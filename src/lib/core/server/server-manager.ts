import type { T }      from "../..";
import { uWSServer }   from "./uWS";
import { httpServer }  from "./http";
import { netServer }   from "./net";
import { bunServer }   from "./bun";

export class ServerManager {

    public static create ({
        adapter,
        ws,
        lookup,
        cors,
    }: {
        adapter: T.Adapter;
        ws: T.WS;
        lookup: Function;
        cors?: (req: T.Request, res: T.Response) => void;
     }) {

        switch (adapter.kind) {
            
            case "uWS": {
                return uWSServer({
                    uWS: adapter.server,
                    ws,
                    cors,
                    lookup,
                });
            }

            case "net": {
                return netServer({
                    net: adapter.server,
                    ws,
                    cors,
                    lookup,
                });
            }

            case "http": {
                return httpServer({
                    http: adapter.server,
                    ws,
                    cors,
                    lookup,
                });
            }

            case "bun": {
                return bunServer({
                    bun: adapter.server,
                    ws,
                    cors,
                    lookup,
                });
            }

            default: {
                throw new Error(`Unsupported adapter`);
            }
        }
    };

    public static listen ({
        adapterKind,
        server,
        port,
        hostname,
        callback,
        onListening,
    }: {
        adapterKind: T.Adapter["kind"];
        server: T.Server;
        port: number;
        hostname?: string | ((callback: { server: T.Server; port: number }) => void);
        callback?: (cb: { server: T.Server; port: number }) => void;
        onListening?: () => void | Promise<void>;
    }) {

        if (adapterKind === "uWS") {

            const handler = async () => {
                await onListening?.();
                callback?.({ server, port });
            };

            hostname
            ? server.listen(port, hostname, handler)
            : server.listen(port, handler);

            return;
        }

        if (adapterKind === "bun") {

            const handler = async () => {
                await onListening?.();
                callback?.({ server, port });
            };

            const normalizeHostname = typeof hostname === 'function' 
            ? undefined
            : hostname

            hostname 
            ? server.listen(port, normalizeHostname, handler)
            : server.listen(port, handler);

            return;
        }

        // "http" and "net" same listen
        hostname
            ? server.listen(port, hostname, () => callback?.({ server, port: port }))
            : server.listen(port, () => callback?.({ server, port: port }));

        server.on("listening", async () => {
            await onListening?.();
        });

        return;
    };
}