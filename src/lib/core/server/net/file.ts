import fsSystem   from 'fs';
import pathSystem from 'path';
import crypto     from 'crypto';
import mime       from 'mime-types';
import type { T } from '../../types';

import { 
    PayloadTooLargeException 
} from "../../exception";

export const netFiles = async ({
  req,
  res,
  options,
}: {
  req: T.Request;
  res: T.Response;
  options: {
    limit: number;
    tempFileDir: string;
    removeTempFile: {
      remove: boolean;
      ms: number;
    };
  };
}) => {
    
  const { socket } = req;
  const temp = options.tempFileDir;

  if (!fsSystem.existsSync(temp)) {
    fsSystem.mkdirSync(temp, { recursive: true });
  }

  const contentType = req.headers["content-type"] ?? "";
  const boundary = contentType.split("boundary=")[1];
  
  if (!boundary) throw new Error("Invalid multipart/form-data (no boundary)");

  const boundaryBuf = Buffer.from(`--${boundary}`);

  return new Promise<{ body: any; files: any }>((resolve, reject) => {
    
    if (req._bodyRead) return reject(new Error("Body already consumed"));

    req._bodyRead = true;
  
    let body: Record<string, any> = {};
    let files: Record<string, any> = {};
    let buffer: Buffer = req._body || Buffer.alloc(0);
    
    let currentFileStream: fsSystem.WriteStream | null = null;
    let file: any = null;
    let headerParsed = false;
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    let totalBytesReceived = buffer.length;

    const onData = (chunk: Buffer) => {
      if (chunk.length > 0) {
        buffer = Buffer.concat([buffer, chunk]);
        totalBytesReceived += chunk.length;
      }
      
      try {

        while (true) {

          if (!headerParsed) {
            
            const headerEnd = buffer.indexOf("\r\n\r\n");
            if (headerEnd === -1) break;

          
            const header = buffer.subarray(0, headerEnd).toString();
            buffer = buffer.subarray(headerEnd + 4);

            const disposition = header.match(/name="([^"]+)"(?:; filename="([^"]+)")?/);
            if (!disposition) continue;

            const fieldName = disposition[1];
            const fileName = disposition[2];

            if (!fileName) {
              const nextBoundary = buffer.indexOf(boundaryBuf);
              if (nextBoundary === -1) break;

              body[fieldName] = buffer.subarray(0, nextBoundary).toString().trim();
              buffer = buffer.subarray(nextBoundary);
              continue;
            }

            const contentTypeMatch = header.match(/Content-Type: ([^\r\n]+)/);

            const mimetype = contentTypeMatch
                ? contentTypeMatch[1]
                : "application/octet-stream";

            const extension = mime.extension(mimetype) ||
              pathSystem.extname(fileName).replace(".", "") ||
              "bin";

            const tempFilename = crypto.randomBytes(16).toString("hex");

            const filePath = pathSystem.join(pathSystem.resolve(), temp, tempFilename);

            currentFileStream = fsSystem.createWriteStream(filePath);

            file = {
              name: fileName,
              tempFilePath: filePath,
              tempFileName: tempFilename,
              mimetype: mimetype,
              extension: extension,
              size: 0,
              sizes: {
                bytes: 0,
                kb: 0,
                mb: 0,
                gb: 0,
              },
              write: (to: string) => {
                return new Promise((resolve, reject) => {
                  fsSystem
                    .createReadStream(filePath)
                    .pipe(fsSystem.createWriteStream(to))
                    .on("finish", () => {
                      return resolve(null);
                    })
                    .on("error", (err) => {
                      return reject(err);
                    });
                });
              },
              remove: () => {
                return new Promise((resolve) =>
                  setTimeout(() => {
                    fsSystem.unlinkSync(filePath);
                    return resolve(null);
                  }, 100),
                );
              },
            };

            if (!files[fieldName]) files[fieldName] = [];
            files[fieldName].push(file);
            headerParsed = true;
          }
         
          const boundaryIndex = buffer.indexOf(boundaryBuf);

          if (boundaryIndex === -1) {
         
            const safeLength = buffer.length - (boundaryBuf.length + 4);
            if (safeLength > 0) {
              const writeChunk = buffer.subarray(0, safeLength);
              currentFileStream?.write(writeChunk);
              file.size += writeChunk.length;
              buffer = buffer.subarray(safeLength);
            }
            break; 
          }

          let end = boundaryIndex;

          if (
            end >= 2 &&
            buffer[end - 2] === 0x0d && 
            buffer[end - 1] === 0x0a   
          ) {
            end -= 2;
          }

          const filePart = buffer.subarray(0, end);

          currentFileStream?.write(filePart);

         
          file.size += filePart.length;

          file.sizes = {
            bytes: file.size,
            kb: file.size / 1024,
            mb: file.size / 1024 / 1024,
            gb: file.size / 1024 / 1024 / 1024,
          };
          
          buffer = buffer.subarray(boundaryIndex + boundaryBuf.length);
          headerParsed = false;

          if (file.size > options.limit) {
            const uploadError = new PayloadTooLargeException(
              `The file '${file.name}' is too large. Limit: ${options.limit} bytes.`
            );
            socket.off('data', onData);

            currentFileStream?.end(() => fsSystem.promises.unlink(file.tempFilePath).catch(() => null))
           
            return reject(uploadError);
          }

          currentFileStream?.end();
        }

        if (totalBytesReceived >= contentLength || buffer.toString().includes(boundary + "--")) {
          socket.off('data', onData);
          if (currentFileStream) currentFileStream.end();
          return resolve({ body, files });
        }
      } catch (err) {
        socket.off('data', onData);
        return reject(err);
      }
    };

    socket.on('data', onData);
    socket.on('error', (err:any) => {
      return reject(err)
    });

    if (buffer.length > 0) onData(Buffer.alloc(0));
  });
};