import type { 
  IncomingMessage, 
  ServerResponse 
} from "http";

import type { T }               from "../../types";

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

  let _writableEnded = false;
  let _aborted =  false;
  let _writeHeaders = Object.create(null);
  let _headersSent = false;
  let _statusCode = 200;

  const response = {
    http: res,
    writableEnded: () => _writableEnded,
    aborted: () => _aborted,
    writeHeaders: () => _writeHeaders,
    headersSent: () => _headersSent,
    statusCode: () => _statusCode,

    setStatusCode (status : number) {
      _statusCode = status;
      this.http.statusCode = status;
      return this;
    },

    removeHeader(key:string) {
      this.http.removeHeader(key);
      return this;
    },

    setHeader(key: string, value: unknown) {
      
      if(value == null) {
        this.removeHeader(key)
        return this;
      }

      if (Array.isArray(value)) {
        value = value.map(String).join();
      } 

      else if (typeof value !== 'string') {
        value = String(value);
      }

      if (!this.writableEnded()) {
        this.http.setHeader(key, value as string);
      }
      
      return this;
    },

    writeHead(status: number, context: Record<string, string>) {
      if(this.headersSent()) {
        return this;
      }

      if (context) {
          for (const key in context) {
              this.setHeader(key, context[key]);
          }
      }

      _statusCode = +status;
      _headersSent = true;

      this.http.statusCode = +status;
      this.http.writeHead(+status);
      
      return this;
    },

    end(chunk?: unknown) {
      
      if (this.writableEnded()) return;

      if (!this.headersSent()) {
        this.http.statusCode = this.statusCode();
      }

      _writableEnded = true;
      _headersSent = true;
      _aborted = true;

      if (chunk === undefined) {
        this.http.end();
        return;
      }

      if (
        typeof chunk === 'string' ||
        Buffer.isBuffer(chunk) ||
        chunk instanceof Uint8Array
      ) {
        this.http.end(chunk);
        return;
      }

      this.http.end(JSON.stringify(chunk));
      
      return;
    },

    async stream (result: AsyncIterable<unknown>) {

      this.writeHead(200, {
        'Content-Type': 'application/x-ndjson;'
      });
             
      for await (const value of result) {
        const chunk = JSON.stringify(value) + '\n';

        if (!this.http.write(chunk)) {
            await new Promise<void>(resolve => {
              this.http.once('drain', resolve);
            });
        }
      }

      this.end();

      return ;

    },

    redirect(status: number, path: string) {

      this.writeHead(status, {
          Location: path
      });

      this.end();

      return;
    }
  };
  return {
    req: request,
    res: response,
  } as unknown as {
    req: T.Request;
    res: T.Response;
  };

};