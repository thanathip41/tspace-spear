import http, { 
    type IncomingMessage, 
    type ServerResponse,
    type OutgoingHttpHeader, 
    type OutgoingHttpHeaders,
} from "http";

import WebSocket from "ws";
import net, { Socket } from 'net';

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

type TServer = {
    listen(
        port: number,
        hostname?:  string | ((callback: { server: T.Server; port: number }) => void),
        callback?: (data: { server: T.Server; port: number }) => void
    ): void;
    on(event: string | symbol, listener: (...args: any[]) => void): void;
    close(callback?: (err?: Error) => void): void;
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

type THeaders=  Record<string, string | undefined>

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

export type TResponseError<T,C> = { message : T , statusCode : C }

type TResponse = {
    /**
     * Raw uWS HttpResponse instance.
     */
    uWS: any; // typeof import('uWebSockets.js').HttpResponse
    http : ServerResponse;
    net : Socket;
    
    writableEnded: () => boolean;
    aborted: () => boolean;
    writeHeaders: () => Record<string,any>;
    headersSent: () => boolean;
    statusCode: () => number;

    set(name: string, value: number | string | readonly string[]): any;
    set(statusCode: TStatusCode, contentType?: 'TEXT' | 'JSON'): void;
    set(statusCode: TStatusCode, headers?: OutgoingHttpHeaders | OutgoingHttpHeader[]): any;

    writeHead: (statusCode: TStatusCode, headers?: OutgoingHttpHeaders | OutgoingHttpHeader[]) => any;

    setHeader: (name: string, value: number | string | readonly string[]) => any;

    setStatusCode(statusCode: TStatusCode, contentType?: 'TEXT' | 'JSON'): void;

    /** 200 OK - Standard successful response */
    ok: <T extends Record<string, any>>(data?: T) => T.Response & T

    /** 201 Created - Resource successfully created */
    created: <T extends Record<string, any>>(data?: T) => T.Response & T

    /** 202 Accepted - Request accepted for processing */
    accepted: <T extends Record<string, any>>(data?: T) => T.Response & T

    /** 204 No Content - Successful request with no response body */
    noContent: () => T.Response;

    /** 206 Partial Content - Successful request with a partial response body */
    partialContent: () => T.Response

    /** 400 Bad Request - Invalid request from client */
    badRequest: <T extends string, C = 400> (message?: T) => TResponseError<T,C>;
     
    /** 401 Unauthorized - Authentication required or failed */
    unauthorized: <T extends string, C = 401> (message?: T) =>  TResponseError<T,C>

    /** 402 Payment Required - Reserved for future/payment flow */
    paymentRequired: <T extends string, C = 402> (message?: T) => TResponseError<T,C>

    /** 403 Forbidden - Client does not have access rights */
    forbidden: <T extends string, C = 403> (message?: T) => TResponseError<T,C>

    /** 404 Not Found - Resource does not exist */
    notFound: <T extends string, C = 404> (message?: T) => TResponseError<T,C>

    /** 405 Method Not Allowed - HTTP method is not supported for this resource */
    notAllowed: <T extends string, C = 405> (message?: T) => TResponseError<T,C>

    /** 408 Request Timeout - The server timed out waiting for the request */
    timeout: <T extends string, C = 408> (message?: T) => TResponseError<T,C>

    /** 409 Conflict - Request could not be completed due to a conflict with the current state of the resource */
    conflict: <T extends string, C = 409> (message?: T) => TResponseError<T,C>

    /** 413 Content Too Large - Request payload exceeds the allowed size */
    tooLarge: <T extends string, C = 413> (message?: T) => TResponseError<T,C>

    /** 422 Unprocessable Entity - Valid request but semantic errors */
    unprocessable: <T extends string, C = 422> (message?: T) => TResponseError<T,C>

    /** 429 Too Many Requests - Rate limit exceeded */
    tooManyRequests: <T extends string, C = 429> (message?: T) => TResponseError<T,C>

    /** 500 Internal Server Error - Generic server failure */
    serverError: <T extends string, C = 500> (message?: T) => TResponseError<T,C>

    /**
     * Serve a media file (video, image, PDF, etc.) from file system.
     * @param filePath Absolute or relative path to media file
     */
    serveMedia: (filePath: string) => any;

    /**
     * Send JSON response.
     * @param data JSON serializable object
     */
    json: <T extends Record<string, any>>(data?:T) => T.Response & T;

    /**
     * Send error response (generic wrapper).
     * @param err Error object or message
     */
    error: (err: any) => TResponseError<'Internal Server Error',500>;

    /**
     * Ends the response, optionally sending a final chunk.
     *
     * @param chunk Final response body.
     * @param encoding String encoding.
     * @returns The response instance.
     */
    end: <T = string>(chunk?: T | Buffer, encoding?: BufferEncoding) => T.Response & T

    /**
     * Send plain text response.
     * @param message Text content
     */
    send: <T = string>(message: T) => T.Response & T;

    /**
     * Send HTML response.
     * @param html HTML string
     */
    html:<T = string>(html: T) => T.Response & T;

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
};

type TStatusCode =
  // 1xx Informational
  | 100 | 101 | 102 | 103

  // 2xx Success
  | 200 | 201 | 202 | 203 | 204 | 205 | 206 | 207 | 208 | 226

  // 3xx Redirection
  | 300 | 301 | 302 | 303 | 304 | 305 | 307 | 308

  // 4xx Client Errors
  | 400 | 401 | 402 | 403 | 404 | 405 | 406 | 407 | 408 | 409
  | 410 | 411 | 412 | 413 | 414 | 415 | 416 | 417 | 418
  | 421 | 422 | 423 | 424 | 425 | 426 | 428 | 429 | 431 | 451

  // 5xx Server Errors
  | 500 | 501 | 502 | 503 | 504 | 505 | 506 | 507 | 508 | 510 | 511;

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

export type UWS = {
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
    /**
     * The 'complie' is variable name of the Spear instance used during compilation
     * (e.g. `"app"` for `const app = new Spear()`).
     *
     * @default "app"
     */
    complie ?: string | boolean; 
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
  Response = unknown,
  Error = never
> = {
  params: Params;
  query: Query;
  body: Body;
  files: Files;
  response: Response;
  errors : Error
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

type ExtractResponse<T> = Awaited<T> extends infer R
    ? R extends TResponse & infer U
        ? U
        : R extends TResponseError<infer E , infer S>
            ? never
            : R
    : never;

type ExtractError<T> = Awaited<T> extends infer R
    ? R extends TResponse
        ? never
        : R extends TResponseError<infer E , infer S>
            ? { message: E; statusCode: S }
            : R
    : never;

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
    ExtractResponse<R>,
    ExtractError<R>
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

export type TExtractParams<Path extends string> = 
    Path extends `${string}:${infer Param}/${infer Rest}`
        ? { [K in Param]: string | number } & TExtractParams<`/${Rest}`>
        : Path extends `${string}:${infer Param}`
        ? { [K in Param]: string | number }
        : {};

export type TPrettify<T> = {
  [K in keyof T]: T[K] extends Date
    ? T[K]
    : T[K] extends object
      ? TPrettify<T[K]>
      : T[K];
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
    type Server           = TServer

    type Headers          = THeaders
    type Ip               = TIp
    type Ips              = TIps
    type FileInput        = TFile

    type FileUpload<T = Record<string, TFile[] | undefined>>     = T
    type Cookies<T = Record<string, string | undefined>>         = TCookies<T>
    type Params<T = Record<string, string | number | undefined>> = TParams<T>
    type Query<T = Record<string, string  | undefined>>          = TQuery<T>
    type Body<T = Record<string, any>>                           = TBody<T>
    type WS = {
        handler ?: WebSocketHandler | null;
        server  ?: WebSocket.Server | null;
        options ?: WebSocket.ServerOptions | null;
    }
    namespace Swagger {
        export type Spec   = TSwagger
        export type Format = TSwaggerFormat
        export type Doc    = TSwaggerDoc
    }
}