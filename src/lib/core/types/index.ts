import http, { 
    type IncomingMessage, 
    type ServerResponse, 
    type IncomingHttpHeaders, 
    type OutgoingHttpHeader, 
    type OutgoingHttpHeaders,
} from "http";

import WebSocket from "ws";
import net from 'net';

export interface ContextExtensions  {
  req     : TRequest
  res     : TResponse
  headers : THeaders
  params  : TParams
  cookies : TCookies
  ip      : TIp
  ips     : TIps

  body    : TBody
  query   : TQuery
  files   : TFileUpload
}

type TContext<
    Override extends Partial<
        Pick<
            ContextExtensions, 
            "body" | "query" | "files" | "params" | "headers"
        >
    > = {}
> = Omit<ContextExtensions, keyof Override> & Override

type TIp = string | null
type TIps = string[]

type THeaders<T = IncomingHttpHeaders> = {
   [K in keyof T]: T[K]
}

type TQuery<T = Record<string, string | undefined>> = T

type TParams<T = Record<string, string | number | undefined>> = T

type TBody<T = Record<string, any>> = T;

type TCookies<T = Record<string, string | undefined>> = T

type TFile = {
    size: number;
    sizes : {
        bytes : number;
        kb    : number;
        mb    : number;
        gb    : number;
    };
    tempFilePath: string;
    tempFileName : string;
    mimetype: string;
    extension : string;
    name: string;
    write : (to : string) => Promise<void>;
    remove : () => Promise<void>;
}

type TFileUpload<T = Record<string, TFile[] | undefined>> = T

type TNextFunction<T = any> = (err ?: Error) =>  T | Promise<T> 

type TRequest = {
    uWs     : any; // typeof import('uWebSockets.js').HttpRequest
    http    : IncomingMessage;
    query   : TQuery;
    files   : TFileUpload;
    body    : TBody;
    params  : TParams;
    headers : THeaders;
} & Partial<any>

type TResponse = {
    /**
     * Raw uWS HttpResponse instance.
     */
    uWS: any; // typeof import('uWebSockets.js').HttpResponse
    http : ServerResponse;
    
    writableEnded: boolean;
    aborted: boolean;
    writeHeaders: Record<string,any>;
    headersSent: boolean;
    statusCode: number;

    writeHead: (statusCode: TStatusCode, headers?: OutgoingHttpHeaders | OutgoingHttpHeader[]) => any

    setHeader: (name: string, value: number | string | readonly string[]) => any

    end<T = any>(chunk?: string | Buffer, encoding?: BufferEncoding) : T.Response & T

    /** 200 OK - Standard successful response */
    ok: <T extends Record<string, any>>(data?: T) => T.Response & T

    /** 201 Created - Resource successfully created */
    created: <T extends Record<string, any>>(data?: T) => T.Response & T

    /** 202 Accepted - Request accepted for processing */
    accepted: <T extends Record<string, any>>(data?: T) => T.Response & T

    /** 204 No Content - Successful request with no response body */
    noContent: <T extends string> (message?: T) => T.Response & T

    /** 400 Bad Request - Invalid request from client */
    badRequest: <T extends string> (message?: T) => T.Response & T

    /** 401 Unauthorized - Authentication required or failed */
    unauthorized: <T extends string> (message?: T) => T.Response & T

    /** 402 Payment Required - Reserved for future/payment flow */
    paymentRequired: <T extends string> (message?: T) => T.Response & T

    /** 403 Forbidden - Client does not have access rights */
    forbidden: <T extends string> (message?: T) => T.Response & T

    /** 404 Not Found - Resource does not exist */
    notFound: <T extends string> (message?: T) => T.Response & T

    /** 422 Unprocessable Entity - Valid request but semantic errors */
    unprocessable: <T extends string> (message?: T) => T.Response & T

    /** 429 Too Many Requests - Rate limit exceeded */
    tooManyRequests: <T extends string> (message?: T) => T.Response & T

    /** 500 Internal Server Error - Generic server failure */
    serverError: <T extends string> (message?: T) => T.Response & T

    /** 502 Bad Gateway - Invalid response from upstream server */
    badGateway: <T extends string> (message?: T) => T.Response & T

    /** 503 Service Unavailable - Server temporarily unavailable */
    unavailable: <T extends string> (message?: T) => T.Response & T

    /** 504 Gateway Timeout - Upstream server timeout */
    gatewayTimeout: <T extends string> (message?: T) => T.Response & T

    /**
     * Serve a media file (video, image, PDF, etc.) from file system.
     * @param filePath Absolute or relative path to media file
     */
    serveMedia: (filePath: string) => any;

    /**
     * Send JSON response.
     * @param data JSON serializable object
     */
    json: <T extends Record<string, any>>(data?:T) => T.Response & T

    /**
     * Send error response (generic wrapper).
     * @param err Error object or message
     */
    error: (err: any) => any

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
        json: <T extends Record<string, any>>(data?:T) => T.Response & T

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

    /**
     * Set HTTP status code.
     * @param code http status code
     */
    setStatusCode : (code : TStatusCode) => void
};

type TStatusCode = 
| 200 | 201 | 202 | 203 | 204
| 300 | 301 | 302 | 303 | 304
| 400 | 401 | 402 | 403 | 404 | 405 | 406 | 407 | 408 | 409
| 410 | 411 | 412 | 413 | 414 | 415 | 416 | 417 | 418 | 421 
| 422 | 423 | 424 | 425 | 426 | 428 | 429 | 431 | 451
| 500 | 501 | 502 | 503 | 504 | 505

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

type TMethodInput = Uppercase<Exclude<TMethod, 'all'>>;

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

type TAdapter =
  | { kind: 'http'; server: typeof http }
  | { kind: 'net'; server: typeof net }
  | { kind: 'uWS'; server: UWS };

type TAdapterServer = typeof http | typeof net | UWS


type TApplication = {
    controllers  ?: (new (...args:any) => any)[] | { folder : string ,  name ?: RegExp; preRouteTypes ?: boolean };
    middlewares  ?: TContextHandler[] | { folder : string , name ?: RegExp };
    globalPrefix ?: string;
    logger       ?: boolean;
    cluster      ?: boolean | number; 
    adapter      ?: TAdapterServer;

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
    }[];
    globalPrefix ?:  {
        path : string;
        options : {
            exclude    : {
                path: string;
                method ?: T.MethodInput[] | '*';
            }[]
        }
    }
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

type TSwaggerPropertyOptions = {
    type: "array";
    items: TSwaggerPropertyOptions; 
    enum?: never;               
    required?: boolean;
    example?: any;
    description?: string;
    format?: TSwaggerFormat;
} | {
    type?: Exclude<TSwaggerType, "array">;
    enum?: (string | number)[];
    required?: boolean;
    example?: any;
    description?: string;
    format?: TSwaggerFormat;
    items?: never;
};

type TSwagger = {
    disabled ?: boolean
    // --
    description ?: string
    summary ?: string,
    bearerToken ?: boolean
    tags        ?: string[]
    params ?: Record<string , TSwaggerPropertyOptions>
    query ?: Record<string , TSwaggerPropertyOptions>
    body  ?: {
        required ?: boolean,
        description ?: string,
        properties : Record<string , TSwaggerPropertyOptions>
    }
    files  ?: {
        required ?: boolean,
        description ?: string,
        properties : Record<string , TSwaggerPropertyOptions>
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

type Route<
  Params = never,
  Query = never,
  Body = never,
  Files = never,
  Response = unknown
> = {
  params: Params;
  query: Query;
  body: Body;
  files: Files;
  response: Response;
};

type Last<T extends any[]> = T extends [...any[], infer L] ? L : never;

type _ParseParams<Path extends string> =
  Path extends `${infer _Before}:${infer Param}/${infer After}`
    ? { [K in Param]: string } & _ParseParams<After>
    : Path extends `${infer _Before}:${infer Param}`
    ? { [K in Param]: string }
    : unknown;

type ParseParams<Path extends string> = 
  unknown extends _ParseParams<Path> 
    ? never 
    : TPrettify<_ParseParams<Path>>;

type ExtractRoute<H, Path extends string> = H extends (ctx: infer C, ...args: any[]) => infer R
  ? Route<
      C extends { params: infer P }
        ? [P] extends [never]
          ? ParseParams<Path>
          : ParseParams<Path> extends never
            ? P 
            : TPrettify<Omit<ParseParams<Path>, keyof P> & P>
        : ParseParams<Path>,
      C extends { query: infer Q } ? Q : never,
      C extends { body: infer B } ? B : never,
      C extends { files: infer F } ? F : never,
      Awaited<R>
    >
  : Route<never, never, never, never, unknown>;

type AddRoute<
  Routes,
  Path extends string,
  Method extends string,
  Info
> = Omit<Routes, Path> & {
  [P in Path]: (P extends keyof Routes ? Routes[P] : {}) & {
    [M in Method]: Info;
  };
};

export type TPrettify<T> = {
  [K in keyof T]: T[K] extends object ? TPrettify<T[K]> : T[K];
} & {};

export type TRegisterRoute<
  Routes,
  Path extends string,
  Method extends string,
  Handlers extends any[]
> = AddRoute<Routes, Path, Method, ExtractRoute<Last<Handlers>, Path>>;

export declare namespace T {
    type Context<
        O extends Partial<Pick<
            ContextExtensions, "query" | "params" | "body" | "files" | "headers">
        > = {}
    >                     = TContext<O>
    type Adapter          = TAdapter
    type AdapterServer    = TAdapterServer
    type Application      = TApplication
    type NextFunction     = TNextFunction
    type File             = TFile
    type Router           = TRouter
    type Route            = TRoute
    type Method           = TMethod
    type ErrorFunction    = TErrorFunction
    type ContextHandler   = TContextHandler
    type WebSocketHandler = TWSHandler
    type StatusCode       = TStatusCode
    type MethodInput      = TMethodInput
    type Response         = TResponse
    type Request          = TRequest

    type Headers<T = IncomingHttpHeaders>  = THeaders<T>
    type Ip                                = TIp
    type Ips                               = TIps
    type FileInput                         = TFile

    type FileUpload<T = Record<string, TFile[] | undefined>>     = T
    type Cookies<T = Record<string, string | undefined>>         = TCookies<T>
    type Params<T = Record<string, string | number | undefined>> = TParams<T>
    type Query<T = Record<string, string  | undefined>>          = TQuery<T>
    type Body<T = Record<string, any>>                           = TBody<T>
    namespace Swagger {
        export type Spec   = TSwagger
        export type Format = TSwaggerFormat
        export type Doc    = TSwaggerDoc
    }
}