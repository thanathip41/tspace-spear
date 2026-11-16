import type { T } from "../../types";
import { normalizeRequestBody } from "../../utils";

export const bunBody = async (req: T.Request, res: T.Response) => {
    const bunReq = req.bun as Request;

    const contentType = bunReq.headers.get("content-type")?.toLowerCase() || null;

    const payload = await bunReq.text();

    return normalizeRequestBody({
        contentType,
        payload,
    });
};