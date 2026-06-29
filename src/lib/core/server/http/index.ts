import type { IncomingMessage, ServerResponse } from "http";

import type { T } from "../../..";

export const httpAdaptRequestResponse = (
  req: IncomingMessage,
  res: ServerResponse
) => {

  const headers: Record<string, any> = req.headers || {};

  const request = {
    // http: req,
    method: req.method?.toUpperCase() || "GET",
    url: req.url || "/",
    headers,
  };

  const response = {
    // http: res,
    statusCode: 200,
    headersSent: false,
    writableEnded: false,
    writeHeaders: {} as Record<string, Record<string, string>>,
    setHeader(key: string, value: string) {

      if (!response.headersSent && !response.writableEnded) {

        res.setHeader(key, value);

      }

      return response;

    },
    writeHeader(key: string, value: string) {

      return response.setHeader(key, value);

    },
    writeHead(status: number, context: Record<string, string>) {

      response.statusCode = status;



      if (!response.headersSent) {

        res.writeHead(status, context);

        response.headersSent = true;

      }



      return response;

    },
    writeStatus(status: number) {

      response.statusCode = status;



      if (!response.headersSent) {

        res.statusCode = status;

      }



      return response;

    },
    end(body?: any) {

      if (response.writableEnded) return response;



      response.writableEnded = true;



      if (!response.headersSent) {

        res.statusCode = response.statusCode;

      }



      res.end(body);

      return response;

    },
  };
  return {
    req: request,
    res: response,
  } as unknown as {
    req: T.Request;
    res: T.Response;
  };

};