import type { T } from "../types"

class Router {

    private _routes : {
        path : string;
        method : T.Method
        handlers : ((ctx : T.Context , next : T.NextFunction) => any)[]
    }[] = []

    get routes () {
        return this._routes
    }

    /**
     * The 'groups' method is used to add the request handler to the router for 'GET' 'POST' 'PUT' 'PATCH' 'DELETE' methods.
     * 
     * @param {string} prefix
     * @param {Router} router
     * @returns {void}
     */
    public groups (prefix : `/${string}`, router : (router : Router) => Router): void {
        const routes =  router(new Router())
        for(const route of routes._routes) {
            route.path = `${prefix}${route.path}`.replace(/^\/+/, '/')
            this._routes.push(route)
        }
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
    public get(path : `/${string}` , ...handlers : ((ctx : T.Context , next : T.NextFunction) => any)[]): this {
        this._routes.push({
            path,
            method : 'get',
            handlers
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
    public post(path : `/${string}` , ...handlers : ((ctx : T.Context , next : T.NextFunction) => any)[]): this {
        this._routes.push({
            path,
            method : 'post',
            handlers
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
    public put(path : `/${string}` , ...handlers : ((ctx : T.Context , next : T.NextFunction) => any)[]): this {
        this._routes.push({
            path,
            method : 'put',
            handlers
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
    public patch(path : `/${string}` , ...handlers : ((ctx : T.Context , next : T.NextFunction) => any)[]): this {
        this._routes.push({
            path,
            method : 'patch',
            handlers
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
    public delete(path : `/${string}` , ...handlers : ((ctx : T.Context , next : T.NextFunction) => any)[]): this {
        this._routes.push({
            path,
            method : 'delete',
            handlers
        })
        return this
    }

    /**
     * The 'all' method is used to add the request handler to the router for 'GET' 'POST' 'PUT' 'PATCH' 'DELETE' methods.
     * 
     * @param {string} path
     * @callback {...Function[]} handlers of the middlewares
     * @property  {object} ctx - context { req , res , query , params , cookies , files , body}
     * @property  {function} next  - go to next function
     * @returns {this}
     */
    public all(path : `/${string}` , ...handlers : ((ctx : T.Context , next : T.NextFunction) => any)[]): this {
        this._routes.push({
            path,
            method : 'all',
            handlers
        })
        return this
    }

    /**
     * The 'head' method is used to add the request handler to the router for the 'HEAD' method.
     * 
     * @param {string} path
     * @callback {...Function[]} handlers of the middlewares
     * @property  {Object} ctx - context { req , res , query , params , cookies , files , body}
     * @property  {Function} next  - go to next function
     * @returns {this}
     */
    public head(path : `/${string}` , ...handlers : ((ctx : T.Context , next : T.NextFunction) => any)[]): this {
        this._routes.push({
            path,
            method : 'head',
            handlers
        })
        return this
    }

    /**
     * The 'options' method is used to add the request handler to the router for the 'OPTIONS' method.
     * 
     * @param {string} path
     * @callback {...Function[]} handlers of the middlewares
     * @property  {Object} ctx - context { req , res , query , params , cookies , files , body}
     * @property  {Function} next  - go to next function
     * @returns {this}
     */
    public options(path : `/${string}` , ...handlers : ((ctx : T.Context , next : T.NextFunction) => any)[]): this {
        this._routes.push({
            path,
            method : 'options',
            handlers
        })
        return this
    }
}

export { Router }
export default Router