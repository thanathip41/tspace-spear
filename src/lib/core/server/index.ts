import http, {  
    ServerResponse 
} from 'http';

import { 
    HEADER_CONTENT_TYPES, 
} from '../const';

import { Stream }          from 'stream';
import cluster             from 'cluster';
import os                  from 'os';
import fsSystem            from 'fs';
import pathSystem          from 'path';
import onFinished          from "on-finished";
import WebSocket           from 'ws';
import net                 from 'net';
import { ParserFactory }   from './parser-factory';
import { FastRouter }      from './fast-router';
import { Router }          from './router';
import { Response }        from './response';
import { Compiler }        from '../compiler';
import { AppRoutes }       from '../compiler/pre-routes';

import type { 
    T, 
    TExtractParams, 
    TPrettify, 
    TRegisterRoute 
}  from '../types';

import { 
    CONTROLLER_METADATA, 
    MIDDLEWARE_METADATA, 
    PARAMTYPES_METADATA, 
    ROUTE_METADATA, 
    SERVICE_METADATA, 
    SWAGGER_METADATA 
} from '../metadata';

import { 
    createServer, 
    litenServer 
} from '../utils';


const EMPTY = Object.freeze(Object.create(null));
const EMPTY_ARRAY = Object.freeze([]) as unknown as string[];

/**
 * 
 * The 'Spear' class is used to create a server and handle HTTP requests.
 * 
 * @returns {Spear} application
 * @example
 * new Spear()
 *  .get('/' , () => 'Hello world!')
 *  .get('/json' , () => {
 *     return {
 *       message : 'Hello world!'
 *     }
 *   })
 *  .listen(3000 , () => console.log('server listening on port : 3000'))
 *   
 */
class Spear<
    const TRoutes = {}, 
    const TOptions extends T.Application = {}
> {

    private readonly _controllers ?: (new () => any)[] | { folder : string ,  name ?: RegExp, preRouteTypes ?: boolean};
    private readonly _middlewares ?: T.ContextHandler[] | { folder : string , name ?: RegExp};
    private readonly _router : FastRouter = new FastRouter(); 
    private readonly _parser = new ParserFactory();
    private _globalPrefix : {
        path : string;
        options : {
            exclude    : {
                path: string;
                method ?: T.MethodInput[] | '*';
            }[]
        }
    } = {
        path: '',
        options: {
            exclude : []
        }
    }

    private _adapter : T.Adapter = { kind : 'http', server : http };
    private  _cluster ?: number | boolean;
    private _cors ?: ((req : T.Request , res : T.Response) => void);
    private _swagger : { use : boolean } & T.Swagger.Doc = {
        use : false,
        path : '/api/docs',
        servers : [
            {
                url : '/'
            }
        ],
        tags : [],
        info : {
            title : "API Documentation",
            description : "This is a sample documentation",
            version : "1.0.0"
        }
    }

    private _swaggerSpecs : (T.Swagger.Spec & { path : string , method : string })[] = []
    private _ws : T.WS = {
        handler : null,
        server  : null,
        options : null
    }
    private _errorHandler : T.ErrorFunction | null = null
    private _globalMiddlewares : T.ContextHandler[] = []
    private _formatResponse : Function | null = null
    private _onListeners : Function[] = []
    private _fileUploadOptions : { 
        limit : number  
        tempFileDir : string 
        removeTempFile : { remove : boolean; ms : number }
    } = {
        limit : Infinity,
        tempFileDir : 'tmp',
        removeTempFile : {
            remove : false,
            ms : 1000 * 60 * 10
        }
    }

    private _generatePreRouteTypes !: {
        folder: string
        name: RegExp
    }

    constructor(options: TOptions = {} as TOptions) {
        this._controllers   = options.controllers;
        this._middlewares   = options.middlewares;

        if(options.logger)  this.useLogger();
        if(options.cluster) this.useCluster(options.cluster);
        if(options.adapter) this.useAdapter(options.adapter);
        if(options.globalPrefix) this.useGlobalPrefix(options.globalPrefix);

        // Ensure controllers is NOT an array and has the required shape
        // before enabling automatic route generation (used for E2E typing).
        const isValidControllerObject = 
            this._controllers &&
            !Array.isArray(this._controllers) &&
            typeof this._controllers === "object" &&
            "folder" in this._controllers &&
            "name" in this._controllers &&
            "preRouteTypes" in this._controllers &&
            this._controllers.folder &&
            this._controllers.name &&
            this._controllers.preRouteTypes

        if (isValidControllerObject) {
            // Auto-generate route metadata for type-safe E2E usage;
            this._generatePreRouteTypes = {
                folder: this._controllers.folder!,
                name: this._controllers.name!,
            };
        }
    }

    /**
     * The get 'instance' method is used to get the instance of Spear.
     * 
     * @returns {this}
     */
    get instance (): this {
        
        return this
    }
    
    /**
     * The get 'routers' method is used get the all routers.
     * 
     * @returns {FastRouter}
     */
    get routers (): FastRouter {
        return this._router;
    }

    /**
     * The get 'contract' method is used to get the complete API contract inferred from all registered routes.
     *
     * Includes:
     * - Route paths
     * - HTTP methods
     * - Params
     * - Query
     * - Body
     * - Files
     * - Response
     *
     * @example
     * ```ts
     * type API = typeof app.contract;
     *
     * API["/users/:id"].GET.params
     * API["/users/:id"].GET.response
     * ```
     */
    get contract() {
        return {} as TPrettify<
            TOptions["controllers"] extends { preRouteTypes?: true }
                ? TRoutes & AppRoutes
                : TRoutes
        >
    }
    /**
     * The 'usePreRouteTypes' method is used to create pre routes for e2e and swagger
     * 
     * @param {{object}} options options
     * @property {string} options.folder
     * @property {RegExp} options.name
     * @returns {this}
     */
    public usePreRouteTypes (options : {
        folder: string
        name: RegExp
    }): this {
        this._generatePreRouteTypes = options;
        return this;
    }

    /**
     * The 'ws' method is used to creates the WebSocket server.
     * 
     * @callback {Function} WebSocketServer
     * @param {WebSocketServer} wss - WebSocketServer
     * @returns {this}
     */
    public ws(handlers: () => T.WebSocketHandler, options ?: WebSocket.ServerOptions): this {
        this._ws.handler = handlers();
        this._ws.options = options ?? {};
        return this;
    }

    /**
     * The 'use' method is used to add the middleware into the request pipeline.
     * 
     * @callback {Function} middleware
     * @property  {Object} ctx - context { req , res , query , params , cookies , files , body}
     * @property  {Function} next  - go to next function
     * @returns {this}
     */
    public use (middleware : T.ContextHandler): this {

        this._globalMiddlewares.push(middleware)

        return this
    }

    /**
     * The 'useGlobalPrefix' method is used to sets a global prefix for all routes in the router.
     *
     * This prefix will be prepended to every route path in the application.
     * If `path` is `null`, `undefined`, or an empty string, no global prefix
     * will be applied.
     *
     * @param {string} path - The global route prefix.
     *
     * @param {Object} [options] - Additional configuration options.
     * @param {Array<{ path: string; method?: TMethod | TMethod[] }>} [options.exclude]
     * Routes to exclude from the global prefix.
     *
     * @returns {this} Returns the current router instance for chaining.
     *
     * @example
     * import Spear from "tspace-spear";
     * const app = new Spear()
     * 
     * app.useGlobalPrefix('/api');
     *
     * @example
     * app.useGlobalPrefix('/api', {
     *   exclude: [
     *     { path: '/health' },
     *     { path: '/auth/login', method: 'POST' }
     *   ]
     * });
     */
    public useGlobalPrefix(
        path: string | null,
        options?: {
            exclude?: {
                path: string;
                methods?: T.MethodInput[] | '*';
            }[];
        }
    ): this {

        this._globalPrefix.path = path == null
            ? ''
            : path.replace(/^\/+|\/+$/g, '');

        this._globalPrefix.options.exclude = (
            options?.exclude ?? []
        ).map(route => {

            const method: T.MethodInput[] | '*' =
                route.methods == null || route.methods === '*'
                    ? '*'
                    : route.methods.map(
                        m => m.toUpperCase() as T.MethodInput
                    );

            return {
                path: route.path.replace(/^\/+|\/+$/g, ''),
                method
            };
        });

        return this;
    }

    /**
     * The 'useAdapter' method is used to switch between different server implementations,
     * such as the native Node.js HTTP server or uWebSockets.js (uWS).
     *
     * @param {T.AdapterServer} adapter - The adapter instance (e.g., HTTP or uWS).
     * @returns {this} Returns the current instance for chaining
     */
    public useAdapter (adapter:  T.AdapterServer): this {

       if (adapter === http) {
            this._adapter = { kind: 'http', server: adapter };
        } 
        
        else if (adapter === net) {
            this._adapter = { kind: 'net', server: adapter };
        } 
        
        else {
            //@ts-ignore
            this._adapter = { kind: 'uWS', server: adapter };
        }

        this._parser.useAdapter(this._adapter);

        return this;
    }

    /**
     * The 'useCluster' method is used cluster run the server
     * 
     * @param {boolean | number} cluster
     * @returns {this}
     */
    public useCluster (cluster ?: number | boolean ): this {
        if (cluster === false) return this;
        this._cluster = cluster ?? true;
        return this;
    }

    /**
     * The 'useLogger' method is used to add the middleware view logger response.
     * 
     * @callback {Function} middleware
     * @property  {Object} ctx - context { req , res , query , params , cookies , files , body}
     * @property  {Function} next  - go to next function
     * @returns {this}
     */
    public useLogger ({ methods , exceptPath } : { 
        methods ?: T.MethodInput[];
        exceptPath ?: string[] | RegExp } = {}
    ): this  {
        
        this._globalMiddlewares.push(({ req , res } : T.Context , next : T.NextFunction) => {
           
            const diffTime = (hrtime?: [number, number]) => {
                
                const MS = 1000
    
                if (hrtime == null) return 0
    
                const [start, end] = process.hrtime(hrtime)
    
                const time = ((start * MS ) + (end / 1e6))
                
                return `${time > MS ? `${(time / MS).toFixed(2)} s` : `${time.toFixed(2)} ms`}`
            }
          
            const statusCode = (res: T.Response) => {
             
                const httpStatusCode = res.statusCode();

                const statusCode = httpStatusCode == null ? 500 : httpStatusCode;
                return statusCode < 400
                    ? `\x1b[32m${statusCode}\x1b[0m`
                    : `\x1b[31m${statusCode}\x1b[0m`
            }
            
            if(exceptPath instanceof RegExp && exceptPath.test(req.url!)) return next()
        
            if(Array.isArray(exceptPath) && exceptPath.some(v => req.url! === v)) return next()

            if(
                methods != null && 
                methods.length && 
                !methods.some(v => v.toLowerCase() === req.method!.toLowerCase())
            ) {
                return next();
            }

            const startTime = process.hrtime()
    
            
            //@ts-ignore
            onFinished(res, (): void => {
                console.log(
                    [
                    `[\x1b[1m\x1b[34mINFO\x1b[0m]`,
                    `\x1b[34m${new Date().toJSON()}\x1b[0m`,
                    `\x1b[33m${req.method!}\x1b[0m`,
                    `${decodeURIComponent(req.url!)}`,
                    `${statusCode(res)}`,
                    `${diffTime(startTime)}`,
                    ].join(" ")
                );
            });
            
        
            return next();
        })

        return this
    }

    /**
     * The 'useBodyParser' method is a middleware used to parse the request body of incoming HTTP requests.
     * @param {object?} 
     * @property {array?} except the body parser with some methods
     * @returns {this}
     */
    public useBodyParser ({ except } : { except ?: T.MethodInput[] } = {}): this {

        this._globalMiddlewares.push((ctx : T.Context , next : T.NextFunction) => {

            const { req, res } = ctx;

            if(
                Array.isArray(except) && 
                except.some(v => v.toLowerCase() === (req.method!).toLowerCase())
            ) {
                return next();
            }

            const contentType = req?.headers['content-type'] ?? null;

            if(contentType == null) return next();

            const isFileUpload = contentType && contentType.startsWith('multipart/form-data');

            if(isFileUpload) return next();

            if(req?.body != null) return next();

            Promise.resolve(this._parser.body(req, res))
            .then(body => {
                req.body = body;
                return next();
            })
            .catch(err => {
                return this._nextError(ctx)(err);
            })
        })

        return this
    }

    /**
     * The 'useFileUpload' method is a middleware used to handler file uploads. It adds a file upload of incoming HTTP requests.
     * 
     * @param {?Object} 
     * @property {?number} limits // bytes. default Infinity
     * @property {?string} tempFileDir
     * @property {?Object} removeTempFile
     * @property {boolean} removeTempFile.remove
     * @property {number}  removeTempFile.ms
     * @returns 
     */
    public useFileUpload ({ limit, tempFileDir , removeTempFile } : {
        limit ?: number
        tempFileDir ?: string
        removeTempFile ?: {
            remove : boolean
            ms : number
        }
    } = {}) {

        if(limit != null) {
            this._fileUploadOptions.limit = limit
        }

        if(tempFileDir != null) {
            this._fileUploadOptions.tempFileDir = tempFileDir
        }

        if(removeTempFile != null) {
            this._fileUploadOptions.removeTempFile = removeTempFile
        }
 
        this._globalMiddlewares.push((ctx : T.Context , next : T.NextFunction) => {

            const { req , res } = ctx
          
            if(req.method === 'GET') {
                return next()
            }

            const contentType = req?.headers['content-type'];

            const isFileUpload = contentType && contentType.startsWith('multipart/form-data');

            if(!isFileUpload) return next()

            if(req?.files != null) return next()

            Promise
            .resolve(this._parser.files({ req , res, options : this._fileUploadOptions}))
            .then(r => {
                req.files = r.files
                req.body = r.body
                return next()
            })
            .catch(err => {
                return this._nextError(ctx)(err)
            })
        })

        return this
    }

    /**
     * The 'useCookiesParser' method is a middleware used to parses cookies attached to the client request object.
     *
     * @returns {this}
     */
    public useCookiesParser (): this {

        this._globalMiddlewares.push(({ req } : T.Context , next : T.NextFunction) => {

            if(req?.cookies != null) return next()

            req.cookies = this._parser.cookies(req)
           
            return next()
        })
        
        return this
    }

    /**
     * The 'useRouter' method is used to add the router in the request context.
     * 
     * @parms {Function} router
     * @property  {Function} router - get() , post() , put() , patch() , delete() 
     * @returns {this}
     */
    public useRouter<Routes>(
        router: Router<Routes>
    ): Spear<typeof this.contract & Routes> {

        const routes = router.routes;

        for (const { path, method, handlers } of routes) {
            this[method](
                this._normalizePath(
                    this._resolveGlobalPrefix({ path, method }),
                    path
                ),
                ...handlers
            );
        }

        return this as Spear<typeof this.contract & Routes>
    }

    /**
     * The 'useSwagger' method is a middleware used to create swagger api.
     * 
     * @param {?Object} doc
     * @returns 
     */
    public useSwagger(doc: T.Swagger.Doc = {}) {
        const { path , servers , tags , info , options } = doc;

        this._swagger = {
            use : true,
            options : options,
            path : path ?? this._swagger.path,
            servers : servers ?? this._swagger.servers,
            tags : tags ?? this._swagger.tags,
            info : info ?? this._swagger.info
        }

        return this
    }

    /**
     * The 'listen' method is used to bind and start a server to a particular port and optionally a hostname.
     * 
     * @param {number} port 
     * @param {function} callback 
     * @returns 
     */
    public async listen(
        port : number, 
        hostname?: string | ((callback: { server: T.Server; port: number }) => void),
        callback ?: (callback : { server : T.Server , port : number }) => void
    ) : Promise<T.Server> {

        if(arguments.length === 2 && typeof hostname === 'function') {
            callback = hostname
        }

        const server = await this._createServer();

        if(this._generatePreRouteTypes) {
            await new Compiler().generateRoutes(
                this._globalPrefix.path,
                this._generatePreRouteTypes
            )
        }

        if(
            this._cluster != null && 
            this._cluster || typeof this._cluster === 'number'
        ) {
            this._clusterMode({
                server,
                port,
                hostname,
                callback
            })
            return server
        }
 
        litenServer({
            adapterKind: this._adapter.kind,
            server,
            port,
            hostname,
            callback,
            onListening: async () => {
                this._onListeners.forEach(listener => listener());

                if (this._swagger.use) {
                    await this._swaggerHandler();
                }
            },
        })

        return server
    }
    /**
     * The 'cors' is used to enable the cors origins on the server.
     * 
     * @params {Object} 
     * @property {(string | RegExp)[]} origins
     * @property {boolean} credentials
     * @returns 
     */
    public cors({ origins , credentials } : {
        origins ?: (string | RegExp)[] , 
        credentials ?: boolean
    } = {}) {

        this._cors = ((req, res) => {

            const origin = req.headers?.origin ?? null

            if(origin == null) return

            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS')
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

            if(Array.isArray(origins) && origins.length) {

                for(const o of origins) {

                    if(typeof o === 'string' && (o === origin || o === '*')) {
                        res.setHeader('Access-Control-Allow-Origin', origin)
                        continue
                    }
                    
                    if(o instanceof RegExp && o.test(origin)) {
                        res.setHeader('Access-Control-Allow-Origin', origin)
                    }
                }
            }

            if(credentials) {
                res.setHeader('Access-Control-Allow-Credentials', 'true');
            }

            if (req.method === 'OPTIONS') {
                res.writeHead(204, { 'Content-Length': '0' });
                res.end()
                return
            }
            
            return
        })

        return this
    }

    /**
     * The 'response' method is used to format the response
     * 
     * @param {function} format 
     * @returns 
     */
    public response (format : (r : unknown , statusCode : number) => Record<string,any> | string) {
        this._formatResponse = format
        return this
    }

    /**
     * The 'catch' method is middleware that is specifically designed to handle errors.
     * 
     * that occur during the processing of requests
     * 
     * @param {function} error 
     * @returns 
     */
    public catch (error : (err : any , ctx : T.Context) => T.Response) {
        this._errorHandler = error
        return this
    }

    /**
     * The 'notfound' method is middleware that is specifically designed to handle errors notfound that occur during the processing of requests
     * 
     * @param {function} fn
     * @returns 
     */
    public notfound (fn : (ctx : T.Context) => T.Response) {

        const handler = ({ req , res } : T.Context) => {

            const ctx = this._createContext({ req , res , ps: {} });

            return fn(ctx);
        }
    
        this.all('*', handler);

        return this
    }

    /**
     * The 'get' method is used to add the request handler to the router for the 'GET' method.
     * 
     * @param {string} path
     * @callback {...Function[]} handlers of the middlewares
     * @property  {Object} ctx - context { req , res , query , params , cookies , files , body}
     * @property  {Function} next  - go to next function
     * @returns {this}
     */
    public get<
        const Path extends string,
        const Handlers extends { 
            cb(
                ctx: T.Context<{ params: TExtractParams<Path>}>, 
                next: T.NextFunction
            ): any 
        }["cb"][]
    >(
        path: Path, 
        ...handlers: Handlers
    ): Spear<TRegisterRoute<TRoutes, Path, "GET", Handlers>,TOptions> { 

        this._onListeners.push(() => {
            return this._router.get(
                this._normalizePath(this._resolveGlobalPrefix({ path , method : 'get' }), path), 
                this._wrapHandlers(
                    ...this._globalMiddlewares,
                    ...handlers as unknown as T.ContextHandler[]
                )
            );
        })

        return this as Spear<TRegisterRoute<TRoutes, Path, "GET", Handlers>,TOptions>;
    }

    /**
     * The 'post' method is used to add the request handler to the router for the 'POST' method.
     * 
     * @param {string} path
     * @callback {...Function[]} handlers of the middlewares
     * @property  {Object} ctx - context { req , res , query , params , cookies , files , body}
     * @property  {Function} next  - go to next function
     * @returns {this}
     */
    public post<
        const Path extends string,
        const Handlers extends { 
            cb(
                ctx: T.Context<{ params: TExtractParams<Path>}>, 
                next: T.NextFunction
            ): any 
        }["cb"][]
    >(
        path: Path, 
        ...handlers: Handlers
    ): Spear<TRegisterRoute<TRoutes, Path, "POST", Handlers>,TOptions> {
        this._onListeners.push(() => {
            return this._router.post(
                this._normalizePath(this._resolveGlobalPrefix({ path , method : 'post' }), path),  
                this._wrapHandlers(
                    ...this._globalMiddlewares,
                    ...handlers as unknown as T.ContextHandler[]
                )
            );
        })

        return this as Spear<TRegisterRoute<TRoutes, Path, "POST", Handlers>,TOptions>;
    }

    /**
     * The 'put' method is used to add the request handler to the router for the 'PUT' method.
     * 
     * @param {string} path
     * @callback {...Function[]} handlers of the middlewares
     * @property  {Object} ctx - context { req , res , query , params , cookies , files , body}
     * @property  {Function} next  - go to next function
     * @returns {this}
     */
    public put<
        const Path extends string,
        const Handlers extends { 
            cb(
                ctx: T.Context<{ params: TExtractParams<Path>}>, 
                next: T.NextFunction
            ): any 
        }["cb"][]
    >(
        path: Path, 
        ...handlers: Handlers
    ): Spear<TRegisterRoute<TRoutes, Path, "PUT", Handlers>,TOptions> {
        this._onListeners.push(() => {
            return this._router.put(
                this._normalizePath(this._resolveGlobalPrefix({ path , method : 'put' }), path), 
                 this._wrapHandlers(
                    ...this._globalMiddlewares,
                    ...handlers as unknown as T.ContextHandler[]
                )
            );
        })
        return this as Spear<TRegisterRoute<TRoutes, Path, "PUT", Handlers>,TOptions>;
    }

    /**
     * The 'patch' method is used to add the request handler to the router for the 'PATCH' method.
     * 
     * @param {string} path
     * @callback {...Function[]} handlers of the middlewares
     * @property  {Object} ctx - context { req , res , query , params , cookies , files , body}
     * @property  {Function} next  - go to next function
     * @returns {this}
     */
    public patch<
        const Path extends string,
        const Handlers extends { 
            cb(
                ctx: T.Context<{ params: TExtractParams<Path>}>, 
                next: T.NextFunction
            ): any 
        }["cb"][]
    >(
        path: Path, 
        ...handlers: Handlers
    ): Spear<TRegisterRoute<TRoutes, Path, "PATCH", Handlers>,TOptions> {
        this._onListeners.push(() => {
            return this._router.patch(
                this._normalizePath(this._resolveGlobalPrefix({ path , method : 'patch' }), path),  
                this._wrapHandlers(
                    ...this._globalMiddlewares,
                    ...handlers as unknown as T.ContextHandler[]
                )
            );
        })
        return this as Spear<TRegisterRoute<TRoutes, Path, "PATCH", Handlers>,TOptions>;
    }

    /**
     * The 'delete' method is used to add the request handler to the router for the 'DELETE' method.
     * 
     * @param {string} path
     * @callback {...Function[]} handlers of the middlewares
     * @property  {Object} ctx - context { req , res , query , params , cookies , files , body}
     * @property  {Function} next  - go to next function
     * @returns {this}
     */
    public delete<
        const Path extends string,
        const Handlers extends { 
            cb(
                ctx: T.Context<{ params: TExtractParams<Path>}>, 
                next: T.NextFunction
            ): any 
        }["cb"][]
    >(
        path: Path, 
        ...handlers: Handlers
    ): Spear<TRegisterRoute<TRoutes, Path, "DELETE", Handlers>,TOptions> {
        this._onListeners.push(() => {
            return this._router.delete(
                this._normalizePath(this._resolveGlobalPrefix({ path , method : 'delete' }), path), 
                this._wrapHandlers(
                    ...this._globalMiddlewares,
                    ...handlers as unknown as T.ContextHandler[]
                )
            );
        })
        return this as Spear<TRegisterRoute<TRoutes, Path, "DELETE", Handlers>,TOptions>
    }

    /**
     * The 'head' method is used to add the request handler to the router for 'HEAD' methods.
     * 
     * @param {string} path
     * @callback {...Function[]} handlers of the middlewares
     * @property  {object} ctx - context { req , res , query , params , cookies , files , body}
     * @property  {function} next  - go to next function
     * @returns {this}
     */
    public head<
        const Path extends string,
        const Handlers extends { 
            cb(
                ctx: T.Context<{ params: TExtractParams<Path>}>, 
                next: T.NextFunction
            ): any 
        }["cb"][]
    >(
        path: Path, 
        ...handlers: Handlers
    ): Spear<TRegisterRoute<TRoutes, Path, "HEAD", Handlers>,TOptions> {
        this._onListeners.push(() => {
            return this._router.head(
                this._normalizePath(this._resolveGlobalPrefix({ path , method : 'head' }), path), 
                this._wrapHandlers(
                    ...this._globalMiddlewares,
                    ...handlers as unknown as T.ContextHandler[]
                )
            );
        })
        return this as Spear<TRegisterRoute<TRoutes, Path, "HEAD", Handlers>,TOptions>
    }

    /**
     * The 'options' method is used to add the request handler to the router for 'OPTIONS' methods.
     * 
     * @param {string} path
     * @callback {...Function[]} handlers of the middlewares
     * @property  {object} ctx - context { req , res , query , params , cookies , files , body}
     * @property  {function} next  - go to next function
     * @returns {this}
     */
    public options <
        const Path extends string,
        const Handlers extends { 
            cb(
                ctx: T.Context<{ params: TExtractParams<Path>}>, 
                next: T.NextFunction
            ): any 
        }["cb"][]
    >(
        path: Path, 
        ...handlers: Handlers
    ): Spear<TRegisterRoute<TRoutes, Path, "OPTIONS", Handlers>,TOptions> {
        this._onListeners.push(() => {
            return this._router.options(
                this._normalizePath(this._resolveGlobalPrefix({ path , method : 'options' }), path), 
                this._wrapHandlers(
                    ...this._globalMiddlewares,
                    ...handlers as unknown as T.ContextHandler[]
                )
            );
        })
        return this as Spear<TRegisterRoute<TRoutes, Path, "OPTIONS", Handlers>,TOptions>
    }

    /**
     * The 'all' method is used to add the request handler to the router for 'GET' 'POST' 'PUT' 'PATCH' 'DELETE' 'HEAD' 'OPTIONS' methods.
     * 
     * @param {string} path
     * @callback {...Function[]} handlers of the middlewares
     * @property  {object} ctx - context { req , res , query , params , cookies , files , body}
     * @property  {function} next  - go to next function
     * @returns {this}
     */
    public all<
        const Path extends string,
        const Handlers extends { 
            cb(
                ctx: T.Context<{ params: TExtractParams<Path>}>, 
                next: T.NextFunction
            ): any 
        }["cb"][]
    >(
        path: Path, 
        ...handlers: Handlers
    ): Spear<TRegisterRoute<TRoutes, Path, "GET" | "POST" | "PUT" | "PATCH" | "DELETE", Handlers>,TOptions> {
        this._onListeners.push(() => {
            return this._router.all(
                this._normalizePath(this._resolveGlobalPrefix({ path , method : 'all' }), path), 
                 this._wrapHandlers(
                    ...this._globalMiddlewares,
                    ...handlers as unknown as T.ContextHandler[]
                )
            );
        })
        return this as Spear<TRegisterRoute<TRoutes, Path, "GET" | "POST" | "PUT" | "PATCH" | "DELETE", Handlers>,TOptions>
    }

    private async _import(
        dir: string,
        pattern?: RegExp
    ): Promise<string[]> {

        const recursive = dir.endsWith("*");

        const root = recursive
            ? dir.slice(0, -1)
            : dir;

        return this._scan(root, pattern, recursive);
    }

    private async _scan(
        dir: string,
        pattern?: RegExp,
        recursive = false
    ): Promise<string[]> {

        const entries = await fsSystem.promises.readdir(dir, {
            withFileTypes: true,
        })

        const result: string[] = [];

        for (const entry of entries) {
            const fullPath = pathSystem.resolve(
                dir,
                entry.name
            );

            if (entry.isDirectory()) {

                if (recursive) {
                    result.push(
                        ...(await this._scan(
                            fullPath,
                            pattern,
                            true
                        ))
                    );
                }

                continue;
            }

            if (
                !pattern ||
                pattern.test(entry.name)
            ) {

                result.push(fullPath);
            }
        }

        return result;
    }

    private async _registerControllers(): Promise<void> {
        
        if(this._controllers == null) return;

        if(!Array.isArray(this._controllers)) {
           
            let failDir = false;
            const controllers = await this._import(
                this._controllers.folder, 
                this._controllers.name
            ).catch(err => {
                 console.log(
                    `\x1b[31m[ControllerLoader ERROR]\x1b[0m Failed to read directory:\n` +
                    `Error: ${err.message}\n`
                );
                failDir = true;
                return [];
            })

            if(!controllers.length && !failDir) {
                console.log(
                    `\x1b[33m[ControllerLoader Warning]\x1b[0m No controllers found in:\n` +
                    `\x1b[36m${this._controllers.folder}\x1b[0m\n\n` +
                    `Using pattern:\n` +
                    `\x1b[36m${this._controllers.name}\x1b[0m`
                );

                console.log(
                    `\nMake sure that:\n` +
                    `- the folder path exists\n` +
                    `- controller files match the pattern\n` +
                    `- recursive scanning is enabled for nested folders\n\n` +
                    `Example:\n` +
                    `\x1b[36m${this._controllers.folder}/*\x1b[0m\n`
                );
            }

            for(const file of controllers) {

                const imported = await import(file)
              
                let maybeController = imported?.default;

                if(maybeController == null) {

                    const entry = Object
                    .entries(imported)
                    .find(([name]) => {
                        return /controller$/i.test(name)
                    })
                    ;
                    maybeController = entry?.[1];
                }
                
                const controller = maybeController

                if (typeof controller !== "function") {
                    console.log(
                        `\x1b[31m[ControllerLoader ERROR]\x1b[0m \x1b[36m${file}\x1b[0m must export a controller class`
                    );
                    continue;
                }

                const controllerInstance = this._createController(controller);
    
                const prefixPath: string = Reflect.getMetadata(CONTROLLER_METADATA, controller) ?? '';

                const routers: T.Router[] = Reflect.getMetadata(ROUTE_METADATA, controller) ?? [];

                const swaggers: (
                    T.Swagger.Spec & 
                    { handler : string | symbol }
                )[] = Reflect.getMetadata(SWAGGER_METADATA, controller) ?? [];

                const middlewares = Reflect.getMetadata(MIDDLEWARE_METADATA, controller) ?? [];

                for(const { method, path, handler } of Array.from(routers)) {

                    const find = Array.from(swaggers).find(s => s.handler === handler)

                    if(find != null) {
                        const globalPrefix =  this._resolveGlobalPrefix({ 
                            path : this._normalizePath( prefixPath, path), 
                            method 
                        });

                        this._swaggerSpecs = [
                            ...this._swaggerSpecs , 
                            {
                                ...find,
                                path : this._normalizePath(globalPrefix , prefixPath, path),
                                method
                            }
                        ]
                    }
                
                    this[method](
                        this._normalizePath(
                            prefixPath,
                            path
                        ), 
                        ...this._normalizeMiddlewares(middlewares),
                        controllerInstance[String(handler)].bind(controllerInstance)
                    )
                }
            }

            return
        }

        for(const controller of this._controllers) {

            const controllerInstance = this._createController(controller);

            const prefixPath: string = Reflect.getMetadata(CONTROLLER_METADATA, controller) ?? '';

            const routers: T.Router[] = Reflect.getMetadata(ROUTE_METADATA, controller) ?? [];

            const swaggers: (
                T.Swagger.Spec & 
                { handler : string | symbol }
            )[] = Reflect.getMetadata(SWAGGER_METADATA, controller) ?? [];

            const middlewares = Reflect.getMetadata(MIDDLEWARE_METADATA, controller) ?? [];

            for(const { method, path, handler } of Array.from(routers)) {

                const find = Array.from(swaggers).find(s => s.handler === handler)

                if(find != null) {
                    const globalPrefix =  this._resolveGlobalPrefix({ 
                        path : this._normalizePath( prefixPath, path), 
                        method 
                    });
                        
                    this._swaggerSpecs = [
                        ...this._swaggerSpecs , 
                        {
                            ...find,
                            path : this._normalizePath(globalPrefix , prefixPath, path),
                            method
                        }
                    ]
                }

                this[method](
                    this._normalizePath(
                        prefixPath, 
                        path
                    ), 
                    ...this._normalizeMiddlewares(middlewares),
                    controllerInstance[String(handler)].bind(controllerInstance)
                )
            }
        }
    }

    private _createController(ControllerClass: new (...args: any[]) => any) {

        const services =
            Reflect.getMetadata(
                SERVICE_METADATA,
                ControllerClass
            ) ?? [];

        const constructorTypes =
            Reflect.getMetadata(
                PARAMTYPES_METADATA,
                ControllerClass
            ) ?? [];

        if (!constructorTypes.length) {
            return new ControllerClass();
        }

        if (!services.length) {
            throw new Error(
                `\x1b[31m[ServiceLoader ERROR]\x1b[0m \x1b[36m${ControllerClass.name}\x1b[0m requires dependencies but no @Service() decorator was found`
            );
        }

        const serviceMap = new Map<any, any>();

        for (const ServiceClass of services) {

            if (
                typeof ServiceClass !== 'function'
            ) {
                throw new Error(
                    `\x1b[31m[ServiceLoader ERROR]\x1b[0m Invalid service in @Service() of ${ControllerClass.name}`
                );
            }

            serviceMap.set(
                ServiceClass,
                new ServiceClass()
            );
        }

        const injections = [];

        const available = services.length
            ? services
                .map((s: any) => s.name)
            : 'None';


        for (const DependencyClass of constructorTypes) {

            const service = serviceMap.get(
                DependencyClass
            );

            if (!service) {

                throw new Error([
                        '\x1b[31m[ServiceLoader ERROR]\x1b[0m',
                        '',
                        `\x1b[36mController\x1b[0m : ${ControllerClass.name}`,
                        `\x1b[36mDependency\x1b[0m : ${DependencyClass.name}`,
                        `\x1b[36mAvailable \x1b[0m : ${available.join(', ')}`,
                        '',
                        '\x1b[33mHint\x1b[0m',
                        '@Service([',
                        `    ${available.join(',\n    ')},`,
                        `    ${DependencyClass.name}`,
                        '])',
                        '',
                        `Register '${DependencyClass.name}' in @Service()`
                    ].join('\n')
                );
            }

            injections.push(service);
        }

        return new ControllerClass(
            ...injections
        );
    }

    private _normalizeMiddlewares = (mids: any[]): T.ContextHandler[] => {
        const result: T.ContextHandler[] = [];

        const visit = (item: any): void => {
            if (Array.isArray(item)) {
                item.forEach(visit);
                return;
            }

            if (!item) return;

            if (typeof item === "function") {
                const proto = item.prototype;

                if (proto && proto !== Object.prototype) {
                    const instance = new item();

                    Object.getOwnPropertyNames(proto)
                        .filter(name => name !== "constructor")
                        .forEach(name => {
                            if (typeof instance[name] === "function") {
                                result.push(instance[name].bind(instance));
                            }
                        });

                    return;
                }

                result.push(item);
            }
        };

        mids.forEach(visit);

        return result;
    };

    private async _registerMiddlewares(): Promise<void> {

        if(this._middlewares == null) return

        if(!Array.isArray(this._middlewares)) {
           
            let failDir = false;

            const middlewares = await this._import(
                this._middlewares.folder, 
                this._middlewares.name
            )
            .catch(err => {
                 console.log(
                    `\x1b[31m[MiddlewareLoader ERROR]\x1b[0m Failed to read directory:\n` +
                    `Error: ${err.message}\n`
                );
                failDir = true;
                return [];
            })

             if(!middlewares.length && !failDir) {
                console.log(
                    `\x1b[33m[MiddlewareLoader Warning]\x1b[0m No middlewares found in:\n` +
                    `\x1b[36m${this._middlewares.folder}\x1b[0m\n\n` +
                    `Using pattern:\n` +
                    `\x1b[36m${this._middlewares.name}\x1b[0m`
                );

                console.log(
                    `\nMake sure that:\n` +
                    `- the folder path exists\n` +
                    `- middleware files match the pattern\n` +
                    `- recursive scanning is enabled for nested folders\n\n` +
                    `Example:\n` +
                    `\x1b[36m${this._middlewares.folder}/*\x1b[0m\n`
                );
            }

            for(const file of middlewares) {

                const imported = await import(file)

                let maybeMiddleware = imported?.default;
                
                if(maybeMiddleware == null) {
                    
                    const entry = Object
                    .entries(imported)
                    .find(([name]) => {
                        return /middleware$/i.test(name)
                    })
                    ;
                    maybeMiddleware = entry?.[1];
                }
                
                const middleware = maybeMiddleware;

                if (typeof middleware !== "function") {
                    console.log(
                        `\x1b[31m[MiddlewareLoader ERROR]\x1b[0m \x1b[36m${file}\x1b[0m must export a middleware`
                    );
                    continue;
                }

                this.use(middleware)
            }

            return
        }
        
        const middlewares = this._middlewares

        for(const middleware of middlewares) {
            this.use(middleware);
        }

        return
    }

    private _wrapHandlers (...handlers : T.ContextHandler[]) {

        return (req : T.Request, res : T.Response , ps : Record<string,string>) => {

            const dispatch = (index: number = 0): void => {

                const handler = handlers[index];

                if (!handler) return;

                const ctx = this._createContext({ req, res, ps });

                try {
                    const next = () => dispatch(index + 1);

                    const isLast = index === handlers.length - 1;

                    if (isLast) {
                        return this._wrapResponse(handler)(
                            ctx, 
                            this._nextError(ctx)
                        );
                    }

                    return handler(ctx, next);
                } catch (err) {
                    return this._nextError(ctx)(err);
                }
            };

            return dispatch();
        }
    }

    private _wrapResponse(handler: T.ContextHandler) {
        return (ctx: T.Context, next: T.NextFunction) => {
            Promise.resolve(handler(ctx, next))
            .then(result => {
               
                if (ctx.res.writableEnded()) {
                    return;
                }

                if (result instanceof ServerResponse) {
                    return;
                }

                if(result instanceof Stream) {
                    return;
                }
   
                if (result == null) {
                    ctx.res.noContent();
                    return;
                }

                if (typeof result === 'string') {
                    ctx.res.end(result);
                    return;
                }

                ctx.res.json(result);
                return;
            })
            .catch(err => {
                return next(err);
            })
        };
    }

    private _nextError (ctx : T.Context) {

        const NEXT_MESSAGE = "The 'next' function does not have any subsequent function."
        
        return (err ?: any) => {
            if(ctx.res.writableEnded()) return;
        
            let statusCode = 
            typeof err?.statusCode === 'number' && 
            Number.isFinite(err.statusCode)
                ? err.statusCode
                : ctx.res.statusCode();

            statusCode = statusCode < 400 ? 500 : statusCode;
            
            const errorMessage = err?.message || NEXT_MESSAGE
            
            if(this._errorHandler != null) {
                err.statusCode = statusCode;
                return this._errorHandler(err, ctx);
            }

            if(!ctx.res.headersSent()) {
                ctx.res.writeHead(statusCode, HEADER_CONTENT_TYPES['json']);
            }

            if(this._formatResponse != null) {

                ctx.res.end(JSON.stringify(
                    this._formatResponse({ 
                        message : errorMessage
                    }, statusCode))
                );

                return;
            }

            ctx.res.end(JSON.stringify({
                statusCode : statusCode,
                message    : errorMessage
            }));  

            return;
        } 
    }

    private _clusterMode ({ server , port , hostname, callback} : {
        server : T.Server;
        port : number;
        hostname?: string | ((callback: { server: T.Server; port: number }) => void),
        callback ?: (callback : { server : T.Server , port : number }) => void 
    }) {

        if (cluster.isPrimary) {

            const numCPUs = os.cpus().length

            const maxWorkers = typeof this._cluster === 'boolean' || this._cluster == null
            ? numCPUs
            : this._cluster

            for (let i = 0; i < maxWorkers; i++) {
                cluster.fork()
            }

            cluster.on('exit', () => {
                cluster.fork()
            })
        } 

        if(cluster.isWorker) {
            
            litenServer({
                adapterKind: this._adapter.kind,
                server,
                port,
                hostname,
                callback,
                onListening: async () => {
                    this._onListeners.forEach(listener => listener());

                    if (this._swagger.use) {
                        await this._swaggerHandler();
                    }
                },
            })
        }

        return
    }

    private async _createServer () : Promise<T.Server> {
       
        await this._registerMiddlewares();

        await this._registerControllers();

        const lookup = this._router.lookup.bind(this._router);

        const cors = this._cors;

        const adapter = this._adapter;

        const ws = this._ws;

        const server = createServer({
            adapter,
            ws,
            cors,
            lookup
        })

        return server as T.Server;
    }

    private _createContext({ req, res, ps } : {
        req: T.Request
        res: T.Response
        ps: Record<string, string>
    }) : any {

        const request = req as T.Request;

        const response = new Response(req, res, {
            formatResponse : this._formatResponse,
            adapter        :  this._adapter.kind
        }) as T.Response

        const headers = req.headers as T.Headers;
        const params = ps as T.Params;

        const body    = request.body as T.Body;
        const files   = request.files as T.FileUpload;
        const cookies = request.cookies as T.Cookies;

        const query = this._parser.queryString(req.url!) as T.Query || {};

        const xff  = headers['x-forwarded-for'];
        const xrip = headers['x-real-ip'];
        const cfip = headers['cf-connecting-ip'];

        let ips: T.Ips = [];

        if (cfip) {
            ips = Array.isArray(cfip) ? cfip : [cfip]
        } else if (xff) {
            ips = Array.isArray(xff) ? xff : [xff]
        } else if (xrip) {
            ips = Array.isArray(xrip) ? xrip : [xrip]
        } else {
            const addr = req.socket?.remoteAddress
            ips = addr ? [addr] : EMPTY_ARRAY
        }

        const ip = (ips.length ? ips[0] : null) as T.Ip

        request.params = params
        request.query  = query
        request.ip     = ip
        request.ips    = ips

        return {
            req: request,
            res: response,
    
            headers: headers ?? EMPTY,
            params: params ?? EMPTY,

            query,
            body: body  ?? EMPTY,
            files: files ?? EMPTY,
            cookies: cookies ?? EMPTY,

            ip,
            ips
        }
    }

    private _normalizePath(...paths: string[]): string {

        const path = paths
            .filter(Boolean)
            .join('/')
            .replace(/\/+/g, '/')
            .replace(/\/+$/, '');

        let normalizedPath =
            path.startsWith('/')
                ? path
                : `/${path}`;

        const globalPrefix =
            this._globalPrefix.path
                .replace(/^\/+|\/+$/g, '');

        if (globalPrefix) {

            const duplicatedPrefix =
                `/${globalPrefix}/${globalPrefix}/`;

            normalizedPath =
                normalizedPath.replace(
                    duplicatedPrefix,
                    `/${globalPrefix}/`
                );

            if (
                normalizedPath ===
                `/${globalPrefix}/${globalPrefix}`
            ) {
                normalizedPath = `/${globalPrefix}`;
            }
        }

        return normalizedPath || '/';
    }

    private async _swaggerHandler () {

        const routes = (this.routers as unknown as { routes : any[]})
        .routes
        .filter(r => {
            return [
                "GET","POST",
                "PUT","PATCH",
                "DELETE",
                "HEAD","OPTIONS"
            ].includes(r.method)
        })
       
        const { 
            path, 
            html, 
            staticSwaggerHandler, 
            staticUrl 
        } = await this._parser.swagger({
            ...this._swagger,
            specs : this._swaggerSpecs,
            routes,
            globalPrefix: this._globalPrefix
        })

        this._router.get(staticUrl, staticSwaggerHandler)

        this._router.get(path as string , (req: T.Request, res: T.Response) => {

            res.writeHead(200, HEADER_CONTENT_TYPES['html']);
            
            res.end(html);

            return;
        })

        return
    }

    private _resolveGlobalPrefix(
        {
            path,
            method
        }: {
            path: string | '*';
            method: T.Method | '*';
        }
    ): string {

        const globalPrefix = this._globalPrefix.path;

        if (!globalPrefix) {
            return '';
        }

        if (path === '*') {
            return `/${globalPrefix}`;
        }

        const cleanPath = path.replace(/^\/+|\/+$/g, '');
        const upperMethod = method.toUpperCase();
        const exclude = this._globalPrefix.options.exclude;

        const isExcluded = exclude.some(route => {

            const methods = route.method ?? '*';

            if (
                methods !== '*' &&
                !methods.includes(upperMethod as T.MethodInput)
            ) {
                return false;
            }

            const routePath = route.path.replace(/^\/+|\/+$/g, '');

            if (routePath === cleanPath) {
                return true;
            }

            if (routePath.endsWith('/*')) {

                const basePath = routePath.slice(0, -2);

                return (
                    cleanPath === basePath ||
                    cleanPath.startsWith(basePath + '/')
                );
            }

            return false;
        });

        return isExcluded
            ? ''
            : `/${globalPrefix}`;
    }
}

export class Application extends Spear {}
export { Spear }
export default Spear