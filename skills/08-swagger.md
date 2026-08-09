# Swagger Documentation - tspace-spear

## What is Swagger?

Swagger (OpenAPI) generates interactive API documentation. Users can:
- See all your API endpoints
- Understand request/response formats
- **Test APIs directly from the browser**

---

## Quick Start

```typescript
import Spear from "tspace-spear";

const app = new Spear()
  .get('/users', () => [{ id: 1, name: 'Alice' }])
  .useSwagger({
    path: '/api/docs',        // Swagger UI URL
    info: {
      title: 'My API',
      version: '1.0.0'
    }
  });

// Access: http://localhost:8000/api/docs
```

---

## Basic Configuration

### Minimal Setup

```typescript
app.useSwagger();  // Default: /api/docs
```

### Full Configuration

```typescript
app.useSwagger({
  path: '/api/docs',           // UI path
  info: {
    title: 'My API',
    version: '1.0.0',
    description: 'API documentation'
  },
  servers: [
    { url: 'http://localhost:8000', description: 'Development' },
    { url: 'https://api.example.com', description: 'Production' }
  ],
  tags: ['Users', 'Posts', 'Auth']  // Group categories
});
```

---

## @Swagger Decorator

Add documentation to controller routes:

```typescript
import { Controller, Get, Post, Swagger, type T } from "tspace-spear";

@Controller('/users')
class UserController {
  
  @Get('/')
  @Swagger({
    summary: 'List all users',           // Short description
    description: 'Returns array of users', // Long description
    tags: ['Users']                       // Group in Swagger UI
  })
  list() {
    return { users: [] };
  }

  @Post('/')
  @Swagger({
    summary: 'Create new user',
    tags: ['Users'],
    body: {
      required: true,
      description: 'User data',
      properties: {
        name: { type: 'string', required: true, description: 'User name' },
        email: { type: 'string', format: 'email', required: true }
      }
    },
    responses: [
      { status: 201, description: 'User created' },
      { status: 400, description: 'Invalid input' }
    ]
  })
  create({ body }: T.Context) {
    return { created: body };
  }
}
```

---

## Swagger Decorator Options

### Basic Info

```typescript
@Swagger({
  summary: 'Get user by ID',      // Short title
  description: 'Returns a user',  // Full description
  tags: ['Users'],                // Category/group
  bearerToken: true               // Show auth button
})
```

### Route Parameters

```typescript
@Swagger({
  params: {
    id: { 
      type: 'string', 
      required: true, 
      description: 'User ID' 
    }
  }
})
```

### Query Parameters

```typescript
@Swagger({
  query: {
    page: { type: 'string', description: 'Page number' },
    limit: { type: 'string', description: 'Items per page' },
    search: { type: 'string', required: false }
  }
})
```

### Request Body

```typescript
@Swagger({
  body: {
    required: true,
    description: 'User data',
    properties: {
      name: { type: 'string', required: true },
      age: { type: 'number', format: 'int32', required: false },
      active: { type: 'boolean' },
      roles: { 
        type: 'array', 
        items: { type: 'string' }
      }
    }
  }
})
```

### File Upload

```typescript
@Swagger({
  files: {
    required: true,
    description: 'Profile picture',
    properties: {
      avatar: { type: 'file', required: true }
    }
  }
})
```

### Cookies

```typescript
@Swagger({
  cookies: {
    names: ['session', 'token'],
    required: true,
    description: 'Auth cookies'
  }
})
```

### Responses

```typescript
@Swagger({
  responses: [
    { 
      status: 200, 
      description: 'Success',
      example: { id: 1, name: 'Alice' }
    },
    { status: 404, description: 'User not found' },
    { status: 401, description: 'Unauthorized' }
  ]
})
```

---

## Complete Controller Example

```typescript
import Spear, { 
  Controller, Get, Post, Put, Delete,
  Swagger, Middleware, type T 
} from "tspace-spear";

// Auth middleware
const authMiddleware: T.ContextHandler = (ctx, next) => {
  if (!ctx.headers.authorization) {
    return ctx.res.unauthorized();
  }
  return next();
};

@Controller('/products')
class ProductController {
  
  @Get('/')
  @Swagger({
    summary: 'List products',
    tags: ['Products'],
    query: {
      page: { type: 'string', description: 'Page number' },
      limit: { type: 'string', description: 'Items per page' }
    },
    responses: [{ status: 200, description: 'Product list' }]
  })
  list({ query }: T.Context) {
    return { products: [] };
  }

  @Get('/:id')
  @Swagger({
    summary: 'Get product',
    tags: ['Products'],
    params: {
      id: { type: 'string', required: true, description: 'Product ID' }
    },
    responses: [
      { status: 200, description: 'Product details' },
      { status: 404, description: 'Not found' }
    ]
  })
  show({ params }: T.Context) {
    return { product: { id: params.id } };
  }

  @Post('/')
  @Middleware(authMiddleware)
  @Swagger({
    summary: 'Create product',
    tags: ['Products'],
    bearerToken: true,
    body: {
      required: true,
      properties: {
        name: { type: 'string', required: true },
        price: { type: 'number', format: 'float', required: true }
      }
    },
    responses: [
      { status: 201, description: 'Created' },
      { status: 401, description: 'Unauthorized' }
    ]
  })
  create({ body }: T.Context) {
    return { created: body };
  }

  @Post('/upload')
  @Middleware(authMiddleware)
  @Swagger({
    summary: 'Upload product image',
    tags: ['Products'],
    bearerToken: true,
    files: {
      required: true,
      properties: {
        image: { type: 'file', required: true }
      }
    },
    responses: [{ status: 201, description: 'Uploaded' }]
  })
  upload({ files }: T.Context) {
    return { uploaded: files };
  }

  @Delete('/:id')
  @Middleware(authMiddleware)
  @Swagger({
    summary: 'Delete product',
    tags: ['Products'],
    bearerToken: true,
    params: {
      id: { type: 'string', required: true }
    },
    responses: [
      { status: 204, description: 'Deleted' },
      { status: 404, description: 'Not found' }
    ]
  })
  delete({ params }: T.Context) {
    return { deleted: params.id };
  }
}

const app = new Spear({
  controllers: [ProductController],
  logger: true
})
.useBodyParser()
.useFileUpload()
.useSwagger({
  path: '/api/docs',
  info: {
    title: 'Product API',
    version: '1.0.0',
    description: 'API for managing products'
  },
  servers: [
    { url: 'http://localhost:8000', description: 'Development' },
    { url: 'https://api.example.com', description: 'Production' }
  ],
  tags: ['Products', 'Auth'],
  options: {
    decoratedOnly: true,        // Only show @Swagger routes
    docExpansion: 'list',       // Expand operations list
    displayRequestDuration: true
  }
});

app.listen(8000);
```

---

## Swagger Options Reference

```typescript
app.useSwagger({
  path: '/api/docs',
  info: {
    title: 'My API',
    version: '1.0.0',
    description: 'API documentation'
  },
  servers: [{ url: '/' }],
  tags: ['Users', 'Posts'],
  options: {
    // Display options
    decoratedOnly: true,        // Only @Swagger decorated routes
    withCredentials: true,      // Send cookies
    filter: true,               // Enable search filter
    docExpansion: 'list',       // 'none' | 'list' | 'full'
    deepLinking: true,          // Deep linking to operations
    displayOperationId: false,  // Show operation ID
    displayRequestDuration: true, // Show request time
    
    // Layout
    layout: 'StandaloneLayout'  // 'BaseLayout' | 'StandaloneLayout'
  }
});
```

---

## Global Prefix with Swagger

```typescript
const app = new Spear({
  globalPrefix: '/api'
})
.useSwagger({
  globalPrefix: {
    path: '/api',
    options: {
      exclude: [
        { path: '/health' },              // /health (not /api/health)
        { path: '/auth', methods: ['POST'] } // POST /auth only
      ]
    }
  }
});
```

---

## Swagger with preRouteTypes (Auto-Generated)

```typescript
// Auto-generate Swagger from controllers
const app = new Spear({
  controllers: {
    folder: `${__dirname}/controllers`,
    name: /controller\.(ts|js)$/,
    preRouteTypes: true  // Enable type generation
  }
})
.useSwagger({
  complie: 'app',  // Use compiled contract (auto from controllers)
  options: {
    decoratedOnly: false  // Show ALL routes
  }
});
```

---

## Custom Static URL (CDN)

```typescript
app.useSwagger({
  staticUrl: 'https://cdn.example.com/swagger-ui'  // Use CDN
});
```

---

## Type & Format Reference

### Types

| Type | Description | Example |
|------|-------------|---------|
| `string` | Text value | `"hello"` |
| `number` | Numeric value | `42` |
| `integer` | Whole number | `100` |
| `boolean` | True/false | `true` |
| `object` | JSON object | `{}` |
| `array` | Array | `[]` |
| `file` | File upload | - |

### Formats

| Format | Type | Description |
|--------|------|-------------|
| `int32` | integer | 32-bit integer |
| `int64` | integer | 64-bit integer |
| `float` | number | Float number |
| `double` | number | Double number |
| `byte` | string | Base64 encoded |
| `binary` | string | Binary data |
| `email` | string | Email address |
| `password` | string | Password field |
| `date` | string | YYYY-MM-DD |
| `date-time` | string | ISO 8601 |
| `uuid` | string | UUID |
| `uri` | string | URL/URI |
| `ipv4` | string | IPv4 address |
| `ipv6` | string | IPv6 address |

---

## Disable Swagger for Route

```typescript
@Controller('/internal')
class InternalController {
  @Get('/health')
  @Swagger({ disabled: true })  // Hide from Swagger
  health() {
    return { status: 'ok' };
  }
}
```

---

## Response Example with Data

```typescript
@Swagger({
  responses: [
    {
      status: 200,
      description: 'Success',
      example: {
        id: 1,
        name: 'Product',
        price: 99.99,
        tags: ['sale', 'new']
      }
    },
    {
      status: 400,
      description: 'Bad Request',
      example: {
        message: 'Validation failed',
        issues: [{ path: 'name', message: 'Required' }]
      }
    }
  ]
})
```

---

## Quick Reference Table

| Option | Description | Example |
|--------|-------------|---------|
| `summary` | Short title | `'List users'` |
| `description` | Full description | `'Returns all users'` |
| `tags` | Category | `['Users']` |
| `bearerToken` | Show auth button | `true` |
| `params` | Route params | `{ id: { type: 'string' } }` |
| `query` | Query params | `{ page: { type: 'string' } }` |
| `body` | Request body | `{ properties: {...} }` |
| `files` | File upload | `{ properties: { file: {...} } }` |
| `cookies` | Cookie names | `{ names: ['token'] }` |
| `responses` | Response list | `[{ status: 200 }]` |
| `disabled` | Hide from Swagger | `true` |

---

## Common Mistakes

### ❌ Wrong: Missing tags

```typescript
@Swagger({
  summary: 'List users'
  // No tags - hard to find in large APIs
})
```

### ✅ Correct: Add tags

```typescript
@Swagger({
  summary: 'List users',
  tags: ['Users']  // Groups in UI
})
```

### ❌ Wrong: No response descriptions

```typescript
@Swagger({
  responses: [{ status: 200 }]  // No description
})
```

### ✅ Correct: Describe responses

```typescript
@Swagger({
  responses: [
    { status: 200, description: 'Success' },
    { status: 404, description: 'User not found' }
  ]
})
```

### ❌ Wrong: Body without properties

```typescript
@Swagger({
  body: { required: true }  // No properties defined
})
```

### ✅ Correct: Define body properties

```typescript
@Swagger({
  body: {
    required: true,
    properties: {
      name: { type: 'string', required: true },
      email: { type: 'string', format: 'email' }
    }
  }
})