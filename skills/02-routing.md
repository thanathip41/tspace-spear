# Routing - tspace-spear

## Basic Routes

```typescript
import Spear, { type T } from "tspace-spear";

const app = new Spear();

// GET
app.get('/users', ({ res }) => res.json({ users: [] }));

// POST
app.post('/users', ({ body, res }) => res.created({ id: 1, ...body }));

// PUT
app.put('/users/:id', ({ params, body }) => ({ id: params.id, ...body }));

// PATCH
app.patch('/users/:id', ({ params }) => ({ patched: params.id }));

// DELETE
app.delete('/users/:id', ({ params }) => ({ deleted: params.id }));

// ALL (all HTTP methods)
app.all('/health', () => 'OK');
```

## Route Parameters

```typescript
// Single param
app.get('/users/:id', ({ params }) => `User ${params.id}`);

// Multiple params
app.get('/users/:userId/posts/:postId', ({ params }) => 
  `Post ${params.postId} by User ${params.userId}`
);

// Wildcard
app.get('/file/*', ({ params }) => {
  const path = params['*']; // captures everything after /file/
  return { path };
});
```

## Query Parameters

```typescript
app.get('/search', ({ query }) => {
  const { q, page, limit } = query;
  return { search: q, page, limit };
});
```

## Request Body

```typescript
app.post('/users', ({ body }) => {
  const { name, email } = body;
  return { created: { name, email } };
});
```

## Response Methods

```typescript
app.get('/json', ({ res }) => res.json({ data: 'value' }));
app.get('/text', ({ res }) => res.send('Hello'));
app.get('/html', ({ res }) => res.html('<h1>Hello</h1>'));
app.get('/status', ({ res }) => res.status(201).json({ created: true }));
app.get('/notfound', ({ res }) => res.notFound('Not found'));
app.get('/error', ({ res }) => res.serverError('Oops'));
```

## Chaining Routes

```typescript
const app = new Spear()
  .get('/', () => 'Home')
  .get('/about', () => 'About')
  .get('/contact', () => 'Contact')
  .post('/api', ({ body }) => ({ received: body }))
  .listen(8000);
```

## Router (Modular Routes)

```typescript
import { Spear, Router, type T } from "tspace-spear";

// Create router
const userRouter = new Router();

userRouter
  .get('/users', ({ res }) => res.json({ users: [] }))
  .post('/users', ({ body, res }) => res.created({ id: 1, ...body }))
  .get('/users/:id', ({ params, res }) => res.json({ id: params.id }));

// Use router
const app = new Spear();
app.useRouter(userRouter);
```

## Router Groups

```typescript
const router = new Router();

// Group routes with prefix
router.groups('/api', (r) => {
  r.get('/users', () => 'users');
  r.get('/posts', () => 'posts');
  return r;
});

// Results in:
// GET /api/users
// GET /api/posts
```

## Nested Router Groups

```typescript
const router = new Router();

router
  .groups('/v1', (r) => {
    r.groups('/users', (r2) => {
      r2.get('/', () => 'list users');
      r2.post('/', () => 'create user');
      r2.get('/:id', () => 'get user');
      return r2;
    });
    return r;
  });

// Results in:
// GET    /v1/users
// POST   /v1/users
// GET    /v1/users/:id
```

## Global Prefix

```typescript
// Option 1: Constructor
const app = new Spear({ globalPrefix: '/api' });

// Option 2: Method
app.useGlobalPrefix('/api', {
  exclude: [
    { path: '/health' },              // /health (not /api/health)
    { path: '/auth', methods: ['POST'] } // POST /auth (not /api/auth)
  ]
});

// Routes:
// app.get('/')         -> GET /api
// app.get('/users')    -> GET /api/users
// app.get('/health')   -> GET /health (excluded)
```

## Route with Multiple Handlers

```typescript
const logger: T.ContextHandler = (ctx, next) => {
  console.log(`${ctx.req.method} ${ctx.req.url}`);
  return next();
};

const auth: T.ContextHandler = (ctx, next) => {
  if (!ctx.headers.authorization) {
    return ctx.res.unauthorized();
  }
  return next();
};

app.get('/protected', logger, auth, ({ res }) => {
  return res.json({ secret: 'data' });
});
```

## Serve Static Files

```typescript
import path from 'path';

app.get('/file/*', (ctx) => {
  const filePath = path.join(process.cwd(), 'uploads', String(ctx.params['*']));
  return ctx.res.serveMedia(filePath);
});

// Access: GET /file/document.pdf -> serves ./uploads/document.pdf