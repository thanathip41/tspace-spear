import { T , UWS } from "../../types";
import { uWSAdaptRequestResponse } from './context';

export const uWSServer = ({
  uWS,
  ws,
  lookup,
  cors
} : {
  uWS     : UWS;
  ws      : T.WS;
  lookup  : Function;
  cors    ?: ((req : T.Request , res : T.Response) => void);
}) => {

    const server = uWS.App();

    server.any('/*', (uwsRes, uwsReq) => {

        const { req , res } = uWSAdaptRequestResponse(uwsReq, uwsRes);
        
        if(cors) cors(req, res);
        
        return lookup(req, res);
    })

    if (ws?.handler) {
        const wsHandler = ws.handler!;

        ws.server = server.ws('/*', {
            open: (ws) => {
                wsHandler?.connection?.(ws);
            },

            message: (wss, message) => {
                wsHandler?.message?.(wss, Buffer.from(message));
            },

            close: (wss, code, message) => {
                wsHandler?.close?.(wss, code, Buffer.from(message));
            },
        });
    }

    return server

}