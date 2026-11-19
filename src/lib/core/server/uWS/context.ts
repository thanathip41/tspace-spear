
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
            return this;
        },

        removeHeader(key: string) {
            delete _writeHeaders[key];
            return this;
        },

        setHeader(key: string, value: any) {

            if(value == null) {
                this.removeHeader(key)
                return this;
            }

            if (Array.isArray(value)) {
                value = value.map(String).join();
            } 
            else if (typeof value !== 'string') {
                value = String(value);
            }

            if ((!_aborted && !_writableEnded)) {
                _writeHeaders[key] = value;
            }

            return this;
        },

        writeHead(
            status: number,
            context?: Record<string, string>
        ) {
            
            if (_writableEnded || _aborted) {
                return this;
            }

            if (context) {
                for (const key in context) {
                    this.setHeader(key, context[key]);
                }
            }

            _statusCode = status;
            _headersSent = true;

            return this;
        },

        end(chunk?: unknown) {

            if (_aborted || _writableEnded) {
                return;
            }

            const status = this.statusCode() as T.StatusCode;

            const statusMessage = HTTP_STATUS_MESSAGES[status] ?? HTTP_STATUS_MESSAGES[500];

            _aborted = true;
            _writableEnded = true;
            _headersSent = true;

            uwsRes.cork(() => {

                uwsRes.writeStatus(`${status} ${statusMessage}`);

                for (const [key, value] of Object.entries(this.writeHeaders())) {
                    uwsRes.writeHeader(key, value);
                }

                if (
                    typeof chunk === "string" ||
                    Buffer.isBuffer(chunk) ||
                    chunk instanceof Uint8Array
                ) {
                    uwsRes.end(chunk);
                    return;
                }

                if (chunk === undefined) {
                    uwsRes.end();
                    return;
                } 
                
                uwsRes.end(JSON.stringify(chunk));
                
                return;
            });
        },

        async stream(result: AsyncIterable<unknown>) {
            if (_aborted || _writableEnded) {
                return;
            }

            this.setHeader('Date',`${new Date().toUTCString()}`);
            this.setHeader('Content-Type','application/x-ndjson; charset=utf-8');

            const status = this.statusCode() as T.StatusCode;

            const statusMessage =
                HTTP_STATUS_MESSAGES[status] ?? HTTP_STATUS_MESSAGES[500];

            _headersSent = true;

            uwsRes.cork(() => {
                if (_aborted) return;

                uwsRes.writeStatus(`${status} ${statusMessage}`);

                for (const [key, value] of Object.entries(this.writeHeaders())) {
                    uwsRes.writeHeader(key, value);
                }
            });

            for await (const value of result) {
                if (_aborted) {
                    return;
                }

                const chunk = JSON.stringify(value) + "\n";

                let writable = true;

                uwsRes.cork(() => {
                    if (_aborted) {
                        writable = false;
                        return;
                    }

                    writable = uwsRes.write(chunk);
                });

                if (!writable) {
                    await new Promise<void>((resolve) => {
                        uwsRes.onWritable(() => {
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
                uwsRes.cork(() => {
                    if (_aborted) return;

                    _aborted = true;
                    _writableEnded = true;

                    uwsRes.end();
                });
            }

            return;
        },

        redirect(status: number, path: string) {

            this.setStatusCode(status);
            this.setHeader('Location', path);
            this.end();

            return;
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
