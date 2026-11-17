
import type { T } from "../../types";

type BunResponseContext = {
    body: BodyInit | null;
    statusCode: number;
    headers: Headers;
    pending: Promise<unknown> | null;
    aborted: boolean;
};

type BunResponse = {
    bun: Response | undefined;

    writableEnded: () => boolean;
    aborted: () => boolean;
    writeHeaders: () => Headers;
    headersSent: () => boolean;
    statusCode: () => number;

    context: () => BunResponseContext;

    setStatusCode(status: number): BunResponse;
    removeHeader(key: string): BunResponse;
    setHeader(key: string, value: any): BunResponse;
    writeHead(status: number, context?: Record<string, string>): BunResponse;
    end(chunk?: unknown): BunResponse;
    stream(result: AsyncIterable<unknown>): BunResponse;
    redirect(status: number, path: string): BunResponse;

    _waitForResponse(): Promise<BunResponse>;
    _toResponse() : void;
};


const createResponse = (ctx: any, value?: unknown): Response => {
    if (ctx.aborted) {
        return new Response(null, { status: 500 });
    }

    if (value instanceof Response) {
        return value;
    }

    const status = ctx.statusCode;

   
    return new Response(
        status === 204 || status === 205 || status === 304
            ? null
            : value !== undefined
                ? normalizeBody(value)
                : ctx.body,
        {
            status,
            headers: ctx.headers,
        }
    );
};

const finishResponse = (instance: any) => {
    const ctx = instance.context();

    if (ctx.aborted) {
        return new Response(null, { status: 500 });
    }

    return ctx.pending
        ? ctx.pending.then((value: unknown) => createResponse(ctx, value))
        : createResponse(ctx);
};


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

const getPathname = (url: string) => {
    const start = url.indexOf("/", url.indexOf("://") + 3);

    if (start === -1) return "/";

    const end = url.indexOf("?", start);

    return end === -1 ? url.slice(start) : url.slice(start, end);
};

export const bunAdaptRequestResponse = (bunReq: Request) => {
    const headers: Record<string, any> = Object.create(null);

    bunReq.headers.forEach((value, key) => {
        headers[key] = value;
    });

    const request: Record<string, any> = {
        bun: bunReq,
        method: bunReq.method,
        url: getPathname(bunReq.url),
        headers,
        signal: bunReq.signal,
    };

    let _writableEnded = false;
    let _aborted = false;
    let _headersSent = false;
    let _statusCode = 200;

    let _body: BodyInit | null = null;
    let _pending: Promise<unknown> | null = null;

    const _writeHeaders = new Headers();

    let responseReady: Promise<void> | undefined;
    
    let resolveResponse: (() => void) | undefined;

    const notifyResponse = () => {
        resolveResponse?.();
        resolveResponse = undefined;
        responseReady = undefined;
    };

    const response: BunResponse = {
        bun: undefined,

        writableEnded: () => _writableEnded,
        aborted: () => _aborted,
        writeHeaders: () => _writeHeaders,
        headersSent: () => _headersSent,
        statusCode: () => _statusCode,

        context() {
            return {
                body: _body,
                statusCode: _statusCode,
                headers: _writeHeaders,
                pending: _pending,
                aborted: _aborted,
            };
        },

        setStatusCode(status: number) {
            _statusCode = status;
            return response;
        },

        removeHeader(key: string) {
            _writeHeaders.delete(key);
            return response;
        },

        setHeader(key: string, value: any) {
            if (value == null) {
                _writeHeaders.delete(key);
                return response;
            }

            if (!_aborted && !_writableEnded) {
                _writeHeaders.set(key, String(value));
            }

            return response;
        },

        writeHead(
            status: number,
            context?: Record<string, string>
        ) {
            if (_writableEnded || _aborted) {
                return response;
            }

            if (context) {
                for (const key in context) {
                    if (
                        Object.prototype.hasOwnProperty.call(context, key) &&
                        !_writeHeaders.has(key)
                    ) {
                        _writeHeaders.set(key, context[key]);
                    }
                }
            }

            _statusCode = status;
            _headersSent = true;

            return response;
        },

        end(chunk?: unknown) {
           
            if (_aborted || _writableEnded) {
                return response;
            }

            _writableEnded = true;
            _headersSent = true;

            if (
                chunk !== null &&
                (typeof chunk === "object" ||
                    typeof chunk === "function") &&
                typeof (chunk as Promise<unknown>).then === "function"
            ) {
                _pending = Promise.resolve(chunk);
            } else {
                _body = normalizeBody(chunk);
            }

            notifyResponse();

            return response;
        },

        stream(result: AsyncIterable<unknown>) {
            if (_aborted || _writableEnded) {
                return response;
            }

            if (!_writeHeaders.has("Content-Type")) {
                _writeHeaders.set(
                    "Content-Type",
                    "application/x-ndjson; charset=utf-8"
                );
            }

            const encoder = new TextEncoder();
            const iterator = result[Symbol.asyncIterator]();

            const stream = new ReadableStream<Uint8Array>({
                async pull(controller) {
                    try {
                        if (_aborted) {
                            controller.close();
                            return;
                        }

                        const { value, done } = await iterator.next();

                        if (done) {
                            controller.close();
                            return;
                        }

                        controller.enqueue(
                            encoder.encode(JSON.stringify(value) + "\n")
                        );
                    } catch (error) {
                        controller.error(error);
                    }
                },

                async cancel() {
                    _aborted = true;
                    await iterator.return?.();
                },
            });

            _body = stream;
            _headersSent = true;
            _writableEnded = true;

            notifyResponse();

            return response;
        },

        redirect(status: number, path: string) {
            response.setStatusCode(status);
            response.setHeader("Location", path);
            response.end();

            return response;
        },

        async _waitForResponse() {
            if (_writableEnded || _aborted) {
                return Promise.resolve(response);
            }

            if (!responseReady) {
                responseReady = new Promise<void>((resolve) => {
                    resolveResponse = resolve;
                });
            }

            return responseReady.then(() => response);
        },

        _toResponse () {
            return this.writableEnded()
                ? finishResponse(this)
                : this._waitForResponse().then(() => finishResponse(this));
        }
    };

    bunReq.signal.addEventListener(
        "abort",
        () => {
            _aborted = true;
            notifyResponse();
        },
        { once: true }
    );

    return {
        req: request,
        res: response,
    } as unknown as {
        req: T.Request;
        res: T.Response;
    };
};
