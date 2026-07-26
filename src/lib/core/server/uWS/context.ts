import type { T }   from "../../types";
import { HTTP_STATUS_MESSAGES } from "../../const";

export const uWSAdaptRequestResponse = (uwsReq: any, uwsRes: any) => {
  const headers: Record<string, any> = {};

  uwsReq.forEach((key: string, value: any) => {
    headers[key.toLowerCase()] = value;
  });

  const request: Record<string, any> = {
    uWS: uwsReq,
    method: String(uwsReq.getMethod()).toUpperCase(),
    url: uwsReq.getUrl() + (uwsReq.getQuery() ? `?${uwsReq.getQuery()}` : ""),
    headers: headers,
  };

  let _writableEnded = false;
  let _aborted =  false;
  let _writeHeaders = Object.create(null);
  let _headersSent = false;
  let _statusCode = 200;

  const response = {
    uWS: uwsRes,
    
    writableEnded: () => _writableEnded,
    aborted: () => _aborted,
    writeHeaders: () => _writeHeaders,
    headersSent: () => _headersSent,
    statusCode: () => _statusCode,

    setStatusCode (status : number) {
      _statusCode = status;      
      response.uWS.statusCode = status; 

      return response;
    },

    setHeader: (key: string, value: string) => {
    
      if (!response.aborted()) {
         _writeHeaders = {
          ...response.writeHeaders(),
          [key]: value,
        };
      }
      return response;
    },
    writeHead(status: number, context: Record<string, string>) {

      if(response.writableEnded()) return response;

      _writeHeaders = {
        ...context,
        ...response.writeHeaders() 
      };

      _headersSent = true;

      response.uWS.statusCode = status;
      
      _statusCode = status;

      return response;
    },
    end: (chunk ?: unknown) => {
      if (response.aborted()) {
        return;
      }

      response.setHeader('connection','keep-alive');
      response.setHeader('keep-alive','timeout=5');

      response.uWS.cork(() => {
        if (!response.aborted()) {
          _aborted = true;
          _writableEnded = true;

          const headers = response.writeHeaders();

          const status = response.statusCode();

          const statusMessage =
            HTTP_STATUS_MESSAGES[status as keyof typeof HTTP_STATUS_MESSAGES] ??
            HTTP_STATUS_MESSAGES[500];

          response.uWS.writeStatus(`${status} ${statusMessage}`);

          for (const key in headers) {
            const value = headers[key];
            response.uWS.writeHeader(key, value);
          }

          if (chunk === undefined) {
            response.uWS.end();
            return;
          }

          if (
            typeof chunk === 'string' ||
            Buffer.isBuffer(chunk) ||
            chunk instanceof Uint8Array
          ) {
            response.uWS.end(chunk);
            return;
          }

          response.uWS.end(JSON.stringify(chunk));
          
          return;
        }
      });
    },
  };

  response.uWS.onAborted(() => {
    _aborted = true;
  });

  return { 
    req : request, 
    res: response 
  } as unknown as { req: T.Request; res: T.Response };
};