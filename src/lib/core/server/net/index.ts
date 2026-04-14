import fsSystem from 'fs';
import pathSystem from 'path';
import crypto from 'crypto';
import mime from 'mime-types';
import { HTTP_STATUS_MESSAGES } from '../../const';
import { Socket } from 'net';

const createResponseObject = (socket: any) => {
  const res = {
    socket,
    statusCode: 200,
    headersSent: false,
    writableEnded: false,
    aborted: false,
    writeHeaders: {
      'content-type': 'text/plain',
      'connection': 'keep-alive'
    } as Record<string, string | number>,

    writeHead(status: number, context?: Record<string, string | number>) {
      this.statusCode = status;
      if (context) {
        for (const key in context) this.setHeader(key, context[key]);
      }
      return this;
    },

    status(code: number) {
      this.statusCode = code;
      return this;
    },

    setHeader(key: string, value: string | number) {
      this.writeHeaders[key.toLowerCase()] = value;
      return this;
    },

    json(data: any) {
      this.setHeader('content-type', 'application/json');
      return this.send(JSON.stringify(data));
    },

    end(body: any = '') {
      if (this.writableEnded) return this;
      socket.cork();
      const content = Buffer.isBuffer(body) ? body : Buffer.from(String(body || ''));

      if (!this.headersSent) {
        this.setHeader('content-length', content.length);
      }

      //@ts-ignore
      const statusMsg = HTTP_STATUS_MESSAGES[this.statusCode] || 'Unknown';

      let head = `HTTP/1.1 ${this.statusCode} ${statusMsg}\r\n`;
      for (const [key, value] of Object.entries(this.writeHeaders)) {
        head += `${key}: ${value}\r\n`;
      }
      head += '\r\n';

      const fullResponse = Buffer.concat([Buffer.from(head), content]);

      if (socket.writable && !socket.destroyed) {
        socket.write(fullResponse);
      }

      this.headersSent = true;
      this.writableEnded = true;

      socket.uncork();
      return;
    },

    send(body?: any) {
      return this.end(body);
    }
  };

  return res;
};

const CRLF = '\r\n';
const HEADER_END = '\r\n\r\n';


export const netAdaptRequestResponse = (
  socket: Socket,
  callback: (req: any, res: any) => void
) => {
  socket.setNoDelay(true);
  socket.setTimeout(60000);

  if ((socket as any)._attached) return;

  (socket as any)._attached = true;

  let buf = Buffer.allocUnsafe(64 * 1024);

  let len = 0;
  
  const ensure = (need: number) => {
    if (buf.length >= need) return;
    let cap = buf.length;
    while (cap < need) cap *= 2;
    const next = Buffer.allocUnsafe(cap);
    buf.copy(next, 0, 0, len);
    buf = next;
  };

  socket.on("error", (err: any) => {
    if (err.code === "ECONNRESET" || err.code === "ECONNABORTED") {
      return;
    }
    console.error("socket error:", err);
    socket.destroy();
  });

  const onData = (chunk: Buffer) => {
    ensure(len + chunk.length);
    chunk.copy(buf, len);
    len += chunk.length;

    while (true) {
      const headerEnd = buf.indexOf(HEADER_END, 0);
      if (headerEnd === -1) break;

      const headerStr = buf.toString("utf8", 0, headerEnd);
      const lines = headerStr.split(CRLF);

      const [method, path] = lines[0].split(" ");

      if (!method || !path) return socket.destroy();

      let headers: any = {};
      let contentLength = 0;
      let keepAlive = true;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const idx = line.indexOf(":");
        if (idx === -1) continue;

        const key = line.slice(0, idx).trim().toLowerCase();
        const val = line.slice(idx + 1).trim();
        headers[key] = val;

        if (key === "content-length") contentLength = parseInt(val) || 0;
        if (key === "connection" && val.toLowerCase() === "close") {
          keepAlive = false;
        }
      }

      const bodyStart = headerEnd + 4;

      const total = bodyStart + contentLength;
      
      if (len < total) break;

      const body = contentLength > 0 ? buf.subarray(bodyStart, total) : null;

      const req = {
        socket,
        method,
        url: path,
        path,
        headers,
        _body: body,
        _bodyRead: false,
      };

      const res = createResponseObject(socket);

      callback(req, res);

      const remain = len - total;
      if (remain > 0) {
        buf.copy(buf, 0, total, len);
      }

      len = remain;

      if (!keepAlive) {
        socket.end();
        return;
      }
    }
  };

  socket.on("data", onData);
};

export const netBody = (req: any): Promise<any> => {
  return new Promise((resolve, reject) => {
  
    if (req._bodyRead) return reject(new Error("Body already consumed"));
    req._bodyRead = true;

    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength === 0) return resolve({});

    let buffer = req._body || Buffer.alloc(0);
    const socket = req.socket;

    const onData = (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length >= contentLength) {
        cleanup();
        try {
          const bodyStr = buffer.subarray(0, contentLength).toString('utf8');
          const contentType = req.headers['content-type'] || '';
          
          if (contentType.includes('application/json')) {
            resolve(JSON.parse(bodyStr));
          } else {
            resolve(Object.fromEntries(new URLSearchParams(bodyStr)));
          }
        } catch (e) { reject(e); }
      }
    };

    const cleanup = () => {
      socket.off('data', onData);
      socket.off('error', reject);
    };

    if (buffer.length >= contentLength) return onData(Buffer.alloc(0));
    
    socket.on('data', onData);
    socket.on('error', reject);
  });
};

export const netFiles = async (req: any, options: {
    limit: number;
    tempFileDir: string;
    removeTempFile: {
      remove: boolean;
      ms: number;
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
      // let buffer: Buffer = Buffer.alloc(0);
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
      // console.log('onData loading');
      // const data: Buffer = Buffer.from(new Uint8Array(chunk));

      // buffer = buffer.length === 0 ? data : Buffer.concat([buffer, data]);
 
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

          const filePart = buffer.subarray(0, boundaryIndex);

          currentFileStream?.write(filePart);
          file.size += filePart.length;

          currentFileStream?.end();

          file.sizes = {
            bytes: file.size,
            kb: file.size / 1024,
            mb: file.size / 1024 / 1024,
            gb: file.size / 1024 / 1024 / 1024,
          };
          
          buffer = buffer.subarray(boundaryIndex + boundaryBuf.length);
          headerParsed = false;
        }

        if (totalBytesReceived >= contentLength || buffer.toString().includes(boundary + "--")) {
          socket.off('data', onData);
          // if (currentFileStream) currentFileStream.end();
          return resolve({ body, files });
        }
      } catch (err) {
        console.log(err)
          socket.off('data', onData);
        return reject(err);
      }
    };

    socket.on('data', onData);
    socket.on('error', (err:any) => {
      console.log(err)
      return reject(err)
    });

    if (buffer.length > 0) onData(Buffer.alloc(0));
  });
};

export const netPipeStream = async ({
  req,
  socket,
  filePath
}: {
  req: any; 
  socket: any;
  filePath: string;
}) => {
  const stat = fsSystem.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers["range"] ?? null;
  const contentType = mime.lookup(filePath) || "application/octet-stream";
  const isVideo = contentType.startsWith("video/");

  let start = 0;
  let end = fileSize - 1;
  let statusCode = "200 OK";
  let headers: string[] = [];

  if (range && isVideo) {
    const parts = range.replace(/bytes=/, "").split("-");
    start = parseInt(parts[0], 10);
    end = parts[1] ? parseInt(parts[1], 10) : end;
    statusCode = "206 Partial Content";
    headers.push(`Content-Range: bytes ${start}-${end}/${fileSize}`);
  }

  const chunkSize = end - start + 1;

  headers.push(`Content-Type: ${contentType}`);
  headers.push(`Accept-Ranges: bytes`);
  headers.push(`Content-Length: ${chunkSize}`);
  headers.push(`Connection: keep-alive`);

  socket.write(`HTTP/1.1 ${statusCode}\r\n${headers.join('\r\n')}\r\n\r\n`);

  const stream = fsSystem.createReadStream(filePath, { start, end });

  stream.on("data", (chunk) => {
    const canWrite = socket.write(chunk);
    if (!canWrite) {
      stream.pause();
    }
  });

  socket.on("drain", () => {
    stream.resume();
  });

  stream.on("end", () => {
    socket.end(); 
  });

  stream.on("error", (err) => {
    console.error("Stream Error:", err);
    socket.destroy();
  });

  socket.on("close", () => {
    stream.destroy();
  });

  return stream;
};