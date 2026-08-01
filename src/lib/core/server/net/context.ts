import { Socket } from 'net';
import type { T } from '../../types';

import { 
  HTTP_STATUS_MESSAGES 
} from '../../const';

const createResponseObject = (socket: Socket,method: string) => {

  let _writableEnded = false;
  let _aborted =  false;
  let _writeHeaders = Object.create(null);
  let _headersSent = false;
  let _statusCode = 200;

  const response = {
    net: socket,
    writableEnded: () => _writableEnded,
    aborted: () => _aborted,
    writeHeaders: () => _writeHeaders,
    headersSent: () => _headersSent,
    statusCode: () => _statusCode,

    setStatusCode (status : number) {
      _statusCode = status;
      return response;
    },

    setHeader(key: string, value: string | number) {
      _writeHeaders[key.toLowerCase()] = value;
      return response;
    },

    writeHead(status: number, context?: Record<string, string | number>) {
      _statusCode = status;
      
      if (context) {
        for (const key in context) {
          if(
            method === 'HEAD' && 
            key === 'Content-Type' &&
            context[key] === 'application/json'
          ) {
           
            response.setHeader(key, 'text/plain');
            continue;
          }
          response.setHeader(key, context[key]);
        }
      }
      return response;
    },

    end(chunk?: unknown) {

      if (response.writableEnded()) return;

      response.net.cork();

      if(method === 'HEAD') chunk = '';
      
      const content = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk || ''));

      if (!response.headersSent()) {
        response.setHeader('content-length', content.length);
      }

      const statusMsg = HTTP_STATUS_MESSAGES[response.statusCode() as T.StatusCode] || 'Unknown';

      let head = `HTTP/1.1 ${response.statusCode()} ${statusMsg}\r\n`;
      for (const [key, value] of Object.entries(response.writeHeaders())) {
        head += `${key}: ${value}\r\n`;
      }
      head += '\r\n';

      const fullResponse = Buffer.concat([Buffer.from(head), content]);

      if (response.net.writable && !response.net.destroyed) {
        response.net.write(fullResponse);
      }

      _headersSent = true;
      _writableEnded = true;

      response.net.uncork();

      return;
    },
  };

  return response;
};

const CRLF = '\r\n';
const HEADER_END = '\r\n\r\n';

export const netAdaptRequestResponse = (
  socket: Socket,
  callback: (req: T.Request, res: T.Response) => void
) => {
  socket.setNoDelay(true);
  socket.setTimeout(60000);

  if ((socket as any)._attached) return;

  (socket as any)._attached = true;

  let buf = Buffer.allocUnsafe(64 * 1024);

  let len = 0;
  
  const ensure = (need: number) => {
    if (buf.length >= need) return;
    let cap = buf.length;
    while (cap < need) cap *= 2;
    const next = Buffer.allocUnsafe(cap);
    buf.copy(next, 0, 0, len);
    buf = next;
  };

  socket.on("error", (err: any) => {
   
    if (err.code === "ECONNRESET" || err.code === "ECONNABORTED") {
      return;
    }
    socket.destroy();
  });

  const onData = (chunk: Buffer) => {
    ensure(len + chunk.length);
    chunk.copy(buf, len);
    len += chunk.length;

    while (true) {
      const headerEnd = buf.indexOf(HEADER_END, 0);
      if (headerEnd === -1) break;

      const headerStr = buf.toString("utf8", 0, headerEnd);
      const lines = headerStr.split(CRLF);

      const [method, path] = lines[0].split(" ");

      if (!method || !path) return socket.destroy();

      let headers: any = {};
      let contentLength = 0;
      let keepAlive = true;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const idx = line.indexOf(":");
        if (idx === -1) continue;

        const key = line.slice(0, idx).trim().toLowerCase();
        const val = line.slice(idx + 1).trim();
        headers[key] = val;

        if (key === "content-length") contentLength = parseInt(val) || 0;
        if (key === "connection" && val.toLowerCase() === "close") {
          keepAlive = false;
        }
      }

      const bodyStart = headerEnd + 4;

      const total = bodyStart + contentLength;
      
      if (len < total) break;

      const body = contentLength > 0 ? buf.subarray(bodyStart, total) : null;

      const req = {
        socket,
        method,
        url: path,
        path,
        headers,
        _body: body,
        _bodyRead: false,
      } as unknown as T.Request

      const res = createResponseObject(socket,method) as unknown as T.Response

      callback(req, res);

      const remain = len - total;
      if (remain > 0) {
        buf.copy(buf, 0, total, len);
      }

      len = remain;

      // if (!keepAlive) {
      //   socket.end();
      //   return;
      // }
    }
  };

  socket.on("data", onData);
};