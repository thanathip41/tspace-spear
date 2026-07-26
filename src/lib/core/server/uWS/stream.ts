import { Stream }   from "stream";
import fsSystem     from "fs";
import mime         from "mime-types";
import type { T }   from "../../types";

export const uWSPipeStream = async ({
  req,
  res,
  filePath
}: {
  req: T.Request;
  res: T.Response;
  filePath: string;
}): Promise<Stream> => {

  const uwsRes = res.uWS;

  const stat = fsSystem.statSync(filePath);

  const fileSize = stat.size;

  const range = req.headers["range"] ?? null;

  const contentType = mime.lookup(filePath) || "application/octet-stream";

  const isVideo = contentType.startsWith("video/");

  let aborted = res.aborted() || false;
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