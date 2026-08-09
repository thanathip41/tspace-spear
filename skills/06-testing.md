# Testing - tspace-spear

## What Testing Utilities Are Available?

tspace-spear provides testing utilities for:
- **Unit Testing** - Test services and controllers in isolation
- **Integration Testing (E2E)** - Test full API endpoints
- **Mocking** - Replace dependencies with mock implementations
- **Spying** - Track method calls on objects

---

## Quick Start

### Simple Service Test

```typescript
import { TestingService } from "tspace-spear/testing";

// Service to test
class UserService {
  private users = [{ id: 1, name: 'Alice' }];
  findAll() { return this.users; }
}

// Test
const testing = new TestingService();
const service = testing.createService(UserService);

const users = service.findAll();
console.log(users); // [{ id: 1, name: 'Alice' }]
```

### Simple E2E Test

```typescript
import { TestModule } from "tspace-spear/testing";

const result = await TestModule.create()
  .setControllers([UserController])
  .compile();

const res = await result.client.get('/users');
console.log(res.status); // 200
```

---

## Unit Testing Services

### Basic Service Test

```typescript
import { TestingService } from "tspace-spear/testing";

// Service to test
class UserService {
  private users = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' }
  ];
  
  findAll() {
    return this.users;
  }
  
  findById(id: number) {
    return this.users.find(u => u.id === id);
  }
  
  create(name: string) {
    const user = { id: this.users.length + 1, name };
    this.users.push(user);
    return user;
  }
}

// Test with Mocha/Chai
describe('UserService', () => {
  const testing = new TestingService();
  let service: UserService;

  before(() => {
    service = testing.createService(UserService);
  });

  it('should return all users', () => {
    const users = service.findAll();
    expect(users).to.have.length(2);
  });

  it('should find user by id', () => {
    const user = service.findById(1);
    expect(user).to.have.property('name', 'Alice');
  });

  it('should create new user', () => {
    const user = service.create('Charlie');
    expect(user).to.have.property('id', 3);
    expect(user.name).toBe('Charlie');
  });
});
```

---

## Unit Testing Controllers with Mocks

### Create Mock Service

```typescript
import { TestingController, createMockService } from "tspace-spear/testing";

// Real service
class UserService {
  findAll() { return [{ id: 1, name: 'Alice' }]; }
}

// Controller with dependency
@Controller('/users')
@Dependencies(UserService)
class UserController {
  constructor(private userService: UserService) {}
  
  @Get('/')
  list() {
    return { users: this.userService.findAll() };
  }
}

// Test with mock
describe('UserController', () => {
  const testing = new TestingController();
  
  // Create mock service
  const mockUserService = createMockService(UserService, {
    findAll: () => [{ id: 1, name: 'Mock User' }]
  });

  // Create controller with mock
  const controller = testing.createController(UserController, {
    mocks: new Map([[UserService, mockUserService]])
  });

  it('should return mocked users', () => {
    const result = controller.list();
    expect(result.users[0].name).toBe('Mock User');
  });
});
```

---

## Create Mock Context

Test controllers with custom context data:

```typescript
import { TestingController } from "tspace-spear/testing";

describe('Controller Context', () => {
  const testing = new TestingController();

  it('should handle params', () => {
    const ctx = testing.createContext({
      params: { id: 123 }
    });
    
    expect(ctx.params.id).toBe(123);
  });

  it('should handle body', () => {
    const ctx = testing.createContext({
      body: { name: 'Test', email: 'test@example.com' }
    });
    
    expect(ctx.body.name).toBe('Test');
    expect(ctx.body.email).toBe('test@example.com');
  });

  it('should handle query', () => {
    const ctx = testing.createContext({
      query: { page: '1', limit: '10' }
    });
    
    expect(ctx.query.page).toBe('1');
    expect(ctx.query.limit).toBe('10');
  });

  it('should handle headers', () => {
    const ctx = testing.createContext({
      headers: { authorization: 'Bearer token123' }
    });
    
    expect(ctx.headers.authorization).toBe('Bearer token123');
  });
});
```

---

## Integration Testing (E2E)

### Basic E2E Test

```typescript
import { TestModule } from "tspace-spear/testing";

describe('User API E2E', () => {
  let result: Awaited<ReturnType<typeof TestModule.create().compile()>>;

  before(async () => {
    // Compile test module
    result = await TestModule.create()
      .setControllers([UserController])
      .setLogger(true)
      .setPort(3000)
      .compile();
  });

  after(async () => {
    // Clean up
    await result.close();
  });

  it('GET /users should return users', async () => {
    const res = await result.client.get('/users');
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
  });

  it('POST /users should create user', async () => {
    const res = await result.client.post('/users', {
      body: { name: 'Alice', email: 'alice@example.com' }
    });
    expect(res.ok).toBe(true);
    expect(res.status).toBe(201);
  });

  it('GET /users/:id should return 404 for non-existent', async () => {
    const res = await result.client.get('/users/999');
    expect(res.ok).toBe(false);
    expect(res.status).toBe(404);
  });
});
```

---

## createTestServer Helper

Alternative way to set up test server:

```typescript
import { createTestServer } from "tspace-spear/testing";

describe('API Tests', () => {
  let testServer: Awaited<ReturnType<typeof createTestServer>>;

  before(async () => {
    testServer = await createTestServer({
      controllers: [UserController],
      logger: true,
      port: 3001
    });
  });

  after(async () => {
    await testServer.close();
  });

  it('should work', async () => {
    const res = await testServer.client.get('/users');
    expect(res.status).toBe(200);
  });
});
```

---

## Service Spying

Track method calls without replacing the service:

```typescript
import { TestingService } from "tspace-spear/testing";

class UserService {
  findAll() { return [{ id: 1, name: 'Alice' }]; }
}

describe('Spy on Service', () => {
  const testing = new TestingService();

  it('should track method calls', () => {
    const service = new UserService();
    
    // Create spy
    const spy = testing.spyOn(
      service as unknown as Record<string, Function>, 
      'findAll'
    );
    
    // Call method
    service.findAll();
    service.findAll();
    
    // Verify spy tracked calls
    expect(spy.callCount).toBe(2);
    expect(spy.calls.length).toBe(2);
    expect(spy.original).toBeDefined();
  });
});
```

---

## Mock Service with Dependencies

Mock a service that another service depends on:

```typescript
import { TestingService } from "tspace-spear/testing";

// Database service
class DatabaseService {
  query(sql: string) { return []; }
}

// Service that depends on DatabaseService
class UserService {
  constructor(private db: DatabaseService) {}
  
  findAll() {
    return this.db.query('SELECT * FROM users');
  }
}

describe('UserService with mocked DB', () => {
  const testing = new TestingService();

  // Create mock database
  const mockDb = testing.createMockService(DatabaseService, {
    query: (sql: string) => [{ id: 1, name: 'Mocked' }]
  });

  it('should use mocked database', () => {
    const service = testing.createService(UserService, {
      mocks: new Map([[DatabaseService, mockDb]])
    });
    
    const users = service.findAll();
    expect(users[0].name).toBe('Mocked');
  });
});
```

---

## Complete Test Example (Cat API)

Full example with service, controller, and E2E tests:

```typescript
import { describe, it, before, after } from "mocha";
import { expect } from "chai";
import { Controller, Get, Post, Dependencies, type T } from "tspace-spear";
import { TestModule, createMockService } from "tspace-spear/testing";

// === SERVICE ===
class CatService {
  private cats = [{ id: 1, name: 'Fluffy' }];
  
  findAll() { return this.cats; }
  findById(id: number) { return this.cats.find(c => c.id === id); }
  create(name: string) { 
    const cat = { id: this.cats.length + 1, name };
    this.cats.push(cat);
    return cat;
  }
}

// === CONTROLLER ===
@Dependencies(CatService)
@Controller('/cats')
class CatController {
  constructor(private catService: CatService) {}

  @Get('/')
  list() { return { cats: this.catService.findAll() }; }

  @Get('/:id')
  show({ params, res }: T.Context<{ params: { id: number } }>) {
    const cat = this.catService.findById(params.id);
    if (!cat) throw res.notFound('Cat not found');
    return { cat };
  }

  @Post('/')
  create({ body }: T.Context<{ body: { name: string } }>) {
    return { created: this.catService.create(body.name) };
  }
}

// === TESTS ===
describe('Cat API', () => {
  let module: Awaited<ReturnType<typeof TestModule.create().compile()>>;

  before(async () => {
    module = await TestModule.create()
      .setControllers([CatController])
      .setPort(4000)
      .compile();
  });

  after(async () => {
    await module.close();
  });

  it('GET /cats - should list cats', async () => {
    const res = await module.client.get('/cats');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.cats).to.have.length(1);
      expect(res.data.cats[0].name).toBe('Fluffy');
    }
  });

  it('GET /cats/:id - should get cat', async () => {
    const res = await module.client.get('/cats/1');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.cat.name).toBe('Fluffy');
    }
  });

  it('POST /cats - should create cat', async () => {
    const res = await module.client.post('/cats', {
      body: { name: 'Whiskers' }
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.created.name).toBe('Whiskers');
    }
  });

  it('GET /cats/999 - should return 404', async () => {
    const res = await module.client.get('/cats/999');
    expect(res.ok).toBe(false);
    expect(res.status).toBe(404);
  });
});
```

---

## ApiClient Usage

The test client (and standalone client) supports:

### GET Request

```typescript
const res = await client.get('/users');
```

### GET with Query

```typescript
const res = await client.get('/users', {
  query: { page: '1', limit: '10' }
});
```

### GET with Params

```typescript
const res = await client.get('/users/:id', {
  params: { id: 123 }
});
```

### POST with Body

```typescript
const res = await client.post('/users', {
  body: { name: 'Alice', email: 'alice@example.com' }
});
```

### PUT/PATCH with Body

```typescript
const res = await client.put('/users/:id', {
  params: { id: 123 },
  body: { name: 'Updated' }
});

const res = await client.patch('/users/:id', {
  params: { id: 123 },
  body: { name: 'Patched' }
});
```

### DELETE

```typescript
const res = await client.delete('/users/:id', {
  params: { id: 123 }
});
```

### File Upload

```typescript
const fileInput = document.getElementById('file') as HTMLInputElement;
const formData = new FormData();
formData.append('avatar', fileInput.files[0]);

const res = await client.upload('/upload', {
  method: 'POST',
  formdata: formData
});
```

### Handle Response

```typescript
if (res.ok) {
  console.log('Success:', res.data);
} else {
  console.error('Error:', res.status, res.data);
}
```

---

## Test with Different Adapters

Test with uWebSockets.js adapter:

```typescript
import { TestModule } from "tspace-spear/testing";
import uWS from "uWebSockets.js";

describe('uWS Adapter Test', () => {
  let module: Awaited<ReturnType<typeof TestModule.create().compile()>>;

  before(async () => {
    const app = new Spear({
      controllers: [UserController],
      adapter: uWS
    });
    
    module = await TestModule.create()
      .setControllers([UserController])
      .compile();
  });

  after(async () => {
    await module.close();
  });

  it('should work with uWS', async () => {
    const res = await module.client.get('/users');
    expect(res.ok).toBe(true);
  });
});
```

---

## Testing Utilities Reference

| Utility | Description | Example |
|---------|-------------|---------|
| `TestingService` | Create and test services | `new TestingService()` |
| `TestingController` | Create and test controllers | `new TestingController()` |
| `TestModule` | E2E testing module | `TestModule.create()` |
| `createTestServer` | Alternative E2E setup | `createTestServer({...})` |
| `createMockService` | Create mock service | `createMockService(Service, {...})` |
| `spyOn` | Spy on method calls | `spyOn(obj, 'method')` |
| `createContext` | Create mock context | `createContext({ params: {...} })` |

---

## Common Patterns

### Test with Multiple Mocks

```typescript
const mockUserService = createMockService(UserService, {...});
const mockEmailService = createMockService(EmailService, {...});

const controller = testing.createController(UserController, {
  mocks: new Map([
    [UserService, mockUserService],
    [EmailService, mockEmailService]
  ])
});
```

### Test Error Handling

```typescript
const mockService = createMockService(UserService, {
  findById: () => { throw new Error('Not found'); }
});

it('should handle errors', () => {
  expect(() => controller.show(ctx)).toThrow('Not found');
});
```

### Test Middleware

```typescript
const middleware: T.ContextHandler = (ctx, next) => {
  if (!ctx.headers.authorization) {
    return ctx.res.unauthorized();
  }
  return next();
};

it('should reject unauthorized', () => {
  const ctx = testing.createContext({});
  const result = middleware(ctx, () => Promise.resolve());
  expect(result).toBeDefined();
});
```

---

## Quick Reference

```typescript
// Unit test service
const testing = new TestingService();
const service = testing.createService(MyService);

// Unit test controller with mock
const mock = createMockService(Dependency, {...});
const controller = testing.createController(MyController, { mocks });

// Create context
const ctx = testing.createContext({ params: {}, body: {} });

// Spy on method
const spy = testing.spyOn(obj, 'methodName');

// E2E test
const module = await TestModule.create()
  .setControllers([MyController])
  .compile();

const res = await module.client.get('/route');
await module.close();
```

---

## Common Mistakes

### ❌ Wrong: Not closing test module

```typescript
before(async () => {
  module = await TestModule.create().compile();
});
// Forgot to close - resource leak!
```

### ✅ Correct: Close after tests

```typescript
before(async () => {
  module = await TestModule.create().compile();
});

after(async () => {
  await module.close();  // Clean up
});
```

### ❌ Wrong: Not using mock in test

```typescript
const mock = createMockService(Service, {...});
const controller = testing.createController(Controller);  // Forgot mocks!
```

### ✅ Correct: Pass mocks

```typescript
const mock = createMockService(Service, {...});
const controller = testing.createController(Controller, {
  mocks: new Map([[Service, mock]])
});
```

### ❌ Wrong: Not checking response ok

```typescript
const res = await client.get('/users');
console.log(res.data);  // May be undefined if error!
```

### ✅ Correct: Check ok first

```typescript
const res = await client.get('/users');
if (res.ok) {
  console.log(res.data);
} else {
  console.error(res.status, res.data);
}