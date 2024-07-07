import fs from 'fs';
import path from 'path';
import findMyWayRouter, { Instance }  from 'find-my-way';
import { parse } from 'url';
import onFinished from "on-finished";
import http, { 
    IncomingMessage, 
    Server, 
    ServerResponse 
} from 'http';

import { 
    Router,
    TContext , 
    TNextFunction, 
    TResponse , 
    TRouter, 
    TApplication,
    TRequestFunction,
    TErrorFunction,
    TRequest,
    TBody,
    TFiles,
    TQuery,
    TCookies,
    THeaders,
    TSwagger
} from '../..'
import { ParserFactory } from './parser-factory';

/**
 * 
 * The 'Spear' class is used to create a server and handle HTTP requests.
 * 
 * @returns {Spear} application
 * @example
 * new Application()
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
    private readonly _middlewares ?: TRequestFunction[] | { folder : string , name ?: RegExp}
    private readonly _globalPrefix : string
    private readonly _router : Instance<findMyWayRouter.HTTPVersion.V1> = findMyWayRouter()
    private readonly _parser = new ParserFactory()
    private _swagger : {
        use : boolean
        path ?: `/${string}`
        servers ?: { url : string }[]
        tags ?: string[]
        info ?: {
            title ?: string,
            description ?: string,
            version ?: string
        }
    } = {
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
    
    private _swaggerAdditional : (TSwagger & { path : string , method : string })[] = []
    private _errorHandler : TErrorFunction | null = null
    private _globalMiddlewares : TRequestFunction[] = []
    private _formatResponse : Function | null = null
    private _onListeners : Function[] = []
    private _fileUploadOptions : { limit : number;  tempFileDir : string , removeTempFile : { remove : boolean; ms : number }} = {
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
        logger
    } : TApplication = {}) {
        if(logger) this._onListeners.push(() => this.use(this._logger));
        this._controllers = controllers;
        this._middlewares = middlewares;
        this._globalPrefix = globalPrefix == null ? '' : globalPrefix;

    }

    get instance () {
        return this
    }
    
    get routers () {
        return this._router;
    }

    /**
     * The 'enableCors' is used to enable the cors origins on the server.
     * 
     * @params {Object} 
     * @property {(string | RegExp)[]} origins
     * @property {boolean} credentials
     * @returns 
     */
    enableCors({ origins , credentials } : {
        origins ?: (string | RegExp)[] , 
        credentials ?: boolean
    } = {}) {

        this._globalMiddlewares.push(({ req , res } : TContext , next : TNextFunction) => {

            const origin = req.headers?.origin

            if(origin == null) return next()

            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

            if(origins == null) {
                res.setHeader('Access-Control-Allow-Origin', '*')
            }

            if(Array.isArray(origins) && origins.length) {
                if(origins.includes(origin)) {
                    res.setHeader('Access-Control-Allow-Origin', origin);
                }
            }

            if(credentials) {
                res.setHeader('Access-Control-Allow-Credentials', 'true');
            }
            
            return next()
        })

        return this
    }

    /**
     * The 'use' method is used to add the middleware into the request pipeline.
     * 
     * @callback {Function} middleware
     * @property  {Object} ctx - context { req , res , query , params , cookies , files , body}
     * @property  {Function} next  - go to next function
     * @returns {this}
     */
    use (middleware : (ctx : TContext , next : TNextFunction) =>  void): this {
        this._globalMiddlewares.push(middleware)
        return this
    }


    /**
     * The 'useBodyParser' method is a middleware used to parse the request body of incoming HTTP requests.
     *
     * @returns {this}
     */
    useBodyParser (): this {

        this._globalMiddlewares.push(async ({ req , res } : TContext , next : TNextFunction) => {

            const contentType = req?.headers['content-type'];

            const isFileUpload = contentType && contentType.startsWith('multipart/form-data');

            if(isFileUpload) return next()

            if(req?._bodyParser != null) return next()

            req._bodyParser = await this._parser.body(req)

            return next()
        })

        return this
    }

    /**
     * The 'useCookiesParser' method is a middleware used to parses cookies attached to the client request object.
     *
     * @returns {this}
     */
    useCookiesParser (): this {

        this._globalMiddlewares.push(({ req } : TContext , next : TNextFunction) => {

            if(req?._cookiesParser != null) return next()

            req._cookiesParser = this._parser.cookies(req)
           
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
    useRouter (router : Router): this {

        const routes = router.routes

        for(const {path , method , handlers} of routes) {
            this[method](this._normalizePath(this._globalPrefix , path) , ...handlers)
        }

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
    useFileUpload ({ limit, tempFileDir , removeTempFile } : {
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

        this._globalMiddlewares.push(async ({ req } : TContext , next : TNextFunction) => {

            const contentType = req?.headers['content-type'];

            const isFileUpload = contentType && contentType.startsWith('multipart/form-data');

            const isListMethods = ['POST','PATCH','PUT','DELETE'].includes(String(req.method))

            if(!isListMethods || !isFileUpload) return next()

            if(req?._filesParser != null) return next()

            const { body , files } = await this._parser.files({ req , options : this._fileUploadOptions})
            
            req._filesParser = files

            req._bodyParser = body

            return next()
        })

        return this
    }

    /**
     * The 'useSwagger' method is a middleware used to create swagger api.
     * 
     * @param {?Object} 
     * @property {?string} path
     * @property {?array} servers
     * @property {?object} info
     * @property {?array} tags
     * @returns 
     */
    useSwagger({
        path,
        servers,
        info,
        tags
    } : {
        path ?: `/${string}`
        servers ?: { url : string , description ?: string }[]
        tags ?: string[]
        info ?: {
            title ?: string,
            description ?: string,
            version ?: string
        }
    } = {}) {

        this._swagger = {
            use : true,
            path : path ?? this._swagger.path,
            servers : servers ?? this._swagger.servers,
            tags : tags ?? this._swagger.tags,
            info : info ?? this._swagger.info
        }

        return this
    }

    /**
     * The 'formatResponse' method is used to format the response
     * 
     * @param {function} format 
     * @returns 
     */
    formatResponse (format : (r : unknown , statusCode : number) => any) {
        this._formatResponse = format
        return this
    }

    /**
     * The 'errorHandler' method is middleware that is specifically designed to handle errors that occur during the processing of requests
     * 
     * @param {function} error 
     * @returns 
     */
    errorHandler (error : (err : Error , ctx : TContext) =>  any) {
        this._errorHandler = error
        return this
    }

    /**
     * The 'notFoundHandler' method is middleware that is specifically designed to handle errors notfound that occur during the processing of requests
     * 
     * @param {function} notfound 
     * @returns 
     */
    notFoundHandler (notfound : (ctx : TContext) =>  any) {

        const handler = ({ req , res } : TContext) =>{
            return notfound({ 
                req, 
                res : this._customizeResponse(req,res),
                headers : {},
                query : {},
                files : {},
                body : {},
                params : {},
                cookies : {}
            })
        }
    
        this._onListeners.push(() => {
            return this._router.all('*', this._wrapHandlers(...this._globalMiddlewares,handler))
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
    get (path : string , ...handlers : ((ctx : TContext , next : TNextFunction) => any)[]): this {

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
    post (path : string , ...handlers : ((ctx : TContext , next : TNextFunction) => any)[]): this {
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
    put (path : string , ...handlers : ((ctx : TContext , next : TNextFunction) => any)[]): this {
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
    patch (path : string , ...handlers : ((ctx : TContext , next : TNextFunction) => any)[]): this {
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
    delete (path : string , ...handlers : ((ctx : TContext , next : TNextFunction) => any)[]): this {
        this._onListeners.push(() => {
            return this._router.delete(
                this._normalizePath(this._globalPrefix, path), 
                this._wrapHandlers(...this._globalMiddlewares,...handlers)
            );
        })
        return this
    }

    /**
     * The 'all' method is used to add the request handler to the router for the 'all' method.
     * 
     * @param {string} path
     * @callback {...Function[]} handlers of the middlewares
     * @property  {object} ctx - context { req , res , query , params , cookies , files , body}
     * @property  {function} next  - go to next function
     * @returns {this}
     */
    all (path : string , ...handlers : ((ctx : TContext , next : TNextFunction) => any)[]): this {
        this._onListeners.push(() => {
            return this._router.all(
                this._normalizePath(this._globalPrefix, path), 
                this._wrapHandlers(...this._globalMiddlewares,...handlers)
            );
        })
        return this
    }

    /**
     * The 'listen' method is used to bind and start a server to a particular port and optionally a hostname.
     * 
     * @param {number} port 
     * @param {function} cb 
     * @returns 
     */
    async listen(port : number | (() => ServerResponse) = 3000, cb : (callback : { server : Server , port : number }) => void) {

        if(arguments.length === 1 && typeof port === 'function') {
            cb = port
            port = 3000
        }

        const server = await this._createServer()

        server.listen(port == null ? 3000 : port , () => {
            if(cb) cb({ server , port} as { server : Server , port : number })
        })


        server.on('listening', () => {
            this._onListeners.forEach(listener => listener())

            if(this._swagger.use) {

                const routes = (this.routers as unknown as { routes : any[]})
                .routes.filter(r => ["GET","POST","PUT","PATCH","DELETE"].includes(r.method))
                
                const { 
                    path  , 
                    html , 
                    staticSwaggerHandler, 
                    staticUrl 
                } = this._parser.swagger({
                    ...this._swagger,
                    options : this._swaggerAdditional,
                    routes
                })

                this.routers.get(staticUrl, staticSwaggerHandler)

                this.routers.get(String(path) , (req, res) => {

                    res.writeHead(200, {'Content-Type': 'text/html'})

                    res.write(html)

                    return res.end()
                })
            }
        })

        server.on('error', (_: NodeJS.ErrnoException) => {
            port = Math.floor(Math.random() * 8999) + 1000
            server.listen(port)
        })
        
        return
    }

    private _logger ({ req , res } : TContext, next: TNextFunction)  {

        const diffTime = (hrtime?: [number, number]) => {
            const MS = 1000
            if (hrtime == null) return 0

            const [start, end] = process.hrtime(hrtime)

            const time = +(((start * MS ) + (end / 1e6)).toFixed(2))
            
            return `${time > MS ? `${time / MS} s` : `${time} ms`}`
        };
      
        const statusCode = (res: TResponse) => {
          const statusCode = res.statusCode == null ? 500 : Number(res.statusCode);
          return statusCode < 400
            ? `\x1b[32m${statusCode}\x1b[0m`
            : `\x1b[31m${statusCode}\x1b[0m`;
        };

        const startTime = process.hrtime();
    
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
    }
    
    private async _import (dir: string , pattern ?: RegExp): Promise<string[]> {
        const directories = fs.readdirSync(dir, { withFileTypes: true });
        const files: any[] = (await Promise.all(
          directories.map((directory) => {
            const newDir = path.resolve(String(dir), directory.name);
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

                const response = await import(file)

                const controller = response?.default

                const controllerInstance = new controller();
    
                const prefixPath: string = Reflect.getMetadata("controllers", controller) ?? ''

                const routers: TRouter[] = Reflect.getMetadata("routers", controller) ?? []

                const swaggers: any[] = Reflect.getMetadata("swaggers", controller) ?? []

                if(prefixPath == null) continue
    
                for(const { method, path, handler} of Array.from(routers)) {

                    const find = Array.from(swaggers).find(s => s.handler === handler)

                    if(find != null) {
                        this._swaggerAdditional = [
                            ...this._swaggerAdditional , 
                            {
                                ...find,
                                path : this._normalizePath(this._globalPrefix , prefixPath, path),
                                method
                            }
                        ]
                    }
                
                    this[method](
                        this._normalizePath(this._globalPrefix ,prefixPath ,path), 
                        this._wrapResponse(
                            controllerInstance[String(handler)].bind(controllerInstance)
                        )
                    )
                }
            }

            return
        }

        for(const controller of this._controllers) {

            const controllerInstance = new controller();

            const prefixPath: string = Reflect.getMetadata("controllers", controller) ?? ''

            const routers: TRouter[] = Reflect.getMetadata("routers", controller) ?? []

            const swaggers: any[] = Reflect.getMetadata("swaggers", controller) ?? []

            if(prefixPath == null) continue

            for(const { method, path, handler} of Array.from(routers)) {

                const find = Array.from(swaggers).find(s => s.handler === handler)

                if(find != null) {
                    this._swaggerAdditional = [
                        ...this._swaggerAdditional , 
                        {
                            ...find,
                            path : this._normalizePath(this._globalPrefix , prefixPath, path),
                            method
                        }
                    ]
                }

                this[method](
                    this._normalizePath(this._globalPrefix , prefixPath, path), 
                    this._wrapResponse(controllerInstance[String(handler)].bind(controllerInstance))
                )
            }
        }
    }

    private async _registerMiddlewares(): Promise<void> {

        if(this._middlewares == null) return

        if(!Array.isArray(this._middlewares)) {
           
            const middlewares = await this._import(this._middlewares.folder , this._middlewares.name)

            for(const file of middlewares) {

                const response = await import(file)

                const middleware = response?.default
                
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

    private _customizeResponse (req : IncomingMessage, res : ServerResponse) : TResponse {

        const response = res as unknown as TResponse

        response.json = (results ?: Record<string,any>) => {

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

            res.writeHead(res.statusCode, { 'Content-Type': 'text/plain' })
            
            return res.end(results)
        }

        response.error = (err ) => {
            let code =
                +err.response?.data?.code ||
                +err.code ||
                +err.status ||
                +err.statusCode ||
                +err.response?.data?.statusCode ||
                500;

            code = (code == null || typeof code !== 'number') ? 500 : Number.isNaN(code) ? 500 : code < 400 ? 500 : code

            const message =
                err.response?.data?.errorMessage ||
                err.response?.data?.message ||
                err.message ||
                `The url '${req.url}' resulted in a server error. Please investigate.`
                ;
            
            response.status(code as any)

            if(this._formatResponse != null) {
                return res.end(JSON.stringify(this._formatResponse({ message }, code) ,null,2))
            }

            return res.end(JSON.stringify({
                message : message 
            },null,2))
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
            response.status(202)
            return res.end()
        }

        response.badRequest = (message ?: string) => {
            response.status(400)

            message = message ?? `The url '${req.url}' resulted in a bad request. Please review the data and try again.`

            if(this._formatResponse != null) {
                return res.end(JSON.stringify(this._formatResponse({ message }, 400) ,null,2))
            }

            return res.end(JSON.stringify({
                message : message 
            },null,2))
        }

        response.unauthorized = (message ?: string) => {
            response.status(401)

            message = message ?? `The url '${req.url}' is unauthorized. Please verify.`

            if(this._formatResponse != null) {
                return res.end(JSON.stringify(this._formatResponse({ message }, 401) ,null,2))
            }

            return res.end(JSON.stringify({
                message
            },null,2))
        }

        response.paymentRequired = (message ?: string) => {
            response.status(402)

            message = message ?? `The url '${req.url}' requires payment. Please proceed with payment.`

            if(this._formatResponse != null) {
                return res.end(JSON.stringify(this._formatResponse({ message }, 402) ,null,2))
            }

            return res.end(JSON.stringify({
                message
            },null,2))
        }

        response.forbidden = (message ?: string) => {
            response.status(403)

            message = message ?? `The url '${req.url}' is forbidden. Please check the permissions or access rights.`

            if(this._formatResponse != null) {
                return res.end(JSON.stringify(this._formatResponse({ message }, 403) ,null,2))
            }

            return res.end(JSON.stringify({
                message
            },null,2))
        }

        response.notFound = (message ?: string) => {
           
            response.status(404)

            message = message ?? `The url '${req.url}' was not found. Please re-check the your url again`

            if(this._formatResponse != null) {
                return res.end(JSON.stringify(this._formatResponse({ message }, 404) ,null,2))
            }

            return res.end(JSON.stringify({
                message
            },null,2))
        }

        response.serverError = (message ?: string) => {
           
            response.status(500)

            message = message ?? `The url '${req.url}' resulted in a server error. Please investigate.`

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

    private _nextFunction (ctx : TContext) {

        return async (err ?: any) => {

            if(err != null) {

                if(this._errorHandler != null) {
                    return this._errorHandler(err,ctx)
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
                    message : err?.message,
                },null,2));  
            }

            if(this._errorHandler != null) {
                return this._errorHandler(new Error(`The 'next' function does not have any subsequent function.`), ctx)
            }

            ctx.res.writeHead(500, { 'Content-Type': 'application/json' })

            if(this._formatResponse != null) {
                return ctx.res.end(JSON.stringify(
                    this._formatResponse({ 
                        message : `The 'next' function does not have any subsequent function.`
                    }, ctx.res.statusCode) ,null, 2)
                )
            }
            
            return ctx.res.end(JSON.stringify({
                message : `The 'next' function does not have any subsequent function.`
            },null,2));  
        } 
    }

    private _wrapHandlers = (...handlers : ((ctx : TContext , next : TNextFunction) => any)[]) : any => {

        return async (req : IncomingMessage, res : ServerResponse , params : Record<string,any>) => {

            const runHandler = async (index : number = 0) : Promise<any> => {

                const response = this._customizeResponse(req,res)

                const request = req as TRequest
                
                const body = request._bodyParser as TBody
                
                const files = request._filesParser as TFiles

                const cookies = request._cookiesParser as TCookies

                const headers = request.headers as THeaders
                
                const query = {...parse(String(req.url), true).query } as TQuery

                const RecordOrEmptyRecord = (data : any) => {
                    if(data == null) return {}
                    return Object.keys(data).length ? data : {}
                }
               
                const ctx = {
                    req : request, 
                    res : response,
                    headers : RecordOrEmptyRecord(headers),
                    params  : RecordOrEmptyRecord(params),
                    query   : RecordOrEmptyRecord(query),
                    body    : RecordOrEmptyRecord(body),
                    files   : RecordOrEmptyRecord(files),
                    cookies : RecordOrEmptyRecord(cookies),
                }

                if(index === handlers.length - 1) {
                    return this._wrapResponse(handlers[index].bind(handlers[index]))(ctx, this._nextFunction(ctx))
                }

                return handlers[index](ctx , () => {
                    return runHandler(index + 1)
                })
            }

            await runHandler()
            .catch(err => {

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
            })
           
        };
    }

    private _wrapResponse(handler : (ctx : TContext , next : TNextFunction) => any) {

        return async (ctx : TContext , next : TNextFunction) => {

            const result = await handler(ctx , next);

            if(result instanceof ServerResponse) return
    
            if(typeof result === 'string') {
                if(!ctx.res.headersSent) {
                    ctx.res.writeHead(200, { 'Content-Type': 'text/plain' })
                }
                return ctx.res.end(result)
            }

            if(this._formatResponse != null) {

                const formatResponse = this._formatResponse({ ...result }, ctx.res.statusCode)

                if(typeof formatResponse === 'string') {
                    if(!ctx.res.headersSent) {
                        ctx.res.writeHead(200, { 'Content-Type': 'text/plain' })
                    }
                    return ctx.res.end(formatResponse)
                }

                if(!ctx.res.headersSent) {
                    ctx.res.writeHead(200, { 'Content-Type': 'application/json' })
                }

                if(Array.isArray(result)) {
                    return ctx.res.end(JSON.stringify(this._formatResponse(result)))
                }

                return ctx.res.end(JSON.stringify(
                    this._formatResponse({ 
                        ...result
                    }, ctx.res.statusCode) ,null, 2)
                )
            }
        
            if(!ctx.res.headersSent) {
                ctx.res.writeHead(200, { 'Content-Type': 'application/json' })
            }

            if(Array.isArray(result)) {
                return ctx.res.end(JSON.stringify(result))
            }

            return ctx.res.end(JSON.stringify({
                ...result,
            },null,2))
        };
    }

    private async _createServer () : Promise<Server> {
       
        await this._registerMiddlewares()

        await this._registerControllers()
        
        const server = http.createServer((req : IncomingMessage, res : ServerResponse) => {
            return this._router.lookup(req, res)
        })

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
}

export { Spear }
export class Application extends Spear {}
export default Spear