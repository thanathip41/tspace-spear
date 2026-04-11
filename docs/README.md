# TspaceSpear

[![NPM version](https://img.shields.io/npm/v/tspace-spear.svg)](https://www.npmjs.com)
[![NPM downloads](https://img.shields.io/npm/dm/tspace-spear.svg)](https://www.npmjs.com)

tspace-spear is a lightweight API framework for Node.js that is fast and highly focused on providing the best developer experience. 
It utilizes the native HTTP server.

### Install

Install with [npm](https://www.npmjs.com/):

```sh
npm install tspace-spear --save
```

### Getting Started
```js
import { Spear } from "tspace-spear";

new Spear()
.get('/' , () => 'Hello world!')
.get('/json' , () => {
  return {
    message : 'Hello world!'
  }
})
.listen(3000 , () => console.log(`Server is now listening http://localhost:3000`))

```

## Adapter
tspace-spear supports multiple server adapters, 
including the native Node.js HTTP server and uWebSockets.js for high performance.

⚠️ Requirements for uWebSockets.js
Node.js 18 or higher is required
Installation is done via GitHub (no official npm release)

```js
import { Spear } from "tspace-spear";
import uWS from "uWebSockets.js";

// Install via package.json
// "dependencies": {
//   "uWebSockets.js": "github:uNetworking/uWebSockets.js#v20.45.0"
// }

new Spear({ adapter: uWS })
.get("/", () => "Hello world!")
.get("/json", () => {
  return {
    message: "Hello world!",
  };
})
.listen(3000, () =>
  console.log("uWS server is running at http://localhost:3000")
);
```

### Cluster
Cluster mode allows tspace-spear to run multiple worker processes to fully utilize multi-core CPU performance.
```js
import { Spear } from "tspace-spear";
new Spear({
  cluster : 3
})
.get('/' , () => 'Hello world!')
.get('/json' , () => {
  return {
    message : 'Hello world!'
  }
})
.listen(3000 , () => console.log(`Server is now listening http://localhost:3000`))

```

### Global Prefix
Global Prefix allows you to define a base path for all routes in your application.

It helps keep your API structured and consistent (e.g. /api, /v1, /app).
```js
const app = new Spear({
  globalPrefix : '/api' // prefix all routes
})
.get('/' , () => 'Hello world!')
.listen(3000 , () => console.log(`Server is now listening http://localhost:3000`))

// http://localhost:3000/api => 'Hello world!'
```

### Logger
The built-in Logger provides request logging for incoming HTTP requests.

```js
const app = new Spear({
  logger :  true
})
// or use this for logging
.useLogger({
    methods     : ['GET','POST'],
    exceptPath  : /\/benchmark(\/|$)|\/favicon\.ico(\/|$)/ // or use Array ['/']
})
.get('/' , () => 'Hello world!')
.listen(3000 , () => console.log(`Server is now listening http://localhost:3000`))

```

## Format Response
Provides a consistent response structure system to standardize how responses are handled across your application.

### Notfound
The NotFound handler is triggered when no route matches the incoming request.
```js
const app = new Spear()
.get('/' , () => {
  return { 
    message: 'Hello world'
  }
})
.notfound(({ res } : T.Context) => {
  return res.notFound('Not found!')
})
.listen(3000 , () => console.log(`Server is now listening http://localhost:3000`))
// http://localhost:3000/notfound => { success: false , message : 'Not found!' , statusCode: 404 }

```

### Response
The response system ensures that all returned values are automatically formatted and sent to the client.

```js
const app = new Spear()
.get('/' , () => {
  return { 
    message: 'Hello world'
  }
})
.response((results, statusCode) => {

  if(typeof results === 'string') return results
  
  /// ...
  return {
      success : statusCode < 400,
      ...results,
      statusCode
  }
})
.listen(3000 , () => console.log(`Server is now listening http://localhost:3000`))
// http://localhost:3000 => { success: true , message : 'Hello World' , statusCode: 200 }

```

### Catch
The Catch handler is used to handle unexpected runtime errors globally.

It acts as a safety layer to prevent server crashes and standardize error responses.

```js
const app = new Spear()
.get('/' , () => {
  throw new Error('Catching failed')
})
.catch((err : Error , { res } : T.Context) => {

  return res
    .status(500)
    .json({
      success    : false,
      message    : err?.message,
      statusCode : 500
  });
}) 
.listen(3000 , () => console.log(`Server is now listening http://localhost:3000`))
// http://localhost:3000 => { success: false , message : 'Catching failed' , statusCode: 500 }

```

### Cors
CORS (Cross-Origin Resource Sharing) controls which origins are allowed to access your API.

It helps secure your server by restricting or allowing cross-domain requests.
```js
const app = new Spear()
.cors({
    origins: [
      /^http:\/\/localhost:\d+$/
    ],
    credentials: true
})
//.cors() allow *
.listen(port , () => console.log(`Server is now allow cors localhost:* `))

```

### Body
Body parsing allows your server to read incoming request payloads (JSON) and access them via ctx.body.

It enables handling requests with structured data.
```js

new Spear()
// enable body payload
.useBodyParser()
.post('/' , ({ body }) =>  {
  return {
    yourBody : body
  }
})
.listen(3000 , () => console.log(`Server is now listening http://localhost:3000`))

```

### File Upload
File upload support allows handling multipart/form-data requests and working with uploaded files via ctx.files.

It provides: <br>

Temporary file handling <br>
File size limits <br>
Manual file movement <br>
Auto cleanup option <br>
```js

import { Spear, type T } from 'tspace-spear';
import path from 'path'

new Spear()
// use this for enable file upload
.useFileUpload({
  limit : 1000 * 1000, // limit for file upload 1_000_000 bytes by default Infinity
  tempFileDir : 'temp', // folder temporary directory by default tmp
  removeTempFile : {
    remove : true, // remove temporary files by default false
    ms : 1000 * 60 // remove file temporary after 60 seconds
  }
})
.post('/' , ({ files } : T.Context) => {

  // you can move the file from temporary to other folder
  // for example please validate the your input file
  const file     = files.file[0]
  const folder   = 'uploads'

  await file.write(path.join(path.resolve(),`${folder}/${+new Date()}.${file.extension}`))

  // after writed the file you should remove the temporary file
  await file.remove()

  return {
    files
  }
})
.listen(3000 , () => console.log(`Server is now listening http://localhost:3000`))

```

### Cookie
Cookie support allows you to read and manage HTTP cookies from incoming requests via ctx.cookies. <br>

It is useful for: <br>

Session handling <br>
Authentication <br>
User preferences <br>
Stateful requests <br>
```js

new Spear()
.useCookiesParser()
.post('/' , ({ cookies }) =>  {
  return {
    yourCookies : cookies
  }
})
.listen(3000 , () => console.log(`Server is now listening http://localhost:3000`))
```

### Middleware
Middleware is a function that runs before the controller handler and is used to: <br>

Intercept requests <br>
Modify ctx <br>
Validate or block execution <br>
Handle authentication / logging / transformations <br>
```js
import { type T } from "tspace-spear"
// file cat-middleware.ts
export default (ctx : T.Context, next: T.NextFunction) =>{
  console.log('cat middleware globals');
  return next();
}

import  Spear { Router, type T } from "tspace-spear";
import CatMiddleware from './cat-middleware.ts'

(async () => {
  const port = Number(process.env.PORT ?? 3000)
  const app = new Spear({
    middlewares: [ CatMiddleware ]
    // if you want to import middlewares with a directory can you follow the example
    // middlewares : {
    //   folder : `${__dirname}/middlewares`,
    //   name :  /middleware\.(ts|js)$/i
    // }
  })

  // or add a middleware
  app.use((ctx : T.Context , next : T.NextFunction) => {
    console.log('global middlewares')
    return next()
  })

   app.get('/' ((ctx,next) => {
    console.log('middleware on the crrent route')
    return next()
   }), ({ res } : T.Context) => {
    return res.json({
      message : 'hello world!'
    });
  })

  app.get('/' , ({ res } : T.Context) => {
    return res.json({
      message : 'hello world!'
    });
  })

  app.listen(port , () => console.log(`Server is now listening http://localhost:3000`))

  // localhost:3000

})()
```

### Controller
A Controller is used to group related routes and define request handlers in a structured way. <br>

It helps organize your application into modules (similar to NestJS / Express routers), while keeping a clean and readable API design.

```js
import { 
  Controller , 
  Middleware , 
  Get , 
  Post,
  Patch,
  Put,
  Delete,  
  WriteHeader, 
  Query, 
  Body,
  Params,
  Cookies,
  Files, 
  StatusCode,
  type T
} from 'tspace-spear';

import CatMiddleware from './cat-middleware.ts'

// file cat-controller.ts
@Controller('/cats')
class CatController {
  @Get('/')
  @Middleware(CatMiddleware)
  @Query('test','id')
  @Cookies('name')
  public async index({ query , cookies } : { 
    query : T.Query<{ id : string }>
    cookies : T.Cookies<{ name : string}>
  }) {

    return {
      query,
      cookies
    }
  }

  @Get('/:id')
  @Middleware(CatMiddleware)
  @Params('id')
  public async show({ params } : T.Context) {
    return {
      params
    }
  }

  @Post('/')
  @Middleware(CatMiddleware)
  public async store({ body } : T.Context) {
    return {
      body
    }
  }

  @Put('/:id')
  @Middleware(CatMiddleware)
  public async update({ files } : T.Context) {
    return {
     files
    }
  }

  @Post('/upload')
  @Middleware(CatMiddleware)
  public async upload({ files } : T.Context) {
    return {
     files
    }
  }

  @Delete('/:id')
  @Middleware(CatMiddleware)
  public async destroy({ params } : T.Context) {
    return {
     params
    }
  }
}

import { Spear } , { Router, type T } from "tspace-spear";

import CatController from './cat-controller.ts'

(async () => {

  const app = new Spear({
    controllers: [ CatController ]
    // if you want to import controllers with a directory can you follow the example
    // controllers : {
    //   folder : `${__dirname}/controllers`,
    //   name :  /controller\.(ts|js)$/i
    // }
  })

  app.useBodyParser()
  app.useCookiesParser()
  app.useFileUpload()

  app.get('/' , ( { res } : T.Context) => {
    return res.json({
      message : 'hello world!'
    });
  })

  app.listen(3000 , () => console.log(`Server is now listening http://localhost:3000`))

  // localhost:3000/cats 
  // localhost:3000/cats/41

})()
```


## Dto
DTO (Data Transfer Object) is used to validate and transform incoming request data before it reaches your controller logic.
```js
import { 
  Controller , 
  Post,
  createDtoDecorator
  type T
} from 'tspace-spear';

import z from "zod";

const catSchema = z.object({
  name: z.string(),
  age: z.number(),
})

const ValidateDtoBody = (keys: string[]) => {
  return createDtoDecorator((ctx) => {
    const body = ctx.body ?? {};
    const issues: Array<{ path: string; message: string }> = [];

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];

        if (body[key] == null) {
            issues.push({
                path: key,
                message: "Missing field",
            });
        }
    }

    if (issues.length > 0) {
        throw {
          message : "Validation failed",
          issues
        }
    }
  });
}

const ValidateDtoZodBody = (schema: z.ZodTypeAny) => {
  return createDtoDecorator((ctx) => {
    const result = schema.parse(ctx.body);
    ctx.body = result as T.Body;
  });
}

const ValidateDtoPromiseBody = (keys: string[]) => {
  return createDtoDecorator(async (ctx) => {
      await new Promise(resolve => setTimeout(resolve,500));
      // check in DB or other async operation
      throw new Error('Validation failed in promise!');
  }, (ctx, error) => {
    // you implement your custom error handling for async validation here
    return ctx.res.status(400).json({
      message: error.message || "Validation failed",
      issues: error.issues || [],
    });
  });
}

// file cat-controller.ts
@Controller('/cats')
export class CatController {
  @Post('/')
  @ValidateDtoBody(["name", "age"])
  public async basic(ctx : T.Context) {
    const body = ctx.body;
    return {
      body
    }
  }

  @Post('/zod')
  @ValidateDtoZodBody(catSchema)
  public async zod(ctx : T.Context) {
    const body = ctx.body as z.infer<typeof catSchema>;
    return {
      body
    }
  }

  @Post('/promise')
  @ValidateDtoPromiseBody(['name', 'age'])
  public async promise(ctx : T.Context) {
    const body = ctx.body;

    return {
      body
    }
  }
}

import { Spear } , { Router, type T } from "tspace-spear";

import CatController from './cat-controller.ts'

(async () => {

  new Spear({
    controllers: [ CatController ]
  })
  .useBodyParser()
  .listen(3000 , () => console.log(`Server is now listening http://localhost:3000`))

  // localhost:3000/cats  // basic implete
  // localhost:3000/cats/zod  // zod implete
  // localhost:3000/cats/promise // promise implete

})()
```

### Router
The Router allows you to organize routes into modular groups, making your application more scalable and maintainable. <br>

It supports: <br>

Grouped routes <br>
Nested route prefixes <br>
Reusable router modules <br>
Separation of concerns <br>
```js
import { Spear, Router, type T } from "tspace-spear";

const app = new Spear()

const router = new Router()
    
router.groups('/my',(r) => {

  r.get('/cats' , ({ req , res }) => {

      return res.json({
          message : 'Hello, World!'
      })
  })

  return r
})
    
router.get('/cats' , ({ req , res }) => {
  return res.json({
      message : 'Hello, World!'
  })
})

app.useRouter(router)

app.get('/' , ({ res } : T.Context) => {
  return res.json({
    message : 'hello world!'
  });
})

let port = 3000

app.listen(port , () => console.log(`Server is now listening http://localhost:3000`))

// localhost:3000/my/cats
// localhost:3000/cats

```

### Swagger
Provides built-in Swagger support to document your API endpoints. <br>

It allows you to: <br>

Describe request parameters (query, body, params) <br>
Generate API documentation <br>
Improve developer experience <br>
Standardize API contracts
```js

// file cat-controller.ts
import { 
  type T,
  Controller, 
  Get , 
  Post,
  Put,
  Patch,
  Delete,
  Swagger
} from 'tspace-spear';

@Controller('/cats')
class CatController {
  @Get('/')
  @Swagger({
    query : {
      id : {
        type : 'integer'
      },
      name :  {
        type : 'string'
      }
    }
  })
  public async index({ query }  : T.Context) {

    return {
      query
    }
  }

  @Get('/:id')
  @Swagger({
    description : '- message',
    query : {
      id : {
        type : 'integer'
      }
    },
    responses : [
      { status : 200 , description : "OK" , example : { id : 'catz' }},
      { status : 400 , description : "Bad request" , example : { id : 'catz' }}
    ]
  })
  public async show({ params } : T.Context) {
    return {
      params
    }
  }

  @Post('/')
  @Swagger({
    bearerToken : true,
    body : {
      description : 'The description !',
      required : true,
      properties : {
        id : {
          type : 'integer',
          example : 1
        },
        name :  {
          type : 'string',
          example : "xxxxx"
        }
      }
    }
  })
  public async store({ body } : T.Context) {
    return {
      body
    }
  }

  @Put('/:uuid')
  @Swagger({
    bearerToken : true,
    body : {
      description : 'The description !',
      required : true,
      properties : {
        id : {
          type : 'integer',
          example : 1
        },
        name :  {
          type : 'string',
          example : "xxxxx"
        }
      }
    }
  })
  public async updated({ body } : T.Context) {
    return {
      body
    }
  }

  @Patch('/:uuid')
  @Swagger({
    bearerToken : true,
    body : {
      description : 'The description !',
      required : true,
      properties : {
        id : {
          type : 'integer',
          example : 1
        },
        name :  {
          type : 'string',
          example : "xxxxx"
        }
      }
    }
  })
  public async update({ body } : T.Context) {
    return {
      body
    }
  }

  @Delete('/:uuid')
  @Swagger({
    bearerToken : true
  })
  public async delete({ params } : T.Context) {
    return {
      params
    }
  }

  @Post('/upload')
  @Swagger({
    bearerToken : true,
    files : {
      required : true,
      properties : {
        file : {
          type : 'array',
          items: {
            type  :"string",
            format:"binary"
          }
        },
        name : {
          type : 'string'
        }
      }
    }
  })
  public async upload({ body , files } : T.Context) {
    return {
      body,
      files
    }
  }
}

(async () => {

  await new Spear({
    controllers: [ CatController ]
  })
   .get('/' , ({ res } : T.Context) => {
    return res.json({
      message : 'hello world!'
    });
  })
  // .useSwagger() // by default path is "/api/docs"
  .useSwagger({
    path : "/docs",
    servers : [
      { url : "http://localhost:3000" , description : "development"}, 
      { url : "http://localhost:8000" , description : "production"}
    ],
    info : {
      "title" : "Welcome to the the documentation",
      "description" : "This is the documentation"
    }
  })
  .listen(3000 , () => console.log(`Server is now listening http://localhost:3000`))

  // localhost:3000/docs
})()

```

### Web Socket
provides built-in WebSocket support for real-time communication. <br>

It allows you to: <br>

Handle client connections <br>
Send/receive messages <br>
Build chat systems <br>
Manage real-time events
```js
import { Spear } from "tspace-spear";
import fs from 'fs';
import path from 'path';

new Spear()
.get('/',(ctx) => {
  // you can serve a HTML file for testing WebSocket connection
  const htmlWs = fs.readFileSync(path.join(path.resolve(), 'public', 'ws.html'), 'utf-8');
  return ctx.res.html(htmlWs);
})
.ws(() => {
  const clients = new Map<string, any>();
  return {
    connection: (ws) => {
      console.log("connected");
    },

    message: (ws, msg) => {
      const data = JSON.parse(msg.toString());

      if (data.type === "register") {
        ws.userId = data.userId;
        clients.set(data.userId, ws);

        ws.send(JSON.stringify({
          type: "system",
          message: `registered as ${data.userId}`
        }));

        return;
      }

      if (data.type === "chat") {
        const targetWs = clients.get(data.to);

        if (!targetWs) {
          ws.send(JSON.stringify({
            type: "error",
            message: "User not online"
          }));
          return;
        }

        targetWs.send(JSON.stringify({
          type: "chat",
          from: ws.userId,
          text: data.text
        }));

        return;
      }
    },

    close: (ws) => {
      if (ws.userId) {
        clients.delete(ws.userId);
      }
    },
    
    error: (ws, error) => {
      console.error('WebSocket error:', error);
    }
  };
})
.listen(3000 , ({ port , server }) =>  {
    console.log(`server listening on : http://localhost:${port}`)
})


```

### Example CRUD
```js
import { Spear } from "tspace-spear";

const spears = [
  {
    id : 1,
    damage : 100
  },
  {
    id : 2,
    damage : 75
  },
  {
    id : 3,
    damage : 50
  }
]

new Spear()
// enable body payload
.useBodyParser()
.get('/' , () => spears)
.get('/:id' , ({ params }) => spears.find(spear => spear.id === Number(params.id ?? 0)))
.post('/' , ({ body }) =>  {
    // please validation the your body 
    const damage  = Number(body.damage ?? (Math.random() * 100).toFixed(0))

    const id = spears.reduce((max, spear) => spear.id > max ? spear.id : max, 0) + 1

    spears.push({ id , damage })

    return spears.find(spear => spear.id === id)
})
.patch('/:id' , ({ params , body , res }) =>  {
    
    const damage  = Number(body.damage ?? (Math.random() * 100).toFixed(0))

    const id = Number(params.id)

    const spear = spears.find(spear => spear.id === id)

    if (spear == null) return res.status(404).json({ message : 'Spear not found'})

    spear.damage = damage;

    return spears.find(spear => spear.id === id)
})
.delete('/:id', ({ params , res }) => {

  const id = Number(params.id)

  const spear = spears.find(spear => spear.id === id)

  if (spear == null) return res.status(404).json({ message : 'Spear not found'})

  spears.splice(spears.findIndex(spear => spear.id === Number(params.id ?? 0)), 1)

  return res.status(204).json()
})
.listen(3000 , () => console.log(`Server is now listening http://localhost:3000`))

```