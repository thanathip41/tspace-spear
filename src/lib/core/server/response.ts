import { 
    HEADER_CONTENT_TYPES 
} from "../const";

import type { T }  from "../types";
import { pipeStream } from "../utils";

type TResponse = T.Response & {
    _isUwebSocket : boolean;
    _formatResponse: Function | null;
    _req : T.Request;
}


function json(this: TResponse, results?: Record<string, any>) {
    if (this.writableEnded) return;

    if (!this.headersSent) {
        this.headersSent = true;
        this.writeHead(
            200, 
            HEADER_CONTENT_TYPES.json
        );   
    }

    if (this._formatResponse) {
        return this.end(
            JSON.stringify(
                this._formatResponse(results,this.statusCode)
            )
        );
    }

    return this.end(JSON.stringify(results));
}

function send(this: TResponse, message: string) {
    if (this.writableEnded) return;

    return this.end(message);
}

function html(this: TResponse, html: string) {
    if (this.writableEnded) return;

    if (!this.headersSent) {
        this.headersSent = true;
        this.writeHead(
            200, 
            HEADER_CONTENT_TYPES.html
        );
    }
    
    return this.end(html);
}

function status(this: TResponse, code: T.StatusCode) {
    return {
        json: (data?: Record<string, any>) => {

            if (!this.headersSent) {
                this.headersSent = true;
                this.writeHead(code, HEADER_CONTENT_TYPES.json);
            }

            return this.json(data);
        },

        send: (message: string) => {

            if (!this.headersSent) {
                this.headersSent = true;
                this.writeHead(code, HEADER_CONTENT_TYPES.text);
            }

            return this.send(message);
        },

        end: (message?: string) => {
            
            if (!this.headersSent) {
                this.headersSent = true;
                this.writeHead(code, HEADER_CONTENT_TYPES.text);
            }

            return this.end(message);
        }
    };
}

function ok(this: TResponse, results?: Record<string, any>) {
    return this.status(200).json(results);
}

function created(this: TResponse, results?: Record<string, any>) {
    return this.status(201).json(results);
}

function accepted(this: TResponse, results?: Record<string, any>) {
    return this.status(202).json(results);
}

function noContent(this: TResponse) {
    return this.status(204).end();
}

function badRequest(this: TResponse, message?: string) {
    message = message ?? `The request '${this._req.url}' resulted in a bad request. Please review the data and try again.`;
    return this.status(400).json({ message });
}

function unauthorized(this: TResponse, message?: string) {
    message = message ?? `The request '${this._req.url}' is unauthorized. Please verify.`;
    return this.status(401).json({ message });
}

function paymentRequired(this: TResponse, message?: string) {
    message = message ?? `The request '${this._req.url}' requires payment. Please proceed with payment.`;
    return this.status(402).json({ message });
}

function forbidden(this: TResponse, message?: string) {
    message = message ?? `The request '${this._req.url}' is forbidden. Please check the permissions or access rights.`;
    return this.status(403).json({ message });
}

function notFound(this: TResponse, message?: string) {
    message = message ?? `The request '${this._req.url}' was not found. Please re-check your URL again.`;
    return this.status(404).json({ message });
}

function unprocessable(this: TResponse, message?: string) {
    message = message ?? `The request to '${this._req.url}' failed validation.`;
    return this.status(422).json({ message });
}

function tooManyRequests(this: TResponse, message?: string) {
    message = message ?? `The request '${this._req.url}' is too many requests. Please wait and try again.`;
    return this.status(429).json({ message });
}

function serverError(this: TResponse, message?: string) {
    message = message ?? `The request '${this._req.url}' resulted in a server error. Please investigate.`;
    return this.status(500).json({ message });
}

function serveMedia(this: TResponse, filePath: string) {
    return pipeStream({
        req: this._req,
        res: this,
        filePath,
        isUwebSocket: this._isUwebSocket
    });
}

function setStatusCode(this: TResponse, code: T.StatusCode, contentType ?: 'TEXT' | 'JSON') {
    if(this.headersSent) return;

    this.statusCode = code;

    if(contentType === 'TEXT') {
        this.writeHead(code,HEADER_CONTENT_TYPES.text);
    }

    else if (contentType === 'JSON') {
        this.writeHead(code, HEADER_CONTENT_TYPES.json);
    }

    else this.writeHead(code);

    return;
}

function setCookies(
    this: TResponse,
    cookies: Record<
        string,
        string | {
            value: string;
            path?: string;
            sameSite?: 'Strict' | 'Lax' | 'None';
            domain?: string;
            secure?: boolean;
            httpOnly?: boolean;
            expires?: Date;
        }
    >
) {
    const cookieLists: string[] = [];

    for (const [key, v] of Object.entries(cookies)) {
        let str = `${key}=${typeof v === 'string' ? v : v.value}`;

        if (typeof v !== 'string') {
            if (v.sameSite) str += `; SameSite=${v.sameSite}`;
            str += `; Path=${v.path ?? '/'}`;

            if (v.domain) str += `; Domain=${v.domain}`;
            if (v.httpOnly) str += `; HttpOnly`;
            if (v.secure) str += `; Secure`;

            if (v.expires) {
                const maxAge = Math.floor((v.expires.getTime() - Date.now()) / 1000);
                str += `; Max-Age=${maxAge}`;
            }
        }

        cookieLists.push(str);
    }

    if (this._isUwebSocket) {
        for (const cookie of cookieLists) {
            this.setHeader("Set-Cookie", cookie);
        }
        return;
    }

    this.setHeader("Set-Cookie", cookieLists);
}

function error(this: TResponse, err: any) {
    const statusCandidates = [
        err?.response?.data?.code,
        err?.code,
        err?.status,
        err?.statusCode,
        err?.response?.data?.statusCode
    ];

    const code =
        statusCandidates
            .map(Number)
            .find(v => Number.isFinite(v) && v >= 400) ?? 500;

    const message =
        err?.response?.data?.errorMessage ??
        err?.response?.data?.message ??
        err?.message ??
        `The request '${this._req.url}' resulted in a server error.`;

    const payload = { message };

    if (!this.headersSent) {
        this.writeHead(code as T.StatusCode, HEADER_CONTENT_TYPES.json);
    }

    if (this._formatResponse) {
        return this.end(
            JSON.stringify(
                this._formatResponse(payload, code)
            )
        );
    }

    return this.end(JSON.stringify(payload));
}

export class Response {
    constructor(
        req: T.Request,
        res: T.Response,
        options: {
            formatResponse?: Function | null;
            isUwebSocket?: boolean;
        }
    ) {
        Object.assign(this, res, {
            _res: res,
            _req: req,
            _formatResponse: options.formatResponse,
            _isUwebSocket: options.isUwebSocket,

            status,
            json,
            send,
            html,
            error,
            ok,
            created,
            accepted,
            noContent,
            badRequest,
            unauthorized,
            paymentRequired,
            forbidden,
            notFound,
            unprocessable,
            tooManyRequests,
            serverError,
            setCookies,
            setStatusCode,
            serveMedia
        });
    }
}
