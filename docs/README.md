# TspaceSpear

[![NPM version](https://img.shields.io/npm/v/tspace-spear.svg)](https://www.npmjs.com)
[![NPM downloads](https://img.shields.io/npm/dm/tspace-spear.svg)](https://www.npmjs.com)

**tspace-spear** is a lightweight, high-performance API framework for Node.js, built on the native HTTP server with optional support for uWebSockets.js (C++) to achieve maximum speed and efficiency.

It is designed with a strong focus on developer experience and provides end-to-end (E2E) type safety and testing support across the full request lifecycle, from request input to response output (see [E2E](#e2e)).

---

### Features

- ⚡ High-performance core built on native Node.js HTTP
- 🚀 Optional [uWebSockets.js](#adapter) adapter support for ultra-low latency and maximum throughput
- 🧠 End-to-end [E2E](#e2e) type safety across the entire request → response lifecycle
- 🎮 Built-in support for [Controllers](#controller) and route-based architecture
- 🏷️ Powerful Decorator system for routes, middleware, validation, and metadata
- 📦 [DTO](#dto) (Data Transfer Object) support for structured and type-safe request handling
- 📂 Built-in [File Upload](#file-upload) support via `useFileUpload()` with zero configuration required
- 🔌 Native [WebSocket](#web-socket) support for real-time applications and event-driven systems
- ⚛️ [GraphQL](#graphql) support with flexible schema integration and HTTP adapters
- 🖥️ Built-in [cluster mode](#cluster) support for multi-core scalability and higher throughput
- 🧪 Built-in testing utilities for [E2E](#e2e) validation
- 🧩 Simple and intuitive developer experience
- 📘 Auto-generated [Swagger](#swagger) documentation via `app.useSwagger()` with zero manual configuration
- 🔥 Lightweight and optimized for high-performance APIs and microservices

---

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
.listen(8000 , () => console.log(`Server is now listening http://localhost:8000`))
```

### Quick Started
Generate applications, modules, controllers, services, and middleware with the Spear CLI.
```sh
# Install CLI globally
npm install -g tspace-spear

# Usage:
  spear create new <project>

# Generators:
  spear g module <names>
  spear g controller <name>
  spear g service <name>
  spear g dto <name>
  spear g middleware <name>

---

# Create a new application structure
spear create new my-app

✔ Successfully created project "my-app"

📦 Project Structure

src/
├── common/
│   └── middlewares/
│       └── log.middleware.ts
│
├── modules/
│   └── cats/
│       ├── cat.controller.ts
│       ├── cat.service.ts
│       └── cat.dto.ts
│
├── client.ts
└── index.ts

🚀 Next Steps

cd my-app

npm run dev

✔ Server is running at:
  http://localhost:8000

✔ Swagger Docs:
  http://localhost:8000/api/docs

✔ Run E2E client:
  ts-node src/client.ts

ts-node src/client.ts // for E2E
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
.listen(8000, () =>
  console.log("uWS server is running at http://localhost:8000")
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
.listen(8000 , () => console.log(`Server is now listening http://localhost:8000`))

```

### Global Prefix
Global Prefix allows you to define a base path for all routes in your application.

It helps keep your API structured and consistent (e.g. /api, /v1, /app).
```js
const app = new Spear({
  globalPrefix : '/api', // prefix all routes
})
.get('/' , () => 'Hello world!') // http://localhost:8000/api
.get('/cats' , () => `Hello all cats`) // http://localhost:8000/api/cats
.get('/cats/:id' , ({ params }) => `Hello cat: ${params.id}`) // http://localhost:8000/api/cats/1
.listen(8000 , () => console.log(`Server is now listening http://localhost:8000`))

// http://localhost:8000/api => 'Hello world!'

// Or this

const app = new Spear()
.useGlobalPrefix('api', {
  exclude : [
    {
      path : '/cats/*',
      // method : '*'
      // method : ['GET','POST']
    }
  ]
})
.get('/' , () => 'Hello world!') // http://localhost:8000/api
.get('/cats' , () => `Hello all cats`) // http://localhost:8000/cats
.get('/cats/:id' , ({ params }) => `Hello cat: ${params.id}`) // http://localhost:8000/cats/1
.listen(8000 , () => console.log(`Server is now listening http://localhost:8000`))
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
.listen(8000 , () => console.log(`Server is now listening http://localhost:8000`))

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
.listen(8000 , () => console.log(`Server is now listening http://localhost:8000`))
// http://localhost:8000/notfound => { success: false , message : 'Not found!' , statusCode: 404 }

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
.listen(8000 , () => console.log(`Server is now listening http://localhost:8000`))
// http://localhost:8000 => { success: true , message : 'Hello World' , statusCode: 200 }

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
.listen(8000 , () => console.log(`Server is now listening http://localhost:8000`))
// http://localhost:8000 => { success: false , message : 'Catching failed' , statusCode: 500 }

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
.listen(8000 , () => console.log(`Server is now listening http://localhost:8000`))

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
.listen(8000 , () => console.log(`Server is now listening http://localhost:8000`))

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
.listen(8000 , () => console.log(`Server is now listening http://localhost:8000`))
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
  const port = Number(process.env.PORT ?? 8000)
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

  app.listen(port , () => console.log(`Server is now listening http://localhost:8000`))

  // localhost:8000

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
    //   folder : `${__dirname}/controllers`, // nestjs style `${__dirname}/modules/*`
    //   name :  /controller\.(ts|js)$/i,

    //   *Auto-generate route metadata for type-safe E2E usage, 
    //   *and swagger documentation. By default if use .useSwagger() no need to set any description 
    //   preRouteTypes : true 
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

  app.listen(8000 , () => console.log(`Server is now listening http://localhost:8000`))

  // localhost:8000/cats 
  // localhost:8000/cats/41

})()
```


## Dto
DTO (Data Transfer Object) is used to validate and transform incoming request data before it reaches your controller logic.
```js
import { 
  type T
  Controller, 
  Post,
  Validate,
  ValidateDto,
  createDtoDecorator
} from 'tspace-spear';

import z from "zod";

import { 
  IsString, 
  IsInt, 
  validate 
} from "class-validator";

const ValidateDtoCustomBody = (keys: string[]) => {
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

const ValidateDtoPromiseBody = (keys: string[]) => {
  return createDtoDecorator(async (ctx) => {
      await new Promise(resolve => setTimeout(resolve,500));
      // check in DB or other async operation
      const cats = await catRepository.findMany({ where : { name : ctx.body.name }});

      if(!cats.length) {
       throw new Error('Validation failed in promise!');
      }

  }, (ctx, error) => {
    // you implement your custom error handling for async validation here
    return ctx.res.status(400).json({
      message: error.message || "Validation failed",
      issues: error.issues || [],
    });
  });
}

const catSchema = z.object({
  name: z.string(),
  age: z.number(),
})

class CreateCatDto {
  @IsString()
  name!: string;

  @IsInt()
  age!: number;
}

// file cat-controller.ts
@Controller('/cats')
export class CatController {

  @Post('/')
  // only required validation without type checking
  @Validate(["name", "age"], { required: { allowEmptyString: false, allowNull: false } })
  public async basic(ctx : T.Context<{ body : { name : any , age : any }}>) {
    return {
      body : ctx.body
    }
  }

  @Post('/custom')
  @ValidateDtoCustomBody(["name", "age"])
  public async custom(ctx : T.Context<{ body : { name : string , age : number }}>) {
    return {
      body : ctx.body
    }
  }

  @Post('/promise')
  @ValidateDtoPromiseBody(['name'])
  public async promise(ctx : T.Context<{ body : { name : string }}>) {
    return {
      body : ctx.body
    }
  }

  @Post('/zod')
  @ValidateDto(catSchema, { adaptor : "zod" })
  public async zod(ctx : T.Context<{ body : z.infer<typeof catSchema>}>) {
    return {
      body : ctx.body
    }
  }

  @Post('/cls')
  @ValidateDto(CreateCatDto)
  public async cls(ctx : T.Context<{ body : CreateCatDto }>) {
    return {
      body : ctx.body
    }
  }
}

import { Spear } from "tspace-spear";

import CatController from './cat-controller.ts'

(async () => {

  new Spear({
    controllers: [ CatController ]
  })
  .useBodyParser()
  .listen(8000 , () => console.log(`Server is now listening http://localhost:8000`))

  // localhost:8000/cats  // basic implete
  // localhost:8000/cats/zod  // zod implete
  // localhost:8000/cats/promise // promise implete

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

let port = 8000

app.listen(port , () => console.log(`Server is now listening http://localhost:8000`))

// localhost:8000/my/cats
// localhost:8000/cats

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
      { url : "http://localhost:8000" , description : "development"}, 
      { url : "http://localhost:8000" , description : "production"}
    ],
    info : {
      "title" : "Welcome to the the documentation",
      "description" : "This is the documentation"
    }
  })
  .listen(8000 , () => console.log(`Server is now listening http://localhost:8000`))

  // localhost:8000/docs
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
.listen(8000 , ({ port , server }) =>  {
    console.log(`server listening on : http://localhost:${port}`)
})


```

## Graphql
GraphQL CRUD Example with graphql-http + tspace-spear

This example shows how to build a simple GraphQL CRUD API using graphql-http and tspace-spear.

It includes:

- GraphQL schema setup
- Query and Mutation examples
- Create / Read / Update / Delete operations
- HTTP integration with graphql-http
- cURL testing examples

The server uses an in-memory array as a fake database for simplicity.

Features
- High performance HTTP server with tspace-spear
- Native GraphQL schema definitions
- Full CRUD operations
- Simple and dependency-light setup
- Works with standard GraphQL clients and tools

### Install
```sh
npm install graphql graphql-http
```

```js

import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLList,
  GraphQLNonNull,
  GraphQLID,
} from 'graphql';

import { createHandler } from 'graphql-http/lib/use/http';
import { type T, Spear } from "tspace-spear";

/**
 * Fake database
 */
const users : { 
  id    : string;
  name  : string;
  email :string
}[] = [];

/**
 * User Type
 */
const UserType = new GraphQLObjectType({
  name: 'User',

  fields: {
    id: { type: GraphQLID },
    name: { type: GraphQLString },
    email: { type: GraphQLString },
  },
});

/**
 * Queries (READ)
 */
const QueryType = new GraphQLObjectType({
  name: 'Query',

  fields: {
    users: {
      type: new GraphQLList(UserType),

      resolve: () => {
        return users;
      },
    },

    user: {
      type: UserType,

      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
      },

      resolve: (_, args) => {
        return users.find((v) => v.id === args.id);
      },
    },
  },
});

/**
 * Mutations (CREATE UPDATE DELETE)
 */
const MutationType = new GraphQLObjectType({
  name: 'Mutation',

  fields: {
    /**
     * CREATE
     */
    createUser: {
      type: UserType,

      args: {
        name: { type: new GraphQLNonNull(GraphQLString) },
        email: { type: new GraphQLNonNull(GraphQLString) },
      },

      resolve: (_, args) => {
        const user = {
          id: String(users.length + 1),
          name: args.name,
          email: args.email,
        };

        users.push(user);

        return user;
      },
    },

    /**
     * UPDATE
     */
    updateUser: {
      type: UserType,

      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
        name: { type: GraphQLString },
        email: { type: GraphQLString },
      },

      resolve: (_, args) => {
        const user = users.find((v) => v.id === args.id);

        if (!user) {
          throw new Error('User not found');
        }

        if (args.name !== undefined) {
          user.name = args.name;
        }

        if (args.email !== undefined) {
          user.email = args.email;
        }

        return user;
      },
    },

    /**
     * DELETE
     */
    deleteUser: {
      type: GraphQLString,

      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
      },

      resolve: (_, args) => {
        const index = users.findIndex((v) => v.id === args.id);

        if (index === -1) {
          throw new Error('User not found');
        }

        users.splice(index, 1);

        return 'Deleted';
      },
    },
  },
});

/**
 * Schema
 */
const schema = new GraphQLSchema({
  query: QueryType,
  mutation: MutationType,
});

/**
 * Handler
 */
const graphqlHandler = createHandler({
  schema,
});

const app =  new Spear()
.post('/graphql',({ req , res }) => graphqlHandler(req , res))

app.listen(4000 , ({ port , server }) =>  {
  console.log(`server listening on : http://localhost:${port}/graphql`)
})
```
### Available Operations

#### Query (Read)

| Operation | Description |
|---|---|
| `users` | Get all users |
| `user(id)` | Get a single user by ID |

#### Mutation (Write)

| Operation | Description |
|---|---|
| `createUser(name, email)` | Create a new user |
| `updateUser(id, name, email)` | Update an existing user |
| `deleteUser(id)` | Delete a user by ID |

```sh
## Create
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { createUser(name:\"John\", email:\"john@example.com\") { id name email } }"
  }'

## Read all
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { users { id name email } }"
  }'

## Read one
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { user(id:\"1\") { id name email } }"
  }'

## Update
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { updateUser(id:\"1\", name:\"Johnny\") { id name email } }"
  }'

## Delete
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { deleteUser(id:\"1\") }"
  }'
```

## E2E
Provides end-to-end type safety and testing support across the full request lifecycle, from request input to
response output. It allows you to:
```js
// file cat-controller.ts
import z from 'zod';
import {
  type T,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  createDtoDecorator
} from "tspace-spear";

const catSchema = z.object({
  id: z.number(),
  name: z.string(),
  age: z.number(),
});

const catSchemaAction = z.object({
  name: z.string(),
  age: z.number(),
});

type Cat = z.infer<typeof catSchema>

let cats: z.infer<typeof catSchema>[] = [
  { id: 1, name: 'cat1', age: 1.6 },
  { id: 2, name: 'cat2', age: 1.8 },
];

const ValidateDtoBody = (schema: z.ZodTypeAny) => {
  return createDtoDecorator((ctx) => {
    const result = schema.parse(ctx.body);
    ctx.body = result as T.Body;
  });
};
@Controller('/cats')
class CatController {

  @Get('/')
  public async index({
    query,
  }: T.Context) {
    return {
      cats,
    };
  }

  @Get('/:id')
  public async show({ res, params }: T.Context<{ params: { id: number } }>) : Promise<{
    cat : Cat
  }> {
    const cat = cats.find((d) => d.id === Number(params.id));

    if(cat == null) {
      return res.notFound('not found cat')
    }

    return {
      cat
    };
  }

  @Post('/')
  @ValidateDtoBody(catSchemaAction)
  public async create({
    body,
  }: T.Context<{ body: z.infer<typeof catSchemaAction> }>) {

    const cat = {
      id: cats.length + 1,
      ...body
    }

    cats.push(cat);

    return {
      cat,
      message: 'created',
    };
  }

  @Put('/:id')
  @ValidateDtoBody(catSchemaAction.partial())
  public async update({
    res,
    params,
    body,
  }: T.Context<{
    params: { id: number };
    body: Partial<z.infer<typeof catSchemaAction>>;
  }>) {
    const id = Number(params.id);

    const index = cats.findIndex((d) => d.id === id);

    if (index === -1) {
      return res.notFound('not found cat')
    }

    cats[index] = {
      ...cats[index],
      ...body,
      id
    };

    const cat = cats[index]

    return {
      message: 'updated',
      cat,
    };
  }

  @Delete('/:id')
  public async remove({ res, params }: T.Context<{ params: { id: number } }>) {
    const id = Number(params.id);

    const index = cats.findIndex((d) => d.id === id);

    if (index === -1) {
      throw res.notFound('not found cat')
    }

    cats = cats.filter((d) => d.id !== id);

    return {
      message: 'deleted',
    };
  }
}

export { CatController };
export default CatController;

// file server/app.ts
import Spear from "tspace-spear";
const app = new Spear({
  logger : true,
  controllers: {
      folder : `${__dirname}/controllers`,
      name:/controller\.(ts|js)$/i,
      // don't forget to set this option for auto-generate route metadata for type-safe E2E usage, 
      // and swagger documentation. By default if use .useSwagger() in app no need to set any description
      preRouteTypes: true
  }
})

app.useGlobalPrefix('api');
app.useBodyParser();
app.listen(8000 , () => console.log(`Server is now listening http://localhost:8000`));

type AppRouter = typeof app.contract;
export { AppRouter }
export default app;

// file frontend/index.ts
import { AppRouter } from "./server/app";
import { ApiClient } from "tspace-spear/client";

const client: ApiClient<AppRouter> = new ApiClient(
  `http://localhost:8000/api`
);

const test = await client.get("/catsq"); // Type error: Argument of type '"/catsq"' is not assignable to parameter of type '"/cats" | "/cats/:id" | ... 3 more
const res = await client.get("/cats");
  res.data.cats = 1 // Type error: Type 'number' is not assignable to type '{ id: number; name: string; age: number; }[]'
  res.data.cats[0].name = 1 // Type error: Type 'number' is not assignable to type 'string'
  res.data.cats[0].age = "1.6" // Type error: Type 'string' is not assignable to type 'number'

  console.log(res) 
  // res.ok -> boolean
  // res.status -> number
  // res.data -> { cats: [{ id: 1, name: 'cat1', age: 1.6 },{ id: 2, name: 'cat2', age: 1.8 }] }
 
```