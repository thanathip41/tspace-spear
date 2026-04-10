import http, { 
    IncomingMessage, 
    Server, 
    ServerResponse 
} from 'http';

import { Stream }          from 'stream';
import cluster             from 'cluster';
import os                  from 'os';
import fsSystem            from 'fs';
import pathSystem          from 'path';
import onFinished          from "on-finished";
import WebSocket           from 'ws';
import { ParserFactory }   from './parser-factory';
import { FastRouter }      from './fast-router';
import { Router }          from './router';
import type { T }          from '../types';
import { Response }        from './response';


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
class Spear {

    private readonly _controllers ?: (new () => any)[] | { folder : string ,  name ?: RegExp};
    private readonly _middlewares ?: T.ContextHandler[] | { folder : string , name ?: RegExp};
    private readonly _router : FastRouter = new FastRouter();
    private readonly _parser = new ParserFactory();
    private _globalPrefix : string = '';
    private _adapter : T.Adapter = http;
    private  _cluster ?: number | boolean;
    private _cors ?: ((req : IncomingMessage , res : ServerResponse) => void);
    private _swagger : { use : boolean } & T.Swagger.Doc = {
        use : false,
        path : '/api/docs',
        servers : [
            {
                url : 'http://localhost:3000'
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
    private _ws !: {
        handler ?: T.WebSocketHandler;
        server  ?: WebSocket.Server;
        options ?: WebSocket.ServerOptions;
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

    private socketClose = 0;
    
    constructor({
        controllers,
        middlewares,
        globalPrefix,
        logger,
        cluster,
        adapter
    } : T.Application = {}) {
        this._controllers   = controllers;
        this._middlewares   = middlewares;
        
        if(logger)  this.useLogger();
        if(cluster) this.useCluster(cluster);
        if(adapter) this.useAdater(adapter);
        if(globalPrefix) this.useGlobalPrefix(globalPrefix);
      
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
     * The 'ws' method is used to creates the WebSocket server.
     * 
     * @callback {Function} WebSocketServer
     * @param {WebSocketServer} wss - WebSocketServer
     * @returns {this}
     */
    public ws(handlers: () => T.WebSocketHandler, options ?: WebSocket.ServerOptions): this {
        this._ws.handler = handlers()
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
     * If `globalPrefix` is `null` or `undefined`, it will default to an empty string,
     * meaning no prefix will be applied.
     *
     * @param {string | null} globalPrefix - The base path prefix to apply to all routes.
     * @returns {this} Returns the current instance for method chaining.
     */
    public useGlobalPrefix(globalPrefix: string | null): this {
        this._globalPrefix = globalPrefix == null ? '' : globalPrefix;
        return this;
    }

    /**
     * The 'useAdater' method is used to switch between different server implementations,
     * such as the native Node.js HTTP server or uWebSockets.js (uWS).
     *
     * @param {T.Adapter} adapter - The adapter instance (e.g., HTTP or uWS).
     * @returns {this} Returns the current instance for chaining
     */
    public useAdater (adapter :  T.Adapter): this {
        this._adapter = adapter;
        this._parser.useAdater(adapter);
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
              const statusCode = res.statusCode == null ? 500 : Number(res.statusCode);
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
    public useRouter (router : Router): this {

        const routes = router.routes

        for(const { path , method , handlers } of routes) {
            this[method](this._normalizePath(this._globalPrefix , path) , ...handlers)
        }

        return this
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
        hostname?: string | ((callback: { server: Server; port: number }) => void),
        callback ?: (callback : { server : Server , port : number }) => void
    ) : Promise<Server> {

        if(arguments.length === 2 && typeof hostname === 'function') {
            callback = hostname
        }

        const server = await this._createServer();

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
 
        if ('App' in this._adapter) {

            const handler = () => {
                this._onListeners.forEach(listener => listener());

                if (this._swagger.use) {
                    this._swaggerHandler();
                }

                callback?.({ server, port });
            };

            if (hostname) {
                server.listen(port, String(hostname), handler);
            } else {
                server.listen(port, handler);
            }

            return server;
        }

        const args: any[] = hostname
        ? [port, hostname, () => callback?.({ server, port: port })]
        : [port, () => callback?.({ server, port: port })];

        server.listen(...args);

        server.on('listening', () => {
            this._onListeners.forEach(listener => listener())

            if(this._swagger.use) {
                this._swaggerHandler()
            }
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
    public get (path : string , ...handlers : T.ContextHandler[]): this {

        this._onListeners.push(() => {
            return this._router.get(
                this._normalizePath(this._globalPrefix, path), 
                this._wrapHandlers(...this._globalMiddlewares,...handlers)
            );
        })

        return this
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
    public post (path : string , ...handlers : T.ContextHandler[]): this {
        this._onListeners.push(() => {
            return this._router.post(
                this._normalizePath(this._globalPrefix, path),  
                this._wrapHandlers(...this._globalMiddlewares,...handlers)
            );
        })
        return this
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
    public put (path : string , ...handlers : T.ContextHandler[]): this {
        this._onListeners.push(() => {
            return this._router.put(
                this._normalizePath(this._globalPrefix, path), 
                this._wrapHandlers(...this._globalMiddlewares,...handlers)
            );
        })
        return this
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
    public patch (path : string , ...handlers : T.ContextHandler[]): this {
        this._onListeners.push(() => {
            return this._router.patch(
                this._normalizePath(this._globalPrefix, path),  
                this._wrapHandlers(...this._globalMiddlewares,...handlers)
            );
        })
        return this
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
    public delete (path : string , ...handlers : T.ContextHandler[]): this {
        this._onListeners.push(() => {
            return this._router.delete(
                this._normalizePath(this._globalPrefix, path), 
                this._wrapHandlers(...this._globalMiddlewares,...handlers)
            );
        })
        return this
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
    public head (path : string , ...handlers : T.ContextHandler[]): this {
        this._onListeners.push(() => {
            return this._router.head(
                this._normalizePath(this._globalPrefix, path), 
                this._wrapHandlers(...this._globalMiddlewares,...handlers)
            );
        })
        return this
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
    public options (path : string , ...handlers : T.ContextHandler[]): this {
        this._onListeners.push(() => {
            return this._router.options(
                this._normalizePath(this._globalPrefix, path), 
                this._wrapHandlers(...this._globalMiddlewares,...handlers)
            );
        })
        return this
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
    public all (path : string , ...handlers : T.ContextHandler[]): this {
        this._onListeners.push(() => {
            return this._router.all(
                this._normalizePath(this._globalPrefix, path), 
                this._wrapHandlers(...this._globalMiddlewares,...handlers)
            );
        })
        return this
    }

    private async _import (dir: string , pattern ?: RegExp): Promise<string[]> {
        const directories = fsSystem.readdirSync(dir, { withFileTypes: true });
        const files = (await Promise.all(
          directories.map((directory) => {
            const newDir = pathSystem.resolve(String(dir), directory.name);
            if(pattern == null) {
                return directory.isDirectory() ? this._import(newDir) : newDir;
            }
            return directory.isDirectory() 
            ? this._import(newDir) 
            : pattern.test(directory.name) 
              ? newDir
              : null
          })
        )).filter(d => d != null)

        return [].concat(...files as any[]);
    }

    private async _registerControllers(): Promise<void> {
        
        if(this._controllers == null) return

        if(!Array.isArray(this._controllers)) {
           
            const controllers = await this._import(this._controllers.folder , this._controllers.name)

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

                const controllerInstance = new controller();
    
                const prefixPath: string = Reflect.getMetadata("controllers", controller) ?? ''

                const routers: T.Router[] = Reflect.getMetadata("routers", controller) ?? []

                const swaggers: any[] = Reflect.getMetadata("swaggers", controller) ?? []

                if(prefixPath == null) continue
    
                for(const { method, path, handler } of Array.from(routers)) {

                    const find = Array.from(swaggers).find(s => s.handler === handler)

                    if(find != null) {
                        this._swaggerSpecs = [
                            ...this._swaggerSpecs , 
                            {
                                ...find,
                                path : this._normalizePath(this._globalPrefix , prefixPath, path),
                                method
                            }
                        ]
                    }
                
                    this[method](
                        this._normalizePath(this._globalPrefix ,prefixPath ,path), 
                        controllerInstance[String(handler)].bind(controllerInstance)
                    )
                }
            }

            return
        }

        for(const controller of this._controllers) {

            const controllerInstance = new controller();

            const prefixPath: string = Reflect.getMetadata("controllers", controller) ?? ''

            const routers: T.Router[] = Reflect.getMetadata("routers", controller) ?? []

            const swaggers: any[] = Reflect.getMetadata("swaggers", controller) ?? []

            if(prefixPath == null) continue

            for(const { method, path, handler} of Array.from(routers)) {

                const find = Array.from(swaggers).find(s => s.handler === handler)

                if(find != null) {
                    this._swaggerSpecs = [
                        ...this._swaggerSpecs , 
                        {
                            ...find,
                            path : this._normalizePath(this._globalPrefix , prefixPath, path),
                            method
                        }
                    ]
                }

                this[method](
                    this._normalizePath(this._globalPrefix , prefixPath, path), 
                    controllerInstance[String(handler)].bind(controllerInstance)
                )
            }
        }
    }

    private async _registerMiddlewares(): Promise<void> {

        if(this._middlewares == null) return

        if(!Array.isArray(this._middlewares)) {
           
            const middlewares = await this._import(this._middlewares.folder , this._middlewares.name)

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

    private _customizeResponse (req : IncomingMessage, res : ServerResponse) : T.Response {

        const response = res as unknown as T.Response

        const parser = this._parser

        response.stream = (filePath : string) => {
            return parser.pipeStream({ req , res , filePath })
        }

        response.json = (results ?: Record<string,any>) => {

            if (res.writableEnded) return;

            if(typeof results === 'string') {

                if(!res.headersSent) {
                    res.writeHead(200, { 'Content-Type': 'text/plain' })
                }

                return res.end(results)
            }

            if(!res.headersSent) {
                res.writeHead(200, { 'Content-Type': 'application/json' })
            }

            if(results == null) {

                if(this._formatResponse != null) {
                    return res.end(JSON.stringify(this._formatResponse(null, res.statusCode)))
                }
    
                return res.end()

            }
            
            if(this._formatResponse != null) {
                
                return res.end(JSON.stringify(
                    this._formatResponse({ 
                        ...results
                    }, res.statusCode))
                )
            }

            return res.end(JSON.stringify({
                ...results,
            }))
        }

        response.send = (results : string) => {

            if (res.writableEnded) {
                return;
            }

            return res.end(results);
        }

        response.html = (results : string) => {

            if (res.writableEnded) return;

            res.writeHead(res.statusCode, {'Content-Type': 'text/html'})

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

            if (this._formatResponse) {
                return res.end(
                    JSON.stringify(this._formatResponse(payload, code))
                )
            }

            return res.end(JSON.stringify(payload))
        }

        response.ok = (results ?: Record<string,any> ) => {
            return response.json(results == null ? {} : results)
        }

        response.created = (results ?: Record<string,any>) => {
            response.status(201)
            return response.json(results == null ? {} : results)
        }

        response.accepted = (results ?: Record<string,any>) => {
            response.status(202)
            return response.json(results == null ? {} : results)
        }

        response.noContent = () => {
            response.status(204)
            return res.end()
        }

        response.badRequest = (message ?: string) => {

            if (res.writableEnded) return;
            
            response.status(400)

            message = message ?? `The request '${req.url}' resulted in a bad request. Please review the data and try again.`

            if(this._formatResponse != null) {
                return res.end(JSON.stringify(this._formatResponse({ message }, 400) ))
            }

            return res.end(JSON.stringify({
                message : message 
            }))
        }

        response.unauthorized = (message ?: string) => {
            response.status(401)

            message = message ?? `The request '${req.url}' is unauthorized. Please verify.`

            if(this._formatResponse != null) {
                return res.end(JSON.stringify(this._formatResponse({ message }, 401) ))
            }

            return res.end(JSON.stringify({
                message
            }))
        }

        response.paymentRequired = (message ?: string) => {
            response.status(402)

            message = message ?? `The request '${req.url}' requires payment. Please proceed with payment.`

            if(this._formatResponse != null) {
                return res.end(JSON.stringify(this._formatResponse({ message }, 402) ))
            }

            return res.end(JSON.stringify({
                message
            }))
        }

        response.forbidden = (message ?: string) => {
            response.status(403)

            message = message ?? `The request '${req.url}' is forbidden. Please check the permissions or access rights.`

            if(this._formatResponse != null) {
                return res.end(JSON.stringify(this._formatResponse({ message }, 403) ))
            }

            return res.end(JSON.stringify({
                message
            }))
        }

        response.notFound = (message ?: string) => {
   
            response.status(404)

            message = message ?? `The request '${req.url}' was not found. Please re-check the your url again.`

            if(this._formatResponse != null) {
                return res.end(JSON.stringify(this._formatResponse({ message }, 404) ))
            }

            return res.end(JSON.stringify({
                message
            }))
        }

        response.unprocessable = (message ?: string) => {
   
            response.status(422)

            message = message ?? `The request to '${req.url}' failed validation.`

            if(this._formatResponse != null) {
                return res.end(JSON.stringify(this._formatResponse({ message }, 422) ))
            }

            return res.end(JSON.stringify({
                message
            }))
        }

        response.tooManyRequests = (message ?: string) => {
   
            response.status(429)

            message = message ?? `The request '${req.url}' is too many request. Please wait and try agian.`

            if(this._formatResponse != null) {
                return res.end(JSON.stringify(this._formatResponse({ message }, 429) ))
            }

            return res.end(JSON.stringify({
                message
            }))
        }

        response.serverError = (message ?: string) => {
           
            response.status(500)

            message = message ?? `The request '${req.url}' resulted in a server error. Please investigate.`

            if(this._formatResponse != null) {
                return res.end(JSON.stringify(this._formatResponse({ message }, 500) ))
            }

            return res.end(JSON.stringify({
                message 
            }))
        }

        response.status = (code : number) => {

            res.writeHead(code, { 'Content-Type': 'application/json' })
            
            return res as unknown as {
                json : (data?: { [key: string]: any }) => void;
                send : (message : string) => void;
            }
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

            if('App' in this._adapter) {
                for(const cookie of cookieLists) {
                    res.setHeader('Set-Cookie', cookie)
                }
                return;
            }
            res.setHeader('Set-Cookie', cookieLists)
        }

        return response
    }

    private _wrapHandlers (...handlers : T.ContextHandler[]) {

        return (req : IncomingMessage, res : ServerResponse , ps : Record<string,string>) => {

            const ctx = this._createContext({ req , res , ps });
           
            const dispatch = (index: number = 0) => {

                try {
                    
                    const handler = handlers[index];

                    if (!handler) return;

                    const result = index === handlers.length - 1
                    ? this._wrapResponse(handler)(ctx, this._nextError(ctx))
                    : handler(ctx, () => dispatch(index + 1));

                    return Promise.resolve(result);

                } catch (err) {
                    return this._nextError(ctx)(err);
                }
            };

            return dispatch();
        }
    }

    private _wrapResponse(handler: T.ContextHandler) {
        return (ctx: T.Context, next: T.NextFunction) => {

            const handleResult = (result : unknown) : void => {

                if (ctx.res.writableEnded) {
                    return;
                }

                if (result instanceof ServerResponse) {
                    return;
                }

                if(result instanceof Stream) {
                    return;
                }
                    
                if (result == null) {
                   
                    if (!ctx.res.headersSent) {
                        ctx.res.writeHead(204, { 'Content-Type': 'text/plain' });
                    }
                    ctx.res.end();

                    return;
                }

                if (typeof result === 'string') {
                    ctx.res.send(result)
                    return;
                }

                if (this._formatResponse != null) {
                    const formattedResult = this._formatResponse(result, ctx.res.statusCode);

                    if (typeof formattedResult === 'string') {
                        if (!ctx.res.headersSent) {
                            ctx.res.writeHead(200, { 'Content-Type': 'text/plain' });
                        }
                        ctx.res.end(formattedResult);
                    
                        return;
                    }

                    if (!ctx.res.headersSent) {
                        ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
                    }

                    ctx.res.end(JSON.stringify(formattedResult));
                   
                    return;
                }

                if (!ctx.res.headersSent) {
                    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
                }

                ctx.res.end(JSON.stringify(result));
                return;
            }

            Promise.resolve(handler(ctx, next))
            .then(result => handleResult(result))
            .catch(err => next(err))
        };
    }

    private _nextError (ctx : T.Context) {

        const NEXT_MESSAGE = "The 'next' function does not have any subsequent function."
        
        return (err ?: any) => {

            const errorMessage = err?.message || NEXT_MESSAGE
            
            if(this._errorHandler != null) {
                return this._errorHandler(new Error(errorMessage), ctx);
            }

            ctx.res.writeHead(500, { 'Content-Type': 'application/json' });

            if(this._formatResponse != null) {

                ctx.res.end(JSON.stringify(
                    this._formatResponse({ 
                        message : errorMessage
                    }, ctx.res.statusCode))
                );

                return;
            }
            
            ctx.res.end(JSON.stringify({
                message : errorMessage
            }));  

            return;
        } 
    }

    private _clusterMode ({ server , port , hostname, callback} : {
        server : Server;
        port : number;
        hostname?: string | ((callback: { server: Server; port: number }) => void),
        callback ?: (callback : { server : Server , port : number }) => void 
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
            
            if ('App' in this._adapter) {

                const handler = () => {
                    this._onListeners.forEach(listener => listener());

                    if (this._swagger.use) {
                        this._swaggerHandler();
                    }

                    callback?.({ server, port });
                };

                if (hostname) {
                    server.listen(port, hostname as string, handler);
                    return server;
                }

                server.listen(port, handler);
                
                return server;
            }

            const args: any[] = hostname
            ? [port, hostname, () => callback?.({ server, port: port })]
            : [port, () => callback?.({ server, port: port })];

            server.listen(...args);

            server.on('listening', () => {
                this._onListeners.forEach(listener => listener())
    
                if(this._swagger.use) {
                    this._swaggerHandler()
                }
            })
    
            server.on('error', (_: NodeJS.ErrnoException) => {
                port = Math.floor(Math.random() * 8999) + 1000
                server.listen(port)
            })
        }

        return
    }

    private async _createServer () : Promise<Server> {
       
        await this._registerMiddlewares();

        await this._registerControllers();

        const lookup = this._router.lookup.bind(this._router);

        const cors = this._cors;

        const adapter = this._adapter;

        if ('App' in adapter) {
            const server = adapter.App();

            server.any('/*', (uwsRes, uwsReq) => {

                const { req , res } = this._uWSRequestResponse(uwsReq, uwsRes);
                
                if(cors) cors(req, res);
                
                return lookup(req, res);
            })

            if (this._ws?.handler) {
                server.ws('/*', {
                    open: (ws) => {
                        this._ws.handler?.connection?.(ws);
                    },

                    message: (ws, message) => {
                        this._ws.handler?.message?.(ws, Buffer.from(message));
                    },

                    close: (ws, code, message) => {
                        this._ws.handler?.close?.(ws, code, Buffer.from(message));
                    }
                });
            }

            return server as unknown as Server;
        } 

        const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
            if (cors) cors(req, res);
            this._router.lookup(req,res)
        })

        if (this._ws?.handler) {
            this._ws.server = new WebSocket.Server({ server , ...this._ws.options });

            this._ws.server.on('connection', (ws) => {

                if (this._ws.handler?.connection) {
                    this._ws.handler.connection(ws);
                }

                ws.on('message', (data) => {
                    this._ws.handler?.message?.(ws, data);
                });

                ws.on('close', (code, reason) => {
                    if (this._ws.handler?.close) {
                        this._ws.handler?.close(ws, code, reason);
                    }
                });

                ws.on('error', (err) => {
                    if (this._ws.handler?.error) {
                        this._ws.handler!.error(ws, err);
                    }
                });
            });
        }
        
        return server as Server
    }

    private _createContext({ req, res, ps } : {
        req: IncomingMessage
        res: ServerResponse
        ps: Record<string, string>
    }) {

        const request = req as T.Request;
        // const response = this._customizeResponse(req, res) as T.Response;
        const response = new Response(req,res)
        .format(this._formatResponse) 
        .isUwebStocket('App' in this._adapter) as unknown as T.Response

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
            ips = addr ? [addr] : []
        }

        const ip = (ips.length ? ips[0] : null) as T.Ip

        request.params = params
        request.query  = query
        request.ip     = ip
        request.ips    = ips

        return {
            req: request,
            res: response,

            headers: headers || {},
            params: params || {},

            query,
            body: body || {},
            files: files || {},
            cookies: cookies || {},

            ip,
            ips
        }
    }

    private _uWSRequestResponse(uwsReq : any , uwsRes : any) {

        const req  : Record<string,any> = {
          method: String(uwsReq.getMethod()).toUpperCase(),
          url: uwsReq.getUrl() + (uwsReq.getQuery() ? `?${uwsReq.getQuery()}` : ''),
          headers: {}
        }

        uwsReq.forEach((key: string | number, value: any) => req.headers[key] = value)
      
        const res = {
            writeHeader: (key : string, value : string) => {
            if (!res.aborted) {
                uwsRes.writeHeader(key, value);
            }
            return res;
            },
            setHeader : (key : string, value : string) => {
                if (!res.aborted) {
                    uwsRes.writeHeader(key, value);
                }
                return res;
            },
            writeHead(status : number , context : Record<string,string>){
                
                res.writeHeaders = {
                    ...res.writeHeaders,
                    [status] : context
                }

                res.headersSent = true

                res.statusCode = status

                return res
            },
            _writeHead(status : number , context : Record<string,string>){
            
                const statusMessages : Record<number,string> = {
                    100: 'Continue',
                    101: 'Switching Protocols',
                    102: 'Processing',
                    200: 'OK',
                    201: 'Created',
                    202: 'Accepted',
                    203: 'Non-Authoritative Information',
                    204: 'No Content',
                    205: 'Reset Content',
                    206: 'Partial Content',
                    207: 'Multi-Status',
                    208: 'Already Reported',
                    226: 'IM Used',
                    300: 'Multiple Choices',
                    301: 'Moved Permanently',
                    302: 'Found',
                    303: 'See Other',
                    304: 'Not Modified',
                    305: 'Use Proxy',
                    306: '(Unused)',
                    307: 'Temporary Redirect',
                    308: 'Permanent Redirect',
                    400: 'Bad Request',
                    401: 'Unauthorized',
                    402: 'Payment Required',
                    403: 'Forbidden',
                    404: 'Not Found',
                    405: 'Method Not Allowed',
                    406: 'Not Acceptable',
                    407: 'Proxy Authentication Required',
                    408: 'Request Timeout',
                    409: 'Conflict',
                    410: 'Gone',
                    411: 'Length Required',
                    412: 'Precondition Failed',
                    413: 'Payload Too Large',
                    414: 'URI Too Long',
                    415: 'Unsupported Media Type',
                    416: 'Range Not Satisfiable',
                    417: 'Expectation Failed',
                    418: 'I\'m a teapot',
                    421: 'Misdirected Request',
                    422: 'Unprocessable Entity',
                    423: 'Locked',
                    424: 'Failed Dependency',
                    425: 'Too Early',
                    426: 'Upgrade Required',
                    428: 'Precondition Required',
                    429: 'Too Many Requests',
                    431: 'Request Header Fields Too Large',
                    451: 'Unavailable For Legal Reasons',
                    500: 'Internal Server Error',
                    501: 'Not Implemented',
                    502: 'Bad Gateway',
                    503: 'Service Unavailable',
                    504: 'Gateway Timeout',
                    505: 'HTTP Version Not Supported',
                    506: 'Variant Also Negotiates',
                    507: 'Insufficient Storage',
                    508: 'Loop Detected',
                    510: 'Not Extended',
                    511: 'Network Authentication Required'
                };

                const statusMessage = statusMessages[status] || statusMessages[500]

                res.uwsRes.writeStatus(`${status} ${statusMessage}`)

                res.uwsRes.writeHeader(Object.keys(context)[0], Object.values(context)[0])

                return res
            },
            writeStatus: (status : string) => {
                if (!res.aborted) {
                    res.uwsRes.writeStatus(status as any);
                }
                return res;
            },
            end: (str : string) => {

                if(res.aborted) {
                    return;
                }
                
                if(str === undefined) {
                    return;
                }

                uwsRes.cork(() => {
                    if(!res.aborted) {
                        res.aborted = true
        
                        for(const h in res.writeHeaders) {
                            //@ts-ignore
                            res._writeHead(h , res.writeHeaders[h])
                        }

                        uwsRes.end(str)

                        return
                    }
                })
            },
            pipeStream (stream : Stream) {

            },
            aborted: false,
            writeHeaders : {},
            headersSent: false,
            statusCode : 200,
            uwsRes,
        };
      
        uwsRes.onAborted(() => {
          res.aborted = true;
        });
      
        return { req, res } as unknown as { req : T.Request, res : T.Response }
    }

    private _normalizePath (...paths: string[]) : string {
        const path = paths
        .join('/')
        .replace(/\/+/g, '/')
        .replace(/\/+$/, '')

        const normalizedPath = path.startsWith('/') ? path : `/${path}`
    
        return /\/api\/api/.test(normalizedPath) 
            ? normalizedPath.replace(/\/api\/api\//, "/api/") 
            : normalizedPath
    }

    private _swaggerHandler () {

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
        } = this._parser.swagger({
            ...this._swagger,
            specs : this._swaggerSpecs,
            routes
        })

        this._router.get(staticUrl, staticSwaggerHandler)

        this._router.get(path as string , (req: IncomingMessage, res: ServerResponse) => {

            res.writeHead(200, {'Content-Type': 'text/html'});
            
            res.end(html);

            return;
        })

        return
    }
}

export class Application extends Spear {}
export { Spear }
export default Spear