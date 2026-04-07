import { IncomingMessage, ServerResponse } from "http"

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
  private trees: Record<string, Node> = {}

  constructor() {
    for (const m of METHODS) {
      this.trees[m] = this._createNode();
    }
  }

  private _createNode(): Node {
    return { static: {} }
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

    return;
  }

  public get(path: string, handler: Handler) {
    this._add("GET", path, handler);
    return this;
  }

  public post(path: string, handler: Handler) {
    this._add("POST", path, handler);
    return this;
  }

  public put(path: string, handler: Handler) {
    this._add("PUT", path, handler);
    return this;
  }

  public patch(path: string, handler: Handler) {
    this._add("PATCH", path, handler);
    return this;
  }

  public delete(path: string, handler: Handler) {
    this._add("DELETE", path, handler);
    return this;
  }

  public options(path: string, handler: Handler) {
    this._add("OPTIONS", path, handler);
    return this;
  }

  public head(path: string, handler: Handler) {
    this._add("HEAD", path, handler);
    return this;
  }

  public all(path: string, handler: Handler) {
    for(const method of METHODS) {
      this._add(method, path, handler);
    }
    return this;
  }

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

    const params: Record<string, string> = {};

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
          node = node.wildcard;
          break
        }
        
        if (rootWildcard?.handler) {
          return rootWildcard.handler(req, res, params)
        }

        res.statusCode = 404;

        return res.end("Not Found");
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
}