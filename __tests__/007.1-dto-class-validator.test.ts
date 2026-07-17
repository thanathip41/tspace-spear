import { describe, it, before, after } from "mocha";
import { expect } from "chai";
import { Server } from "http";
import {
  Spear,
  Controller,
  Get,
  Post,
  Put,
  ValidateDto,
  type T,
} from "../src/lib";
import { ApiClient } from "../src/lib/core/client";
import {
  IsString,
  IsEmail,
  IsOptional,
  IsNumber,
  MinLength,
  MaxLength,
  IsPositive,
} from "class-validator";

// ============== DTO Classes ==============

class CreateUserDto {
  @IsString()
  @MinLength(2, { message: "Name must be at least 2 characters" })
  @MaxLength(50, { message: "Name must be less than 50 characters" })
  name!: string;

  @IsEmail({}, { message: "Invalid email format" })
  email!: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  password?: string;
}

class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
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
  @IsPositive()
  quantity?: number;
}

// ============== Controllers ==============

@Controller("/users")
class UsersController {
  private users: any[] = [
    { id: 1, name: "Alice", email: "alice@example.com" },
    { id: 2, name: "Bob", email: "bob@example.com" },
  ];

  @Get("/")
  list(): any {
    return { users: this.users };
  }

  @Get("/:id")
  show({ res, params }: T.Context<{ params: { id: number } }>): any {
    const user = this.users.find((u) => u.id === params.id);
    if (!user) {
      throw res.notFound("User not found");
    }
    return { user };
  }

  @Post("/")
  @ValidateDto(CreateUserDto)
  create({ body }: T.Context<{ body: CreateUserDto }>): any {
    const newUser = { id: this.users.length + 1, ...body };
    this.users.push(newUser);
    return { created: newUser };
  }

  @Put("/:id")
  @ValidateDto(UpdateUserDto)
  update({
    res,
    params,
    body,
  }: T.Context<{ params: { id: number }; body: UpdateUserDto }>): any {
    const index = this.users.findIndex((u) => u.id === params.id);
    if (index === -1) {
      throw res.notFound("User not found");
    }
    this.users[index] = { ...this.users[index], ...body };
    return { updated: this.users[index] };
  }
}

@Controller("/products")
class ProductsController {
  private products: any[] = [
    { id: 1, name: "Widget", price: 9.99, quantity: 100 },
  ];

  @Get("/")
  list(): any {
    return { products: this.products };
  }

  @Post("/")
  @ValidateDto(CreateProductDto)
  create({ body }: T.Context<{ body: CreateProductDto }>): any {
    const newProduct = { id: this.products.length + 1, ...body };
    this.products.push(newProduct);
    return { created: newProduct };
  }
}

describe("DTO Class Validator Tests", () => {
  let server: Server;
  let client: ApiClient<any>;

  const app = new Spear({
    logger: true,
    controllers: [UsersController, ProductsController],
  });

  app.useBodyParser();

  before((done) => {
    app.listen(5011, ({ port, server: sCallback }) => {
      server = sCallback;
      client = new ApiClient(`http://localhost:${port}`);
      done();
    });
  });

  after((done) => {
    server?.close(() => done());
  });

  describe("UsersController - CreateUserDto Validation", () => {
    it("should create user with valid data", async () => {
      const res = await client.post("/users", {
        body: {
          name: "Charlie",
          email: "charlie@example.com",
          password: "secret123",
        },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data: any = res.data;
        expect(data.created).to.have.property("name", "Charlie");
        expect(data.created).to.have.property("email", "charlie@example.com");
      }
    });

    it("should reject missing name", async () => {
      const res = await client.post("/users", {
        body: { email: "test@example.com" } as any,
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(422);
      if (!res.ok) {
        const data: any = res.data;
        expect(data).to.have.property("issues");
        expect(data.issues[0]).to.have.property("path", "name");
      }
    });

    it("should reject name too short", async () => {
      const res = await client.post("/users", {
        body: { name: "A", email: "test@example.com" },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(422);
    });

    it("should reject invalid email format", async () => {
      const res = await client.post("/users", {
        body: { name: "Test User", email: "not-an-email" },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(422);
    });

    it("should accept without optional password", async () => {
      const res = await client.post("/users", {
        body: { name: "Diana", email: "diana@example.com" },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });
  });

  describe("UsersController - UpdateUserDto Validation", () => {
    it("should update user with valid partial data", async () => {
      const res = await client.put("/users/1", {
        body: { name: "Alice Updated" },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data: any = res.data;
        expect(data.updated).to.have.property("name", "Alice Updated");
      }
    });

    it("should update user with valid email", async () => {
      const res = await client.put("/users/1", {
        body: { email: "alice.new@example.com" },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });

    it("should reject invalid email in update", async () => {
      const res = await client.put("/users/1", {
        body: { email: "invalid-email" },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(422);
    });

    it("should return 404 for non-existent user", async () => {
      const res = await client.put("/users/999", {
        body: { name: "Test" },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(404);
    });
  });

  describe("ProductsController - CreateProductDto Validation", () => {
    it("should create product with valid data", async () => {
      const res = await client.post("/products", {
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

    it("should reject missing product name", async () => {
      const res = await client.post("/products", {
        body: { price: 19.99 } as any,
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(422);
    });

    it("should reject empty product name", async () => {
      const res = await client.post("/products", {
        body: { name: "", price: 19.99 },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(422);
    });

    it("should reject non-positive price", async () => {
      const res = await client.post("/products", {
        body: { name: "Test", price: 0 },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(422);
    });

    it("should reject negative price", async () => {
      const res = await client.post("/products", {
        body: { name: "Test", price: -10 },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(422);
    });

    it("should accept without optional quantity", async () => {
      const res = await client.post("/products", {
        body: { name: "Simple Product", price: 5.99 },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });
  });
});
