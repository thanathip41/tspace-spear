
import type { T } from "../../types";
import { HTTP_STATUS_MESSAGES } from "../../const";

export const uWSAdaptRequestResponse = (
    uwsReq: any,
    uwsRes: any
) => {
    const headers: Record<string, any> = Object.create(null);

    uwsReq.forEach((key: string, value: any) => {
        headers[key.toLowerCase()] = value;
    });

    const query = uwsReq.getQuery();

    const request: Record<string, any> = {
        uWS: uwsReq,
        method: uwsReq.getMethod().toUpperCase(),
        url: uwsReq.getUrl() + (query ? `?${query}` : ""),
        headers
    };

    let _writableEnded = false;
    let _aborted = false;
    let _headersSent = false;
    let _statusCode = 200;

    const _writeHeaders: Record<string, any> = Object.create(null);

    const response = {
        uWS: uwsRes,

        writableEnded: () => _writableEnded,
        aborted: () => _aborted,
        writeHeaders: () => _writeHeaders,
        headersSent: () => _headersSent,
        statusCode: () => _statusCode,

        setStatusCode(status: number) {
            _statusCode = status;
            return response;
        },

        removeHeader(key: string) {
            delete _writeHeaders[key];
        },

        setHeader(key: string, value: any) {
            if(value == null) {
                this.removeHeader(key)
                return;
            }
            
            if (!_aborted && !_writableEnded) {
                _writeHeaders[key] = value;
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
                        !Object.prototype.hasOwnProperty.call(_writeHeaders, key)
                    ) {
                        _writeHeaders[key] = context[key];
                    }
                }
            }

            _statusCode = status;
            _headersSent = true;

            return response;
        },

        end(chunk?: unknown) {
            if (_aborted || _writableEnded) {
                return;
            }

            const uws = uwsRes;
            const headers = _writeHeaders;
            const status = _statusCode;

            const statusMessage =
                HTTP_STATUS_MESSAGES[
                    status as keyof typeof HTTP_STATUS_MESSAGES
                ] ?? HTTP_STATUS_MESSAGES[500];

            _aborted = true;
            _writableEnded = true;
            _headersSent = true;

            uws.cork(() => {
                uws.writeStatus(`${status} ${statusMessage}`);

                for (const key in headers) {
                    uws.writeHeader(key, headers[key]);
                }

                if (chunk === undefined) {
                    uws.end();
                } else if (
                    typeof chunk === "string" ||
                    Buffer.isBuffer(chunk) ||
                    chunk instanceof Uint8Array
                ) {
                    uws.end(chunk);
                } else {
                    uws.end(JSON.stringify(chunk));
                }
            });
        },

        async stream(result: AsyncIterable<unknown>) {
            if (_aborted || _writableEnded) {
                return;
            }

            const uws = uwsRes;
            const headers = _writeHeaders;

            // Default headers
            if (!headers["Content-Type"]) {
                headers["Content-Type"] =
                    "application/x-ndjson; charset=utf-8";
            }

            const status = _statusCode;

            const statusMessage =
                HTTP_STATUS_MESSAGES[
                    status as keyof typeof HTTP_STATUS_MESSAGES
                ] ?? HTTP_STATUS_MESSAGES[500];

            _headersSent = true;

            uws.cork(() => {
                if (_aborted) return;

                uws.writeStatus(`${status} ${statusMessage}`);

                for (const key in headers) {
                    uws.writeHeader(key, headers[key]);
                }
            });

            for await (const value of result) {
                if (_aborted) {
                    return;
                }

                const chunk = JSON.stringify(value) + "\n";

                let writable = true;

                uws.cork(() => {
                    if (_aborted) {
                        writable = false;
                        return;
                    }

                    writable = uws.write(chunk);
                });

                if (!writable) {
                    await new Promise<void>((resolve) => {
                        uws.onWritable(() => {
                            resolve();
                            return false;
                        });
                    });

                    if (_aborted) {
                        return;
                    }
                }
            }

            if (!_aborted) {
                uws.cork(() => {
                    if (_aborted) return;

                    _aborted = true;
                    _writableEnded = true;

                    uws.end();
                });
            }
        }
    };

    uwsRes.onAborted(() => {
        _aborted = true;
    });

    return {
        req: request,
        res: response
    } as unknown as {
        req: T.Request;
        res: T.Response;
    };
};
