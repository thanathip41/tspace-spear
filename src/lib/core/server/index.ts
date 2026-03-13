import cluster             from 'cluster';
import os                  from 'os';
import fsSystem            from 'fs';
import pathSystem          from 'path';
import { URL }             from 'url';
import onFinished          from "on-finished";
import WebSocket           from 'ws';
import http, { 
    IncomingMessage, 
    Server, 
    ServerResponse 
} from 'http';
import findMyWayRouter, { type Instance } from 'find-my-way';
import { ParserFactory } from './parser-factory';
import { Router } from './router';
import type { T } from '../types';

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

    private readonly _controllers ?: (new () => any)[] | { folder : string ,  name ?: RegExp}
    private readonly _middlewares ?: T.RequestFunction[] | { folder : string , name ?: RegExp}
    private readonly _globalPrefix : string
    private readonly _router : Instance<findMyWayRouter.HTTPVersion.V1> = findMyWayRouter()
    private readonly _parser = new ParserFactory()
    private  _cluster ?: number | boolean
    private _cors ?: ((req : IncomingMessage , res : ServerResponse) => void)
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

    private _wss ?: WebSocket.Server;
    private _ws?: T.WebSocketHandler;
    private _wsOptions ?: WebSocket.ServerOptions
    private _swaggerSpecs : (T.Swagger.Spec & { path : string , method : string })[] = []
    private _errorHandler : T.ErrorFunction | null = null
    private _globalMiddlewares : T.RequestFunction[] = []
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
    
    constructor({
        controllers,
        middlewares,
        globalPrefix,
        logger,
        cluster
    } : T.Application = {}) {
        if(logger) this.useLogger()
        if(cluster) this.useCluster(cluster)
        this._controllers   = controllers;
        this._middlewares   = middlewares;
        this._globalPrefix  = globalPrefix == null ? '' : globalPrefix;
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
     * @returns {Instance<findMyWayRouter.HTTPVersion.V1>}
     */
    get routers (): Instance<findMyWayRouter.HTTPVersion.V1> {

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
        this._ws = handlers()
        this._wsOptions = options ?? {};
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
    public use (middleware : (ctx : T.Context , next : T.NextFunction) =>  void): this {

        this._globalMiddlewares.push(middleware)

        return this
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
    public useLogger ({ methods , exceptPath } : { methods ?: T.MethodInput[] , exceptPath ?: string[] | RegExp } = {}): this  {
        
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
            
            if(exceptPath instanceof RegExp && exceptPath.test(String(req.url))) return next()
        
            if(Array.isArray(exceptPath) && exceptPath.some(v => String(req.url) === v)) return next()

            if(
                methods != null && 
                methods.length && 
                !methods.some(v => v.toLocaleLowerCase() === String(req.method).toLocaleLowerCase())
            ) {
                return next()
            }

            const startTime = process.hrtime()
    
            onFinished(res, (): void => {
            console.log(
                [
                `[\x1b[1m\x1b[34mINFO\x1b[0m]`,
                `\x1b[34m${new Date().toJSON()}\x1b[0m`,
                `\x1b[33m${req.method}\x1b[0m`,
                `${decodeURIComponent(String(req.url))}`,
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

            const { req } = ctx;

            const contentType = req?.headers['content-type'] ?? '';

            const isFileUpload = contentType && contentType.startsWith('multipart/form-data');

            const isCanParserBody = contentType.includes('application/json') || 
            contentType.includes('application/x-www-form-urlencoded')
            
            if(
                except != null && 
                Array.isArray(except) && 
                except.some(v => v.toLocaleLowerCase() === (req.method)?.toLocaleLowerCase())) {
                return next()
            }

            if(isFileUpload) return next()

            if(!isCanParserBody) return next()

            if(req?.body != null) return next()

            Promise.resolve(this._parser.body(req))
            .then(r => {
                req.body = r 
                return next();
            })
            .catch(err => {
                return this._nextFunction(ctx)(err);
            })
        })

        return this
    }

    /**
     * The 'useFileUpload' method is a middleware used to handler file uploads. It adds a file upload of incoming HTTP requests.
     * 
     * @param {?Object} 
     * @property {?number} limits
     * @property {?string} tempFileDir
     * @property {?Object} removeTempFile
     * @property {boolean} removeTempFile.remove
     * @property {number} removeTempFile.ms
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

            const { req } = ctx
          
            if(req.method === 'GET') {
                return next()
            }

            const contentType = req?.headers['content-type'];

            const isFileUpload = contentType && contentType.startsWith('multipart/form-data');

            if(!isFileUpload) return next()

            if(req?.files != null) return next()

            Promise
            .resolve(this._parser.files(req , this._fileUploadOptions ))
            .then(r => {
                req.files = r.files
                req.body = r.body
                return next()
            })
            .catch(err => {
                return this._nextFunction(ctx)(err)
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

        const server = await this._createServer()
        
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
    public response (format : (r : unknown , statusCode : number) => any) {
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
    public catch (error : (err : any , ctx : T.Context) => any) {
        this._errorHandler = error
        return this
    }

    /**
     * The 'notfound' method is middleware that is specifically designed to handle errors notfound that occur during the processing of requests
     * 
     * @param {function} fn
     * @returns 
     */
    public notfound (fn : (ctx : T.Context) =>  any) {

        const handler = ({ req , res } : T.Context) =>{
            return fn({ 
                req, 
                res     : this._customizeResponse(req,res),
                headers : {},
                query   : {},
                files   : {},
                body    : {},
                params  : {},
                cookies : {}
            })
        }
    
        this._onListeners.push(() => {
            return this.all('*', ...this._globalMiddlewares, handler)
        })

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
    public get (path : string , ...handlers : ((ctx : T.Context , next : T.NextFunction) => any)[]): this {

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
    public post (path : string , ...handlers : ((ctx : T.Context , next : T.NextFunction) => any)[]): this {
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
    public put (path : string , ...handlers : ((ctx : T.Context , next : T.NextFunction) => any)[]): this {
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
    public patch (path : string , ...handlers : ((ctx : T.Context , next : T.NextFunction) => any)[]): this {
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
    public delete (path : string , ...handlers : ((ctx : T.Context , next : T.NextFunction) => any)[]): this {
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
    public head (path : string , ...handlers : ((ctx : T.Context , next : T.NextFunction) => any)[]): this {
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
    public options (path : string , ...handlers : ((ctx : T.Context , next : T.NextFunction) => any)[]): this {
        this._onListeners.push(() => {
            return this._router.options(
                this._normalizePath(this._globalPrefix, path), 
                this._wrapHandlers(...this._globalMiddlewares,...handlers)
            );
        })
        return this
    }

    /**
     * The 'any' method is used to add the request handler to the router for 'GET' 'POST' 'PUT' 'PATCH' 'DELETE' 'HEAD' 'OPTIONS' methods.
     * 
     * @param {string} path
     * @callback {...Function[]} handlers of the middlewares
     * @property  {object} ctx - context { req , res , query , params , cookies , files , body}
     * @property  {function} next  - go to next function
     * @returns {this}
     */
    public any (path : string , ...handlers : ((ctx : T.Context , next : T.NextFunction) => any)[]): this {
        this._onListeners.push(() => {
            return this._router.all(
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
    public all (path : string , ...handlers : ((ctx : T.Context , next : T.NextFunction) => any)[]): this {
        this._onListeners.push(() => {
            return this._router.all(
                this._normalizePath(this._globalPrefix, path), 
                this._wrapHandlers(...this._globalMiddlewares,...handlers)
            );
        })
        return this
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

    private async _import (dir: string , pattern ?: RegExp): Promise<string[]> {
        const directories = fsSystem.readdirSync(dir, { withFileTypes: true });
        const files: any[] = (await Promise.all(
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

        return [].concat(...files);
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
        
        const middlewares : any[] = this._middlewares

        for(const middleware of middlewares) {
            this.use(middleware);
        }

        return
    }

    private _customizeResponse (req : IncomingMessage, res : ServerResponse) : T.Response {

        const response = res as unknown as T.Response

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
                    return res.end(JSON.stringify(this._formatResponse(null, res.statusCode),null,2))
                }
    
                return res.end()

            }
            

            if(this._formatResponse != null) {
                
                return res.end(JSON.stringify(
                    this._formatResponse({ 
                        ...results
                    }, res.statusCode) ,null, 2)
                )
            }

            return res.end(JSON.stringify({
                ...results,
            },null,2))
        }

        response.send = (results : string) => {

            if (res.writableEnded) return;

            res.writeHead(res.statusCode, { 'Content-Type': 'text/plain' })
            
            return res.end(results)
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
                return res.end(JSON.stringify(this._formatResponse({ message }, 400) ,null,2))
            }

            return res.end(JSON.stringify({
                message : message 
            },null,2))
        }

        response.unauthorized = (message ?: string) => {
            response.status(401)

            message = message ?? `The request '${req.url}' is unauthorized. Please verify.`

            if(this._formatResponse != null) {
                return res.end(JSON.stringify(this._formatResponse({ message }, 401) ,null,2))
            }

            return res.end(JSON.stringify({
                message
            },null,2))
        }

        response.paymentRequired = (message ?: string) => {
            response.status(402)

            message = message ?? `The request '${req.url}' requires payment. Please proceed with payment.`

            if(this._formatResponse != null) {
                return res.end(JSON.stringify(this._formatResponse({ message }, 402) ,null,2))
            }

            return res.end(JSON.stringify({
                message
            },null,2))
        }

        response.forbidden = (message ?: string) => {
            response.status(403)

            message = message ?? `The request '${req.url}' is forbidden. Please check the permissions or access rights.`

            if(this._formatResponse != null) {
                return res.end(JSON.stringify(this._formatResponse({ message }, 403) ,null,2))
            }

            return res.end(JSON.stringify({
                message
            },null,2))
        }

        response.notFound = (message ?: string) => {
   
            response.status(404)

            message = message ?? `The request '${req.url}' was not found. Please re-check the your url again.`

            if(this._formatResponse != null) {
                return res.end(JSON.stringify(this._formatResponse({ message }, 404) ,null,2))
            }

            return res.end(JSON.stringify({
                message
            },null,2))
        }

        response.unprocessable = (message ?: string) => {
   
            response.status(422)

            message = message ?? `The request to '${req.url}' failed validation.`

            if(this._formatResponse != null) {
                return res.end(JSON.stringify(this._formatResponse({ message }, 422) ,null,2))
            }

            return res.end(JSON.stringify({
                message
            },null,2))
        }

        response.tooManyRequests = (message ?: string) => {
   
            response.status(429)

            message = message ?? `The request '${req.url}' is too many request. Please wait and try agian.`

            if(this._formatResponse != null) {
                return res.end(JSON.stringify(this._formatResponse({ message }, 429) ,null,2))
            }

            return res.end(JSON.stringify({
                message
            },null,2))
        }

        response.serverError = (message ?: string) => {
           
            response.status(500)

            message = message ?? `The request '${req.url}' resulted in a server error. Please investigate.`

            if(this._formatResponse != null) {
                return res.end(JSON.stringify(this._formatResponse({ message }, 500) ,null,2))
            }

            return res.end(JSON.stringify({
                message 
            },null,2))
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
            sameSite   ?: 'Strict' | 'Lax' | 'None'
            domain     ?: string
            secure     ?: boolean
            httpOnly   ?: boolean
            expires    ?: Date
        }> ) => {

            for(const [key,v] of Object.entries(cookies)) {
                if(typeof v === 'string') {
                    res.setHeader('Set-Cookie', `${key}=${v}`);
                    continue
                }

                if(v.value === '' || v.value ==  null) continue

                let str = `${key}=${v.value}`

                if(v.sameSite != null) {
                    str += ` ;SameSite=${v.sameSite}`
                }

                if(v.domain != null) {
                    str += ` ;Domain=${v.domain}`
                }

                if(v.httpOnly != null) {
                    str += ` ;HttpOnly`
                }

                if(v.secure != null) {
                    str += ` ;Secure`
                }

                if(v.expires != null) {
                    str += ` ;Expires=${v.expires.toUTCString()}`
                }

                res.setHeader('Set-Cookie', str);
            }
        }

        return response
    }
   
    private _wrapHandlers (...handlers : ((ctx : T.Context , next : T.NextFunction) => any)[]) {

        return (req : IncomingMessage, res : ServerResponse , params : Record<string,any>) => {

            const nextHandler = (index : number = 0) : any => {

                try {

                    const response = this._customizeResponse(req,res) as T.Response
                
                    const request = req as T.Request

                    request.params = params as T.Params
                    
                    const body = request.body as T.Body
                    
                    const files = request.files as T.FileUpload

                    const cookies = request.cookies as T.Cookies

                    const headers = request.headers as T.Headers
                    
                    const url = new URL(req.url!, "http://localhost")

                    const query = Object.fromEntries(url.searchParams)  as T.Query

                    const RecordOrEmptyRecord = (data : any) => {
                        if(data == null) return {}
                        return Object.keys(data).length ? data : {}
                    }
                
                    const ctx = {
                        req : request, 
                        res: response,
                        headers : RecordOrEmptyRecord(headers),
                        params  : RecordOrEmptyRecord(params),
                        query   : RecordOrEmptyRecord(query),
                        body    : RecordOrEmptyRecord(body),
                        files   : RecordOrEmptyRecord(files),
                        cookies : RecordOrEmptyRecord(cookies) 
                    }
                
                    if(index === handlers.length - 1) {
                    
                        return this._wrapResponse(
                            handlers[index]
                            .bind(handlers[index])
                        )(
                            ctx, 
                            this._nextFunction(ctx)
                        )
                    }

                    return handlers[index](ctx , () => {
                        return nextHandler(index + 1)
                    })

                } catch (err) {
                    const ctx = {
                        req, 
                        res : this._customizeResponse(req,res), 
                        params : Object.keys(params).length ? params : {},
                        headers : {},
                        query : {},
                        body: {},
                        files: {},
                        cookies: {}
                    }

                    return this._nextFunction(ctx)(err)
                }
            }

            if (res.writableEnded) return;

            return nextHandler();
        }
    }

    private _wrapResponse(handler: (ctx: T.Context, next: T.NextFunction) => any) {
        return (ctx: T.Context, next: T.NextFunction) => {
            Promise.resolve(handler(ctx, next))
            .then(result => {

                if (ctx.res.writableEnded) return;

                if (result instanceof ServerResponse) {
                    if (result?.end) {
                        result.end()
                    }
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
                    if (!ctx.res.headersSent) {
                        ctx.res.writeHead(200, { 'Content-Type': 'text/plain' });
                    }
                    ctx.res.end(result ?? '');
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
            })
            .catch(err => {
                return this._nextFunction(ctx)(err)
            })
        };
    }

    private _nextFunction (ctx : T.Context) {

        const NEXT_MESSAGE = "The 'next' function does not have any subsequent function."
        
        return (err ?: any) => {
      
            if(err != null) {

                if(this._errorHandler != null) {
                    const callback = this._errorHandler(err,ctx);

                    if(callback == null || !(callback instanceof ServerResponse)) {

                        ctx.res.writeHead(500, { 'Content-Type': 'application/json' });

                        return ctx.res.end(JSON.stringify({
                            message : err?.message
                        },null,2));  
                    }

                    return callback
                }

                ctx.res.writeHead(500, { 'Content-Type': 'application/json' })

                if(this._formatResponse != null) {
                    return ctx.res.end(JSON.stringify(
                        this._formatResponse({ 
                            message : err?.message,
                        }, ctx.res.statusCode) ,null, 2)
                    )
                }

                return ctx.res.end(JSON.stringify({
                    message : err?.message
                },null,2));  
            }

            if(this._errorHandler != null) {
                return this._errorHandler(new Error(NEXT_MESSAGE), ctx);
            }

            ctx.res.writeHead(500, { 'Content-Type': 'application/json' });

            if(this._formatResponse != null) {
                return ctx.res.end(JSON.stringify(
                    this._formatResponse({ 
                        message : NEXT_MESSAGE
                    }, ctx.res.statusCode) ,null, 2)
                );
            }
            
            return ctx.res.end(JSON.stringify({
                message : NEXT_MESSAGE
            },null,2));  
        } 
    }

    private async _createServer () : Promise<Server> {
       
        await this._registerMiddlewares()

        await this._registerControllers()

        const lookup = this._router.lookup.bind(this._router);
        const cors = this._cors;

        const server = http.createServer(
            { maxHeaderSize: 1024 * 1024 },
            cors
            ? (req: IncomingMessage, res: ServerResponse) => {
                cors(req, res)
                return lookup(req, res)
            }
            : (req: IncomingMessage, res: ServerResponse) => {
                return lookup(req, res)
            }
        )
       
        if (this._ws) {
            this._wss = new WebSocket.Server({ server , ...this._wsOptions });

            this._wss.on('connection', (ws) => {

                if (this._ws?.connection) {
                    this._ws!.connection(ws);
                }

                ws.on('message', (data) => {
                    if (this._ws?.message) {
                        this._ws!.message(ws, data);
                    }
                });

                ws.on('close', (code, reason) => {
                    if (this._ws?.close) {
                        this._ws!.close(ws, code, reason);
                    }
                });

                ws.on('error', (err) => {
                    if (this._ws?.error) {
                        this._ws!.error(ws, err);
                    }
                });
            });
        }

        return server
    }

    private _normalizePath (...paths: string[]) : string {
        const path = paths
        .join('/')
        .replace(/\/+/g, '/')
        .replace(/\/+$/, '')

        const normalizedPath = path.startsWith('/') ? path : `/${path}`
    
        return /\/api\/api/.test(normalizedPath) ? normalizedPath.replace(/\/api\/api\//, "/api/") : normalizedPath
    }

    private _swaggerHandler () {

        const routes = (this.routers as unknown as { routes : any[]})
        .routes.filter(r => ["GET","POST","PUT","PATCH","DELETE"].includes(r.method))
       
        const { 
            path  , 
            html , 
            staticSwaggerHandler, 
            staticUrl 
        } = this._parser.swagger({
            ...this._swagger,
            specs : this._swaggerSpecs,
            routes
        })

        this._router.get(staticUrl, staticSwaggerHandler)

        this._router.get(String(path) , (req, res) => {

            res.writeHead(200, {'Content-Type': 'text/html'})

            res.write(html)

            return res.end()
        })

        return
    }
}

export class Application extends Spear {}
export { Spear }
export default Spear