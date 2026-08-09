# Spear CLI - Command Line Interface

## Install CLI

```bash
# Install globally
npm install -g tspace-spear

# Check version
spear --version
```

## Create New Project

```bash
# Create new application
spear create new my-app

# Output:
# ✔ Successfully created project "my-app"
#
# 📦 Project Structure
# src/
# ├── common/
# │   └── middlewares/
# │       └── log.middleware.ts
# ├── modules/
# │   └── cats/
# │       ├── cat.controller.ts
# │       ├── cat.service.ts
# │       └── cat.dto.ts
# ├── client.ts
# └── index.ts
```

## Generate Module

```bash
# Generate a complete module (controller + service + dto)
spear generate module users

# Output:
# ✔ Created src/modules/users/users.controller.ts
# ✔ Created src/modules/users/users.service.ts
# ✔ Created src/modules/users/users.dto.ts
```

## Generate Controller

```bash
# Generate controller only
spear generate controller products

# Output:
# ✔ Created src/controllers/products.controller.ts
```

## Generate Service

```bash
# Generate service only
spear generate service orders

# Output:
# ✔ Created src/services/orders.service.ts
```

## Generate Middleware

```bash
# Generate middleware
spear generate middleware auth

# Output:
# ✔ Created src/middlewares/auth.middleware.ts
```

## Generate DTO

```bash
# Generate DTO (Data Transfer Object)
spear generate dto user

# Output:
# ✔ Created src/dtos/user.dto.ts
```

## CLI Options

```bash
# Show help
spear --help

# Show version
spear --version

# Generate with alias
spear g module users    # Same as 'generate'
spear g controller users
spear g service users
spear g middleware users
spear g dto users

# Create with alias
spear c new my-app      # Same as 'create'
```

## Project Structure After Generation

```
my-app/
├── src/
│   ├── common/
│   │   └── middlewares/
│   │       └── log.middleware.ts
│   │
│   ├── modules/
│   │   ├── users/
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   └── users.dto.ts
│   │   └── cats/
│   │       ├── cat.controller.ts
│   │       ├── cat.service.ts
│   │       └── cat.dto.ts
│   │
│   ├── client.ts       # API client for E2E testing
│   └── index.ts        # Main entry point
│
├── package.json
├── tsconfig.json
└── README.md
```

## Generated Controller Template

```typescript
// src/modules/users/users.controller.ts
import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Validate,
  type T 
} from "tspace-spear";

import { UserService } from "./users.service";
import { CreateUserDto } from "./users.dto";

@Controller('/users')
export class UserController {
  constructor(private userService: UserService) {}

  @Get('/')
  list() {
    return { users: this.userService.findAll() };
  }

  @Get('/:id')
  show({ params }: T.Context<{ params: { id: number } }>) {
    return { user: this.userService.findById(params.id) };
  }

  @Post('/')
  @Validate(['name', 'email'], { required: true })
  create({ body }: T.Context) {
    return { created: this.userService.create(body) };
  }

  @Put('/:id')
  update({ params, body }: T.Context) {
    return { updated: { id: params.id, ...body } };
  }

  @Delete('/:id')
  delete({ params }: T.Context) {
    return { deleted: params.id };
  }
}
```

## Generated Service Template

```typescript
// src/modules/users/users.service.ts
export class UserService {
  private users = [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' }
  ];

  findAll() {
    return this.users;
  }

  findById(id: number) {
    return this.users.find(u => u.id === id);
  }

  create(data: { name: string; email: string }) {
    const user = {
      id: this.users.length + 1,
      ...data
    };
    this.users.push(user);
    return user;
  }

  update(id: number, data: any) {
    const index = this.users.findIndex(u => u.id === id);
    if (index === -1) return null;
    this.users[index] = { ...this.users[index], ...data };
    return this.users[index];
  }

  delete(id: number) {
    const index = this.users.findIndex(u => u.id === id);
    if (index === -1) return false;
    this.users.splice(index, 1);
    return true;
  }
}
```

## Generated DTO Template

```typescript
// src/modules/users/users.dto.ts
import { 
  IsString, 
  IsEmail, 
  IsInt, 
  Min,
  IsOptional 
} from "class-validator";

export class CreateUserDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsInt()
  @Min(18)
  @IsOptional()
  age?: number;
}

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsInt()
  @Min(18)
  @IsOptional()
  age?: number;
}
```

## Generated Middleware Template

```typescript
// src/common/middlewares/log.middleware.ts
import { type T } from "tspace-spear";

export const LogMiddleware: T.ContextHandler = (ctx, next) => {
  const start = Date.now();
  
  return next().then(() => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}]`,
      ctx.req.method,
      ctx.req.url,
      `- ${duration}ms`
    );
  });
};
```

## Generated Client Template

```typescript
// src/client.ts
import { ApiClient } from "tspace-spear/client";
import app from "./index";

// Type-safe API client
const client = new ApiClient<typeof app.contract>('http://localhost:8000');

async function main() {
  // List users
  const users = await client.get('/users');
  if (users.ok) {
    console.log('Users:', users.data);
  }

  // Create user
  const created = await client.post('/users', {
    body: { name: 'Charlie', email: 'charlie@example.com' }
  });
  
  if (created.ok) {
    console.log('Created:', created.data);
  }
}

main();
```

## Generated Main Entry

```typescript
// src/index.ts
import Spear, { type T } from "tspace-spear";
import { UserController } from "./modules/users/users.controller";
import { LogMiddleware } from "./common/middlewares/log.middleware";

const app = new Spear({
  logger: true,
  controllers: [UserController],
  middlewares: [LogMiddleware]
})
.useBodyParser()
.useFileUpload()
.useSwagger({
  path: '/api/docs',
  info: {
    title: 'My API',
    version: '1.0.0'
  },
  options: {
    decoratedOnly: false
  }
})
.catch((err: any, { res }: T.Context) => {
  return res.status(500).json({
    message: err.message,
    statusCode: 500
  });
});

const port = Number(process.env.PORT ?? 8000);

app.listen(port, ({ port }) => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Swagger docs at http://localhost:${port}/api/docs`);
});
```

## Run Generated Project

```bash
cd my-app

# Install dependencies
npm install

# Run development server
npm run dev

# Output:
# Server running at http://localhost:8000
# Swagger docs at http://localhost:8000/api/docs
```

## Run E2E Client

```bash
# Run the generated client
npx ts-node src/client.ts

# Output:
# Users: { users: [...] }
# Created: { created: {...} }
```

## Run Tests

```bash
# Run tests
npm test

# Run tests with specific adapter
npm run test:http   # HTTP adapter
npm run test:uws    # uWebSockets adapter
npm run test:net    # Net adapter
```

## Build for Production

```bash
# Build TypeScript to JavaScript
npm run build

# Output in dist/ folder
# dist/
# ├── lib/
# └── cli/
```

## Quick Commands Reference

| Command | Description |
|---------|-------------|
| `spear create new <name>` | Create new project |
| `spear generate module <name>` | Generate complete module |
| `spear generate controller <name>` | Generate controller |
| `spear generate service <name>` | Generate service |
| `spear generate middleware <name>` | Generate middleware |
| `spear generate dto <name>` | Generate DTO |
| `spear g m <name>` | Alias for generate module |
| `spear g c <name>` | Alias for generate controller |
| `spear g s <name>` | Alias for generate service |
| `spear --help` | Show help |
| `spear --version` | Show version |