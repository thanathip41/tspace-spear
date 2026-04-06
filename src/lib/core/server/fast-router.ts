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

type Method = typeof METHODS[number]

export class FastRouter {
  private trees: Record<string, Node> = Object.create(null)

  constructor() {
    for (const m of METHODS) {
      this.trees[m] = this.createNode()
    }
  }

  private createNode(): Node {
    return { static: Object.create(null) }
  }

  private add(method: Method, path: string, handler: Handler) {
    let node = this.trees[method]

    let i = 1
    let start = 1

    for (; i <= path.length; i++) {
      if (path[i] === "/" || i === path.length) {
        const part = path.slice(start, i)

        if (!part) {
          start = i + 1
          continue
        }

        if (part[0] === ":") {
          if (!node.param) {
            node.param = this.createNode()
            node.param.paramName = part.slice(1)
          }
          node = node.param
        } else if (part === "*") {
          if (!node.wildcard) {
            node.wildcard = this.createNode()
          }
          node = node.wildcard
          break
        } else {
          if (!node.static[part]) {
            node.static[part] = this.createNode()
          }
          node = node.static[part]
        }

        start = i + 1
      }
    }

    node.handler = handler
  }

  public get(path: string, handler: Handler) {
    this.add("GET", path, handler)
  }

  public post(path: string, handler: Handler) {
    this.add("POST", path, handler)
  }

  public put(path: string, handler: Handler) {
    this.add("PUT", path, handler)
  }

  public patch(path: string, handler: Handler) {
    this.add("PATCH", path, handler)
  }

  public delete(path: string, handler: Handler) {
    this.add("DELETE", path, handler)
  }

  public options(path: string, handler: Handler) {
    this.add("OPTIONS", path, handler)
  }

  public head(path: string, handler: Handler) {
    this.add("HEAD", path, handler)
  }

  public all(path: string, handler: Handler) {
    for(const method of METHODS) {
       this.add(method, path, handler)
    }
  }

  public lookup(req: IncomingMessage, res: ServerResponse) {
    const method = req.method!
    let node = this.trees[method]

    if (!node) {
      res.statusCode = 405
      return res.end("Method Not Allowed")
    }

    let url = req.url || "/"
    let q = url.indexOf("?")
    if (q !== -1) url = url.slice(0, q)

    const params: Record<string, string> = Object.create(null)

    let i = 1
    let start = 1

    for (; i <= url.length; i++) {
      if (url[i] === "/" || i === url.length) {
        const part = url.slice(start, i)

        if (!part) {
          start = i + 1
          continue
        }

        let next = node.static[part]
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
          node = node.wildcard
          break
        }

        res.statusCode = 404
        return res.end("Not Found")
      }
    }

    if (!node.handler) {
      res.statusCode = 404
      return res.end("Not Found")
    }

    return node.handler(req, res, params)
  }
}