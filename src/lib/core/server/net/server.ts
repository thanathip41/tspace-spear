import WebSocket  from 'ws';
import { T } from "../../types";
import { netAdaptRequestResponse } from "./context";

export const netServer = ({
  net,
  ws,
  lookup,
  cors
} : {
  net     : typeof import("net");
  ws      : T.WS;
  lookup  : Function;
  cors    ?: ((req : T.Request , res : T.Response) => void);
}) => {

    if (ws?.handler) {

        const wss = new WebSocket.Server({
            noServer: true,
            ...ws.options,
        });

        const handler = ws.handler!;

        ws.server = wss;

        wss.on('connection', (ws) => {

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
    }

    const server = net.createServer((socket) => {

        netAdaptRequestResponse(socket, (req, res) => {

            const wsServer = ws?.server;
            if (
                wsServer &&
                ws.handler &&
                req.headers?.upgrade?.toLowerCase() === 'websocket'
            ) {
                wsServer.handleUpgrade(
                    req as any,
                    socket,
                    Buffer.alloc(0),
                    (ws) => wsServer.emit('connection', ws, req)
                );
                return;
            }


            if (cors) cors(req, res);

            return lookup(req, res);
        });

    })

    return server;

}