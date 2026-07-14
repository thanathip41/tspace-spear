import type { 
    T, 
    TExtractParams, 
    TPrettify, 
    TRegisterRoute 
} from "../types"

class Router<TRoutes = {}> {

    private _routes : {
        path : string;
        method : T.Method
        handlers : ((ctx : T.Context , next : T.NextFunction) => any)[]
    }[] = []

    get routes () {
        return this._routes
    }

    get contract () : TPrettify<TRoutes> {
        return {} as TPrettify<TRoutes>
    }

    /**
     * The 'groups' method is used to add the request handler to the router for 'GET' 'POST' 'PUT' 'PATCH' 'DELETE' methods.
     * 
     * @param {string} prefix
     * @param {Router} router
     * @returns {this}
     */
    public groups<
        const Prefix extends `/${string}`,
        R extends Router<any>
    >(
        prefix: Prefix,
        router: (router: Router) => R
    ): Router<
        TRoutes & {
            [K in keyof R["contract"] as `${Prefix}${K & string}`]:
                R["contract"][K]
        }
    > {
        const routes = router(new Router());

        for (const route of routes.routes) {
            route.path = `${prefix}${route.path}`.replace(/^\/+/, "/");
            this._routes.push(route);
        }

        return this as any;
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
    ): Router<TRegisterRoute<TRoutes, Path, "GET", Handlers>> { 
        
        this._routes.push({
            path,
            method : 'get',
            handlers : handlers as unknown as T.ContextHandler[]
        })

        return this as Router<TRegisterRoute<TRoutes, Path, "GET", Handlers>>;
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
    ): Router<TRegisterRoute<TRoutes, Path, "POST", Handlers>> { 

        this._routes.push({
            path,
            method : 'post',
            handlers : handlers as unknown as T.ContextHandler[]
        })

        return this as Router<TRegisterRoute<TRoutes, Path, "POST", Handlers>>;
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
    ): Router<TRegisterRoute<TRoutes, Path, "PUT", Handlers>> { 

        this._routes.push({
            path,
            method : 'put',
            handlers : handlers as unknown as T.ContextHandler[]
        });

        return this as Router<TRegisterRoute<TRoutes, Path, "PUT", Handlers>>;
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
    ): Router<TRegisterRoute<TRoutes, Path, "PATCH", Handlers>> { 

        this._routes.push({
            path,
            method : 'patch',
            handlers : handlers as unknown as T.ContextHandler[]
        });

        return this as Router<TRegisterRoute<TRoutes, Path, "PATCH", Handlers>>;
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
    ): Router<TRegisterRoute<TRoutes, Path, "DELETE", Handlers>> { 

        this._routes.push({
            path,
            method : 'delete',
            handlers : handlers as unknown as T.ContextHandler[]
        });

        return this as Router<TRegisterRoute<TRoutes, Path, "DELETE", Handlers>>;
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
    ): Router<TRegisterRoute<TRoutes, Path, "GET" | "POST" | "PUT" | "PATCH" | "DELETE", Handlers>> { 

        this._routes.push({
            path,
            method : 'all',
            handlers : handlers as unknown as T.ContextHandler[]
        });

        return this as Router<TRegisterRoute<TRoutes, Path, "GET" | "POST" | "PUT" | "PATCH" | "DELETE", Handlers>>;
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
    ): Router<TRegisterRoute<TRoutes, Path, "HEAD", Handlers>> { 

        this._routes.push({
            path,
            method : 'head',
            handlers : handlers as unknown as T.ContextHandler[]
        });

        return this as Router<TRegisterRoute<TRoutes, Path, "HEAD", Handlers>>;
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
    public options<
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
    ): Router<TRegisterRoute<TRoutes, Path, "OPTIONS", Handlers>> { 

        this._routes.push({
            path,
            method : 'options',
            handlers : handlers as unknown as T.ContextHandler[]
        });

        return this as Router<TRegisterRoute<TRoutes, Path, "OPTIONS", Handlers>>;
    }
}

export { Router }
export default Router