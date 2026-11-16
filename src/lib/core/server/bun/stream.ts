import { Stream }   from "stream";
import fsSystem     from "fs";
import pathSystem   from "path";
import mime         from "mime-types";
import crypto       from 'crypto';
import type { T }   from "../../types";

import {
   HEADER_CONTENT_TYPES 
} from "../../const";


export const httpPipeStream = async ({
  req,
  res,
  filePath,
}: {
  req: T.Request;
  res: T.Response;
  filePath: string;
}): Promise<Stream> => {
  if (!fsSystem.existsSync(filePath)) {
    return res
      .writeHead(404, HEADER_CONTENT_TYPES["text"])
      .end(`File not found: ${pathSystem.basename(filePath)}`);
  }

  const stat = fsSystem.statSync(filePath);

  const fileSize = stat.size;

  const range = req.headers["range"] ?? null;

  const contentType = mime.lookup(filePath) || HEADER_CONTENT_TYPES["octet"]["Content-Type"];

  const isVideo = contentType.startsWith("video/");

  const writeHead = (header: Record<string, any>, code = 200) => {
    const extension = filePath.split(".").pop();
    const previews = Object.values({
      video: [
        "mp4",
        "webm",
        "ogg",
        "ogv",
        "avi",
        "mov",
        "mkv",
        "flv",
        "f4v",
        "wmv",
        "ts",
        "mpeg",
      ],
      audio: ["wav", "mp3"],
      document: ["pdf","html"],
      image: ["png", "jpeg", "jpg", "gif", "webp", "svg", "ico"],
    }).flat();

    if (previews.some((p) => extension?.toLocaleLowerCase().includes(p))) {
      res.writeHead(code as T.StatusCode, header);
      return;
    }

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${+new Date()}.${extension}`,
    );
    res.setHeader("Content-Type", HEADER_CONTENT_TYPES["octet"]["Content-Type"]);
  };

  const maxAge = 1000 * 60 * 60 * 24 * 7;

  const etag = crypto
  .createHash("md5")
  .update(`${stat.size}-${stat.mtimeMs}`)
  .digest("hex");

  const baseHeader = {
      "Connection" :"keep-alive",
      "Keep-Alive" :"timeout=60, max=1000",
      "Cache-Control": `public, max-age=${maxAge}, immutable`,
      "Strict-transport-security": `max-age=${maxAge}; includeSubDomains`,
      "ETag": `"${etag}"`,
      "Date" : new Date(stat.birthtimeMs).toUTCString(),
      "Last-modified": new Date(stat.birthtimeMs).toUTCString(),
      "Vary" :"Origin, Accept-Encoding",
      "Accept-Ranges": "bytes",
      "Content-Length": fileSize,
      "Content-Type": contentType,
      "X-Content-type-options": "nosniff",
      "X-Xss-protection": "1; mode=block",
    }

  if (!isVideo || range == null) {
    const header = {
      ...baseHeader,
      "Content-Length": fileSize,
      "Content-Type": contentType,
    };

    const stream = fsSystem.createReadStream(filePath);

    writeHead(header);

    stream.on("error", () => res.http.end());

    return stream.pipe(res.http);
  }

  const parts = range.replace(/bytes=/, "").split("-");
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

  const chunksize = end - start + 1;

  const stream = fsSystem.createReadStream(filePath, { start, end });

  const header = {
    ...baseHeader,
    "Content-Range": `bytes ${start}-${end}/${fileSize}`,
    "Content-Length": chunksize,
    "Accept-Ranges": "bytes"
  };

  writeHead(header, 206);

  stream.on("error", () => res.http.end());

  return stream.pipe(res.http);
};
