import type { T }   from "../../types";

import { normalizeRequestBody } from "../../utils";

export const uWSBody = (req: T.Request, res: T.Response & { uWS: any }) => {
  return new Promise((resolve, reject) => {
    let buffer: Buffer[] = [];

    res.uWS.onAborted(() => {
      reject(new Error("Request aborted"));
    });

    res.uWS.onData(async (chunk: ArrayBuffer, isLast: boolean) => {
      buffer.push(Buffer.from(chunk));

      if (!isLast) return;

      const payload = Buffer.concat(buffer as any).toString("utf-8");

      const contentType = req.headers["content-type"]?.toLowerCase() ?? null;

      try {
        const body = await normalizeRequestBody({ contentType, payload });

        return resolve(body);
      } catch (err) {
        return reject(err);
      }
    });
  });
};