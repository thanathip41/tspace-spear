import fsSystem          from "fs";
import pathSystem        from "path";
import mime              from "mime-types";
import crypto            from "crypto";
import { StringDecoder } from "string_decoder";

import type { 
  IncomingMessage, 
  ServerResponse 
} from "http";

import busboy from "busboy";

import type { T }               from "../../types";
import { normalizeRequestBody } from "../../utils";
import { PayloadTooLargeException } from "../../exception";

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
    } catch {}
  }

  return new Promise<{ body: T.Body; files: T.FileUpload }>(
    (resolve, reject) => {
      const body: Record<string, any> = {};
      const files: Record<string, any> = {};

      const fileWritePromises: Promise<any>[] = [];

      let uploadError: Error | null = null;

      const bb = busboy({
        headers: req.headers,
        defParamCharset: "utf8",
        limits: {
          fileSize: options.limit,
        },
      });

      const removeTemp = (fileTemp: string, ms: number) => {
        setTimeout(() => {
          try {
            fsSystem.unlinkSync(fileTemp);
          } catch {}
        }, ms);
      };

      bb.on("file", (fieldName, fileData, info) => {
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
        let exceeded = false;

        fileData.on("data", (chunk: Buffer) => {
          fileSize += chunk.length;
        });

        fileData.on("limit", () => {
          exceeded = true;

          uploadError = new PayloadTooLargeException(
            `The file '${fieldName}' is too large. Limit: ${options.limit} bytes.`
          );

          fileData.unpipe(writeStream);

          writeStream.end();

          fileData.resume();
        });

        const promise = new Promise<void>((resolveFile, rejectFile) => {
          fileData.pipe(writeStream);

          writeStream.on("finish", () => {
            if (!exceeded) {
              const file = {
                name: filename,
                tempFilePath: filePath,
                tempFileName: tempFilename,
                mimetype: mimeType,
                extension,
                size: fileSize,
                sizes: {
                  bytes: fileSize,
                  kb: fileSize / 1024,
                  mb: fileSize / 1024 / 1024,
                  gb: fileSize / 1024 / 1024 / 1024,
                },
                write: (to: string) =>
                  new Promise((resolve, reject) => {
                    fsSystem
                      .createReadStream(filePath)
                      .pipe(fsSystem.createWriteStream(to))
                      .on("finish", resolve)
                      .on("error", reject);
                  }),
                remove: () =>
                  new Promise((resolve) => {
                    try {
                      fsSystem.unlinkSync(filePath);
                    } catch {}
                    resolve(null);
                  }),
              };

              if (!files[fieldName]) {
                files[fieldName] = [];
              }

              files[fieldName].push(file);

              if (options.removeTempFile.remove) {
                removeTemp(filePath, options.removeTempFile.ms);
              }
            } else {
              try {
                fsSystem.unlinkSync(filePath);
              } catch {}
            }

            resolveFile();
          });

          writeStream.on("error", rejectFile);
        });

        fileWritePromises.push(promise);
      });

      bb.on("field", (name, value) => {
        body[name] = value;
      });

      bb.on("finish", async () => {
        try {
          await Promise.all(fileWritePromises);

          if (uploadError) {
            return reject(uploadError);
          }

          return resolve({
            body,
            files,
          });
        } catch (err) {
          return reject(err);
        }
      });

      bb.on("error", (err) => {
        return reject(err);
      });

      req.pipe(bb);
    }
  );
};