import { StringDecoder } from "string_decoder";
import type { T }               from "../../types";
import { normalizeRequestBody } from "../../utils";

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