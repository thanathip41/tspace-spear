import WebSocket           from 'ws';
import { IncomingMessage, ServerResponse } from "http";
import { T } from "../../types";

import { httpAdaptRequestResponse } from "./context";

export const httpServer = ({
  http,
  ws,
  lookup,
  cors
} : {
  http    : typeof import("http");
  ws      : T.WS;
  lookup  : Function;
  cors    ?: ((req : T.Request , res : T.Response) => void);
}) => {

    const server = http.createServer((httpReq: IncomingMessage, httpRes: ServerResponse) => {
        const { req , res } = httpAdaptRequestResponse(httpReq, httpRes);
        if (cors) cors(req, res);
        return lookup(req, res);
    })

    if(ws?.handler == null) {
        return server;
    }

    const handler = ws.handler!;

    const wss = new WebSocket.Server({ server , ...ws.options });

    ws.server = wss;

    wss!.on('connection', (ws) => {

        handler?.connection?.(ws);

        ws.on('message', (data) => {
            handler?.message?.(ws, data);
        });

        ws.on('close', (code, reason) => {
            handler?.close?.(ws, code, reason);
        });

        ws.on('error', (err) => {
           handler?.error?.(ws, err);
        });
    });
      
    return server

}