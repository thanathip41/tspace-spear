# E2E Types & Type Safety - tspace-spear

## What is E2E Type Safety?

E2E (End-to-End) type safety means your **server and client share the same types**. When you change server code, your client automatically knows about it - no manual type updates needed!

```typescript
// Server defines routes
const app = new Spear()
  .get('/users', () => [{ id: 1, name: 'Alice' }]);

// Client automatically knows the types!
const client = new ApiClient<typeof app.contract>('http://localhost:8000');

// This is typed - you get autocomplete!
const users = await client.get('/users');
// users.data is: [{ id: number, name: string }]
```

## Step 1: Get Contract Type from Server

```typescript
import Spear from "tspace-spear";

const app = new Spear()
  .get('/users', () => [{ id: 1, name: 'Alice' }])
  .get('/users/:id', ({ params }) => ({ id: params.id }))
  .post('/users', ({ body }) => ({ created: body }));

// Get the API contract type
type API = typeof app.contract;

// What types does API have?
// API["/users"].GET.response        = [{ id: number, name: string }]
// API["/users/:id"].GET.params      = { id: string }
// API["/users/:id"].GET.response    = { id: string }
// API["/users"].POST.body           = unknown
// API["/users"].POST.response       = { created: unknown }
```

## Step 2: Use Contract in Client

```typescript
import { ApiClient } from "tspace-spear/client";

// Import the server's contract type
type API = typeof app.contract;

// Create client with that type
const client = new ApiClient<API>('http://localhost:8000');

// Now all requests are type-safe!
const users = await client.get('/users');
// ✅ TypeScript knows: users.data is [{ id: number, name: string }]

const user = await client.get('/users/:id', {
  params: { id: '123' }  // ✅ params.id must be string
});

const created = await client.post('/users', {
  body: { name: 'Alice' }  // ✅ body is typed
});
```

## Handle Response Types

```typescript
const res = await client.get('/users');

// Check if request succeeded
if (res.ok) {
  // TypeScript knows data exists and has correct type
  console.log(res.data);  // Type: [{ id: number, name: string }]
} else {
  // Handle error
  console.error(res.status, res.data);
}
```

## E2E with Controllers (Auto-Generated Types)

When using controllers, enable `preRouteTypes` to generate types automatically:

```typescript
// server.ts
import Spear, { Controller, Get, Dependencies, type T } from "tspace-spear";

// Service
class UserService {
  findAll() { return [{ id: 1, name: 'Alice' }]; }
}

// Controller
@Dependencies(UserService)
@Controller('/users')
class UserController {
  constructor(private userService: UserService) {}

  @Get('/')
  list() {
    return { users: this.userService.findAll() };
  }
}

// App with preRouteTypes
const app = new Spear({
  controllers: {
    folder: `${__dirname}/controllers`,
    name: /controller\.(ts|js)$/,
    preRouteTypes: true  // ✅ Enable auto type generation!
  }
});

// Now contract has all controller routes!
type API = typeof app.contract;
// API["/users"].GET.response = { users: { id: number, name: string }[] }
```

## Full E2E Example (Server + Client)

### Server (server.ts)

```typescript
import Spear, { Controller, Get, Post, Dependencies, type T } from "tspace-spear";

class TodoService {
  private todos = [{ id: 1, title: 'Learn tspace-spear', done: false }];
  
  findAll() { return this.todos; }
  create(title: string) { 
    const todo = { id: this.todos.length + 1, title, done: false };
    this.todos.push(todo);
    return todo;
  }
}

@Dependencies(TodoService)
@Controller('/todos')
class TodoController {
  constructor(private todoService: TodoService) {}

  @Get('/')
  list() { return { todos: this.todoService.findAll() }; }

  @Post('/')
  create({ body }: T.Context<{ body: { title: string } }>) {
    return { created: this.todoService.create(body.title) };
  }
}

const app = new Spear({
  controllers: {
    folder: `${__dirname}/controllers`,
    name: /controller\.(ts|js)$/,
    preRouteTypes: true
  }
});

app.listen(8000);
export default app;  // Export for client to import
```

### Client (client.ts)

```typescript
import { ApiClient } from "tspace-spear/client";
import app from "./server";  // Import server to get types

// Create typed client
const client = new ApiClient<typeof app.contract>('http://localhost:8000');

async function main() {
  // List todos - fully typed!
  const todos = await client.get('/todos');
  if (todos.ok) {
    console.log(todos.data.todos);  // Type: { id, title, done }[]
  }

  // Create todo - body is typed!
  const created = await client.post('/todos', {
    body: { title: 'New todo' }  // ✅ TypeScript checks this!
  });
  if (created.ok) {
    console.log(created.data.created);
  }
}

main();
```

## Typed Query Parameters

```typescript
// Server
app.get('/search', ({ query }) => {
  return { results: [] };
});

// Client
const res = await client.get('/search', {
  query: {
    q: 'hello',    // string
    page: '1',     // string
    limit: '10'    // string
  }
});
```

## Typed Route Parameters

```typescript
// Server
app.get('/users/:userId/posts/:postId', ({ params }) => {
  return params;
});

// Client
const res = await client.get('/users/:userId/posts/:postId', {
  params: {
    userId: '123',   // ✅ Must be string
    postId: '456'    // ✅ Must be string
  }
});
```

## Typed Response Handling

```typescript
// Server with typed response
@Controller('/users')
class UserController {
  @Get('/:id')
  show({ params }: T.Context<{ params: { id: number } }>) {
    return { user: { id: params.id, name: 'Alice' } };
  }
}

// Client
const res = await client.get('/users/:id', {
  params: { id: '1' }
});

if (res.ok) {
  // TypeScript knows the exact structure!
  console.log(res.data.user.id);    // number
  console.log(res.data.user.name);  // string
}
```

## Add Custom Types to Context (Like User)

### Step 1: Create types.d.ts

```typescript
// src/types.d.ts
import { ContextExtensions } from "tspace-spear";

type User = {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
};

declare module "tspace-spear" {
  interface ContextExtensions {
    user?: User;  // Add user to context
  }
}
```

### Step 2: Update tsconfig.json

```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "esModuleInterop": true
  },
  "include": [
    "src",
    "src/types.d.ts"  // ✅ Include type extension
  ]
}
```

### Step 3: Use in Middleware

```typescript
// auth.middleware.ts
const authMiddleware: T.ContextHandler = (ctx, next) => {
  const token = ctx.headers.authorization;
  
  if (!token) {
    return ctx.res.unauthorized();
  }
  
  // ctx.user is now typed!
  ctx.user = {
    id: 1,
    name: 'John',
    email: 'john@example.com',
    role: 'admin'
  };
  
  return next();
};
```

### Step 4: Use in Controller

```typescript
@Controller('/profile')
class ProfileController {
  @Get('/')
  @Middleware(authMiddleware)
  profile({ user, res }: T.Context) {
    // user is typed as: User | undefined
    if (!user) {
      return res.unauthorized();
    }
    
    // TypeScript knows user has id, name, email, role
    return { 
      id: user.id,
      name: user.name,
      email: user.email
    };
  }
}
```

## Base Contract vs Compiled Contract

```typescript
const app = new Spear()
  .get('/health', () => 'OK')  // Direct route
  .useSwagger({ complie: 'app' });

// baseContract = only routes defined directly on app
type BaseAPI = typeof app.baseContract;
// { "/health": { GET: {...} } }

// compiledContract = routes from compiler (preRouteTypes)
type CompiledAPI = typeof app.compiledContract;
// { "/users": {...}, "/users/:id": {...} }

// contract = merged (base + compiled)
type FullAPI = typeof app.contract;
// { "/health": {...}, "/users": {...}, "/users/:id": {...} }
```

## Swagger with Compile Types

```typescript
const app = new Spear({
  controllers: {
    folder: `${__dirname}/controllers`,
    name: /controller\.(ts|js)$/,
    preRouteTypes: true  // Generate types
  }
})
.useSwagger({
  complie: 'app',  // Use compiled contract for Swagger docs
  path: '/api/docs',
  options: {
    decoratedOnly: false  // Show all routes
  }
});

// Swagger UI at http://localhost:8000/api/docs
// Shows all controller routes with full documentation!
```

## Quick Reference

| Concept | Code |
|---------|------|
| Get contract type | `type API = typeof app.contract` |
| Create typed client | `new ApiClient<API>('http://...')` |
| Enable controller types | `preRouteTypes: true` |
| Extend context | `declare module "tspace-spear" { interface ContextExtensions { user?: User } }` |
| Swagger with types | `useSwagger({ complie: 'app' })` |

## Common Mistakes

### ❌ Wrong: Not exporting app

```typescript
// server.ts
const app = new Spear();
app.listen(8000);
// Forgot to export!
```

### ✅ Correct: Export for client

```typescript
// server.ts
const app = new Spear();
app.listen(8000);
export default app;  // ✅ Export for type inference
```

### ❌ Wrong: Not using contract type

```typescript
const client = new ApiClient('http://localhost:8000');
// No types!
```

### ✅ Correct: Use contract type

```typescript
const client = new ApiClient<typeof app.contract>('http://localhost:8000');
// Full type safety!