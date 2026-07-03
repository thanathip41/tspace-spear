import { describe, it, before, after } from "mocha";
import { expect } from "chai";
import { Server } from "http";
import {
  Spear,
  Controller,
  Post,
  ValidateDto,
  Validate,
  type T,
} from "../src/lib";
import { ApiClient } from "../src/lib/core/client";
import { z } from "zod";

// ============== Zod Schema Tests ==============

// User Zod Schema
const UserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email format"),
  age: z.number().int().positive("Age must be positive").optional(),
});

// Product Zod Schema
const ProductSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  price: z.number().positive("Price must be positive"),
  quantity: z
    .number()
    .int()
    .nonnegative("Quantity must be non-negative")
    .optional(),
});

@Controller("/zod-users")
class ZodUsersController {
  private users: any[] = [];

  @Post("/")
  @ValidateDto(UserSchema, { adaptor: "zod" })
  create({ body }: T.Context<{ body: z.infer<typeof UserSchema> }>): any {
    const newUser = { id: this.users.length + 1, ...body };
    this.users.push(newUser);
    return { created: newUser };
  }

  @Post("/optional")
  @ValidateDto(UserSchema.omit({ age: true }).partial(), { adaptor: "zod" })
  createOptional({ body }: T.Context<{ body: any }>): any {
    return { created: body };
  }
}

@Controller("/zod-products")
class ZodProductsController {
  private products: any[] = [];

  @Post("/")
  @ValidateDto(ProductSchema, { adaptor: "zod" })
  create({ body }: T.Context<{ body: z.infer<typeof ProductSchema> }>): any {
    const newProduct = { id: this.products.length + 1, ...body };
    this.products.push(newProduct);
    return { created: newProduct };
  }
}

// ============== Class Validator DTO Tests ==============

import {
  IsString,
  IsEmail,
  IsOptional,
  IsNumber,
  MinLength,
  IsPositive,
} from "class-validator";

class CreateUserDto {
  @IsString()
  @MinLength(1, { message: "Name is required" })
  name!: string;

  @IsEmail({}, { message: "Invalid email format" })
  email!: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  age?: number;
}

class CreateProductDto {
  @IsString()
  @MinLength(1, { message: "Product name is required" })
  name!: string;

  @IsNumber()
  @IsPositive()
  price!: number;

  @IsOptional()
  @IsNumber()
  quantity?: number;
}

@Controller("/class-users")
class ClassUsersController {
  private users: any[] = [];

  @Post("/")
  @ValidateDto(CreateUserDto)
  create({ body }: T.Context<{ body: CreateUserDto }>): any {
    const newUser = { id: this.users.length + 1, ...body };
    this.users.push(newUser);
    return { created: newUser };
  }
}

@Controller("/class-products")
class ClassProductsController {
  private products: any[] = [];

  @Post("/")
  @ValidateDto(CreateProductDto)
  create({ body }: T.Context<{ body: CreateProductDto }>): any {
    const newProduct = { id: this.products.length + 1, ...body };
    this.products.push(newProduct);
    return { created: newProduct };
  }
}

// ============== Validate Decorator Tests ==============

@Controller("/validate")
class ValidateController {
  @Post("/required")
  @Validate(["name", "email"], { required: true })
  required({ body }: T.Context): any {
    return { received: body };
  }

  @Post("/optional")
  @Validate(["name"], { target: "query" })
  optionalQuery({ query }: T.Context): any {
    return { received: query };
  }

  @Post("/custom-required")
  @Validate(["email", "password"], {
    required: {
      allowNull: false,
      allowEmptyString: false,
    },
  })
  customRequired({ body }: T.Context): any {
    return { received: body };
  }
}

describe("DTO and Zod Validator Tests", () => {
  let server: Server;
  let client: ApiClient<any>;

  const app = new Spear({
    logger: true,
    controllers: [
      ZodUsersController,
      ZodProductsController,
      ClassUsersController,
      ClassProductsController,
      ValidateController,
    ],
  });

  app.useBodyParser();

  before((done) => {
    app.listen(5008, ({ port, server: sCallback }) => {
      server = sCallback;
      client = new ApiClient(`http://localhost:${port}`);
      done();
    });
  });

  after((done) => {
    server?.close(() => done());
  });

  // ============== Zod Validation Tests ==============
  describe("Zod Validation - /zod-users", () => {
    it("should create user with valid data", async () => {
      const res = await client.post("/zod-users", {
        body: { name: "John", email: "john@example.com", age: 25 },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data: any = res.data;
        expect(data.created).to.have.property("name", "John");
        expect(data.created).to.have.property("email", "john@example.com");
      }
    });

    it("should reject invalid email format", async () => {
      const res = await client.post("/zod-users", {
        body: { name: "John", email: "invalid-email", age: 25 },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(422);
    });

    it("should reject missing required name", async () => {
      const res = await client.post("/zod-users", {
        body: { email: "john@example.com", age: 25 },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(422);
    });

    it("should reject empty name", async () => {
      const res = await client.post("/zod-users", {
        body: { name: "", email: "john@example.com" },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(422);
    });

    it("should accept user without optional age", async () => {
      const res = await client.post("/zod-users", {
        body: { name: "Jane", email: "jane@example.com" },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });
  });

  describe("Zod Validation - /zod-products", () => {
    it("should create product with valid data", async () => {
      const res = await client.post("/zod-products", {
        body: { name: "Widget", price: 9.99, quantity: 100 },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data: any = res.data;
        expect(data.created).to.have.property("name", "Widget");
        expect(data.created).to.have.property("price", 9.99);
      }
    });

    it("should reject negative price", async () => {
      const res = await client.post("/zod-products", {
        body: { name: "Widget", price: -5 },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(422);
    });

    it("should reject missing required name", async () => {
      const res = await client.post("/zod-products", {
        body: { price: 9.99 },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(422);
    });
  });

  // ============== Class Validator Tests ==============
  describe("Class Validator - /class-users", () => {
    it("should create user with valid data", async () => {
      const res = await client.post("/class-users", {
        body: { name: "Alice", email: "alice@example.com", age: 30 },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data: any = res.data;
        expect(data.created).to.have.property("name", "Alice");
        expect(data.created).to.have.property("email", "alice@example.com");
      }
    });

    it("should reject invalid email format", async () => {
      const res = await client.post("/class-users", {
        body: { name: "Alice", email: "not-an-email" },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(422);
    });

    it("should reject missing required name", async () => {
      const res = await client.post("/class-users", {
        body: { email: "alice@example.com" },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(422);
    });

    it("should accept user without optional age", async () => {
      const res = await client.post("/class-users", {
        body: { name: "Bob", email: "bob@example.com" },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });
  });

  describe("Class Validator - /class-products", () => {
    it("should create product with valid data", async () => {
      const res = await client.post("/class-products", {
        body: { name: "Gadget", price: 19.99, quantity: 50 },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data: any = res.data;
        expect(data.created).to.have.property("name", "Gadget");
        expect(data.created).to.have.property("price", 19.99);
      }
    });

    it("should reject non-positive price", async () => {
      const res = await client.post("/class-products", {
        body: { name: "Gadget", price: 0 },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(422);
    });
  });

  // ============== Validate Decorator Tests ==============
  describe("Validate Decorator - /validate/required", () => {
    it("should accept valid required fields", async () => {
      const res = await client.post("/validate/required", {
        body: { name: "Test", email: "test@example.com" },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data: any = res.data;
        expect(data.received).to.have.property("name", "Test");
      }
    });

    it("should reject missing required field", async () => {
      const res = await client.post("/validate/required", {
        body: { name: "Test" },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
      if (!res.ok) {
        const data: any = res.data;
        expect(data.issues).to.be.an("array");
        expect(data.issues[0]).to.have.property("path", "email");
      }
    });

    it("should reject null value when allowNull is false", async () => {
      const res = await client.post("/validate/required", {
        body: { name: null, email: "test@example.com" },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });

    it("should reject empty string when allowEmptyString is false", async () => {
      const res = await client.post("/validate/required", {
        body: { name: "", email: "test@example.com" },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });
  });

  describe("Validate Decorator - /validate/optional (query)", () => {
    it("should accept query with name parameter", async () => {
      const res = await client.post("/validate/optional", {
        query: { name: "TestQuery" },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });

    it("should reject missing query parameter", async () => {
      const res = await client.post("/validate/optional");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });
  });

  describe("Validate Decorator - /validate/custom-required", () => {
    it("should accept valid email and password", async () => {
      const res = await client.post("/validate/custom-required", {
        body: { email: "test@example.com", password: "secret123" },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });

    it("should reject null email", async () => {
      const res = await client.post("/validate/custom-required", {
        body: { email: null, password: "secret123" },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });

    it("should reject empty password", async () => {
      const res = await client.post("/validate/custom-required", {
        body: { email: "test@example.com", password: "" },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });
  });
});
