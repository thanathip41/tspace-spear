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
      response.http.statusCode = status;
      return response;
    },

    removeHeader(key:string) {
      response.http.removeHeader(key);
      return;
    },

    setHeader(key: string, value: string) {
      if (!response.writableEnded()) {
        response.http.setHeader(key, value);
      }
      return response;
    },

    writeHead(status: number, context: Record<string, string>) {
      if(response.headersSent()) return response;

      _statusCode = +status;
      _headersSent = true;
      response.http.statusCode = +status;
      response.http.writeHead(+status, context);

      return response;
    },
    end(chunk?: unknown) {
      
      if (response.writableEnded()) return;

      if (chunk == null) {
        response.http.end();
        return;
      }

      _writableEnded = true;

      if (!response.headersSent()) {
        response.http.statusCode = response.statusCode();
      }

      if (
        typeof chunk === 'string' ||
        Buffer.isBuffer(chunk) ||
        chunk instanceof Uint8Array
      ) {
        response.http.end(chunk);
        return;
      }

      response.http.end(JSON.stringify(chunk));
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