import fsSystem   from 'fs';
import mime       from 'mime-types';

export const netPipeStream = async ({
  req,
  socket,
  filePath
}: {
  req: any; 
  socket: any;
  filePath: string;
}) => {
  const stat = fsSystem.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers["range"] ?? null;
  const contentType = mime.lookup(filePath) || "application/octet-stream";
  const isVideo = contentType.startsWith("video/");

  let start = 0;
  let end = fileSize - 1;
  let statusCode = "200 OK";
  let headers: string[] = [];

  if (range && isVideo) {
    const parts = range.replace(/bytes=/, "").split("-");
    start = parseInt(parts[0], 10);
    end = parts[1] ? parseInt(parts[1], 10) : end;
    statusCode = "206 Partial Content";
    headers.push(`Content-Range: bytes ${start}-${end}/${fileSize}`);
  }

  const chunkSize = end - start + 1;

  headers.push(`Content-Type: ${contentType}`);
  headers.push(`Accept-Ranges: bytes`);
  headers.push(`Content-Length: ${chunkSize}`);
  headers.push(`Connection: keep-alive`);

  socket.write(`HTTP/1.1 ${statusCode}\r\n${headers.join('\r\n')}\r\n\r\n`);

  const stream = fsSystem.createReadStream(filePath, { start, end });

  stream.on("data", (chunk) => {
    const canWrite = socket.write(chunk);
    if (!canWrite) {
      stream.pause();
    }
  });

  socket.on("drain", () => {
    stream.resume();
  });

  stream.on("end", () => {
    socket.end(); 
  });

  stream.on("error", (err) => {
    console.error("Stream Error:", err);
    socket.destroy();
  });

  socket.on("close", () => {
    stream.destroy();
  });

  return stream;
};