import { 
  IncomingMessage, 
  ServerResponse 
} from "http";

import { Stream }   from "stream";
import fsSystem     from "fs";
import pathSystem   from "path";
import mime         from "mime-types";
import crypto       from "crypto";
import type { T }   from "../../types";

import { HTTP_STATUS_MESSAGES } from "../../const";
import { normalizeRequestBody } from "../../utils";


export const uWSAdaptRequestResponse = (uwsReq: any, uwsRes: any) => {
  const headers: Record<string, any> = {};

  uwsReq.forEach((key: string, value: any) => {
    headers[key.toLowerCase()] = value;
  });

  const req: Record<string, any> = {
    uWS: uwsReq,
    method: String(uwsReq.getMethod()).toUpperCase(),
    url: uwsReq.getUrl() + (uwsReq.getQuery() ? `?${uwsReq.getQuery()}` : ""),
    headers: headers,
  };

  const _writeHead = (status: number, context: Record<string, any>) => {
    const statusMessage =
      HTTP_STATUS_MESSAGES[status as keyof typeof HTTP_STATUS_MESSAGES] ||
      HTTP_STATUS_MESSAGES[500];

    res.uWS.writeStatus(`${status} ${statusMessage}`);

    res.uWS.writeHeader(Object.keys(context)[0], Object.values(context)[0]);

    return res;
  };

  const res = {
    writeHeader: (key: string, value: string) => {
      if (!res.aborted) {
        uwsRes.writeHeader(key, value);
      }
      return res;
    },
    setHeader: (key: string, value: string) => {
      if (!res.aborted) {
        uwsRes.writeHeader(key, value);
      }
      return res;
    },
    writeHead(status: number, context: Record<string, string>) {
      res.writeHeaders = {
        ...res.writeHeaders,
        [status]: context,
      };

      res.headersSent = true;

      res.statusCode = status;

      return res;
    },
    writeStatus: (status: string) => {
      if (!res.aborted) {
        res.uWS.writeStatus(status as any);
      }
      return res;
    },
    end: (str: string) => {
      if (res.aborted) {
        return;
      }

      if (str === undefined) {
        return;
      }

      uwsRes.cork(() => {
        if (!res.aborted) {
          res.aborted = true;
          res.writableEnded = true;

          for (const h in res.writeHeaders) {
            _writeHead(+h, res.writeHeaders[h]);
          }

          uwsRes.end(str);

          return;
        }
      });
    },
    writableEnded: false,
    aborted: false,
    writeHeaders: Object.create(null),
    headersSent: false,
    statusCode: 200,
    uWS: uwsRes,
  };

  uwsRes.onAborted(() => {
    res.aborted = true;
  });

  return { req, res } as unknown as { req: T.Request; res: T.Response };
};
export const uWSBody = (req: T.Request, res: T.Response & { uWS: any }) => {
  return new Promise((resolve, reject) => {
    let buffer: Buffer[] = [];

    res.uWS.onAborted(() => {
      reject(new Error("Request aborted"));
    });

    res.uWS.onData(async (chunk: ArrayBuffer, isLast: boolean) => {
      buffer.push(Buffer.from(chunk));

      if (!isLast) return;

      const payload = Buffer.concat(buffer as any).toString("utf-8");

      const contentType = req.headers["content-type"]?.toLowerCase() ?? null;

      try {
        const body = await normalizeRequestBody({ contentType, payload });

        return resolve(body);
      } catch (err) {
        return reject(err);
      }
    });
  });
};
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

        aborted = true;

        try {
          currentFileStream?.destroy();
        } catch {}
        try {
          file?.tempFilePath && fsSystem.unlinkSync(file.tempFilePath);
        } catch {}

        try {
          res.uWS.close();
        } catch {}

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
                  return fail(
                    new Error(`File too large (limit ${options.limit} bytes)`),
                  );
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

            if (file.size > options.limit) {
              return fail(
                new Error(`File too large (limit ${options.limit} bytes)`),
              );
            }

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

export const uWSPipeStream = async ({
  req,
  res,
  filePath
}: {
  req: IncomingMessage;
  res: ServerResponse;
  filePath: string;
}): Promise<Stream> => {

  //@ts-ignore
  const uwsRes = res.uWS;

  const stat = fsSystem.statSync(filePath);

  const fileSize = stat.size;

  const range = req.headers["range"] ?? null;

  const contentType = mime.lookup(filePath) || "application/octet-stream";

  const isVideo = contentType.startsWith("video/");

  //@ts-ignore
  let aborted = res.aborted || false;
  let stream: fsSystem.ReadStream;
  let start = 0;
  let end = fileSize - 1;

  uwsRes.onAborted(() => {
    aborted = true;
    if (stream) stream.destroy();
  });

  if (range && isVideo) {
    const parts = range.replace(/bytes=/, "").split("-");
    start = parseInt(parts[0], 10);
    end = parts[1] ? parseInt(parts[1], 10) : end;

    uwsRes.writeStatus("206 Partial Content");
    uwsRes.writeHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
  } else {
    uwsRes.writeStatus("200 OK");
  }

  const chunkSize = end - start + 1;

  uwsRes.writeHeader("Content-Type", contentType);
  uwsRes.writeHeader("Accept-Ranges", "bytes");
  uwsRes.writeHeader("Content-Length", chunkSize.toString());

  stream = fsSystem.createReadStream(filePath, { start, end });

  stream.pause();

  stream.on("data", (chunk) => {
    if (aborted) return;
    const ok = uwsRes.cork(() => uwsRes.write(chunk));

    if (!ok) stream.pause();
  });

  uwsRes.onWritable(() => {
    if (aborted) return false;
    stream.resume();
    return true;
  });

  stream.on("end", () => {
    if (!aborted) {
      uwsRes.cork(() => {
        uwsRes.end();
      });
    }
  });

  stream.on("error", () => {
    if (!aborted) {
      uwsRes.cork(() => {
        uwsRes.writeStatus("500 Internal Server Error").end();
      });
    }
  });

  stream.resume();

  return stream;
};
