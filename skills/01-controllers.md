# Controllers - tspace-spear

## Basic Controller

```typescript
import { Controller, Get, Post, type T } from "tspace-spear";

@Controller('/users')
class UserController {
  @Get('/')
  list({ res }: T.Context) {
    return res.json({ users: [] });
  }

  @Get('/:id')
  show({ params }: T.Context<{ params: { id: number } }>) {
    return { id: params.id };
  }

  @Post('/')
  create({ body }: T.Context) {
    return { created: body };
  }
}

// Register
const app = new Spear({ controllers: [UserController] });
```

## HTTP Methods

```typescript
@Controller('/posts')
class PostController {
  @Get('/')      list() { return []; }
  @Post('/')     create() { return { created: true }; }
  @Put('/:id')   update() { return { updated: true }; }
  @Patch('/:id') patch() { return { patched: true }; }
  @Delete('/:id')delete() { return { deleted: true }; }
  @Head('/')     head() { return; }
  @Options('/')  options() { return; }
}
```

## With Middleware

```typescript
import { Controller, Get, Middleware, type T } from "tspace-spear";

const authMiddleware: T.ContextHandler = (ctx, next) => {
  if (!ctx.headers.authorization) {
    return ctx.res.unauthorized();
  }
  return next();
};

@Controller('/admin')
class AdminController {
  @Get('/dashboard')
  @Middleware(authMiddleware)
  dashboard() {
    return { admin: true };
  }
}
```

## With Service (Dependency Injection)

```typescript
import { Controller, Get, Dependencies, type T } from "tspace-spear";

// Service
class UserService {
  findAll() {
    return [{ id: 1, name: 'Alice' }];
  }
}

// Controller with DI
@Dependencies(UserService)
@Controller('/users')
class UserController {
  constructor(private userService: UserService) {}

  @Get('/')
  list() {
    return { users: this.userService.findAll() };
  }
}
```

## Extract Context Data

```typescript
@Controller('/data')
class DataController {
  @Get('/params/:id')
  @Params('id')
  getParams({ params }: T.Context) {
    return { params }; // Only 'id' field
  }

  @Get('/query')
  @Query('page', 'limit')
  getQuery({ query }: T.Context) {
    return { query }; // Only 'page' and 'limit'
  }

  @Post('/body')
  @Body('name', 'email')
  postBody({ body }: T.Context) {
    return { body }; // Only 'name' and 'email'
  }

  @Get('/cookies')
  @Cookies('token')
  getCookies({ cookies }: T.Context) {
    return { cookies }; // Only 'token'
  }

  @Post('/upload')
  @Files('avatar')
  upload({ files }: T.Context) {
    return { files }; // Only 'avatar'
  }
}
```

## Validate Decorator

```typescript
import { Controller, Post, Validate } from "tspace-spear";

@Controller('/users')
class UserController {
  @Post('/')
  @Validate(['name', 'email'], { required: true })
  create({ body }: T.Context) {
    return { created: body };
  }
}
```

## Status Code

```typescript
import { Controller, Get, StatusCode, type T } from "tspace-spear";

@Controller('/status')
class StatusController {
  @Get('/ok')
  @StatusCode(200)
  ok() {
    return 'OK';
  }

  @Get('/created')
  @StatusCode(201)
  created() {
    return { created: true };
  }
}
```

## Write Header

```typescript
import { Controller, Get, WriteHeader } from "tspace-spear";

@Controller('/headers')
class HeaderController {
  @Get('/cors')
  @WriteHeader('Access-Control-Allow-Origin', '*')
  cors() {
    return { data: 'test' };
  }
}
```

## Swagger Documentation

```typescript
import { Controller, Get, Post, Swagger, type T } from "tspace-spear";

@Controller('/users')
class UserController {
  @Get('/')
  @Swagger({
    summary: 'List all users',
    tags: ['Users'],
    responses: { status: 200, description: 'Success' }
  })
  list() {
    return { users: [] };
  }

  @Post('/')
  @Swagger({
    summary: 'Create user',
    tags: ['Users'],
    body: {
      required: true,
      properties: {
        name: { type: 'string', required: true },
        email: { type: 'string', required: true }
      }
    }
  })
  create({ body }: T.Context) {
    return { created: body };
  }
}