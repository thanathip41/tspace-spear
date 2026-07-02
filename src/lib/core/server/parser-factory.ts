import fsSystem          from "fs";
import pathSystem        from "path";
import swaggerUiDist     from "swagger-ui-dist";
import fastQuerystring   from "fast-querystring";
import { type T }        from "../types";

import { uWSBody, uWSfiles }   from "./uWS";
import { netBody, netFiles }   from "./net";
import { httpBody, httpfiles } from "./http";
export class ParserFactory {
  private uWS     = false;
  private net     = false;
 
  public useAdapter(adapter: T.Adapter) {
  
    if(adapter.kind === 'uWS') {
      this.uWS = true;
    }

    if(adapter.kind === 'net') {
      this.net = true
    }

    return this;
  }
  public queryString(url: string) {
    const i = url.indexOf("?");

    if (i === -1) return {};

    return fastQuerystring.parse(url.slice(i + 1));
  }

  public async files({
    req,
    res,
    options,
  }: {
    req: T.Request;
    res: T.Response;
    options: {
      limit: number;
      tempFileDir: string;
      removeTempFile: {
        remove: boolean;
        ms: number;
      };
    };
  }) {

    if (this.uWS) {
      return uWSfiles({ req, res, options });
    }

    if(this.net) {
      return netFiles({req , res , options })
    }

    return httpfiles({req , res , options });
  }

  public async body(req: T.Request, res: T.Response): Promise<T.Body> {

    if (this.uWS) {
      return (await uWSBody(req, res)) as T.Body;
    }

    if(this.net) {
      return (await netBody(req,res)) as T.Body;
    }

    return (await httpBody(req,res)) as T.Body;
  }

  public cookies(req: T.Request) {
    const cookies: Record<string, any> = {};

    const cookieString = req.headers?.cookie;

    if (cookieString == null) return null;

    for (const cookie of cookieString.split(";")) {
      const [name, value] = cookie.split("=").map((v: string) => v.trim());
      cookies[name] = decodeURIComponent(value);
    }

    for (const name of Object.keys(cookies)) {
      const cookie = cookies[name];
      if (!cookie.startsWith("Expires=")) continue;
      const expiresString = cookie.replace("Expires=", "");
      const expiresDate = new Date(expiresString);
      if (isNaN(expiresDate.getTime()) || expiresDate < new Date()) {
        delete cookies[name];
      }
    }

    return cookies;
  }

  public async swagger(doc: T.Swagger.Doc) {

    const resolveGlobalPrefix = (
        {
            path,
            method
        }: {
            path: string | '*';
            method: T.Method | '*';
        }
    ): string => {

        if(doc.globalPrefix == null) return '';

        const globalPrefix = doc.globalPrefix.path;

        if (!globalPrefix) {
            return '';
        }

        if (path === '*') {
            return `/${globalPrefix}`;
        }

        const cleanPath = path.replace(/^\/+|\/+$/g, '');
        const upperMethod = method.toUpperCase();
        const exclude = doc.globalPrefix.options.exclude;

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

    const spec = {
      openapi: "3.1.0",
      info: doc.info ?? {
        title: "API Documentation",
        description: "Documentation",
        version: "1.0.0",
      },
      components: {
        securitySchemes: {
          BearerToken: {
            type: "http",
            scheme: "bearer",
            name: "Authorization",
            description: "Enter your token in the format : 'Bearer {TOKEN}'",
          },
          cookies: {
            type: "apiKey",
            in: "header",
            name: "Cookie",
            description: "Enter your cookies in the headers",
          },
        },
      },
      servers: doc.servers,
      tags: doc.tags,
      paths: {},
    };

    const { appRoutes } = await import("../compiler/pre-routes");

    const specPaths = (routes: T.Route[]) => {
      let paths: Record<string, any> = {};

      const defaultSpecResponse = {
        "200": {
          description: "OK",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: {
                    example: "success",
                  },
                },
              },
            },
          },
        },
      };
      
      for (const r of routes) {
        if (r.path === "*") continue;

        const path = r.path.replace(/:(\w+)/g, "{$1}");
        const method = r.method.toLowerCase();

        const swagger = (doc.specs ?? []).find((s) => {
          return s.path === r.path && s.method.toLowerCase() === method;
        });

        const decoratedOnly = doc.options?.decoratedOnly ?? false;

        if ((swagger == null && decoratedOnly) || swagger?.disabled) {
          continue;
        }

        //@ts-ignore
        const globalPrefix = resolveGlobalPrefix({ path , method })

        const pathWithoutGlobalPrefix= r.path
        .replace(globalPrefix, "")
        .replace(/\/+/g, '/') 
        .replace(/\/$/, '') || '/';

        //@ts-ignore
        const preRoute = appRoutes[pathWithoutGlobalPrefix]?.[r.method];

        if (paths[path] == null) {
          paths[path] = {
            [method]: {},
          };
        }

        const spec: Record<string, any> = {};

        const tags = /\/api\/v\d+/.test(r.path)
          ? r.path.split("/")[3]
          : /\/api/.test(r.path)
            ? r.path.split("/")[2]
            : r.path.split("/")[1];

        spec.parameters = [];

        spec.responses = {};

        spec.tags = [];

        if (doc.responses != null) {

          const responses: Record<string, any> = {};

          for (const response of Array.from(doc.responses ?? [])) {

            if (response == null || !Object.keys(response).length) continue;

            responses[`${response.status}`] = {
              description: response.description,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties:
                      response.example == null
                        ? {}
                        : Object.keys(response.example).reduce(
                            (prev: Record<string, any>, key: string) => {
                              prev[key] = {
                                example: (response?.example ?? {})[key] ?? {},
                              };
                              return prev;
                            },
                            {},
                          ),
                  },
                },
              },
            };
          }

          spec.responses = {
            ...responses,
          };
        }

        if(swagger == null) {

          spec.tags = [
            tags == null || tags === "" || /^:[^:]*$/.test(tags)
              ? "default"
              : tags,
          ];

          if (!Object.keys(spec.responses).length) {
            spec.responses = defaultSpecResponse;
          }

          if (preRoute && Object.keys(preRoute.params ?? {}).length) {

            const queryParams = Object.entries(preRoute.params ?? {}).map(([k, v]) => {
            return {
                name: k,
                in: "path",
                required: false,
                description: `Params for '${k}'`,
                example: v,
                schema: {
                  type: v
                }
              }
            });

            spec.parameters = [
              ...(spec.parameters ?? []),
              ...queryParams,
            ];
          } else if (Array.isArray(r.params) && Array.from(r.params).length) {
            spec.parameters = Array.from(r.params).map((p) => {
              return {
                name: p,
                in: "path",
                required: true,
                schema: {
                  type: "string",
                },
              };
            });
          }

          if(preRoute && Object.keys(preRoute.query ?? {}).length) {
            
            const queryParams = Object.entries(preRoute.query ?? {}).map(([k, v]) => {
              return {
                name: k,
                in: "query",
                required: false,
                description: `QueryParams for '${k}'`,
                example: v,
                schema: {
                  type: v,
                }
              }
            });

            spec.parameters = [
              ...(spec.parameters ?? []),
              ...queryParams,
            ];
          }

          if(preRoute && Object.keys(preRoute.body ?? {}).length) {

            const properties = Object.fromEntries(
              Object.entries(preRoute.body ?? {}).map(([key, value]) => [
                key,
                {
                  type: value,
                  example: value,
                },
              ])
            );
            spec.requestBody = {
              description: `Body payload`,
              required: false,
              content: {
                "application/json": {
                  schema: {
                    type       : "object",
                    properties : properties,
                    required   : false
                  }
                },
              },
            }
           
          }

          if(preRoute && Object.keys(preRoute.files ?? {}).length) {

            const properties = Object.fromEntries(
              Object.entries(preRoute.files ?? {}).map(([key, value]) => [
                key,
                {
                  type: value,
                  format:"binary",
                  example: value,
                },
              ])
            );

            spec.requestBody = {
              description: `File Upload payload`,
              required: false,
              content: {
                 "multipart/form-data": {
                  schema: {
                    type: "object",
                    properties: properties,
                  },
                },
              },
            }
           
          }

          if(preRoute && Object.keys(preRoute.response ?? {}).length) {
            
            const responses: Record<string, any> = {};
            
              responses["200"] = {
                description: null,
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: Object.keys(preRoute.response ?? {}).reduce(
                          (prev: Record<string, any>, key: string) => {
                            prev[key] = {
                              example: (preRoute.response ?? {})[key] ?? {},
                            };
                            return prev;
                          },
                          {},
                        )
                    },
                  },
                },
              };

            spec.responses = {
              ...responses,
            };
          }

          paths[path][method] = spec;

          continue;
        }

        /** Load from Swagger */
        spec.tags = [
          swagger.tags == null
            ? tags == null || tags === "" || /^:[^:]*$/.test(tags)
              ? "default"
              : tags
            : swagger.tags,
        ];

        if (swagger.bearerToken) {
          spec.security = [{ BearerToken: [] }];
        }

        if (swagger.summary != null) {
          spec.summary = swagger.summary;
        }

        if (swagger.description != null) {
          spec.description = swagger.description;
        }

        if(swagger.params != null) {
          const params = Object.entries(swagger.params).map(([k, v]) => {
            return {
              name: k,
              in: "path",
              required: v?.required === true,
              description: v?.description,
              example: v?.example || v?.enum,
              schema: {
                type: v?.type ?? "string",
              }
            }
          });

          spec.parameters = [
            ...(spec.parameters ?? []),
            ...params,
          ];
        }
        else if (preRoute && Object.keys(preRoute.params ?? {}).length) {

           const queryParams = Object.entries(preRoute.params ?? {}).map(([k, v]) => {
           return {
              name: k,
              in: "path",
              required: false,
              description: `Params for '${k}'`,
              example: v,
              schema: {
                type: v
              }
            }
          });

          spec.parameters = [
            ...(spec.parameters ?? []),
            ...queryParams,
          ];
        }
        else if (Array.isArray(r.params) && Array.from(r.params).length) {
          spec.parameters = Array.from(r?.params).map((p) => {
            return {
              name: p,
              in: "path",
              required: true,
              schema: {
                type: "string",
              },
            };
          });
        }

        if (swagger.query != null) {
          const queryParams = Object.entries(swagger.query).map(([k, v]) => {
            return {
              name: k,
              in: "query",
              required: v?.required === true,
              description: v?.description,
              example: v?.example || v?.enum,
              schema: {
                type: v?.type ?? "string",
              }
            }
          });

          spec.parameters = [
            ...(spec.parameters ?? []),
            ...queryParams,
          ];
        } else if(preRoute && Object.keys(preRoute.query ?? {}).length) {
            
          const queryParams = Object.entries(preRoute.query ?? {}).map(([k, v]) => {
            return {
              name: k,
              in: "query",
              required: false,
              description: `QueryParams for '${k}'`,
              example: v,
              schema: {
                type: v,
              }
            }
          });

          spec.parameters = [
            ...(spec.parameters ?? []),
            ...queryParams,
          ];
        }

        if (swagger.cookies != null) {
          spec.parameters = [
            ...spec.parameters,
            ...[
              {
                name: "Cookie",
                in: "header",
                required: swagger.cookies.required === true,
                schema: {
                  type: "string",
                },
                example: swagger.cookies.names
                  .map((v, i) => `${v}={value${i + 1}}`)
                  .join(" ; "),
                description: swagger.cookies?.description,
              },
            ],
          ];
        }

        if (swagger.body != null) {

          spec.requestBody = {
            description: swagger.body.description,
            required: swagger.body?.required === true,
            content: {
              "application/json": {
                schema: {
                  type       : "object",
                  properties : swagger.body.properties,
                  required   : Object.entries(swagger.body.properties)
                    .filter(([_, v]) => v.required)
                    .map(([key]) => key)
                },
              },
            },
          };
        } else if(preRoute && Object.keys(preRoute.body ?? {}).length) {

          const properties = Object.fromEntries(
            Object.entries(preRoute.body ?? {}).map(([key, value]) => [
              key,
              {
                type: value,
                example: value,
              },
            ])
          );
          spec.requestBody = {
            description: `Body payload`,
            required: false,
            content: {
              "application/json": {
                schema: {
                  type       : "object",
                  properties : properties,
                  required   : false
                }
              },
            },
          }
        }

        if (swagger.files != null) {

          spec.requestBody = {
            description: swagger.files.description,
            required: swagger.files?.required === true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: swagger.files.properties,
                },
              },
            },
          };
        } else if(preRoute && Object.keys(preRoute.files ?? {}).length) {

          const properties = Object.fromEntries(
            Object.entries(preRoute.files ?? {}).map(([key, value]) => [
              key,
              {
                type: value,
                format:"binary",
                example: value,
              },
            ])
          );

          spec.requestBody = {
            description: `File Upload payload`,
            required: false,
            content: {
                "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: properties,
                },
              },
            },
          }
        }

        if (swagger.responses != null) {
          const responses: Record<string, any> = {};
          for (const response of swagger.responses) {
            if (response == null || !Object.keys(response).length) continue;

            responses[`${response.status}`] = {
              description: response.description,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties:
                      response.example == null
                        ? {}
                        : Object.keys(response.example).reduce(
                            (prev: Record<string, any>, key: string) => {
                              prev[key] = {
                                example: (response?.example ?? {})[key] ?? {},
                              };
                              return prev;
                            },
                            {},
                          ),
                  },
                },
              },
            };
          }

          spec.responses = {
            ...responses,
          };
        } else if(preRoute && Object.keys(preRoute.response ?? {}).length) {
            
          const responses: Record<string, any> = {};
          
            responses["200"] = {
              description: null,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: Object.keys(preRoute.response ?? {}).reduce(
                        (prev: Record<string, any>, key: string) => {
                          prev[key] = {
                            example: (preRoute.response ?? {})[key] ?? {},
                          };
                          return prev;
                        },
                        {},
                      )
                  },
                },
              },
            };

          spec.responses = {
            ...responses
          };
          
        }

        if (!Object.keys(spec.responses).length) {
          spec.responses = defaultSpecResponse;
        }

        paths[path][method] = spec;
      }

      return paths;
    };

    spec.paths = specPaths(doc.routes ?? []);

    const normalizePath = (...paths: string[]): string => {
      const path = paths.join("/").replace(/\/+/g, "/").replace(/\/+$/, "");

      const normalizedPath = path.startsWith("/") ? path : `/${path}`;

      return /\/api\/api/.test(normalizedPath)
        ? normalizedPath.replace(/\/api\/api\//, "/api/")
        : normalizedPath;
    };

    const STATIC_URL = "/swagger-ui";
    const iconURL = normalizePath(
      doc.staticUrl ?? "",
      `${STATIC_URL}/favicon-32x32.png`,
    ).replace(/^\/(http[s]?:\/{0,2})/, "$1");
    const cssURL = normalizePath(
      doc.staticUrl ?? "",
      `${STATIC_URL}/swagger-ui.css`,
    ).replace(/^\/(http[s]?:\/{0,2})/, "$1");
    const scriptBundle = normalizePath(
      doc.staticUrl ?? "",
      `${STATIC_URL}/swagger-ui-bundle.js`,
    ).replace(/^\/(http[s]?:\/{0,2})/, "$1");
    const scriptStandalonePreset = normalizePath(
      doc.staticUrl ?? "",
      `${STATIC_URL}/swagger-ui-standalone-preset.js`,
    ).replace(/^\/(http[s]?:\/{0,2})/, "$1");

    const html = `
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="description" content="SwaggerUI" />
                <title>SwaggerUI</title>
                <link rel="icon" href="${iconURL}">
                <link rel="stylesheet" href="${cssURL}" />
                <style>
                    .swagger-ui .topbar .download-url-wrapper {
                        visibility: hidden;
                    }
                </style>
            </head>
            <body>
                <div id="swagger-ui"></div>
            </body>
            <script src="${scriptBundle}"></script>
            <script src="${scriptStandalonePreset}"></script>
            <script>
                window.onload = () => {
                    window.ui = SwaggerUIBundle({ 
                        dom_id: '#swagger-ui',
                        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset], 
                        spec : ${JSON.stringify(spec)}, 
                        withCredentials: ${doc.options?.withCredentials ?? "true"},
                        layout: "${doc.options?.layout ?? "StandaloneLayout"}",
                        filter: "${doc.options?.filter ?? "false"}",
                        docExpansion: "${doc.options?.docExpansion ?? "list"}",
                        deepLinking: "${doc.options?.deepLinking ?? "true"}",
                        displayOperationId: "${doc.options?.displayOperationId ?? "false"}",
                        displayRequestDuration: "${doc.options?.displayRequestDuration ?? "false"}"
                    });
                };
            </script>
        </html>
        `;

    const staticSwaggerHandler = (
      req: T.Request,
      res: T.Response,
      params: Record<string, string>,
    ) => {
      try {
        const swaggerUiPath = swaggerUiDist.getAbsoluteFSPath();

        const mimeTypes: Record<string, any> = {
          ".html": "text/html",
          ".css": "text/css",
          ".js": "application/javascript",
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".gif": "image/gif",
          ".svg": "image/svg+xml",
          ".json": "application/json",
        };

        const requestedFilePath = params["*"];
        const filePath = pathSystem.join(swaggerUiPath, requestedFilePath);
        const extname = pathSystem.extname(filePath);
        const contentType = mimeTypes[extname] || "text/html";

        const content = fsSystem.readFileSync(filePath);

        res.writeHead(200, { "Content-Type": contentType });

        return res.end(content, "utf-8");
      } catch (err: any) {
        res.writeHead(404, { "Content-Type": "text/plain" });

        return res.end("Not found");
      }
    };

    return {
      path: doc.path,
      staticUrl: `${STATIC_URL}/*`,
      staticSwaggerHandler,
      html,
    };
  }
}
