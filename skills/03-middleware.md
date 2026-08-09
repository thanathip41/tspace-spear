# Middleware - tspace-spear

## What is Middleware?

Middleware functions run before your route handler. They can:
- Read/modify request data
- Add properties to context
- End the request early
- Pass control to next middleware

## Basic Middleware

```typescript
import Spear, { type T } from "tspace-spear";

const app = new Spear();

// Global middleware - runs on every request
app.use((ctx: T.Context, next: T.NextFunction) => {
  console.log(`${ctx.req.method} ${ctx.req.url}`);
  return next();
});
```

## Auth Middleware

```typescript
const authMiddleware: T.ContextHandler = async (ctx, next) => {
  const token = ctx.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return ctx.res.unauthorized('Token required');
  }
  
  try {
    // Verify token (pseudo-code)
    const user = await verifyToken(token);
    ctx.user = user;  // Add user to context
    return next();
  } catch (err) {
    return ctx.res.forbidden('Invalid token');
  }
};

app.use(authMiddleware);
```

## Logger Middleware

```typescript
const loggerMiddleware: T.ContextHandler = (ctx, next) => {
  const start = Date.now();
  
  return next().then(() => {
    const duration = Date.now() - start;
    console.log(`${ctx.req.method} ${ctx.req.url} - ${duration}ms`);
  });
};

app.use(loggerMiddleware);
```

## Built-in Middleware

### Body Parser

```typescript
// Enable JSON body parsing
app.useBodyParser();

// Exclude certain methods
app.useBodyParser({ except: ['GET', 'HEAD'] });
```

### File Upload

```typescript
app.useFileUpload({
  limit: 10_000_000,        // 10MB limit
  tempFileDir: 'tmp',       // Temp folder
  removeTempFile: {
    remove: true,           // Auto-remove temp files
    ms: 60000               // Remove after 60 seconds
  }
});
```

### Cookies Parser

```typescript
app.useCookiesParser();

// Now ctx.cookies is available
app.get('/profile', ({ cookies, res }) => {
  const token = cookies.token;
  return res.json({ token });
});
```

### Logger

```typescript
// Enable in constructor
const app = new Spear({ logger: true });

// Or with options
app.useLogger({
  methods: ['GET', 'POST'],           // Only log these methods
  exceptPath: ['/health', /\/static/] // Exclude paths
});
```

## CORS Middleware

```typescript
app.cors({
  origins: ['http://localhost:3000', /^https:\/\/.*\.example\.com$/],
  credentials: true
});

// Or allow all
app.cors();
```

## Rate Limiting Middleware

```typescript
const rateLimit = (max: number, windowMs: number) => {
  const requests = new Map<string, { count: number; reset: number }>();
  
  return ((ctx, next) => {
    const ip = ctx.ip!;
    const now = Date.now();
    const record = requests.get(ip) || { count: 0, reset: now + windowMs };
    
    if (now > record.reset) {
      record.count = 0;
      record.reset = now + windowMs;
    }
    
    record.count++;
    requests.set(ip, record);
    
    if (record.count > max) {
      return ctx.res.tooManyRequests('Rate limit exceeded');
    }
    
    return next();
  }) as T.ContextHandler;
};

app.use(rateLimit(100, 60000)); // 100 requests per minute
```

## Controller Middleware

```typescript
import { Controller, Get, Middleware, type T } from "tspace-spear";

const adminCheck: T.ContextHandler = (ctx, next) => {
  if (!ctx.user?.isAdmin) {
    return ctx.res.forbidden('Admin only');
  }
  return next();
};

@Controller('/admin')
class AdminController {
  @Get('/dashboard')
  @Middleware(adminCheck)
  dashboard() {
    return { admin: true };
  }
}
```

## Class-based Middleware

```typescript
class AuthMiddleware {
  async validate(ctx: T.Context, next: T.NextFunction) {
    if (!ctx.headers.authorization) {
      return ctx.res.unauthorized();
    }
    return next();
  }
  
  async log(ctx: T.Context, next: T.NextFunction) {
    console.log('Auth check passed');
    return next();
  }
}

@Controller('/secure')
class SecureController {
  @Get('/data')
  @Middleware(AuthMiddleware)  // Runs validate() then log()
  getData() {
    return { secret: 'data' };
  }
}
```

## Multiple Middleware

```typescript
const middleware1: T.ContextHandler = (ctx, next) => {
  console.log('Middleware 1 - before');
  return next();
};

const middleware2: T.ContextHandler = (ctx, next) => {
  console.log('Middleware 2 - before');
  return next();
};

app.get('/test', middleware1, middleware2, ({ res }) => {
  return res.json({ result: 'Handler executed' });
});

// Order: middleware1 -> middleware2 -> handler
```

## Conditional Middleware

```typescript
const conditionalMiddleware: T.ContextHandler = (ctx, next) => {
  // Only run for POST requests
  if (ctx.req.method === 'POST') {
    console.log('Processing POST body...');
  }
  return next();
};

app.use(conditionalMiddleware);
```

## Error in Middleware

```typescript
const errorMiddleware: T.ContextHandler = (ctx, next) => {
  try {
    // Some operation
    throw new Error('Something went wrong');
  } catch (err) {
    return next(err);  // Pass error to error handler
  }
};

app.use(errorMiddleware);
```

## Middleware Order Example

```typescript
const app = new Spear()
  .use((ctx, next) => {           // 1. Runs first (global)
    console.log('Global middleware');
    return next();
  })
  .useBodyParser()                 // 2. Parse body
  .useCookiesParser()              // 3. Parse cookies
  .get('/test',
    (ctx, next) => {               // 4. Route-specific middleware
      console.log('Route middleware');
      return next();
    },
    ({ res }) => res.json({ done: true })  // 5. Handler
  );