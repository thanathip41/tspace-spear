import fsSystem          from 'fs'
import pathSystem        from 'path'
import mime              from 'mime-types'
import crypto            from 'crypto'
import swaggerUiDist     from 'swagger-ui-dist'
import querystring       from 'querystring'
import { Readable }      from 'stream'
import { StringDecoder } from "string_decoder"

import busboy, { 
    type FileInfo 
} from 'busboy'

import {
    IncomingMessage, 
    ServerResponse 
} from "http"

import { 
    type TBody, 
    type TFiles, 
    type TSwaggerDoc 
} from '../types'

export class ParserFactory {

    files (req : IncomingMessage , options : {
        limit : number
        tempFileDir : string
        removeTempFile : {
            remove :  boolean,
            ms      : number
        }
    }) {
        
        const temp = options.tempFileDir

        if (!fsSystem.existsSync(temp)) {
            try { fsSystem.mkdirSync(temp, { recursive: true })} catch (err) {}
        }

        return new Promise<{ body : TBody , files : TFiles }>((resolve, reject) => {

            const body  : Record<string,any> = {};
            const files : Record<string,any> = {};
         
            const fileWritePromises :any[] = [];

            const bb = busboy({ headers: req.headers })

            const removeTemp = (fileTemp : string , ms : number) => {
                const remove = () => {
                    try { fsSystem.unlinkSync(fileTemp) } catch (err) {}
                }
                setTimeout(remove, ms)
            }

            bb.on('file', (fieldName : string, fileData : Readable, info : FileInfo) => {
                
                const { filename, mimeType } = info;
                
                const tempFilename = crypto.randomBytes(16).toString('hex')

                const filePath = pathSystem.join(pathSystem.resolve(),`${temp}/${tempFilename}`)

                const writeStream =  fsSystem.createWriteStream(filePath)

                let fileSize = 0;

                fileData.on('data', (data: string) => {
                    fileSize += data.length;

                    if(fileSize > options.limit) {

                        fileData.unpipe(writeStream)

                        writeStream.destroy()

                        return reject(new Error(`The file '${fieldName}' is too large to be uploaded. The limit is '${options.limit}' bytes.`))
                    }
                })

                const fileWritePromise = new Promise((resolve, reject) => {
                    
                    fileData.pipe(writeStream)

                    writeStream.on('finish', () => {

                        const file = {
                            name         : filename,
                            tempFilePath : filePath,
                            tempFileName : tempFilename,
                            mimetype     : mimeType,
                            extension    : String(mime.extension(String(mimeType))),
                            size         : fileSize,
                            sizes : {
                                bytes : fileSize,
                                kb    : fileSize / 1024,
                                mb    : fileSize / 1024 / 1024,
                                gb    : fileSize / 1024 / 1024 / 1024
                            },
                            write : (to : string) => {
                                return new Promise((resolve, reject) => {
                                    fsSystem.createReadStream(filePath)
                                    .pipe(fsSystem.createWriteStream(to))
                                    .on('finish', () => {
                                      return resolve(null)
                                    })
                                    .on('error', (err) => {
                                        return reject(err)
                                    });
                                })
                            },
                            remove : () => {
                                return new Promise(resolve => setTimeout(() => {
                                    fsSystem.unlinkSync(filePath)
                                    return resolve(null)
                                },100))
                            }
                        }

                        if (files[fieldName] == null) {
                            files[fieldName] = []
                        }
        
                        files[fieldName].push(file)

                        if(options.removeTempFile.remove) {
                            removeTemp(filePath , options.removeTempFile.ms)
                        }

                        return resolve(null)
                    })

                    writeStream.on('error', reject)
                })

                fileWritePromises.push(fileWritePromise)
                    
            })

            bb.on('field', (name: string, value: string) => {
              body[name] = value;
            })

            bb.on('finish', () => {
            
                Promise.all(fileWritePromises)
                .then(() => {
                    return resolve({
                        files,
                        body
                    })
                })
                .catch((err) => {
                    return reject(err)
                })
            })

            bb.on('error', (err : any) => {
                return reject(err)
            })

            req.pipe(bb)
        
        })
    }
    
    body (req : IncomingMessage) {

        return new Promise((resolve, reject) => {

            const decoder = new StringDecoder('utf-8');
            let payload = '';
    
            req.on('data', (data: Buffer) => {
                payload += decoder.write(data);
            });
    
            req.on('end', () => {
                try {

                    const isUrlEncoded = req.headers['content-type']?.includes('x-www-form-urlencoded');

                    if (isUrlEncoded) {
                        return resolve(querystring.parse(payload));
                    }

                    payload += decoder.end();

                    return resolve(JSON.parse(payload));
                   
                } catch (e) {
                    
                    return resolve({});
                }
            });
    
            req.on('error', (err: any) => {
    
                return reject(err);
            });
        });
    }

    cookies (req : IncomingMessage) {
        const cookies: Record<string,any> = {}

        const cookieString = req.headers?.cookie

        if(cookieString == null) return null

        for(const cookie of cookieString.split(';')) {
            const [name, value] = cookie.split('=').map((v: string) => v.trim());
            cookies[name] = decodeURIComponent(value);
        }

        for(const name of Object.keys(cookies)) {
            const cookie = cookies[name]
            if (!cookie.startsWith('Expires=')) continue
            const expiresString = cookie.replace('Expires=', '');
            const expiresDate = new Date(expiresString);
            if (isNaN(expiresDate.getTime()) || expiresDate < new Date()) {
                delete cookies[name];
            }
        }

        return cookies;
    }

    swagger (doc : TSwaggerDoc) {
        
        const spec = {
            openapi : "3.1.0",
            info: doc.info ?? {
                title : 'API Documentation',
                description : "Documentation",
                version : '1.0.0'
            },
            components : {
                securitySchemes : {
                    BearerToken: {
                        type: "http",
                        scheme: "bearer",
                        name: "Authorization",
                        description: "Enter your token in the format : 'Bearer {TOKEN}'"
                    },
                    cookies: {
                        type: "apiKey",
                        in: "header",
                        name: "Cookie",
                        description: "Enter your cookies in the headers"
                    }
                },
            },
            servers: doc.servers,
            tags: doc.tags,
            paths: {},
        }

        const specPaths = (routes : { method : string , path : string , params : string[] }[]) => {

            let paths : Record<string,any> = {}

            for(const r of routes) {

                if(r.path === '*') continue

                const path = r.path.replace(/:(\w+)/g, "{$1}")
                const method = r.method.toLocaleLowerCase()

                if(paths[path] == null) {
                    paths[path] = {
                        [method]: {}
                    }
                }

                const spec : Record<string,any> = {}
                const tags =  /\/api\/v\d+/.test(r.path)
                ? r.path.split('/')[3]
                : /\/api/.test(r.path)
                  ? r.path.split('/')[2]
                  : r.path.split('/')[1]

                spec.parameters = []
                spec.responses = {}
                spec.tags = []

                if(doc.responses != null) {
                    const responses : Record<string,any> = {}
                    for(const response of Array.from(doc.responses ?? [])) {
                   
                        if(response == null || !Object.keys(response).length) continue
        
                        responses[`${response.status}`] = {
                            description: response.description, 
                            content: {
                                "application/json": {
                                    schema : {
                                        type: 'object', 
                                        properties: response.example == null 
                                        ? {} 
                                        : Object.keys(response.example)
                                        .reduce((prev : Record<string,any>, key : string) => {
                                            prev[key] = { example : (response?.example ?? {})[key] ?? {} }
                                            return prev;
                                        }, {})
                                    }
                                }
                            }
                        }
                    }
        
                    spec.responses = {
                        ...responses
                    }
                }

                const swagger = doc.options.find(s => (s.path === r.path) && (s.method.toLocaleLowerCase() === method))

                if(swagger != null) {

                    spec.tags = [
                        swagger.tags == null
                        ? tags == null || tags === '' || /^:[^:]*$/.test(tags) ? 'default' : tags
                        : swagger.tags
                    ]

                    if(swagger.bearerToken) {
                        spec.security = [{ "BearerToken": [] }]
                    }

                    if(swagger.summary != null) {
                        spec.summary = swagger.summary
                    } 

                    if(swagger.description != null) {
                        spec.description= swagger.description
                    } 
                   
                    if(Array.isArray(r.params) && Array.from(r.params).length) {
                        spec.parameters = Array.from(r?.params).map(p => {
                            return {
                                name : p,
                                in : "path",
                                required: true,
                                schema: {
                                    type: "string"
                                }
                            }
                        })
                    }

                    if(swagger.query != null) {

                        spec.parameters = [
                            ...spec.parameters,
                            ...Object.entries(swagger.query).map(([k , v]) => {
                                return {
                                    name : k,
                                    in : "query",
                                    required: v.required == null ? false : true,
                                    schema: {
                                        type: v.type
                                    }
                                }
                            })
                        ]
                    }

                    if(swagger.cookies != null) {
                        spec.parameters = [
                            ...spec.parameters,
                            ...[{
                                name : "Cookie",
                                in : "header",
                                required: swagger.cookies.required == null ? false : true,
                                schema: {
                                    type: "string"
                                },
                                example : swagger.cookies.names.map((v,i) => `${v}={value${i+1}}`).join(' ; '),
                                description : swagger.cookies?.description
                            }]
                        ]
                    }

                    if(swagger.body != null) {
                        spec.requestBody = {
                            description: swagger.body?.description == null ? "description" : swagger.body.description,
                            required: swagger.body?.required == null ? false : true,
                            content : {
                                "application/json" : {
                                    schema : {
                                        type: "object",
                                        properties: swagger.body.properties
                                    }
                                }
                            }
                        }
                    }

                    if(swagger.files != null) {
                        spec.requestBody = {
                            description: swagger.files?.description == null ? "description" : swagger.files.description,
                            required: swagger.files?.required == null ? false : true,
                            content : {
                                "multipart/form-data" : {
                                    schema : {
                                        type: "object",
                                        properties: swagger.files.properties
                                    }
                                }
                            }
                        }
                    }

                    if(swagger.responses != null) {
                        const responses : Record<string,any> = {}
                        for(const response of swagger.responses) {
                       
                            if(response == null || !Object.keys(response).length) continue

                            responses[`${response.status}`] = {
                                description: response.description, 
                                content: {
                                    "application/json": {
                                        schema : {
                                            type: 'object', 
                                            properties: response.example == null 
                                            ? {} 
                                            : Object.keys(response.example)
                                            .reduce((prev : Record<string,any>, key : string) => {
                                                prev[key] = { example : (response?.example ?? {})[key] ?? {} }
                                                return prev;
                                            }, {})
                                        }
                                    }
                                }
                            }
                        }
    
                        spec.responses = {
                            ...responses
                            
                        }
                    }
                
                    paths[path][method] = spec       

                    continue
                }

                spec.tags = [
                    tags == null || tags === '' || /^:[^:]*$/.test(tags) ? 'default' : tags
                ]

                if(Array.isArray(r.params) && Array.from(r.params).length) {
                    
                    spec.parameters = Array.from(r.params).map(p => {
                        return {
                            name : p,
                            in : "path",
                            required: true,
                            schema: {
                                type: "string"
                            }
                        }
                    })
                }

                paths[path][method] = spec           

            }

            return paths
            
        }

        spec.paths = specPaths(doc.routes)

        const normalizePath = (...paths: string[]) : string => {
            const path = paths
            .join('/')
            .replace(/\/+/g, '/')
            .replace(/\/+$/, '')
    
            const normalizedPath = path.startsWith('/') ? path : `/${path}`
        
            return /\/api\/api/.test(normalizedPath) ? normalizedPath.replace(/\/api\/api\//, "/api/") : normalizedPath
        }

        const STATIC_URL = '/swagger-ui'
        const iconURL = normalizePath(doc.staticUrl ?? '', `${STATIC_URL}/favicon-32x32.png`).replace(/^\/(http[s]?:\/{0,2})/, '$1')
        const cssURL  = normalizePath(doc.staticUrl ?? '', `${STATIC_URL}/swagger-ui.css`).replace(/^\/(http[s]?:\/{0,2})/, '$1')
        const scriptBundle = normalizePath(doc.staticUrl ??'' , `${STATIC_URL}/swagger-ui-bundle.js`).replace(/^\/(http[s]?:\/{0,2})/, '$1')
        const scriptStandalonePreset = normalizePath(doc.staticUrl ?? '' , `${STATIC_URL}/swagger-ui-standalone-preset.js`).replace(/^\/(http[s]?:\/{0,2})/, '$1')
    
        const html = `
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="description" content="SwaggerUI" />
                <title>SwaggerUI</title>
                <link rel="icon" href="${iconURL}">
                <link rel="stylesheet" href="${cssURL}" />
            </head>
            <body>
                <div id="swagger-ui"></div>
            </body>
            <script src="${scriptBundle}"></script>
            <script src="${scriptStandalonePreset}"></script>
            <script>
                window.onload = () => {
                    window.ui = SwaggerUIBundle({ spec : ${JSON.stringify(spec)} , 
                    dom_id: '#swagger-ui',
                    withCredentials: true,
                    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset], layout: "StandaloneLayout"});
                };
            </script>
        </html>
        `
        
        const staticSwaggerHandler = (req : IncomingMessage, res : ServerResponse, params : Record<string,any>) => {

            const swaggerUiPath = swaggerUiDist.getAbsoluteFSPath()

            const mimeTypes : Record<string,any> = {
                '.html': 'text/html',
                '.css': 'text/css',
                '.js': 'application/javascript',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.gif': 'image/gif',
                '.svg': 'image/svg+xml',
                '.json': 'application/json'
            }
            
            const requestedFilePath :any = params['*'];
            const filePath = pathSystem.join(swaggerUiPath, requestedFilePath);
            const extname = pathSystem.extname(filePath)
            const contentType = mimeTypes[extname] || 'text/html'
            
            try {
                const content = fsSystem.readFileSync(filePath)

                res.writeHead(200, {'Content-Type': contentType })

                return res.end(content, 'utf-8')

            } catch (err : any) {

                res.writeHead(404, {'Content-Type': contentType })

                return res.end(`The file '${requestedFilePath}' is not exists`)
            }
        }
        
        return {
            path : doc.path,
            staticUrl : `${STATIC_URL}/*`,
            staticSwaggerHandler,
            html
        }
    }
}