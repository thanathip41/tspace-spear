import { IncomingMessage, ServerResponse } from "http"
import { T } from "../types";
import { Stream } from "stream";
import fsSystem   from "fs";
import mime       from 'mime-types';
export class Response {

    private _formatResponse : Function | null = null;
    private _isUwebStocket: Boolean = false

    constructor (private req: IncomingMessage , private res: ServerResponse) {}

    public format(format : Function | null) {
        this._formatResponse = format;
        return this;
    }

    public isUwebStocket (uws : boolean) {
        this._isUwebStocket = uws;
        return this;
    }

    public end(r : unknown) {
        return this.res.end(r)
    }

    public writeHead(status : number , header : string) {
        this.res.writeHead(status,header)
    }

    public stream (filePath : string){
        return this.pipeStream(filePath)
    }

    public send (results : string) {

        if (this.res.writableEnded) {
            return;
        }

        // return this.res.end(results);
        const resultsBuffer = Buffer.from(results);

        const socket = this.req.socket;

        if (!socket || socket.destroyed) {
            return this.res.end(resultsBuffer)
        }

        const headerBuffer = this._buildHeader(200, {
            "Content-Length": resultsBuffer.length,
            "Content-Type": "text/plain",
            "Connection": "keep-alive"
        });

        socket.cork();
        socket.write(headerBuffer as unknown as Uint8Array<ArrayBufferLike>);
        socket.write(resultsBuffer as unknown as Uint8Array<ArrayBufferLike>);
        socket.uncork();

        return this.res.end();
    }
    
    public json (results ?: Record<string,any>) {

        if (this.res.writableEnded) return;

        if(typeof results === 'string') {

            if(!this.res.headersSent) {
                this.res.writeHead(200, { 'Content-Type': 'text/plain' })
            }

            return this.res.end(results)
        }

        if(!this.res.headersSent) {
            this.res.writeHead(200, { 'Content-Type': 'application/json' })
        }

        if(results == null) {

            if(this._formatResponse != null) {
                return this.res.end(JSON.stringify(this._formatResponse(null, this.res.statusCode)))
            }

            return this.res.end()

        }
        
        if(this._formatResponse != null) {
            
            return this.res.end(JSON.stringify(
                this._formatResponse({ 
                    ...results
                }, this.res.statusCode))
            )
        }

        return this.res.end(JSON.stringify({
            ...results,
        }))
    }
    
    public html = (results : string) => {

        if (this.res.writableEnded) return;

        this.res.writeHead(this.res.statusCode, {'Content-Type': 'text/html'})

        return this.res.end(results)
    }
    
    public error = (err: any) => {

        const statusCandidates = [
            err?.response?.data?.code,
            err?.code,
            err?.status,
            err?.statusCode,
            err?.response?.data?.statusCode
        ]

        let code = statusCandidates
            .map(v => Number(v))
            .find(v => Number.isFinite(v) && v >= 400) ?? 500

        const message =
            err?.response?.data?.errorMessage ??
            err?.response?.data?.message ??
            err?.message ??
            `The request '${this.req.url}' resulted in a server error.`

        this.setStatusCode(code as T.StatusCode)

        const payload = { message }

        if (this._formatResponse) {
            return this.res.end(
                JSON.stringify(this._formatResponse(payload, code))
            )
        }

        return this.res.end(JSON.stringify(payload))
    }

    public status (code : number) {
        this.res.writeHead(code, { 'Content-Type': 'application/json' })
        
        return {
            json : (data?: { [key: string]: any }) => {
                return this.json(data);
            },
            send : (str : string) => {
                return this.send(str)
            }
        }
    }

    public setStatusCode (code: number) {
        this.res.writeHead(code, { 'Content-Type': 'application/json' });
        return;
    }

    public setCookies = (cookies : Record<string,string | { 
        value      : string
        path       ?: string
        sameSite   ?: 'Strict' | 'Lax' | 'None'
        domain     ?: string
        secure     ?: boolean
        httpOnly   ?: boolean
        expires    ?: Date
    }> ) => {

        const cookieLists: string[] = []

        for (const [key, v] of Object.entries(cookies)) {
            let str = `${key}=${typeof v === 'string' ? v : v.value}`

            if (typeof v !== 'string') {
                if (v.sameSite) str += `; SameSite=${v.sameSite}`
                str += `; Path=${v.path ?? '/'}`

                if (v.domain) str += `; Domain=${v.domain}`
                if (v.httpOnly) str += `; HttpOnly`
                if (v.secure) str += `; Secure`

                if (v.expires) {
                    const maxAge = Math.floor((v.expires.getTime() - Date.now()) / 1000)
                    str += `; Max-Age=${maxAge}`
                }
            }

            cookieLists.push(str)
        }

        if(this._isUwebStocket) {
            for(const cookie of cookieLists) {
                this.res.setHeader('Set-Cookie', cookie)
            }
            return;
        }
        this.res.setHeader('Set-Cookie', cookieLists)
    }

    public ok (results ?: Record<string,any> ) {
        if (this.res.writableEnded) return;
        return this.json(results == null ? {} : results)
    }

    public created (results ?: Record<string,any>) {
        if (this.res.writableEnded) return;
        this.status(201);
        return this.json(results == null ? {} : results)
    }

    public accepted = (results ?: Record<string,any>) => {

        if (this.res.writableEnded) return;

        this.status(202)

        return this.json(results == null ? {} : results)
    }

    public noContent = () => {

        if (this.res.writableEnded) return;

        this.status(204)

        return this.res.end()
    }

    public badRequest = (message ?: string) => {

        if (this.res.writableEnded) return;
        
        this.status(400);

        message = message ?? `The request '${this.req.url}' resulted in a bad request. Please review the data and try again.`

        if(this._formatResponse != null) {
            return this.res.end(JSON.stringify(this._formatResponse({ message }, 400) ))
        }

        return this.res.end(JSON.stringify({
            message : message 
        }))
    }

    public unauthorized = (message ?: string) => {

        if (this.res.writableEnded) return;

        this.status(401);

        message = message ?? `The request '${this.req.url}' is unauthorized. Please verify.`

        if(this._formatResponse != null) {
            return this.res.end(JSON.stringify(this._formatResponse({ message }, 401) ))
        }

        return this.res.end(JSON.stringify({
            message
        }))
    }

    paymentRequired = (message ?: string) => {

        if (this.res.writableEnded) return;

        this.status(402);

        message = message ?? `The request '${this.req.url}' requires payment. Please proceed with payment.`

        if(this._formatResponse != null) {
            return this.res.end(JSON.stringify(this._formatResponse({ message }, 402) ))
        }

        return this.res.end(JSON.stringify({
            message
        }))
    }

    forbidden = (message ?: string) => {
        
        if (this.res.writableEnded) return;

        this.status(403)

        message = message ?? `The request '${this.req.url}' is forbidden. Please check the permissions or access rights.`

        if(this._formatResponse != null) {
            return this.res.end(JSON.stringify(this._formatResponse({ message }, 403) ))
        }

        return this.res.end(JSON.stringify({
            message
        }))
    }

    notFound = (message ?: string) => {

        if (this.res.writableEnded) return;

        this.status(404)

        message = message ?? `The request '${this.req.url}' was not found. Please re-check the your url again.`

        if(this._formatResponse != null) {
            return this.res.end(JSON.stringify(this._formatResponse({ message }, 404) ))
        }

        return this.res.end(JSON.stringify({
            message
        }))
    }

    unprocessable = (message ?: string) => {

        if (this.res.writableEnded) return;

        this.status(422)

        message = message ?? `The request to '${this.req.url}' failed validation.`

        if(this._formatResponse != null) {
            return this.res.end(JSON.stringify(this._formatResponse({ message }, 422) ))
        }

        return this.res.end(JSON.stringify({
            message
        }))
    }

    tooManyRequests = (message ?: string) => {

        if (this.res.writableEnded) return;

        this.status(429)

        message = message ?? `The request '${this.req.url}' is too many request. Please wait and try agian.`

        if(this._formatResponse != null) {
            return this.res.end(JSON.stringify(this._formatResponse({ message }, 429) ))
        }

        return this.res.end(JSON.stringify({
            message
        }))
    }

    serverError = (message ?: string) => {
        
        if (this.res.writableEnded) return;

        this.status(500)

        message = message ?? `The request '${this.req.url}' resulted in a server error. Please investigate.`

        if(this._formatResponse != null) {
            return this.res.end(JSON.stringify(this._formatResponse({ message }, 500) ))
        }

        return this.res.end(JSON.stringify({
            message 
        }))
    }

    private async pipeStream (filePath : string): Promise<Stream> {
    
        if(this._isUwebStocket) {
            //@ts-ignore
            const uwsRes = this.res.uwsRes;
                    
            if (!fsSystem.existsSync(filePath)) {
                uwsRes.writeStatus('404 Not Found').end();
            }
            
            const stat = fsSystem.statSync(filePath);
            const fileSize = stat.size;
            
            const range = this.req.headers['range'];
            
            let aborted = false;
            let stream: fsSystem.ReadStream;
            
            uwsRes.onAborted(() => {
                aborted = true;
                if (stream) stream.destroy();
            });
            
            let start = 0;
            let end = fileSize - 1;
            
            const contentType = mime.lookup(filePath) || 'application/octet-stream';
    
            const isVideo = contentType.startsWith("video/");
            
            if (range && isVideo) {
                const parts = range.replace(/bytes=/, '').split('-');
                start = parseInt(parts[0], 10);
                end = parts[1] ? parseInt(parts[1], 10) : end;
    
                uwsRes.writeStatus('206 Partial Content');
                uwsRes.writeHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
            } else {
                uwsRes.writeStatus('200 OK');
            }
    
            const chunkSize = end - start + 1;
                    
            uwsRes.writeHeader('Content-Type', contentType);
            uwsRes.writeHeader('Accept-Ranges', 'bytes');
            uwsRes.writeHeader('Content-Length', chunkSize.toString());
    
    
            stream = fsSystem.createReadStream(filePath, { start, end });
    
            stream.pause();
    
            stream.on('data', (chunk) => {
                if (aborted) return;
    
                const ok = uwsRes.cork(() => uwsRes.write(chunk));
    
                if (!ok) stream.pause();
            });
    
            uwsRes.onWritable(() => {
                if (aborted) return false;
                stream.resume();
                return true;
            });
    
            stream.on('end', () => {
                if (!aborted) {
                uwsRes.cork(() => uwsRes.end());
                }
            });
    
            stream.on('error', () => {
                if (!aborted) {
                uwsRes.writeStatus('500 Internal Server Error').end();
                }
            });
    
            stream.resume();
    
            return stream;
        }
    
        return '' as unknown as Stream
        
    }

    private _buildHeader(
        status : number,
        headers : Record<string,string | number> = {}
    ) {
    
        const statusTextMap: Record<string,string> = {
            200: "OK",
            201: "Created",
            204: "No Content",
            301: "Moved Permanently",
            302: "Found",
            304: "Not Modified",
            400: "Bad Request",
            401: "Unauthorized",
            403: "Forbidden",
            404: "Not Found",
            500: "Internal Server Error",
        };

        const statusText = statusTextMap[status] || "OK";

        const lines = [`HTTP/1.1 ${status} ${statusText}`];

        for (const k in headers) {
            const v = headers[k];
            if (v !== undefined && v !== null) {
                lines.push(k + ": " + v);
            }
        }

        lines.push("", "");

        return Buffer.from(lines.join("\r\n"));
    }
}