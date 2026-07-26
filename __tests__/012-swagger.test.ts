import { describe, it, before, after } from "mocha";
import { expect } from "chai";
import {
  Spear,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Swagger,
  type T,
} from "../src/lib";
import { ApiClient } from "../src/lib/core/client";
import { getAdapter } from "./app/adapter";
import "reflect-metadata";

// ============== Controllers with Swagger ==============

@Controller("/users")
class UsersController {
  private users: Map<number, { id: number; name: string; email: string }> =
    new Map([
      [1, { id: 1, name: "Alice", email: "alice@example.com" }],
      [2, { id: 2, name: "Bob", email: "bob@example.com" }],
    ]);
  private nextId = 3;

  @Get("/")
  @Swagger({
    summary: "Get all users",
    description: "Returns a list of all registered users",
    tags: ["Users"],
    responses: [
      {
        status: 200,
        description: "Successful response",
        example: {
          users: [{ id: 1, name: "Alice", email: "alice@example.com" }],
        },
      },
    ],
  })
  list() {
    return { users: Array.from(this.users.values()) };
  }

  @Get("/:id")
  @Swagger({
    summary: "Get user by ID",
    description: "Returns a single user by their ID",
    tags: ["Users"],
    params: {
      id: { type: "integer", required: true, description: "User ID" },
    },
    responses: [
      { status: 200, description: "Successful response" },
      { status: 404, description: "User not found" },
    ],
  })
  show({ res, params }: T.Context<{ params: { id: number } }>) {
    const user = this.users.get(params.id);
    if (!user) {
      throw res.notFound("User not found");
    }
    return { user };
  }

  @Post("/")
  @Swagger({
    summary: "Create new user",
    description: "Creates a new user with the provided data",
    tags: ["Users"],
    body: {
      required: true,
      description: "User creation data",
      properties: {
        name: { type: "string", required: true },
        email: { type: "string", format: "email", required: true },
        age: { type: "integer", required: false },
      },
    },
    responses: [
      { status: 200, description: "User created successfully" },
      { status: 400, description: "Invalid input" },
    ],
  })
  create({
    body,
  }: T.Context<{ body: { name: string; email: string; age?: number } }>) {
    const id = this.nextId++;
    const user = { id, ...body };
    this.users.set(id, user);
    return { created: user };
  }

  @Put("/:id")
  @Swagger({
    summary: "Update user",
    description: "Updates an existing user",
    tags: ["Users"],
    params: {
      id: { type: "integer", required: true, description: "User ID" },
    },
    responses: [
      { status: 200, description: "User updated successfully" },
      { status: 404, description: "User not found" },
    ],
  })
  update({
    res,
    params,
    body,
  }: T.Context<{
    params: { id: number };
    body: { name?: string; email?: string };
  }>) {
    const user = this.users.get(params.id);
    if (!user) {
      throw res.notFound("User not found");
    }
    const updated = { ...user, ...body };
    this.users.set(params.id, updated);
    return { updated };
  }

  @Delete("/:id")
  @Swagger({
    summary: "Delete user",
    description: "Deletes a user by ID",
    tags: ["Users"],
    params: {
      id: { type: "integer", required: true, description: "User ID" },
    },
    responses: [
      { status: 200, description: "User deleted successfully" },
      { status: 404, description: "User not found" },
    ],
  })
  remove({ res, params }: T.Context<{ params: { id: number } }>) {
    const deleted = this.users.delete(params.id);
    if (!deleted) {
      throw res.notFound("User not found");
    }
    return { deleted: true };
  }
}

@Controller("/products")
class ProductsController {
  private products = [
    { id: 1, name: "Widget", price: 9.99 },
    { id: 2, name: "Gadget", price: 19.99 },
  ];

  @Get("/")
  @Swagger({
    summary: "Get all products",
    description: "Returns a list of all products",
    tags: ["Products"],
    responses: [{ status: 200, description: "List of products" }],
  })
  list() {
    return { products: this.products };
  }

  @Post("/")
  @Swagger({
    summary: "Create product",
    description: "Creates a new product",
    tags: ["Products"],
    body: {
      required: true,
      description: "Product creation data",
      properties: {
        name: { type: "string", required: true },
        price: { type: "number", required: true },
      },
    },
    responses: [{ status: 200, description: "Product created successfully" }],
  })
  create({ body }: T.Context<{ body: { name: string; price: number } }>) {
    const newProduct = { id: this.products.length + 1, ...body };
    this.products.push(newProduct);
    return { created: newProduct };
  }
}

describe("Swagger/OpenAPI Decorator Tests", () => {
  let server;
  let client: ApiClient<any>;
  let app: any;

  const { portOffset, adapter } = getAdapter();

  app = new Spear({
    logger: true,
    adapter,
    controllers: [UsersController, ProductsController],
  });

  app.useBodyParser();
  app.useSwagger("/api/docs", {
    title: "Test API",
    version: "1.0.0",
    description: "Test API for Swagger documentation",
  });

  before((done) => {
    app.listen(5030 + portOffset, ({ port, server: sCallback }: any) => {
      server = sCallback;
      client = new ApiClient(`http://localhost:${port}`);
      done();
    });
  });

  after((done) => {
    done();
  });

  describe("Swagger UI Tests", () => {
    it("should serve Swagger UI at /api/docs", async () => {
      const res = await client.get("/api/docs");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      // Response should contain HTML with Swagger UI elements
      if (res.ok) {
        expect(res.data).to.be.a("string");
        expect(res.data).to.include("SwaggerUI");
        expect(res.data).to.include("swagger-ui");
      }
    });

    it("should serve Swagger static assets", async () => {
      const res = await client.get("/swagger-ui/swagger-ui.css");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });

    it("should include Users endpoints in Swagger spec (embedded in HTML)", async () => {
      const res = await client.get("/api/docs");
      expect(res.ok).to.be.equal(true);
      if (res.ok && typeof res.data === "string") {
        // The spec is embedded in the HTML as JSON
        expect(res.data).to.include("/users");
        expect(res.data).to.include("Get all users");
      }
    });

    it("should include Products endpoints in Swagger spec (embedded in HTML)", async () => {
      const res = await client.get("/api/docs");
      expect(res.ok).to.be.equal(true);
      if (res.ok && typeof res.data === "string") {
        expect(res.data).to.include("/products");
        expect(res.data).to.include("Get all products");
      }
    });

    it("should include user CRUD operations in Swagger spec (embedded in HTML)", async () => {
      const res = await client.get("/api/docs");
      expect(res.ok).to.be.equal(true);
      if (res.ok && typeof res.data === "string") {
        expect(res.data).to.include("post");
        expect(res.data).to.include("put");
        expect(res.data).to.include("delete");
      }
    });
  });

  describe("Functional Tests - Swagger Documented Endpoints", () => {
    it("should return all users (documented endpoint)", async () => {
      const res = await client.get("/users");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        expect(res.data.users).to.be.an("array").with.length.greaterThan(0);
      }
    });

    it("should get user by ID (documented endpoint)", async () => {
      const res = await client.get("/users/1");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        expect(res.data.user).to.have.property("name", "Alice");
      }
    });

    it("should create new user (documented endpoint)", async () => {
      const res = await client.post("/users", {
        body: { name: "Charlie", email: "charlie@example.com" },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });

    it("should update user (documented endpoint)", async () => {
      const res = await client.put("/users/1", {
        body: { name: "Alice Updated" },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });

    it("should delete user (documented endpoint)", async () => {
      const res = await client.delete("/users/3");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });

    it("should return 404 for non-existent user (documented response)", async () => {
      const res = await client.get("/users/999");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(404);
    });
  });

  describe("Functional Tests - Products Controller", () => {
    it("should return all products (documented endpoint)", async () => {
      const res = await client.get("/products");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        expect(res.data.products).to.be.an("array").with.length.greaterThan(0);
      }
    });

    it("should create new product (documented endpoint)", async () => {
      const res = await client.post("/products", {
        body: { name: "New Product", price: 29.99 },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });
  });
});
