
import fs from "fs";
import path from "path";
import mime from "mime-types";
import crypto from "crypto";

import type { T } from "../../types";
import { PayloadTooLargeException } from "../../exception";

export const bunfiles = async ({
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
  const temp = path.resolve(options.tempFileDir);

  await fs.promises.mkdir(temp, { recursive: true });

  const body: Record<string, any> = {};
  const files: Record<string, any> = {};

  const formData = await req.bun.formData();

  const removeTemp = (filePath: string, ms: number) => {
    setTimeout(() => {
      fs.promises.unlink(filePath).catch(() => {});
    }, ms);
  };

  for (const [fieldName, value] of formData.entries()) {
    if (!(value instanceof File)) {
      body[fieldName] = value;
      continue;
    }

    if (value.size > options.limit) {
      throw new PayloadTooLargeException(
        `The file '${fieldName}' is too large. Limit: ${options.limit} bytes.`
      );
    }

    const filename = value.name;

    const extension =
      mime.extension(value.type) ||
      path.extname(filename).replace(".", "") ||
      "bin";

    const tempFilename = crypto.randomBytes(16).toString("hex");

    const filePath = path.join(temp, tempFilename);

    const buffer = Buffer.from(await value.arrayBuffer());

    await fs.promises.writeFile(filePath, buffer);

    const fileSize = value.size;

    const file = {
      name: filename,
      tempFilePath: filePath,
      tempFileName: tempFilename,
      mimetype: value.type,
      extension,
      size: fileSize,
      sizes: {
        bytes: fileSize,
        kb: fileSize / 1024,
        mb: fileSize / 1024 / 1024,
        gb: fileSize / 1024 / 1024 / 1024,
      },
      write: (to: string) =>
        new Promise<void>((resolve, reject) => {
          fs.createReadStream(filePath)
            .pipe(fs.createWriteStream(to))
            .on("finish", resolve)
            .on("error", reject);
        }),
      remove: async () => {
        await fs.promises.unlink(filePath).catch(() => {});
        return null;
      },
    };

    if (!files[fieldName]) {
      files[fieldName] = [];
    }

    files[fieldName].push(file);

    if (options.removeTempFile.remove) {
      removeTemp(filePath, options.removeTempFile.ms);
    }
  }

  return {
    body,
    files,
  };
};
