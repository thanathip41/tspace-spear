import { 
    IncomingMessage, 
    ServerResponse 
} from "http";

import { 
    HEADER_CONTENT_TYPES 
} from "../const";

import type { T }  from "../types";
import { pipeStream } from "../utils";

export const Response = (req : IncomingMessage, res : ServerResponse , { 
    formatResponse,
    isUwebSocket
} : { 
    formatResponse ?: Function | null
    isUwebSocket ?: boolean
}
): T.Response => {

    const response = res as unknown as T.Response;

    response.serveMedia = (filePath : string) => {
        return pipeStream({ req , res , filePath, isUwebSocket })
    }

    response.status = (code : number) => {
        
        return {
            json : (data?: { [key: string]: any }) => {
                if(!res.headersSent)
                    res.writeHead(code, HEADER_CONTENT_TYPES['json'])
                return response.json(data)
            },
            send : (message : string) => {
                if(!res.headersSent)
                    res.writeHead(code, HEADER_CONTENT_TYPES['text'])
                return response.send(message)
            },
            end : (message ?: string) => {
                if(!res.headersSent)
                    res.writeHead(code, HEADER_CONTENT_TYPES['text'])
                return response.end(message)
            },
        }
    }

    response.json = (results ?: Record<string,any>) => {

        if (res.writableEnded) return;

        if(typeof results === 'string') {

            if(!res.headersSent) {
                res.writeHead(200, HEADER_CONTENT_TYPES['text'])
            }

            return res.end(results)
        }

        if(!res.headersSent) {
            res.writeHead(200, HEADER_CONTENT_TYPES['json'])
        }

        if(results == null) {

            if(formatResponse != null) {
                return res.end(JSON.stringify(formatResponse(null, res.statusCode)))
            }

            return res.end();

        }
        
        if(formatResponse != null) {
            
            return res.end(JSON.stringify(
                formatResponse({ 
                    ...results
                }, res.statusCode))
            )
        }

        return res.end(JSON.stringify(results))
    }

    response.send = (results : string) => {

        if (res.writableEnded) {
            return;
        }

        if(formatResponse != null) {
            return res.end(formatResponse(results, res.statusCode))
        }

        return res.end(results);
    }

    response.html = (results : string) => {

        if (res.writableEnded) return;

        res.writeHead(res.statusCode, HEADER_CONTENT_TYPES['html'])

        return res.end(results)
    }

    response.error = (err: any) => {

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
            `The request '${req.url}' resulted in a server error.`

        response.status(code as T.StatusCode)

        const payload = { message }

        if (formatResponse) {
            return res.end(
                JSON.stringify(formatResponse(payload, code))
            )
        }

        return res.end(JSON.stringify(payload))
    }

    response.ok = (results ?: Record<string,any> ) => {
        return response.json(results)
    }

    response.created = (results ?: Record<string,any>) => {
        return response.status(201).json(results);
    }

    response.accepted = (results ?: Record<string,any>) => {
        return response.status(202).json(results);
    }

    response.noContent = () => {
        return response.status(204).end();
    }

    response.badRequest = (message ?: string) => {

        message = message ?? `The request '${req.url}' resulted in a bad request. Please review the data and try again.`;

        return response.status(400).json({ message })
    }

    response.unauthorized = (message ?: string) => {
       
        message = message ?? `The request '${req.url}' is unauthorized. Please verify.`

        return response.status(401).json({ message })
    }

    response.paymentRequired = (message ?: string) => {

        message = message ?? `The request '${req.url}' requires payment. Please proceed with payment.`

       return response.status(402).json({ message })
    }

    response.forbidden = (message ?: string) => {

        message = message ?? `The request '${req.url}' is forbidden. Please check the permissions or access rights.`

        return response.status(403).json({ message })
    }

    response.notFound = (message ?: string) => {

        message = message ?? `The request '${req.url}' was not found. Please re-check the your url again.`

        return response.status(404).json({ message })
    }

    response.unprocessable = (message ?: string) => {

        message = message ?? `The request to '${req.url}' failed validation.`

        return response.status(422).json({ message })
    }

    response.tooManyRequests = (message ?: string) => {

        message = message ?? `The request '${req.url}' is too many request. Please wait and try agian.`;

        return response.status(429).json({ message });
    }

    response.serverError = (message ?: string) => {
        
        message = message ?? `The request '${req.url}' resulted in a server error. Please investigate.`

        return response.status(500).json({ message });
    }

    response.setCookies = (cookies : Record<string,string | { 
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

        if(isUwebSocket) {
            for(const cookie of cookieLists) {
                res.setHeader('Set-Cookie', cookie)
            }
            return;
        }

        res.setHeader('Set-Cookie', cookieLists)
    }

    return response
}