import fsSystem          from "fs";
import pathSystem        from "path";
import mime              from "mime-types";
import crypto            from "crypto";
import { StringDecoder } from "string_decoder";

import type { 
  IncomingMessage, 
  ServerResponse 
} from "http";

import busboy from "busboy";

import type { T }               from "../../types";
import { normalizeRequestBody } from "../../utils";
import { PayloadTooLargeException } from "../../exception";

export const httpBody = (req: T.Request, res: T.Response) => {
  return new Promise((resolve, reject) => {
    const decoder = new StringDecoder("utf-8");
    let payload = "";

    req.on("data", (data: Buffer) => {
      payload += decoder.write(data);
    });

    req.on("end", async () => {
      payload += decoder.end();

      const contentType = req.headers["content-type"]?.toLowerCase() || null;

      try {
        const body = await normalizeRequestBody({ contentType, payload });

        return resolve(body);
      } catch (err) {
        return reject(err);
      }
    });

    req.on("error", (err: any) => {
      return reject(err);
    });
  });
};