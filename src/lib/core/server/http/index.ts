import { Readable }      from "stream";
import fsSystem          from "fs";
import pathSystem        from "path";
import mime              from "mime-types";
import crypto            from "crypto";
import { StringDecoder } from "string_decoder";

import type { 
  IncomingMessage, 
  ServerResponse 
} from "http";

import busboy, { 
  FileInfo 
} from "busboy";

import type { T }               from "../../types";
import { normalizeRequestBody } from "../../utils";

export const httpAdaptRequestResponse = (
  req: IncomingMessage,
  res: ServerResponse
) => {

  const headers: Record<string, any> = req.headers || {};

  const request = {
    http: req,
    method: req.method?.toUpperCase() || "GET",
    url: req.url || "/",
    headers,
    on(event: string, cb: any) {
      return req.on(event,cb)
    },
    pipe(cb:any) {
      return req.pipe(cb)
    }
  };

  const response = {
    http: res,
    writableEnded: false,
    aborted: false,
    writeHeaders: Object.create(null),
    headersSent: false,
    statusCode: 200,
    setHeader(key: string, value: string) {
      if (!response.headersSent && !response.writableEnded) {
        res.setHeader(key, value);
      }
      return response;
    },
    writeHeader(key: string, value: string) {

      return response.setHeader(key, value);

    },
    writeHead(status: number, context: Record<string, string>) {

      response.statusCode = status;



      if (!response.headersSent) {

        res.writeHead(status, context);

        response.headersSent = true;

      }



      return response;

    },
    writeStatus(status: number) {

      response.statusCode = status;



      if (!response.headersSent) {

        res.statusCode = status;

      }



      return response;

    },
    end(chunk?: unknown) {
      
      if (response.writableEnded) return;

      if (chunk == null) {
        res.end();
        return;
      }

      response.writableEnded = true;

      if (!response.headersSent) {
        res.statusCode = response.statusCode;
      }

      if (
        typeof chunk === 'string' ||
        Buffer.isBuffer(chunk) ||
        chunk instanceof Uint8Array
      ) {
        res.end(chunk);
        return;
      }

      res.end(JSON.stringify(chunk));

      return;

    },
  };
  return {
    req: request,
    res: response,
  } as unknown as {
    req: T.Request;
    res: T.Response;
  };

};

export const httpBody = (req: T.Request, res: T.Response) => {
  return new Promise((resolve, reject) => {
    const decoder = new StringDecoder("utf-8");
    let payload = "";

    req.on("data", (data: Buffer) => {
      payload += decoder.write(data);
    });

    req.on("end", async () => {
      payload += decoder.end();

      const contentType = req.headers["content-type"]?.toLowerCase() || null;

      try {
        const body = await normalizeRequestBody({ contentType, payload });

        return resolve(body);
      } catch (err) {
        return reject(err);
      }
    });

    req.on("error", (err: any) => {
      return reject(err);
    });
  });
};

export const httpfiles = async ({
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
    } catch (err) {}
  }
  
  return new Promise<{ body: T.Body; files: T.FileUpload }>(
    (resolve, reject) => {
      const body: Record<string, any> = {};
      const files: Record<string, any> = {};

      const fileWritePromises: any[] = [];

      const bb = busboy({ headers: req.headers, defParamCharset: "utf8" });

      const removeTemp = (fileTemp: string, ms: number) => {
        const remove = () => {
          try {
            fsSystem.unlinkSync(fileTemp);
          } catch (err) {}
        };
        setTimeout(remove, ms);
      };

      bb.on(
        "file",
        (fieldName: string, fileData: Readable, info: FileInfo) => {
          const { filename, mimeType } = info;

          const extension =
            mime.extension(mimeType) ||
            pathSystem.extname(filename).replace(".", "") ||
            "bin";

          const tempFilename = crypto.randomBytes(16).toString("hex");

          const filePath = pathSystem.join(
            pathSystem.resolve(),
            `${temp}/${tempFilename}`,
          );

          const writeStream = fsSystem.createWriteStream(filePath);

          let fileSize = 0;

          fileData.on("data", (data: string) => {
            fileSize += data.length;

            if (fileSize > options.limit) {
              fileData.unpipe(writeStream);

              writeStream.destroy();

              return reject(
                new Error(
                  `The file '${fieldName}' is too large to be uploaded. The limit is '${options.limit}' bytes.`,
                ),
              );
            }
          });

          const fileWritePromise = new Promise((resolve, reject) => {
            fileData.pipe(writeStream);

            writeStream.on("finish", () => {
              const file = {
                name: filename,
                tempFilePath: filePath,
                tempFileName: tempFilename,
                mimetype: mimeType,
                extension: extension,
                size: fileSize,
                sizes: {
                  bytes: fileSize,
                  kb: fileSize / 1024,
                  mb: fileSize / 1024 / 1024,
                  gb: fileSize / 1024 / 1024 / 1024,
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

              if (files[fieldName] == null) {
                files[fieldName] = [];
              }

              files[fieldName].push(file);

              if (options.removeTempFile.remove) {
                removeTemp(filePath, options.removeTempFile.ms);
              }

              return resolve(null);
            });

            writeStream.on("error", reject);
          });

          fileWritePromises.push(fileWritePromise);
        },
      );

      bb.on("field", (name: string, value: string) => {
        body[name] = value;
      });

      bb.on("finish", () => {
        Promise.all(fileWritePromises)
          .then(() => {
            return resolve({
              files,
              body,
            });
          })
          .catch((err) => {
            return reject(err);
          });
      });

      bb.on("error", (err: any) => {
        return reject(err);
      });

      req.pipe(bb);
    },
  );
};
