import { T } from "../../types";
import { bunAdaptRequestResponse } from "./context";

const normalizeBody = (chunk: unknown): BodyInit | null => {
    if (chunk == null) return null;

    if (
        typeof chunk === "string" ||
        chunk instanceof Uint8Array ||
        chunk instanceof ArrayBuffer ||
        chunk instanceof Blob
    ) {
        return chunk;
    }

    return JSON.stringify(chunk);
};

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

    //       const createResponse = (value?: unknown): Response => {
    //     const ctx = res.context();

    //     if (ctx.aborted) {
    //         return new Response(null, { status: 500 });
    //     }

    //     if (value instanceof Response) {
    //         return value;
    //     }

    //     const body =
    //         ctx.statusCode === 204 ||
    //         ctx.statusCode === 205 ||
    //         ctx.statusCode === 304
    //             ? null
    //             : value !== undefined
    //                 ? normalizeBody(value)
    //                 : ctx.body;

    //     return new Response(body, {
    //         status: ctx.statusCode,
    //         headers: ctx.headers,
    //     });
    // };

    // const finish = () => {
    //     const ctx = res.context();

    //     if (ctx.aborted) {
    //         return new Response(null, { status: 500 });
    //     }

    //     if (ctx.pending) {
    //         return ctx.pending.then(createResponse);
    //     }

    //     return createResponse();
    // };

    // if (res.writableEnded()) {
    //     return finish();
    // }

    // return res.waitForResponse().then(finish);

     return new Response('hi');
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
      return instance;
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

        //@ts-ignore
        ws.server = instance;
    } else {
        //@ts-ignore
        instance = Bun.serve({
            port,
            hostname,
            fetch,
        });
    }

        //@ts-ignore
        callback?.({ port: instance.port });

        return instance;
    },

    close() {
      instance?.stop();
      instance = undefined;
    },
  };
};