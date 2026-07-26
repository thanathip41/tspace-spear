import fsSystem     from "fs";
import pathSystem   from "path";
import mime         from "mime-types";
import crypto       from "crypto";
import type { T }   from "../../types";

import { PayloadTooLargeException } from "../../exception";

export const uWSfiles = async ({
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
  const temp = options.tempFileDir;

  if (!fsSystem.existsSync(temp)) {
    try {
      fsSystem.mkdirSync(temp, { recursive: true });
    } catch {}
  }

  const removeTemp = (fileTemp: string, ms: number) => {
    const remove = () => {
      try {
        fsSystem.unlinkSync(fileTemp);
      } catch (err) {}
    };
    setTimeout(remove, ms);
  };

  const contentType = req.headers["content-type"] ?? "";
  const boundary = contentType.split("boundary=")[1];

  if (!boundary) {
    throw new Error("Invalid multipart/form-data (no boundary)");
  }

  const boundaryBuf = Buffer.from(`\r\n--${boundary}`);

  return new Promise<{ body: T.Body; files: T.FileUpload }>(
    (resolve, reject) => {
      let body: Record<string, any> = {};

      let files: Record<string, any> = {};

      let buffer: Buffer = Buffer.alloc(0);

      let currentFileStream: fsSystem.WriteStream | null = null;
      let file: any = null;

      let headerParsed = false;
      let aborted = false;

      const fail = (err: Error) => {
        if (aborted) return;

        // aborted = true;

        // try {
        //   currentFileStream?.destroy();
        // } catch {}
        // try {
        //   file?.tempFilePath && fsSystem.unlinkSync(file.tempFilePath);
        // } catch {}

        // try {
        //   res.uWS.close();
        // } catch {}

        return reject(err);
      };

      res.uWS.onData((chunk: ArrayBuffer, isLast: boolean) => {
        if (aborted) return;

        const data: Buffer = Buffer.from(new Uint8Array(chunk));

        buffer = buffer.length === 0 ? data : Buffer.concat([buffer, data]);

        try {
          while (true) {
            if (!headerParsed) {
              const headerEnd = buffer.indexOf("\r\n\r\n");
              if (headerEnd === -1) break;

              const header = buffer.slice(0, headerEnd).toString();
              buffer = buffer.slice(headerEnd + 4);

              const disposition = header.match(
                /name="([^"]+)"(?:; filename="([^"]+)")?/,
              );
              if (!disposition) continue;

              const fieldName = disposition[1];
              const fileName = disposition[2];

              if (!fileName) {
                const nextBoundary = buffer.indexOf(
                  boundaryBuf as unknown as string,
                );

                if (nextBoundary === -1) break;

                const value = buffer.slice(0, nextBoundary).toString().trim();
                body[fieldName] = value;

                buffer = buffer.slice(nextBoundary + boundaryBuf.length);
                continue;
              }

              const contentTypeMatch = header.match(/Content-Type: ([^\r\n]+)/);

              const mimetype = contentTypeMatch
                ? contentTypeMatch[1]
                : "application/octet-stream";

              const extension =
                mime.extension(mimetype) ||
                pathSystem.extname(fileName).replace(".", "") ||
                "bin";

              const tempFilename = crypto.randomBytes(16).toString("hex");

              const filePath = pathSystem.join(
                pathSystem.resolve(),
                `${temp}/${tempFilename}`,
              );

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

              if (options.removeTempFile.remove) {
                removeTemp(filePath, options.removeTempFile.ms);
              }

              headerParsed = true;
            }

            const boundaryIndex = buffer.indexOf(
              boundaryBuf as unknown as string,
            );

            if (boundaryIndex === -1) {
              const safeLength = buffer.length - boundaryBuf.length;

              if (safeLength > 0) {
                const writeChunk = buffer.slice(0, safeLength);

                currentFileStream!.write(writeChunk);
                file.size += writeChunk.length;

                file.sizes = {
                  bytes: file.size,
                  kb: file.size / 1024,
                  mb: file.size / 1024 / 1024,
                  gb: file.size / 1024 / 1024 / 1024,
                };

                if (file.size > options.limit) {
                  const uploadError = new PayloadTooLargeException(
                    `The file '${file.name}' is too large. Limit: ${options.limit} bytes.`
                  );

                  fsSystem.promises.unlink(file.tempFilePath).catch(() => null);
                  
                  return fail(uploadError);
                }

                buffer = buffer.slice(safeLength);
              }

              break;
            }

            const filePart = buffer.slice(0, boundaryIndex);

            currentFileStream!.write(filePart);

            file.size += filePart.length;

            file.sizes = {
              bytes: file.size,
              kb: file.size / 1024,
              mb: file.size / 1024 / 1024,
              gb: file.size / 1024 / 1024 / 1024,
            };

            currentFileStream!.end();

            currentFileStream = null;

            file = null;

            buffer = buffer.slice(boundaryIndex + boundaryBuf.length);

            headerParsed = false;
          }

          if (isLast && !aborted) {
            if (currentFileStream) currentFileStream.end();

            return resolve({ body, files });
          }
        } catch (err: any) {
          return fail(err);
        }
      });
    },
  );
};

