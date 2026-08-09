# Response Handling - tspace-spear

## Response Helpers

### Success Responses

```typescript
import Spear, { type T } from "tspace-spear";

const app = new Spear();

// 200 OK
app.get('/ok', ({ res }) => res.ok({ data: 'success' }));

// 201 Created
app.post('/create', ({ res }) => res.created({ id: 1, name: 'Item' }));

// 202 Accepted
app.post('/process', ({ res }) => res.accepted({ status: 'processing' }));

// 204 No Content
app.delete('/delete', ({ res }) => res.noContent());
```

### Error Responses

```typescript
// 400 Bad Request
app.get('/bad', ({ res }) => res.badRequest('Invalid input'));

// 401 Unauthorized
app.get('/unauth', ({ res }) => res.unauthorized('Login required'));

// 403 Forbidden
app.get('/forbidden', ({ res }) => res.forbidden('No access'));

// 404 Not Found
app.get('/notfound', ({ res }) => res.notFound('Item not found'));

// 413 Content Too Large
app.get('/toolarge', ({ res }) => res.tooLarge('File too big'));

// 422 Unprocessable Entity
app.get('/invalid', ({ res }) => res.unprocessable('Invalid data'));

// 429 Too Many Requests
app.get('/ratelimit', ({ res }) => res.tooManyRequests('Slow down'));

// 500 Internal Server Error
app.get('/error', ({ res }) => res.serverError('Something broke'));
```

## Status Code Method

```typescript
// Set status and chain response method
app.get('/custom', ({ res }) => 
  res.status(201).json({ created: true })
);

app.get('/text', ({ res }) => 
  res.status(200).send('Hello')
);

app.get('/empty', ({ res }) => 
  res.status(204).end()
);
```

## Response Types

### JSON Response

```typescript
app.get('/json', ({ res }) => 
  res.json({ message: 'Hello', count: 42 })
);
```

### Text Response

```typescript
app.get('/text', ({ res }) => 
  res.send('Plain text response')
);
```

### HTML Response

```typescript
app.get('/html', ({ res }) => 
  res.html('<h1>Hello World</h1>')
);
```

### File Response

```typescript
import path from 'path';

app.get('/file', (ctx) => {
  const filePath = path.join(process.cwd(), 'files', 'document.pdf');
  return ctx.res.serveMedia(filePath);
});
```

## Set Headers

```typescript
// Single header
app.get('/header', ({ res }) => {
  res.set('X-Custom-Header', 'value');
  return res.json({ data: 'test' });
});

// Multiple headers
app.get('/headers', ({ res }) => {
  res.set('X-API-Version', '1.0');
  res.set('X-Request-Id', 'abc123');
  return res.json({ data: 'test' });
});

// Status code with headers
app.get('/status-headers', ({ res }) => {
  res.set(201, 'JSON');
  return res.json({ created: true });
});
```

## Set Cookies

```typescript
app.post('/login', ({ res }) => {
  res.setCookies({
    token: 'abc123',
    user: 'john'
  });
  return res.json({ logged: true });
});

// With options
app.post('/login', ({ res }) => {
  res.setCookies({
    token: {
      value: 'abc123',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      expires: new Date(Date.now() + 86400000) // 1 day
    }
  });
  return res.json({ logged: true });
});
```

## Response Formatting (Global)

```typescript
// Format all responses consistently
const app = new Spear()
  .response((result: any, statusCode: number) => {
    if (typeof result === 'string') {
      return result;
    }
    
    if (Array.isArray(result)) {
      return {
        success: statusCode < 400,
        data: result,
        statusCode
      };
    }
    
    if (typeof result === 'object' && result !== null) {
      return {
        success: statusCode < 400,
        ...result,
        statusCode
      };
    }
    
    return {
      success: statusCode < 400,
      data: result,
      statusCode
    };
  });

// Now all responses are formatted:
// GET /users -> { success: true, data: [...], statusCode: 200 }
```

## Custom Error Handler

```typescript
import { z } from 'zod';

const app = new Spear()
  .catch((err: any, { res }: T.Context) => {
    // Zod validation errors
    if (err instanceof z.ZodError) {
      return res.status(422).json({
        message: 'Validation failed',
        issues: err.issues,
        statusCode: 422
      });
    }

    // Custom error with status
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        message: err.message,
        statusCode: err.statusCode
      });
    }

    // Default 500
    return res.status(500).json({
      message: err.message || 'Internal server error',
      statusCode: 500
    });
  });
```

## Not Found Handler

```typescript
const app = new Spear()
  .notfound(({ res }: T.Context) => {
    return res.status(404).json({
      message: 'Route not found',
      path: res.http.url
    });
  });
```

## Write Head

```typescript
app.get('/raw', ({ res }) => {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'X-Custom': 'value'
  });
  return res.end(JSON.stringify({ data: 'raw' }));
});
```

## Response Properties

```typescript
app.get('/check', ({ res }) => {
  // Check if headers sent
  const sent = res.headersSent();
  
  // Get status code
  const status = res.statusCode();
  
  // Check if writable ended
  const ended = res.writableEnded();
  
  // Check if aborted
  const aborted = res.aborted();
  
  return { sent, status, ended, aborted };
});
```

## Chaining Example

```typescript
app.post('/users', ({ body, res }: T.Context) => {
  // Validate
  if (!body?.name) {
    return res.badRequest('Name is required');
  }

  // Create user (pseudo-code)
  const user = { id: 1, ...body };

  // Set headers and respond
  res.set('X-User-Id', String(user.id));
  return res.created(user);
});
```

## Response Type Helpers

```typescript
// All these return typed responses
res.ok({ data })           // 200
res.created({ id: 1 })     // 201
res.accepted()             // 202
res.noContent()            // 204
res.partialContent()       // 206

res.badRequest('msg')      // 400
res.unauthorized('msg')    // 401
res.paymentRequired('msg') // 402
res.forbidden('msg')       // 403
res.notFound('msg')        // 404
res.notAllowed('msg')      // 405
res.timeout('msg')         // 408
res.conflict('msg')        // 409
res.tooLarge('msg')        // 413
res.unprocessable('msg')   // 422
res.tooManyRequests('msg') // 429
res.serverError('msg')     // 500