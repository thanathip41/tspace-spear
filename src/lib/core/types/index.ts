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

type TRequest = IncomingMessage & Partial<any>

type THttpResponder = {
    /**200+ */
    ok              : (data ?: Record<string,any>) => any;
    created         : (data ?: Record<string,any>) => any; 
    accepted        : (data ?: Record<string,any>) => any;

    /**400+ */
    noContent       : (message?: string) => any;
    badRequest      : (message?: string) => any;
    unauthorized    : (message?: string) => any;
    paymentRequired : (message?: string) => any;
    forbidden       : (message?: string) => any;
    unprocessable   : (message?: string) => any;
    tooManyRequests : (message?: string) => any;
    notFound        : (message?: string) => any;

    /**500+ */
    serverError     : (message?: string) => any;
    badGateway      : (message?: string) => any;
    unavailable     : (message?: string) => any;
    gatewayTimeout  : (message?: string) => any;

    /**helper */
    json            : (data?: Record<string,any>) => any;
    error           : (err: any) => any;
    send            : (message : string) => any;
    html            : (html : string) => any;
    status          : (code : TStatusCode) => {
        json : (data?: Record<string,any>) => any;
        send : (message : string) => any;
    };
    setCookies      : (cookies : Record<string, string | { 
        value       : string
        path        ?: string
        sameSite    ?: 'Strict' | 'Lax' | 'None'
        domain      ?: string
        secure      ?: boolean
        httpOnly    ?: boolean
        expires     ?: Date
    }>) => any
}

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

type Handler = (res: unknown, req: unknown) => void | Promise<void>;

type UWS = {
  App: () => {
    get: (path: string, handler: Handler) => any;
    post: (path: string, handler: Handler) => any;
    patch: (path: string, handler: Handler) => any;
    put: (path: string, handler: Handler) => any;
    del: (path: string, handler: Handler) => any;
    any: (path: string, handler: Handler) => any;
    options: (path: string, handler: Handler) => any;
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
    middlewares  ?: TRequestFunction[] | { folder : string , name ?: RegExp };
    globalPrefix ?: string;
    logger       ?: boolean;
    cluster      ?: boolean | number; 
    adapter      ?: TAdapter
}

type TRequestFunction = (ctx : TContext , next : TNextFunction) => any
  
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
    connection : (ws: WebSocket) => void | string | Buffer;
    message    : (ws: WebSocket, data: WebSocket.Data) => void | string | Buffer;
    close      : (ws: WebSocket, code: number, reason: Buffer) => void;
    error      : (ws: WebSocket, error: Error) => void;
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
    type RequestFunction  = TRequestFunction
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