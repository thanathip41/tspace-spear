import { HEADER_CONTENT_TYPES } from "../const";

import { uWSPipeStream, uWSServer } from "../server/uWS";
import { httpPipeStream, httpServer } from "../server/http";
import { netPipeStream, netServer } from "../server/net";

import type { T } from "../..";
import querystring from "querystring";
import { Stream } from "stream";
import fsSystem from "fs";
import pathSystem from "path";
import xml2js from "xml2js";

export const normalizeRequestBody = async ({
  contentType,
  payload,
}: {
  contentType: string | null;
  payload: any;
}) => {
  if (contentType == null || payload == null || payload === "") {
    return {};
  }

  if (contentType.includes(HEADER_CONTENT_TYPES["form"]["Content-Type"])) {
    return querystring.parse(payload);
  }

  if (contentType.includes(HEADER_CONTENT_TYPES["json"]["Content-Type"])) {
    try {
      return JSON.parse(payload);
    } catch (err) {
      throw new Error("Invalid JSON format in request body.");
    }
  }

  if (
    contentType.includes(HEADER_CONTENT_TYPES["xml"]["Content-Type"]) ||
    contentType.includes(HEADER_CONTENT_TYPES["xmlText"]["Content-Type"])
  ) {
    try {
      const result = await xml2js.parseStringPromise(payload, {
        explicitArray: false,
      });
      return result;
    } catch (err) {
      throw new Error("Invalid XML format in request body.");
    }
  }

  if (
    contentType.includes(HEADER_CONTENT_TYPES["text"]["Content-Type"]) ||
    contentType.includes(HEADER_CONTENT_TYPES["js"]["Content-Type"]) ||
    contentType.includes(HEADER_CONTENT_TYPES["jsText"]["Content-Type"]) ||
    contentType.includes(HEADER_CONTENT_TYPES["jsX"]["Content-Type"])
  ) {
    return { contentType, text: payload };
  }

  return {};
};

export const pipeStream = async ({
  req,
  res,
  filePath,
  adapter,
}: {
  req: T.Request;
  res: T.Response;
  filePath: string;
  adapter: "http" | "net" | "uWS";
}): Promise<Stream> => {
  if (!fsSystem.existsSync(filePath)) {
    return res
      .writeHead(404, HEADER_CONTENT_TYPES["text"])
      .end(`File not found: ${pathSystem.basename(filePath)}`);
  }

  if (adapter === "uWS") {
    return uWSPipeStream({ req, res, filePath });
  }

  if (adapter === "net") {
    return netPipeStream({ req, socket: res.net, filePath });
  }

  return httpPipeStream({ req, res, filePath });
};

export const createServer = ({
  adapter,
  ws,
  lookup,
  cors,
}: {
  adapter: T.Adapter;
  ws: T.WS;
  lookup: Function;
  cors?: (req: T.Request, res: T.Response) => void;
}) => {
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

    default: {
      throw new Error(`Unsupported adapter`);
    }
  }
};

export const litenServer = ({
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
  callback?: (data: { server: T.Server; port: number }) => void;
  onListening?: () => void | Promise<void>;
}) => {
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

  hostname
    ? server.listen(port, hostname, () => callback?.({ server, port: port }))
    : server.listen(port, () => callback?.({ server, port: port }));

  server.on("listening", async () => {
    await onListening?.();
  });

  return;
};
