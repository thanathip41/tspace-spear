import { HEADER_CONTENT_TYPES } from "../const";

import { uWSPipeStream } from "../server/uWS";
import { httpPipeStream } from "../server/http";
import { netPipeStream } from "../server/net";
import { bunPipeStream } from "../server/bun";

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
  adapter:  T.Adapter["kind"];
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

  if (adapter === "bun") {
    return bunPipeStream({ req, res, filePath });
  }

  return httpPipeStream({ req, res, filePath });
};

export const EMPTY_OBJECT = Object.freeze(Object.create(null));
