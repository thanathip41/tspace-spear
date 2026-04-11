import { IncomingMessage, ServerResponse } from "http";

import { HEADER_CONTENT_TYPES } from "../const";

import { uWSPipeStream } from "../server/uWS";

import querystring  from "querystring";
import { Stream }   from "stream";
import fsSystem     from "fs";
import pathSystem   from "path";
import mime         from "mime-types";
import xml2js       from "xml2js";
import Crypto       from 'crypto';

export const normalizeRequestBody = async ({
  contentType,
  payload,
}: {
  contentType: string | null;
  payload: any;
}) => {
  if (contentType == null || payload == null || payload === "") {
    return {};
  }

  if (contentType.includes("x-www-form-urlencoded")) {
    return querystring.parse(payload);
  }

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(payload);
    } catch (err) {
      throw new Error("Invalid JSON format in request body.");
    }
  }

  if (
    contentType.includes("application/xml") ||
    contentType.includes("text/xml")
  ) {
    try {
      const result = await xml2js.parseStringPromise(payload, {
        explicitArray: false,
      });
      return result;
    } catch (err) {
      throw new Error("Invalid XML format in request body.");
    }
  }

  if (
    contentType.includes("text/plain") ||
    contentType.includes("text/javascript") ||
    contentType.includes("application/javascript") ||
    contentType.includes("application/x-javascript")
  ) {
    return { contentType, text: payload };
  }

  return {};
};

export const pipeStream = async ({
  req,
  res,
  filePath,
  isUwebSocket,
}: {
  req: IncomingMessage;
  res: ServerResponse;
  filePath: string;
  isUwebSocket?: boolean;
}): Promise<Stream> => {
  if (!fsSystem.existsSync(filePath)) {
    return res
      .writeHead(404, HEADER_CONTENT_TYPES["text"])
      .end(`File not found: ${pathSystem.basename(filePath)}`);
  }

  if (isUwebSocket) {
    return uWSPipeStream({ req, res, filePath });
  }
  
  const stat = fsSystem.statSync(filePath);

  const fileSize = stat.size;

  const range = req.headers["range"] ?? null;

  const contentType = mime.lookup(filePath) || "application/octet-stream";

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
      document: ["pdf"],
      image: ["png", "jpeg", "jpg", "gif", "webp", "svg", "ico"],
    }).flat();

    if (previews.some((p) => extension?.toLocaleLowerCase().includes(p))) {
      res.writeHead(code, header);
      return;
    }

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${+new Date()}.${extension}`,
    );
    res.setHeader("Content-Type", "application/octet-stream");
  };

  const maxAge = 1000 * 60 * 60 * 24 * 7;
  const etag = Crypto.createHash("md5").update(`${stat.size}-${stat.mtimeMs}`).digest("hex");

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

    stream.on("error", () => res.end());

    return stream.pipe(res);
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

  stream.on("error", () => res.end());

  return stream.pipe(res);
};
