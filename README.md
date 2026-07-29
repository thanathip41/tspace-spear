# tspace-spear

[![NPM version](https://img.shields.io/npm/v/tspace-spear.svg)](https://www.npmjs.com)
[![NPM downloads](https://img.shields.io/npm/dm/tspace-spear.svg)](https://www.npmjs.com)

**tspace-spear** is a lightweight, high-performance API framework for Node.js, built on the native HTTP server with optional support for uWebSockets.js (C++) to achieve maximum speed and efficiency.

It is designed with a strong focus on developer experience and provides end-to-end (E2E) type safety and testing support across the full request lifecycle, from request input to response output (see [E2E](#e2e)).

---

## Features

- ⚡ High-performance core built on native Node.js HTTP
- 🚀 Optional [uWebSockets.js](#adapter) adapter support for ultra-low latency and maximum throughput
- 🧠 End-to-end [E2E](#e2e) type safety across the entire request → response lifecycle
- 🎮 Built-in support for [Controllers](#controller) and route-based architecture
- 🏷️ Powerful Decorator system for [routes](#router), [middleware](#middleware), validation, and metadata
- 💉 Built-in constructor-based dependency injection (DI) for [Services](#service)
- 📦 [DTO](#dto) (Data Transfer Object) support for structured and type-safe request handling
- 📂 Built-in [File Upload](#file-upload) support via `useFileUpload()` with zero configuration required
- 🔌 Native [WebSocket](#web-socket) support for real-time applications and event-driven systems
- ⚛️ [GraphQL](#graphql) support with flexible schema integration and HTTP adapters
- 🖥️ Built-in [Cluster mode](#cluster) support for multi-core scalability and higher throughput
- 🧪 Built-in testing utilities for [E2E](#e2e) validation
- 🧩 Simple and intuitive developer experience
- 📘 Auto-generated [Swagger](#swagger) documentation via `app.useSwagger()` with zero manual configuration
- 🔥 Lightweight and optimized for high-performance APIs and microservices
- 🧪 First-class testing support with built-in mocks, spies, and test utilities
- 🎯 Type-safe testing APIs with zero-boilerplate setup

---

## Install

Install with [npm](https://www.npmjs.com/):

```sh
npm install tspace-spear --save
npm install tspace-spear -g
```

## Documentation

See the [`docs`](https://thanathip41.github.io/tspace-spear) directory for full documentation.

## Basic Usage
- [Getting Started](#getting-started)
- [Quick Started](#quick-started)
- [Adapter](#adapter)
- [Cluster](#cluster)
- [Global Prefix](#global-prefix)
- [Logger](#logger)
- [Format Response](#format-response)
  - [Notfound](#notfound)
  - [Response](#response)
  - [Catch](#catch)
- [Cors](#cors)
- [Body](#body)
- [File Upload](#file-upload)
- [Cookie](#cookie)
- [Middleware](#middleware)
- [Controller](#controller)
- [Service](#service)
- [Extending Context Type](#extending-context-type)
- [Exception](#exception)
- [Dto](#dto)
- [Router](#router)
- [Serve Static Files](#serve-static-files)
- [Swagger](#swagger)
- [WebSocket](#websocket)
- [Graphql](#graphql)
- [E2E](#e2e)
- [Testing](#testing)

## Getting Started
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

## Quick Started
Generate applications, modules, controllers, services, and middleware with the Spear CLI.
```sh
# Install CLI globally
npm install -g tspace-spear

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

## Cluster
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

## Global Prefix
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
      // methods : '*'
      // methods : ['GET','POST']
    }
  ]
})
.get('/' , () => 'Hello world!') // http://localhost:8000/api
.get('/cats' , () => `Hello all cats`) // http://localhost:8000/cats
.get('/cats/:id' , ({ params }) => `Hello cat: ${params.id}`) // http://localhost:8000/cats/1
.listen(8000 , () => console.log(`Server is now listening http://localhost:8000`))
```

## Logger
The built-in Logger provides request logging for incoming HTTP requests.

It helps you monitor:

Request method
Request path
Performance tracking
Debugging and observability

You can enable a simple logger or configure advanced logging behavior.
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

It ensures that:

* All responses are predictable
* Errors are properly structured
* Missing routes are handled cleanly
* Global error catching is supported

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

You can return:

* String
* Object (JSON)
* Custom response via ctx.res
```js
import { Spear } from "tspace-spear";

const app = new Spear()
.get('/' , () => {
  return { 
    message: 'Hello world'
  }
})
.response((results, statusCode) => {

    if (typeof results === 'string') return results

    if (Array.isArray(results)) {
        return {
          success: statusCode < 400,
          data: results,
          statusCode
        }
    }

    if (typeof results === 'object' && results !== null) {
        return {
          success: statusCode < 400,
          ...results,
          statusCode
        }
    }

    return {
        success: statusCode < 400,
        data: results,
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
import { Spear } from "tspace-spear";
import { z } from "zod";
const app = new Spear()
.get('/' , () => {
  throw new Error('Catching failed')
})
.catch((err, { res } : T.Context) => {

  if(err instanceof z.ZodError) {
      return res
      .status(422)
      .json({
          success    : false,
          message: "Validation failed",
          issues    : err?.issues,
          statusCode : 422
      });
  }

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

## Cors
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

## Body
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

## File Upload
File upload support allows handling multipart/form-data requests and working with uploaded files via ctx.files.

It provides:

* Temporary file handling
* File size limits
* Manual file movement
* Auto cleanup option
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

## Cookie
Cookie support allows you to read and manage HTTP cookies from incoming requests via ctx.cookies.

It is useful for:

* Session handling
* Authentication
* User preferences
* Stateful requests
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

## Middleware
Middleware is a function that runs before the controller handler and is used to:

* Intercept requests
* Modify ctx
* Validate or block execution
* Handle authentication / logging / transformations
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

## Controller
A Controller is used to group related routes and define request handlers in a structured way.

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
    //   *and swagger documentation. By default if use .useSwagger() in app no need to set any description 
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

## Service
Registers one or more service classes for Dependency Injection.

All registered services will be available in the controller constructor
without manual instantiation.
```js
// cat-service.ts
class CatService {
  public index () {
    return [
      {
        id: 1,
        name: 'cat1'
      },
      {
        id: 2,
        name: 'cat2'
      }
    ]
  }
}

// cat-controller.ts
import { 
  Controller, 
  Get
} from 'tspace-spear';
import CatService from './cat-service.ts'

@Service([CatService]) // don't forgot this to send CatService for Dependency Injection(DI)
@Controller('/cats')
class CatController {

  constructor(
    private catService: CatService
  ) {}

  @Get('/')
  public index() {
    return this.catService.index();
  }
}

// app.ts
import { Spear } from "tspace-spear";

(async () => {

  const app = new Spear({
    controllers : {
      folder : `${__dirname}/controllers`,
      name :  /controller\.(ts|js)$/i,
      preRouteTypes : true 
    }
  });
  
  app.useSwagger();

  app.listen(8000 , () => console.log(`Server is now listening http://localhost:8000`));
})()
```

## Extending Context Type
`tspace-spear` supports TypeScript module augmentation, allowing you to extend the default `Context` type with your own application-specific properties.

This is useful for adding custom data such as `user`, `session`, `permissions`, or authentication information.
```js
// Create `types.d.ts` in your project src:
import { ContextExtensions } from 'tspace-spear';

type User = {
  id    : number;
  name  : string;
  email : string;
}

declare module "tspace-spear" {
  interface ContextExtensions {
    user ?: User;
  }
}

// Make sure types.d.ts is included in your tsconfig.json:

// {
//   "include": [
//     "src",
//     "src/types.d.ts"
//   ]
// }

// index.ts
import { Spear, type T } from "tspace-spear";

const app = new Spear();

app.use((ctx: T.Context, next: T.NextFunction) => {
  // fake auth
  ctx.user = {
    id: 1,
    name: "John Doe",
    email: "john_doe@gmail.com"
  };
  return next();
});

app.get("/", (ctx: T.Context) => {
  if (!ctx.user) {
    return ctx.res.unauthorized()
  }
  return ctx.user!;
});

app.listen(8000, () => {
  console.log("Server is running at http://localhost:8000");
});

```
## Exception
Exceptions are used to return HTTP errors from your application.
```js
import {
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  MethodNotAllowedException,
  ConflictException,
  GoneException,
  UnsupportedMediaTypeException,
  UnprocessableEntityException,
  TooManyRequestsException,
  InternalServerErrorException,
  NotImplementedException,
  BadGatewayException,
  ServiceUnavailableException,
  GatewayTimeoutException,
} from 'tspace-spear/exception';

@Controller('/users')
class UserController {
  @Get('/:id')
  public async show({ params }) {

    if (!params.id) {
      throw new BadRequestException('User id is required');
    }

    return {
      id: params.id,
    };
  }
}
```

## Dto
DTO (Data Transfer Object) is used to validate and transform incoming request data before it reaches your controller logic.
```js
import { 
  Controller , 
  Post,
  Validate,
  ValidateDto,
  createDtoDecorator,
  type T
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

import { Spear } , { Router, type T } from "tspace-spear";

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

## Router
The Router allows you to organize routes into modular groups, making your application more scalable and maintainable.

It supports:

* Grouped routes
* Nested route prefixes
* Reusable router modules
* Separation of concerns
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

## Serve Static Files
Serve files directly from a local directory.
```js

const path = require('path');

new Spear({
  logger: true
})
.get('/file/*', (ctx) => {
  // Maps:
  //   /file/example.pdf
  // -> ./example/example.pdf
  const filePath = path.join(
    path.resolve(),
    'example',
    String(ctx.params['*'])
  );

  return ctx.res.serveMedia(filePath);
})
.listen(3000 , ({ port }) =>  {
  console.log(`server listening on : http://localhost:${port}`)
})

```

## Testing
Basic testing examples for tspace-spear framework.

### Example Service and Controller
```js
import { Controller, Get, Post, Service, type T } from "tspace-spear";

@Service()
class UserService {
  private users = new Map([
    [1, { id: 1, name: "Alice", email: "alice@example.com" }],
    [2, { id: 2, name: "Bob", email: "bob@example.com" }],
  ]);
  findAll() { return Array.from(this.users.values()); }
  findById(id) { return this.users.get(id); }
  create(name, email) {
    const id = this.users.size + 1;
    const user = { id, name, email };
    this.users.set(id, user);
    return user;
  }
}

@Controller("/users")
@Service(UserService)
class UsersController {
  constructor(private userService: UserService) {}
  @Get("/") list() { return { users: this.userService.findAll() }; }
  @Get("/:id") show({ res, params }) {
    const user = this.userService.findById(params.id);
    if (!user) throw res.notFound("User not found");
    return { user };
  }
  @Post("/") create({ body, res }) {
    const { name, email } = body;
    if (!name || !email) return res.status(400).json({ error: "Required" });
    return { created: this.userService.create(name, email) };
  }
}
```

### Unit Testing a Service
```js
import { TestingService } from "tspace-spear/testing";

const testing = new TestingService();
const service = testing.createService(UserService);

const users = service.findAll(); // [{ id: 1, name: "Alice", ... }]
const user = service.findById(1); // { id: 1, name: "Alice", ... }
```

### Unit Testing a Controller with Mocked Service
```js
import { 
  TestingController, 
  createMockService 
  } from "tspace-spear/testing";

const testing = new TestingController();
const mockService = createMockService(UserService, {
  findAll: () => [{ id: 1, name: "Mock User" }],
});

const controller = testing.createController(UsersController, {
  mocks: new Map([[UserService, mockService]]),
});

const ctx = testing.createContext({ params: { id: 1 } });
const result = controller.show(ctx);
```

### Integration Testing with TestModule
```js
import { TestModule } from "tspace-spear/testing";

const module = await TestModule.create()
  .setControllers([UsersController])
  .setLogger(false)
  .compile();

const res = await module.client.get("/users");
await module.close();
```

### Integration Testing with createTestServer
```js
import { createTestServer } from "tspace-spear/testing";

const testServer = await createTestServer({
  controllers: [UsersController],
  logger: false,
});

const res = await testServer.client.get("/users");
await testServer.close();
```

### Spying on Service Methods
```js
import { TestingService } from "tspace-spear/testing";

const testing = new TestingService();
const service = new UserService();
const spy = testing.spyOn(service, "findAll");

service.findAll();
console.log(spy.callCount); // 1
```