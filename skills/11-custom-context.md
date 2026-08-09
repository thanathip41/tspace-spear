# Custom T.Context - Extend Context Types

## What is Context Extension?

By default, `T.Context` has basic properties like `req`, `res`, `params`, `query`, `body`, etc. 

**Context extension** lets you add **custom properties** (like `user`, `session`, `locale`) with full TypeScript type safety.

---

## Quick Example: Add `user` to Context

### Step 1: Create `types.d.ts`

```typescript
// src/types.d.ts
import { ContextExtensions } from "tspace-spear";

// Define your custom type
type User = {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
};

// Extend ContextExtensions interface
declare module "tspace-spear" {
  interface ContextExtensions {
    user?: User;  // Add user property
  }
}

export {};  // Important: makes this a module
```

### Step 2: Update `tsconfig.json`

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
import { type T } from "tspace-spear";

const authMiddleware: T.ContextHandler = (ctx, next) => {
  const token = ctx.headers.authorization;
  
  if (!token) {
    return ctx.res.unauthorized();
  }
  
  // ctx.user is now typed as: User | undefined
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
import { Controller, Get, Middleware, type T } from "tspace-spear";

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
      email: user.email,
      role: user.role
    };
  }
}
```

---

## Complete Example: Auth System

### Define User Type

```typescript
// src/types.d.ts
import { ContextExtensions } from "tspace-spear";

type User = {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
};

type Session = {
  id: string;
  userId: number;
  expiresAt: Date;
};

declare module "tspace-spear" {
  interface ContextExtensions {
    user?: User;
    session?: Session;
    locale?: string;
  }
}

export {};
```

### Auth Middleware

```typescript
// src/middlewares/auth.middleware.ts
import { type T } from "tspace-spear";
import jwt from "jsonwebtoken";

export const authMiddleware: T.ContextHandler = async (ctx, next) => {
  const token = ctx.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return ctx.res.unauthorized('Token required');
  }
  
  try {
    // Verify token
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
    
    // Get user from database (pseudo-code)
    const user = await db.users.findById(payload.userId);
    
    if (!user) {
      return ctx.res.unauthorized('User not found');
    }
    
    // Set user on context - fully typed!
    ctx.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };
    
    return next();
  } catch (err) {
    return ctx.res.forbidden('Invalid token');
  }
};
```

### Locale Middleware

```typescript
// src/middlewares/locale.middleware.ts
import { type T } from "tspace-spear";

export const localeMiddleware: T.ContextHandler = (ctx, next) => {
  // Get locale from header or default to 'en'
  ctx.locale = ctx.headers['accept-language'] || 'en';
  
  return next();
};
```

### Session Middleware

```typescript
// src/middlewares/session.middleware.ts
import { type T } from "tspace-spear";

export const sessionMiddleware: T.ContextHandler = async (ctx, next) => {
  const sessionId = ctx.cookies.sessionId;
  
  if (sessionId) {
    // Get session from database (pseudo-code)
    const session = await db.sessions.findById(sessionId);
    if (session) {
      ctx.session = session;  // Fully typed!
    }
  }
  
  return next();
};
```

### Use in Controller

```typescript
// src/controllers/profile.controller.ts
import { Controller, Get, Middleware, type T } from "tspace-spear";
import { authMiddleware } from '../middlewares/auth.middleware';
import { localeMiddleware } from '../middlewares/locale.middleware';

@Controller('/profile')
class ProfileController {
  
  // Public route with locale
  @Get('/settings')
  @Middleware(localeMiddleware)
  settings({ locale, res }: T.Context) {
    return res.json({
      language: locale,  // Typed as: string | undefined
      theme: 'dark'
    });
  }
  
  // Protected route with user
  @Get('/')
  @Middleware(authMiddleware)
  getProfile({ user, res }: T.Context) {
    if (!user) {
      return res.unauthorized();
    }
    
    // user is fully typed!
    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    });
  }
  
  // Admin only route
  @Get('/admin')
  @Middleware(authMiddleware)
  adminPanel({ user, res }: T.Context) {
    if (!user || user.role !== 'admin') {
      return res.forbidden('Admin access required');
    }
    
    return res.json({
      message: 'Welcome, admin!',
      user
    });
  }
}
```

---

## Multiple Custom Properties

You can add multiple properties to context:

```typescript
// src/types.d.ts
import { ContextExtensions } from "tspace-spear";

declare module "tspace-spear" {
  interface ContextExtensions {
    // Authentication
    user?: {
      id: number;
      name: string;
      email: string;
      role: string;
    };
    
    // Session
    session?: {
      id: string;
      userId: number;
      expiresAt: Date;
    };
    
    // Localization
    locale?: string;
    timezone?: string;
    
    // Request tracking
    requestId?: string;
    startTime?: number;
    
    // Custom data
    metadata?: Record<string, any>;
  }
}

export {};
```

### Use Multiple Properties

```typescript
@Controller('/dashboard')
class DashboardController {
  @Get('/')
  @Middleware(authMiddleware)
  @Middleware(localeMiddleware)
  @Middleware(trackingMiddleware)
  dashboard(ctx: T.Context) {
    // All properties are typed!
    const { user, locale, timezone, requestId, startTime } = ctx;
    
    return {
      user: user,        // User | undefined
      locale: locale,    // string | undefined
      timezone: timezone, // string | undefined
      requestId: requestId, // string | undefined
      duration: Date.now() - (startTime || Date.now())
    };
  }
}
```

---

## Generic Context with Custom Type

For inline routes, you can specify custom context type:

```typescript
import Spear, { type T } from "tspace-spear";

type MyContext = T.Context & {
  user?: { id: number; name: string };
};

const app = new Spear()
  .use((ctx: MyContext, next) => {
    ctx.user = { id: 1, name: 'John' };
    return next();
  })
  .get('/profile', (ctx: MyContext) => {
    // ctx.user is typed!
    return { user: ctx.user };
  });
```

---

## Context Extension with DTO

Combine context extension with DTO validation:

```typescript
import { Controller, Post, ValidateDto, Middleware, type T } from "tspace-spear";

type MyContext = T.Context & {
  user?: { id: number; role: string };
};

class CreatePostDto {
  title!: string;
  content!: string;
  tags?: string[];
}

@Controller('/posts')
class PostController {
  
  @Post('/')
  @Middleware(authMiddleware)
  @ValidateDto(CreatePostDto)
  create(ctx: T.Context & { body: CreatePostDto }) {
    // Both body and user are typed!
    const { title, content, tags } = ctx.body;
    const userId = ctx.user?.id;
    
    return { created: { title, content, tags, authorId: userId } };
  }
}
```

---

## Testing with Extended Context

```typescript
import { TestingController } from "tspace-spear/testing";

type MyContext = T.Context & {
  user?: { id: number; name: string };
};

describe('ProfileController', () => {
  const testing = new TestingController();

  it('should return user profile', () => {
    // Create context with custom user property
    const ctx = testing.createContext({
      headers: { authorization: 'Bearer token123' }
    }) as MyContext;
    
    // Add user (simulating auth middleware)
    ctx.user = { id: 1, name: 'Test User' };
    
    // Call controller method
    const result = controller.getProfile(ctx);
    
    expect(result).toEqual({
      id: 1,
      name: 'Test User'
    });
  });
});
```

---

## Common Patterns

### Role-Based Access Control

```typescript
type User = {
  id: number;
  role: 'admin' | 'moderator' | 'user';
};

declare module "tspace-spear" {
  interface ContextExtensions {
    user?: User;
  }
}

// Middleware factory
const requireRole = (roles: string[]) => {
  return ((ctx: T.Context, next) => {
    if (!ctx.user || !roles.includes(ctx.user.role)) {
      return ctx.res.forbidden('Insufficient permissions');
    }
    return next();
  }) as T.ContextHandler;
};

// Use in controller
@Controller('/admin')
class AdminController {
  @Get('/users')
  @Middleware(requireRole(['admin']))
  listUsers() {
    return { users: [] };
  }
}
```

### Request Tracking

```typescript
import { v4 as uuidv4 } from 'uuid';

declare module "tspace-spear" {
  interface ContextExtensions {
    requestId?: string;
    startTime?: number;
  }
}

const trackingMiddleware: T.ContextHandler = (ctx, next) => {
  ctx.requestId = ctx.headers['x-request-id'] as string || uuidv4();
  ctx.startTime = Date.now();
  
  return next().then(() => {
    const duration = Date.now() - ctx.startTime!;
    console.log(`[${ctx.requestId}] ${ctx.req.method} ${ctx.req.url} - ${duration}ms`);
  });
};
```

### Tenant/Multi-tenant Support

```typescript
type Tenant = {
  id: string;
  name: string;
  plan: 'free' | 'pro' | 'enterprise';
};

declare module "tspace-spear" {
  interface ContextExtensions {
    tenant?: Tenant;
  }
}

const tenantMiddleware: T.ContextHandler = async (ctx, next) => {
  const subdomain = ctx.headers.host?.split('.')[0];
  
  if (subdomain) {
    ctx.tenant = await db.tenants.findBySubdomain(subdomain);
  }
  
  return next();
};
```

---

## Quick Reference

```typescript
// 1. Create types.d.ts
import { ContextExtensions } from "tspace-spear";

declare module "tspace-spear" {
  interface ContextExtensions {
    user?: User;
  }
}
export {};

// 2. Include in tsconfig.json
{
  "include": ["src", "src/types.d.ts"]
}

// 3. Use in middleware
const middleware: T.ContextHandler = (ctx, next) => {
  ctx.user = { id: 1 };  // Typed!
  return next();
};

// 4. Use in controller
@Get('/')
@Middleware(middleware)
handler({ user }: T.Context) {
  return { user };  // user is typed!
}
```

---

## Common Mistakes

### ❌ Wrong: Forgetting `export {}`

```typescript
// types.d.ts
declare module "tspace-spear" {
  interface ContextExtensions {
    user?: User;
  }
}
// Missing export {} - types may not be picked up!
```

### ✅ Correct: Add `export {}`

```typescript
// types.d.ts
declare module "tspace-spear" {
  interface ContextExtensions {
    user?: User;
  }
}
export {};  // Makes this a module
```

### ❌ Wrong: Not including in tsconfig.json

```json
{
  "include": ["src"]  // Missing types.d.ts!
}
```

### ✅ Correct: Include types file

```json
{
  "include": ["src", "src/types.d.ts"]
}
```

### ❌ Wrong: Not checking for undefined

```typescript
@Get('/')
@Middleware(authMiddleware)
handler({ user }: T.Context) {
  return { id: user.id };  // Error if user is undefined!
}
```

### ✅ Correct: Check first

```typescript
@Get('/')
@Middleware(authMiddleware)
handler({ user, res }: T.Context) {
  if (!user) {
    return res.unauthorized();
  }
  return { id: user.id };  // Safe!
}
```

### ❌ Wrong: Using `any` type

```typescript
declare module "tspace-spear" {
  interface ContextExtensions {
    user?: any;  // No type safety!
  }
}
```

### ✅ Correct: Define proper type

```typescript
type User = {
  id: number;
  name: string;
};

declare module "tspace-spear" {
  interface ContextExtensions {
    user?: User;  // Full type safety!
  }
}