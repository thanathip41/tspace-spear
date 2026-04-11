import http, { 
    IncomingHttpHeaders, 
    IncomingMessage, 
    ServerResponse 
} from "http";

import WebSocket from "ws";

type TContext = {
    req     : TRequest
    res     : TResponse
    headers : THeaders 
    query   : TQuery
    params  : TParams
    body    : TBody
    files   : TFileUpload
    cookies : TCookies
    ip      : TIp
    ips     : TIps
}

type TIp = string | null
type TIps = string[]

type THeaders<T = IncomingHttpHeaders> = {
   [K in keyof T]: T[K]
}

type TQuery<T = Record<string, string | undefined>> = T

type TParams<T = Record<string, string | undefined>> = T

type TBody<T = Record<string,any>> = T

type TCookies<T = Record<string, any>> = T

type TFile = {
    size: number;
    sizes : {
        bytes : number,
        kb    : number,
        mb    : number,
        gb    : number
    };
    tempFilePath: string;
    tempFileName : string;
    mimetype: string;
    extension : string;
    name: string;
    write : (to : string) => Promise<void>;
    remove : () => Promise<void>;
}

type TFileUpload = Record<string, TFile[] | undefined>

type TNextFunction<T = any> = (err ?: Error) =>  T | Promise<T> 

type TRequest = IncomingMessage & {
    uWs    : any; // typeof import('uWebSockets.js').HttpRequest
    query  : TQuery;
    files  : TFileUpload;
    body   : TBody;
    params : TParams;
} & Partial<any>

type THttpResponder = {
    /**
     * Raw uWS HttpResponse instance.
     */
    uWS: any; // typeof import('uWebSockets.js').HttpResponse

    /** 200 OK - Standard successful response */
    ok: (data?: Record<string, any>) => any;

    /** 201 Created - Resource successfully created */
    created: (data?: Record<string, any>) => any;

    /** 202 Accepted - Request accepted for processing */
    accepted: (data?: Record<string, any>) => any;

    /** 204 No Content - Successful request with no response body */
    noContent: (message?: string) => any;

    /** 400 Bad Request - Invalid request from client */
    badRequest: (message?: string) => any;

    /** 401 Unauthorized - Authentication required or failed */
    unauthorized: (message?: string) => any;

    /** 402 Payment Required - Reserved for future/payment flow */
    paymentRequired: (message?: string) => any;

    /** 403 Forbidden - Client does not have access rights */
    forbidden: (message?: string) => any;

    /** 422 Unprocessable Entity - Valid request but semantic errors */
    unprocessable: (message?: string) => any;

    /** 429 Too Many Requests - Rate limit exceeded */
    tooManyRequests: (message?: string) => any;

    /** 404 Not Found - Resource does not exist */
    notFound: (message?: string) => any;

    /** 500 Internal Server Error - Generic server failure */
    serverError: (message?: string) => any;

    /** 502 Bad Gateway - Invalid response from upstream server */
    badGateway: (message?: string) => any;

    /** 503 Service Unavailable - Server temporarily unavailable */
    unavailable: (message?: string) => any;

    /** 504 Gateway Timeout - Upstream server timeout */
    gatewayTimeout: (message?: string) => any;

    /**
     * Serve a media file (video, image, PDF, etc.) from file system.
     * @param filePath Absolute or relative path to media file
     */
    serveMedia: (filePath: string) => any;

    /**
     * Send JSON response.
     * @param data JSON serializable object
     */
    json: (data?: Record<string, any>) => any;

    /**
     * Send error response (generic wrapper).
     * @param err Error object or message
     */
    error: (err: any) => any;

    /**
     * Send plain text response.
     * @param message Text content
     */
    send: (message: string) => any;

    /**
     * Send HTML response.
     * @param html HTML string
     */
    html: (html: string) => any;

    /**
     * Set HTTP status code and return chained response helpers.
     *
     * This method does not send a response immediately.
     * Instead, it sets the status code and returns a response builder
     * that allows sending the response in different formats.
     *
     * @param code HTTP status code to set for the response
     * @returns An object containing response methods bound to the given status
     *
     * @example
     * res.status(200).json({ success: true });
     *
     * @example
     * res.status(404).send("Not Found");
     *
     * @example
     * res.status(204).end();
     */
    status: (code: TStatusCode) => {
        /**
         * Send JSON response with the previously set status code.
         *
         * @param data JSON-serializable object to send as response body
         */
        json: (data?: Record<string, any>) => any;

        /**
         * Send plain text response with the previously set status code.
         *
         * @param message Text response body
         */
        send: (message: string) => any;

        /**
         * End the response with optional raw message body.
         *
         * Commonly used for empty responses (e.g. 204 No Content).
         *
         * @param message Optional raw response body
         */
        end: (message?: string) => any;
    };

    /**
     * Set HTTP cookies.
     * @param cookies Key-value map or detailed cookie objects
     */
    setCookies: (
        cookies: Record<
            string,
            | string
            | {
                  value: string;
                  path?: string;
                  sameSite?: 'Strict' | 'Lax' | 'None';
                  domain?: string;
                  secure?: boolean;
                  httpOnly?: boolean;
                  expires?: Date;
              }
        >
    ) => any;
};

type TStatusCode = 
| 200 | 201 | 202 | 203 | 204
| 300 | 301 | 302 | 303 | 304
| 400 | 401 | 402 | 403 | 404 | 405 | 406 | 407 | 408 | 409
| 410 | 411 | 412 | 413 | 414 | 415 | 416 | 417 | 418 | 421 
| 422 | 423 | 424 | 425 | 426 | 428 | 429 | 431 | 451
| 500 | 501 | 502 | 503 | 504 | 505

type TResponse = ServerResponse & THttpResponder;

type TRouter = {
    method: TMethod;
    path: string;
    handler: string | symbol;
}

type TRoute = {
    path   : string;
    method : string;
    params : string[];
}

type TMethod = |'get' | 'post' | 'patch' | 'put' | 'delete' | 'all' | 'head' | 'options';

type TMethodInput = Uppercase<TMethod>;

type HandlerUWS = (res: unknown, req: unknown) => void | Promise<void>;

type UWS = {
  App: () => {
    get: (path: string, handler: HandlerUWS) => any;
    post: (path: string, handler: HandlerUWS) => any;
    patch: (path: string, handler: HandlerUWS) => any;
    put: (path: string, handler: HandlerUWS) => any;
    del: (path: string, handler: HandlerUWS) => any;
    any: (path: string, handler: HandlerUWS) => any;
    options: (path: string, handler: HandlerUWS) => any;
    listen: (...args: any[]) => any;
    ws : (path: string, options: {
        open?: (ws: any) => void;
        message?: (ws: any, message: ArrayBuffer, isBinary: boolean) => void;
        close?: (ws: any, code: number, message: ArrayBuffer) => void;
    }) => any;
  }
};

type TAdapter = UWS | typeof http

type TApplication = {
    controllers  ?: (new () => any)[] | { folder : string ,  name ?: RegExp };
    middlewares  ?: TContextHandler[] | { folder : string , name ?: RegExp };
    globalPrefix ?: string;
    logger       ?: boolean;
    cluster      ?: boolean | number; 
    adapter      ?: TAdapter;

    express      ?: boolean
}

type TContextHandler = (ctx : TContext , next : TNextFunction) => any

type TErrorFunction = (err : Error, ctx : TContext) => any

type TSwaggerFormat = 
| "string" | "number" | "integer" | "boolean" | "object" | "array" 
| "date" | "date-time" | "password" | "int32" | "int64" | "float" | "double" | "byte" 
| "binary" | "base64" | "email" | "uuid" | "uri" | "hostname" | "ipv4" | "ipv6" | "json" | "xml";

type TSwaggerType = "string" | "number" | "integer" | "boolean" | "object" | "array" | "date" | "date-time" | "file"

type TSwaggerDoc = {
    path ?: `/${string}`
    staticUrl ?: `${string}`
    servers ?: { url : string , description ?: string }[]
    tags ?: string[]
    info ?: {
        title ?: string,
        description ?: string,
        version ?: string
    },
    routes ?: {
        path : string;
        method : string;
        params : string[]
    }[]
    specs ?: (TSwagger & { path : string , method : string})[]
    options ?: {
        decoratedOnly ?: boolean, // default : false
        withCredentials ?: boolean, // default : true
        filter ?: boolean // default : false
        docExpansion ?: "none" | "list" | "full", // default : "list"
        deepLinking?: boolean, // default : true
        displayOperationId?: boolean, // default : false
        displayRequestDuration?: boolean, // default : false
        layout?: 'BaseLayout' | 'StandaloneLayout' // default : 'StandaloneLayout'
    }
    responses ?: {
        status : number,
        description : string,
        example ?: Record<string,any>
    }[]
}

type TSwagger = {
    disabled ?: boolean
    // --
    description ?: string
    summary ?: string,
    bearerToken ?: boolean
    tags        ?: string[]
    params ?: Record<string , {
        description ?: string,
        type ?: TSwaggerType
        example ?: any
    }>
    query ?: Record<string , {
        required ?: boolean,
        description ?: string,
        type ?: TSwaggerType
        example ?: any
    }>
    body  ?: {
        required ?: boolean,
        description ?: string,
        properties : Record<string , {
            type : TSwaggerType
            example ?: any
        }>
    }
    files  ?: {
        required ?: boolean,
        description ?: string,
        properties : Record<string , {
            type : TSwaggerType
            format ?: TSwaggerFormat,
            items ?: any,
            example ?: any
        }>
    }
    cookies ?: {
        names : string[],
        required ?: boolean,
        description ?: string
    }
    responses ?: {
        status : number,
        description : string,
        example ?: Record<string,any>
    }[]
}

type TWSHandler = {
    connection : (ws: WebSocket & Partial<any>) => void | string | Buffer;
    message    : (ws: WebSocket & Partial<any>, data: WebSocket.Data) => void | string | Buffer;
    close      : (ws: WebSocket & Partial<any>, code: number, reason: Buffer) => void;
    error      : (ws: WebSocket & Partial<any>, error: Error) => void;
}

export declare namespace T {
    type Adapter          = TAdapter
    type Application      = TApplication
    type NextFunction     = TNextFunction
    type File             = TFile
    type Context          = TContext
    type Router           = TRouter
    type Route            = TRoute
    type Method           = TMethod
    type ErrorFunction    = TErrorFunction
    type HttpStatus       = THttpResponder
    type ContextHandler   = TContextHandler
    type WebSocketHandler = TWSHandler
    type StatusCode       = TStatusCode
    type MethodInput      = TMethodInput
    type Response         = TResponse
    type Request          = TRequest

    type FileUpload                          = TFileUpload
    type Cookies<T = Record<string, any>>    = TCookies<T>
    type Params<T = Record<string, string>>  = TParams<T>
    type Query<T = Record<string, string>>   = TQuery<T>
    type Body<T = Record<string, any>>       = TBody<T>
    type Headers<T = IncomingHttpHeaders>    = THeaders<T>
    type Ip                                  = TIp
    type Ips                                 = TIps
    namespace Swagger {
        export type Spec   = TSwagger
        export type Format = TSwaggerFormat
        export type Doc    = TSwaggerDoc
    }
}