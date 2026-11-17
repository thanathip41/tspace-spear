import fs from "fs";
import mime from "mime-types";
import type { T } from "../../types";

export const bunPipeStream = async ({
  req,
  res,
  filePath
}: {
  req: T.Request;
  res: T.Response;
  filePath: string;
}): Promise<fs.ReadStream> => {

  const stat = fs.statSync(filePath);

  const fileSize = stat.size;

  const range = req.headers["range"] ?? null;

  const contentType = mime.lookup(filePath) || "application/octet-stream";

  const isVideo = contentType.startsWith("video/");

  let start = 0;
  let end = fileSize - 1;

  if (range && isVideo) {
    const parts = range.replace(/bytes=/, "").split("-");

    start = parseInt(parts[0], 10);
    end = parts[1] ? parseInt(parts[1], 10) : end;

    res.setStatusCode(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
  }

  const chunkSize = end - start + 1;

  res.setHeader("Content-Type", contentType);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Length", chunkSize.toString());

  const stream = fs.createReadStream(filePath, { start, end });

  return stream;
};