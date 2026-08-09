# tspace-spear Skills

> **📖 Guide for LLMs & Developers:** This documentation is designed for AI assistants and developers to quickly understand and use tspace-spear framework. Each file contains copy-paste ready examples.

## How to Use This Documentation

### For LLMs (AI Assistants)
1. **Read this file first** - Get overview of all features
2. **Check Quick Examples below** - Find common patterns
3. **Link to specific skill files** - Deep dive into topics as needed

### For Humans
- **Beginners:** Start with `00-quick-start.md` → read in order
- **Intermediate:** Jump to specific skill files you need
- **Advanced:** See `07-e2e-types.md` for type safety patterns

---

## Features Overview

| Feature | Description | Example |
|---------|-------------|---------|
| **⚡ High Performance** | Native Node.js HTTP + uWebSockets.js support | `new Spear({ adapter: uWS })` |
| **🧠 E2E Type Safety** | Full type inference from server to client | `new ApiClient<typeof app.contract>()` |
| **🎮 Controllers** | Decorator-based routing with DI | `@Controller('/users')` |
| **🏷️ Decorators** | `@Get`, `@Post`, `@Middleware`, `@Validate` | `@Get('/:id')` |
| **💉 Dependency Injection** | Constructor-based service injection | `@Dependencies([UserService])` |
| **📦 DTO Validation** | class-validator, Zod, custom validators | `@ValidateDto(UserDto)` |
| **📂 File Upload** | Built-in multipart/form-data support | `.useFileUpload()` |
| **🔌 WebSocket** | Native WebSocket support | `.ws(() => {...})` |
| **📘 Swagger** | Auto-generated OpenAPI docs | `.useSwagger()` |
| **🧪 Testing** | Unit + E2E testing utilities | `TestModule.create()` |
| **🎯 Router** | Modular route groups | `new Router()` |
| **🔐 Middleware** | Global + route-specific | `.use((ctx, next) => {...})` |
| **🌐 CORS** | Cross-origin support | `.cors({ origins: [...] })` |
| **🔀 Cluster Mode** | Multi-core scaling | `new Spear({ cluster: 4 })` |
| **🛠️ CLI** | Generate modules, controllers, services | `spear g module users` |

---

## Skills Index

| File | Topic | Description |
|------|-------|-------------|
| [00-quick-start.md](./00-quick-start.md) | Quick Start | Installation, Hello World, basic usage |
| [01-controllers.md](./01-controllers.md) | Controllers | Decorator-based controllers, DI, middleware |
| [02-routing.md](./02-routing.md) | Routing | Routes, parameters, router groups |
| [03-middleware.md](./03-middleware.md) | Middleware | Global, route-specific, built-in middleware |
| [04-validation.md](./04-validation.md) | Validation | DTO, validators, class-validator, Zod |
| [05-response.md](./05-response.md) | Response | Response helpers, error handling, formatting |
| [06-testing.md](./06-testing.md) | Testing | Unit tests, integration tests, mocking |
| [07-e2e-types.md](./07-e2e-types.md) | E2E Types | Contract types, ApiClient, context extensions |
| [08-swagger.md](./08-swagger.md) | Swagger | OpenAPI docs, @Swagger decorator, compile types |
| [09-websocket.md](./09-websocket.md) | WebSocket | Real-time chat, rooms, broadcasting |
| [10-file-upload.md](./10-file-upload.md) | File Upload | Upload, save, validate, remove files |
| [11-custom-context.md](./11-custom-context.md) | Custom Context | Extend T.Context with custom types (user, session) |
| [12-cli.md](./12-cli.md) | CLI | Generate modules, controllers, services |

---

## Quick Examples

### Hello World
```typescript
import Spear from "tspace-spear";
new Spear()
  .get('/', () => 'Hello!')
  .listen(8000);
```

### Controller with Dependency Injection
```typescript
import { Controller, Get, Dependencies } from "tspace-spear";

class UserService {
  findAll() { return [{ id: 1, name: 'Alice' }]; }
}

@Dependencies(UserService)
@Controller('/users')
class UserController {
  constructor(private userService: UserService) {}

  @Get('/')
  list() { return { users: this.userService.findAll() }; }
}
```

### Middleware (Global + Route)
```typescript
import Spear, { type T } from "tspace-spear";

// Global middleware
const app = new Spear()
  .use((ctx: T.Context, next) => {
    console.log(`${ctx.req.method} ${ctx.req.url}`);
    return next();
  })
  // Route-specific middleware
  .get('/protected', 
    (ctx, next) => {
      if (!ctx.headers.authorization) {
        return ctx.res.unauthorized();
      }
      return next();
    },
    ({ res }) => res.json({ secret: 'data' })
  );
```

### Routing & Parameters
```typescript
const app = new Spear()
  // Route params
  .get('/users/:id', ({ params }) => `User ${params.id}`)
  // Query params
  .get('/search', ({ query }) => `Search: ${query.q}`)
  // POST with body
  .post('/users', ({ body, res }) => res.created({ id: 1, ...body }))
  // Router groups
  .useRouter(new Router().groups('/api', r => {
    r.get('/users', () => 'users');
    return r;
  }));
```

### Validation (DTO + Zod)
```typescript
import { Controller, Post, Validate, ValidateDto, type T } from "tspace-spear";
import { z } from 'zod';

const userSchema = z.object({
  name: z.string(),
  email: z.string().email()
});

@Controller('/users')
class UserController {
  // Built-in validation
  @Post('/basic')
  @Validate(['name', 'email'], { required: true })
  basic({ body }: T.Context) {
    return { created: body };
  }

  // Zod validation
  @Post('/zod')
  @ValidateDto(userSchema, { adaptor: 'zod' })
  zod({ body }: T.Context<{ body: z.infer<typeof userSchema> }>) {
    return { created: body };
  }
}
```

### Response Helpers
```typescript
@Controller('/response')
class ResponseController {
  @Get('/success')
  success({ res }) {
    return res.ok({ data: 'success' });
  }

  @Get('/created')
  created({ res }) {
    return res.created({ id: 1 });
  }

  @Get('/error')
  error({ res }) {
    return res.serverError('Oops!');
  }

  @Get('/custom')
  custom({ res }) {
    return res.status(201).json({ custom: true });
  }
}
```

### File Upload
```typescript
import Spear, { type T } from "tspace-spear";
import path from "path";

const app = new Spear()
  .useFileUpload({ limit: 10_000_000, tempFileDir: 'tmp' })
  .post('/upload', async ({ files, res }: T.Context) => {
    const file = files.avatar?.[0];
    if (!file) return res.badRequest('No file');
    
    await file.write(path.join(process.cwd(), 'uploads', file.name));
    return res.json({ saved: file.name, size: file.sizes.mb });
  });
```

### WebSocket (Real-time Chat)
```typescript
import Spear from "tspace-spear";

const app = new Spear()
  .ws(() => {
    const clients = new Map<string, any>();
    
    return {
      connection: (ws) => console.log('Connected'),
      message: (ws, data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'chat') {
          clients.forEach(c => c.send(JSON.stringify(msg)));
        }
      },
      close: (ws) => clients.delete(ws.userId)
    };
  });
```

### E2E Type-Safe Client
```typescript
import { ApiClient } from "tspace-spear/client";
import app from "./server";

// Fully typed client - autocomplete for routes!
const client = new ApiClient<typeof app.contract>('http://localhost:8000');

async function main() {
  const users = await client.get('/users');
  if (users.ok) {
    console.log(users.data.users);  // Typed!
  }

  const created = await client.post('/users', {
    body: { name: 'Alice', email: 'alice@example.com' }  // Typed!
  });
}
```

### Swagger Documentation
```typescript
import Spear, { Controller, Get, Swagger } from "tspace-spear";

@Controller('/users')
class UserController {
  @Get('/')
  @Swagger({
    summary: 'List users',
    tags: ['Users'],
    responses: [{ status: 200, description: 'Success' }]
  })
  list() { return { users: [] }; }
}

const app = new Spear({ controllers: [UserController] })
  .useSwagger({
    path: '/api/docs',
    info: { title: 'My API', version: '1.0.0' }
  });
// Access: http://localhost:8000/api/docs
```

### Testing (Unit + E2E)
```typescript
import { TestModule, createMockService } from "tspace-spear/testing";

// Unit test with mock
const mockService = createMockService(UserService, {
  findAll: () => [{ id: 1, name: 'Mock' }]
});

// E2E test
const result = await TestModule.create()
  .setControllers([UserController])
  .setMocks(new Map([[UserService, mockService]]))
  .compile();

const res = await result.client.get('/users');
expect(res.ok).toBe(true);
```

### Context Extension (Custom User Type)
```typescript
// 1. Create src/types.d.ts
import { ContextExtensions } from "tspace-spear";

declare module "tspace-spear" {
  interface ContextExtensions {
    user?: { id: number; name: string; role: string };
  }
}

// 2. Use in middleware
const authMiddleware: T.ContextHandler = (ctx, next) => {
  ctx.user = { id: 1, name: 'John', role: 'admin' };  // Typed!
  return next();
};

// 3. Use in controller
@Controller('/profile')
class ProfileController {
  @Get('/')
  @Middleware(authMiddleware)
  profile({ user }) {
    return { user };  // user is typed!
  }
}
```

### CLI Commands
```bash
# Install CLI
npm install -g tspace-spear

# Create project
spear create new my-app

# Generate module (controller + service + dto)
spear generate module users

# Generate controller
spear generate controller products

# Generate service
spear generate service orders

# Generate middleware
spear generate middleware auth