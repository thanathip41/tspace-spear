import { T } from "../../types";
import { bunAdaptRequestResponse } from "./context";

export const bunServer = ({
    bun ,
    lookup,
    cors,
    ws,
}: {
  bun : typeof Bun;
  lookup: Function;
  cors?: (req: T.Request, res: T.Response) => void;
  ws: T.WS;
}) => {

    let instance: ReturnType<typeof Bun.serve> | undefined;

    const fetch = (bunReq: Request) => {
        const { req, res } = bunAdaptRequestResponse(bunReq) as any;

        if (cors) cors(req, res);

        lookup(req, res);

        return res._toResponse();
    };

  const websocket = {
    open(socket: any) {
      ws?.handler?.connection?.(socket);
    },

    message(socket: any, message: string | Buffer) {
      ws?.handler?.message?.(socket, Buffer.from(message));
    },

    close(socket: any, code: number, reason: string) {
      ws?.handler?.close?.(socket, code, Buffer.from(reason));
    },
  };

  return {

    get instance() {
      return instance as any;
    },

    listen(
      port: number,
      hostname?: string,
      callback?: (args: { port: number }) => void,
    ) {
      
      if (ws?.handler) {
        instance = Bun.serve({
          port,
          hostname,
          fetch,
          websocket,
        });
        
        ws.server = instance as any;

        callback?.({ port: instance.port! });

        return instance;
      } 
        
      instance = Bun.serve({
        port,
        hostname : undefined,
        fetch,
      });
     
      callback?.({ port: instance.port! });

      return instance;
    },

    close() {
      instance?.stop();
      instance = undefined;
    },
  };
};