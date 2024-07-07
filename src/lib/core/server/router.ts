import { TContext, TNextFunction } from "../types";

class Router {

    private _routes : {
        path : string;
        method : 'get' | 'post' | 'put' | 'patch' | 'delete' | 'all'
        handlers : ((ctx : TContext , next : TNextFunction) => any)[]
    }[] = []

    get routes () {
        return this._routes
    }

    groups (prefix : `/${string}`, router : (router : Router) => Router) {
        const routes =  router(new Router)
        for(const route of routes._routes) {
            route.path = `${prefix}${route.path}`.replace(/^\/+/, '/')
            this._routes.push(route)
        }
    }

    get(path : `/${string}` , ...handlers : ((ctx : TContext , next : TNextFunction) => any)[]) {
        this._routes.push({
            path,
            method : 'get',
            handlers
        })
        return this
    }

    post(path : `/${string}` , ...handlers : ((ctx : TContext , next : TNextFunction) => any)[]) {
        this._routes.push({
            path,
            method : 'post',
            handlers
        })
        return this
    }

    put(path : `/${string}` , ...handlers : ((ctx : TContext , next : TNextFunction) => any)[]) {
        this._routes.push({
            path,
            method : 'put',
            handlers
        })
        return this
    }

    patch(path : `/${string}` , ...handlers : ((ctx : TContext , next : TNextFunction) => any)[]) {
        this._routes.push({
            path,
            method : 'patch',
            handlers
        })
        return this
    }

    delete(path : `/${string}` , ...handlers : ((ctx : TContext , next : TNextFunction) => any)[]) {
        this._routes.push({
            path,
            method : 'delete',
            handlers
        })
        return this
    }

    all(path : `/${string}` , ...handlers : ((ctx : TContext , next : TNextFunction) => any)[]) {
        this._routes.push({
            path,
            method : 'all',
            handlers
        })
        return this
    }
}

export { Router }
export default Router