
import pathSystem from "path";
import mime from "mime-types";
import crypto from "crypto";

import type { T } from "../../types";

import {
  HEADER_CONTENT_TYPES
} from "../../const";

export const bunPipeStream = async ({
  req,
  res,
  filePath,
}: {
  req: T.Request;
  res: T.Response;
  filePath: string;
}): Promise<void> => {

  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    res
      .writeHead(404, HEADER_CONTENT_TYPES["text"])
      .end(`File not found: ${pathSystem.basename(filePath)}`);

    return;
  }

  const stat = await file.stat();

  const fileSize = stat.size;
  const range = req.headers["range"] ?? null;

  const contentType =
    mime.lookup(filePath) ||
    HEADER_CONTENT_TYPES["octet"]["Content-Type"];

  const isVideo = contentType.startsWith("video/");

  const extension = pathSystem.extname(filePath).slice(1).toLowerCase();

  const previews = new Set([
    "mp4", "webm", "ogg", "ogv", "avi", "mov",
    "mkv", "flv", "f4v", "wmv", "ts", "mpeg",
    "wav", "mp3", "pdf", "html", "png", "jpeg",
    "jpg", "gif", "webp", "svg", "ico",
  ]);

  const headers: Record<string, any> = {
    "Connection": "keep-alive",
    "Keep-Alive": "timeout=60, max=1000",
    "Cache-Control": "public, max-age=604800, immutable",
    "Strict-Transport-Security": "max-age=604800; includeSubDomains",
    "ETag": `"${crypto
      .createHash("md5")
      .update(`${fileSize}-${stat.mtime}`)
      .digest("hex")}"`,
    "Date": new Date().toUTCString(),
    "Last-Modified": new Date(stat.mtime).toUTCString(),
    "Vary": "Origin, Accept-Encoding",
    "Accept-Ranges": "bytes",
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
    "X-XSS-Protection": "1; mode=block",
  };

  const writeHead = (code = 200, extraHeaders: Record<string, any> = {}) => {

    if (!previews.has(extension)) {
      headers["Content-Disposition"] =
        `attachment; filename="${Date.now()}.${extension || "bin"}`;

      headers["Content-Type"] =
        HEADER_CONTENT_TYPES["octet"]["Content-Type"];
    }

    res.writeHead(code as T.StatusCode, {
      ...headers,
      ...extraHeaders,
    });
  };

  // Full file response
  if (!isVideo || !range) {

    writeHead(200, {
      "Content-Length": String(fileSize),
    });

    res.end(file);

    return;
  }

  // Video range response
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);

  if (!match || (!match[1] && !match[2])) {
    res.writeHead(416, {
      ...headers,
      "Content-Range": `bytes */${fileSize}`,
    }).end();

    return;
  }

  let start: number;
  let end: number;

  if (!match[1]) {
    const suffixLength = Number(match[2]);

    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : fileSize - 1;
  }

  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start >= fileSize ||
    end < start
  ) {
    res.writeHead(416, {
      ...headers,
      "Content-Range": `bytes */${fileSize}`,
    }).end();

    return;
  }

  end = Math.min(end, fileSize - 1);

  const chunkSize = end - start + 1;

  writeHead(206, {
    "Content-Range": `bytes ${start}-${end}/${fileSize}`,
    "Content-Length": String(chunkSize),
  });

  // Blob.slice uses an exclusive end offset.
  res.end(file.slice(start, end + 1));
};
