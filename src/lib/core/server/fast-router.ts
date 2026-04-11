import { IncomingMessage, ServerResponse } from "http"
import { T } from "../.."

type Handler = (
  req: IncomingMessage,
  res: ServerResponse,
  params: Record<string, string>
) => any

type Node = {
  static: Record<string, Node>
  param?: Node
  wildcard?: Node
  handler?: Handler
  paramName?: string
}

const METHODS = [
  "GET", "POST", "PUT", "PATCH",
  "DELETE", "OPTIONS", "HEAD"
] as const

type Method = typeof METHODS[number];
export class FastRouter {
  private trees: Record<string, Node> = Object.create(null);
  private _routes: T.Route[] = [] 

  constructor() {
    for (const m of METHODS) {
      this.trees[m] = this._createNode();
    }
  }

  /**
   * Get all registered routes in the router.
   *
   * Returns the internal route registry used for debugging,
   * inspection, or serialization of the router tree.
   *
   * @returns Internal routes structure
   */
  public get routes () {
    return this._routes;
  }

  /**
   * Register a GET route.
   *
   * Handles HTTP GET requests for the specified path.
   *
   * @param path Route path (e.g. "/users/:id")
   * @param handler Function executed when route matches
   * @returns Router instance for chaining
   *
   * @example
   * router.get("/users", (req, res) => {});
   */
  public get(path: string, handler: Handler) {
    this._add("GET", path, handler);
    return this;
  }

  /**
   * Register a POST route.
   *
   * Used for creating resources or submitting data.
   *
   * @param path Route path
   * @param handler Route handler function
   * @returns Router instance for chaining
   */
  public post(path: string, handler: Handler) {
    this._add("POST", path, handler);
    return this;
  }

  /**
   * Register a PUT route.
   *
   * Typically used for full resource replacement.
   *
   * @param path Route path
   * @param handler Route handler function
   * @returns Router instance for chaining
   */
  public put(path: string, handler: Handler) {
    this._add("PUT", path, handler);
    return this;
  }

  /**
   * Register a PATCH route.
   *
   * Used for partial updates to a resource.
   *
   * @param path Route path
   * @param handler Route handler function
   * @returns Router instance for chaining
   */
  public patch(path: string, handler: Handler) {
    this._add("PATCH", path, handler);
    return this;
  }

  /**
   * Register a DELETE route.
   *
   * Used for removing a resource.
   *
   * @param path Route path
   * @param handler Route handler function
   * @returns Router instance for chaining
   */
  public delete(path: string, handler: Handler) {
    this._add("DELETE", path, handler);
    return this;
  }

  /**
   * Register an OPTIONS route.
   *
   * Used for CORS preflight requests or capability discovery.
   *
   * @param path Route path
   * @param handler Route handler function
   * @returns Router instance for chaining
   */
  public options(path: string, handler: Handler) {
    this._add("OPTIONS", path, handler);
    return this;
  }

  /**
   * Register a HEAD route.
   *
   * Same as GET but returns headers only (no body).
   *
   * @param path Route path
   * @param handler Route handler function
   * @returns Router instance for chaining
   */
  public head(path: string, handler: Handler) {
    this._add("HEAD", path, handler);
    return this;
  }

  /**
   * Register a route for all HTTP methods.
   *
   * This registers the same handler for every supported HTTP method.
   * Useful for middleware-like or catch-all behavior.
   *
   * @param path Route path
   * @param handler Route handler function
   * @returns Router instance for chaining
   *
   * @example
   * router.all("/health", (req, res) => res.send("OK"));
   */
  public all(path: string, handler: Handler) {
    for(const method of METHODS) {
      this._add(method, path, handler);
    }
    return this;
  }

  /**
   * Lookup a route handler based on the incoming request.
   *
   * This method is responsible for resolving the correct route
   * from the registered router tree and executing the matched handler.
   *
   * It supports parameterized routes, static routes, and (optionally)
   * wildcard matching depending on router implementation.
   *
   * @param req Incoming HTTP request object
   * @param res Server response object used to send output
   *
   * @returns void
   *
   * @example
   * router.lookup(req, res);
   *
   * @internal
   * This is typically called by the HTTP server layer and should not
   * be invoked directly in most application code.
   */
  public lookup(req: IncomingMessage, res: ServerResponse) {
    const method = req.method!;
    
    let node = this.trees[method];

    if (!node) {
      res.statusCode = 405;
      return res.end("Method Not Allowed");
    }

    let url = req.url || "/";
    let q = url.indexOf("?");
    if (q !== -1) url = url.slice(0, q);

    const params: Record<string, string> = Object.create(null);

    const rootWildcard = node.wildcard;

    let start = 1;
    
    for (let i = 1; i <= url.length; i++) {
      if (url[i] === "/" || i === url.length) {
        const part = url.slice(start, i)

        if (!part) {
          start = i + 1
          continue
        }

        let next = node.static[part];

        if (next) {
          node = next
          start = i + 1
          continue
        }

        if (node.param) {
          params[node.param.paramName!] = part
          node = node.param
          start = i + 1
          continue
        }

        if (node.wildcard) {
          params["*"] = url.slice(start);
          node = node.wildcard;
          break
        }
        
        if (rootWildcard?.handler) {
          return rootWildcard.handler(req, res, params)
        }


        res.statusCode = 404;
        res.end("Not Found");
        return;
      }
    }

     if (!node.handler) {

      if (rootWildcard?.handler) {
        return rootWildcard.handler(req, res, params)
      }

      res.statusCode = 404;

      return res.end("Not Found");
    }

    return node.handler(req, res, params)
  }

  private _createNode(): Node {
    return { static: Object.create(null) }
  }

  private _add(method: Method, path: string, handler: Handler) {
    let node = this.trees[method];

    let start = 1;

    for (let i = 1; i <= path.length; i++) {
      if (path[i] === "/" || i === path.length) {
        const part = path.slice(start, i);

        if (!part) {
          start = i + 1
          continue;
        }

        if (part[0] === ":") {

          if (!node.param) {
            node.param = this._createNode();
            node.param.paramName = part.slice(1);
          }

          node = node.param;
        } 
        
        else if (part === "*") {

          if (!node.wildcard) {
            node.wildcard = this._createNode();
          }
          node = node.wildcard;

          break
        } 
        
        else {

          if (!node.static[part]) {
            node.static[part] = this._createNode();
          }

          node = node.static[part];
        }

        start = i + 1;
      }
    }

    node.handler = handler;

    this._routes.push({
      path,
      method,
      params: this._extractParams(path)
    });

    return;
  }

  private _extractParams(path: string): string[] {
    const params: string[] = [];

    let start = 1;

    for (let i = 1; i <= path.length; i++) {
      if (path[i] === "/" || i === path.length) {
        const part = path.slice(start, i);

        if (part && part[0] === ":") {
          params.push(part.slice(1));
        }

        start = i + 1;
      }
    }

    return params;
  }
}