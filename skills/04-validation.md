# Validation & DTO - tspace-spear

## Built-in Validate Decorator

```typescript
import { Controller, Post, Validate, type T } from "tspace-spear";

@Controller('/users')
class UserController {
  @Post('/')
  @Validate(['name', 'email'])  // Fields must exist
  create({ body }: T.Context) {
    return { created: body };
  }
}
```

## Required Validation

```typescript
@Controller('/users')
class UserController {
  @Post('/')
  @Validate(['name', 'email'], { required: true })
  create({ body }: T.Context) {
    return { created: body };
  }

  @Post('/strict')
  @Validate(['name'], { 
    required: { 
      allowNull: false,        // Reject null values
      allowEmptyString: false  // Reject "" values
    } 
  })
  createStrict({ body }: T.Context) {
    return { created: body };
  }
}
```

## Validate Query Parameters

```typescript
@Controller('/search')
class SearchController {
  @Get('/')
  @Validate(['q', 'page'], { target: 'query' })
  search({ query }: T.Context) {
    return { results: [] };
  }
}
```

## Validate Route Parameters

```typescript
@Controller('/users')
class UserController {
  @Get('/:id')
  @Validate(['id'], { target: 'params' })
  show({ params }: T.Context) {
    return { user: params.id };
  }
}
```

## Custom DTO Validator

```typescript
import { createDtoDecorator, type T } from "tspace-spear";

// Custom email validator
const ValidateEmail = (key: string = 'email') => {
  return createDtoDecorator((ctx: T.Context) => {
    const email = ctx.body?.[key];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!email || !emailRegex.test(email)) {
      throw {
        message: 'Validation failed',
        issues: [{ path: key, message: 'Invalid email format' }]
      };
    }
  });
};

@Controller('/users')
class UserController {
  @Post('/')
  @ValidateEmail('email')
  create({ body }: T.Context) {
    return { created: body };
  }
}
```

## Custom Validator with Async

```typescript
const ValidateUniqueEmail = (key: string = 'email') => {
  return createDtoDecorator(
    async (ctx: T.Context) => {
      const email = ctx.body?.[key];
      
      // Check database (async)
      const exists = await db.users.findByEmail(email);
      
      if (exists) {
        throw {
          message: 'Validation failed',
          issues: [{ path: key, message: 'Email already exists' }]
        };
      }
    },
    (ctx, error) => {
      // Custom error handler
      return ctx.res.status(400).json({
        message: error.message,
        issues: error.issues
      });
    }
  );
};
```

## Type Validation

```typescript
const ValidateTypes = (types: Record<string, string>) => {
  return createDtoDecorator((ctx: T.Context) => {
    const body = ctx.body ?? {};
    const issues: Array<{ path: string; message: string }> = [];

    for (const [key, expectedType] of Object.entries(types)) {
      const value = body[key];

      if (value === undefined) {
        issues.push({ path: key, message: `Missing field: ${key}` });
        continue;
      }

      const actualType = Array.isArray(value) ? 'array' : typeof value;

      if (actualType !== expectedType) {
        issues.push({
          path: key,
          message: `Expected '${expectedType}' but got '${actualType}'`
        });
      }
    }

    if (issues.length > 0) {
      throw { message: 'Validation failed', issues };
    }
  });
};

@Controller('/products')
class ProductController {
  @Post('/')
  @ValidateTypes({ name: 'string', price: 'number', active: 'boolean' })
  create({ body }: T.Context) {
    return { created: body };
  }
}
```

## Number Range Validation

```typescript
const ValidateNumberRange = (key: string, min: number, max: number) => {
  return createDtoDecorator((ctx: T.Context) => {
    const value = ctx.body?.[key];
    const issues: Array<{ path: string; message: string }> = [];

    if (value == null) {
      issues.push({ path: key, message: `Missing field: ${key}` });
    } else if (typeof value !== 'number') {
      issues.push({ path: key, message: `Expected number but got '${typeof value}'` });
    } else if (value < min || value > max) {
      issues.push({ path: key, message: `Value must be between ${min} and ${max}` });
    }

    if (issues.length > 0) {
      throw { message: 'Validation failed', issues };
    }
  });
};

@Controller('/products')
class ProductController {
  @Post('/')
  @ValidateNumberRange('price', 0, 10000)
  create({ body }: T.Context) {
    return { created: body };
  }
}
```

## class-validator Integration

First install:
```bash
npm install class-validator class-transformer
```

```typescript
import { IsString, IsInt, Min, IsEmail, IsOptional } from 'class-validator';
import { Controller, Post, ValidateDto, type T } from "tspace-spear";

// DTO Class
class CreateUserDto {
  @IsString()
  name: string;

  @IsInt()
  @Min(18)
  age: number;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  nickname?: string;
}

@Controller('/users')
class UserController {
  @Post('/')
  @ValidateDto(CreateUserDto)  // Auto-validates and transforms
  create({ body }: T.Context<{ body: CreateUserDto }>) {
    return { created: body };
  }
}
```

## Zod Integration

First install:
```bash
npm install zod
```

```typescript
import { z } from 'zod';
import { Controller, Post, ValidateDto, type T } from "tspace-spear";

// Zod Schema
const userSchema = z.object({
  name: z.string().min(1),
  age: z.number().min(18),
  email: z.string().email(),
  nickname: z.string().optional()
});

@Controller('/users')
class UserController {
  @Post('/')
  @ValidateDto(userSchema, { adaptor: 'zod' })
  create({ body }: T.Context<{ body: z.infer<typeof userSchema> }>) {
    return { created: body };
  }
}
```

## Zod with Custom Options

```typescript
@Post('/')
@ValidateDto(userSchema, {
  adaptor: 'zod',
  message: 'Invalid user data',
  status: 422,
  target: 'body'  // or 'query', 'params', 'files'
})
create({ body }: T.Context) {
  return { created: body };
}
```

## Multiple Validators

```typescript
@Controller('/users')
class UserController {
  @Post('/')
  @Validate(['name', 'email'], { required: true })
  @ValidateEmail('email')
  @ValidateNumberRange('age', 0, 150)
  create({ body }: T.Context) {
    return { created: body };
  }
}
```

## Validation Error Response

When validation fails, the response is:

```json
{
  "message": "Validation failed",
  "issues": [
    {
      "path": "email",
      "message": "Invalid email format"
    },
    {
      "path": "name",
      "message": "Missing field"
    }
  ]
}
```

## Custom Error Handler Global

```typescript
const app = new Spear()
  .catch((err: any, { res }: T.Context) => {
    // Handle validation errors
    if (err.issues) {
      return res.status(400).json({
        message: err.message || 'Validation failed',
        issues: err.issues
      });
    }
    
    // Other errors
    return res.status(500).json({
      message: err.message,
      statusCode: 500
    });
  });