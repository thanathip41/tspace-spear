import { describe, it, before, after } from "mocha";
import { expect } from "chai";
import { Server } from 'http';
import { Spear, Controller, Get, Post, Put, Delete, Service, type T } from "../src/lib";
import { ApiClient } from "../src/lib/core/client";

// ============== Services ==============

@Service()
class UserService {
  
  private users: Map<number, { id: number; name: string; email: string }> = new Map([
    [1, { id: 1, name: "Alice", email: "alice@example.com" }],
    [2, { id: 2, name: "Bob", email: "bob@example.com" }],
  ]);

  private nextId = 3;

  public findAll() {
    return Array.from(this.users.values());
  }

  public findById(id: number) {
    return this.users.get(id);
  }

  public findByName(name: string): Array<{ id: number; name: string; email: string }> {
    return Array.from(this.users.values()).filter(u => u.name === name);
  }

  public create(name: string, email: string) {
    const id = this.nextId++;
    const user = { id, name, email };
    this.users.set(id, user);
    return user;
  }

  public update(
    id: number, 
    data: Partial<{ name: string; email: string }>
  ) {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...data };
    this.users.set(id, updated);
    return updated;
  }

  public delete(id: number): boolean {
    return this.users.delete(id);
  }

  public count(): number {
    return this.users.size;
  }
}

class ProductService {
  private products: Map<number, { id: number; name: string; price: number }> = new Map([
    [1, { id: 1, name: "Widget", price: 9.99 }],
    [2, { id: 2, name: "Gadget", price: 19.99 }],
  ]);
  private nextId = 3;

  findAll(): Array<{ id: number; name: string; price: number }> {
    return Array.from(this.products.values());
  }

  findById(id: number): { id: number; name: string; price: number } | undefined {
    return this.products.get(id);
  }

  create(name: string, price: number): { id: number; name: string; price: number } {
    const id = this.nextId++;
    const product = { id, name, price };
    this.products.set(id, product);
    return product;
  }

  delete(id: number): boolean {
    return this.products.delete(id);
  }
}

class OrderService {
  private orders: Map<number, { id: number; userId: number; products: number[]; total: number }> = new Map();
  private nextId = 1;

  create(userId: number, products: number[], total: number): { id: number; userId: number; products: number[]; total: number } {
    const id = this.nextId++;
    const order = { id, userId, products, total };
    this.orders.set(id, order);
    return order;
  }

  findById(id: number): { id: number; userId: number; products: number[]; total: number } | undefined {
    return this.orders.get(id);
  }

  findByUserId(userId: number): Array<{ id: number; userId: number; products: number[]; total: number }> {
    return Array.from(this.orders.values()).filter(o => o.userId === userId);
  }
}

// ============== Controllers ==============
@Controller('/users')
@Service(UserService)
class UsersController {
  constructor(private userService: UserService){}

  // @ts-ignore - decorator type inference
  @Get('/')
  list() {
    return { users: this.userService.findAll() };
  }

  // @ts-ignore - decorator type inference
  @Get('/:id')
  show({ res, params }: T.Context<{ params: { id: number } }>) {
    const user = this.userService.findById(params.id);
    if (!user) {
      throw res.notFound("User not found");
    }
    return { user };
  }

  // @ts-ignore - decorator type inference
  @Get('/search/:name')
  searchByName({ res, params }: T.Context<{ params: { name: string } }>) {
    const users = this.userService.findByName(params.name);
    if (users.length === 0) {
      throw res.notFound("No users found with that name");
    }
    return { users, count: users.length };
  }

  // @ts-ignore - decorator type inference
  @Post('/')
  create({ body, res }: T.Context) {
    const { name, email } = body as { name: string; email: string };
    
    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    const user = this.userService.create(name, email);
    return { created: user, total: this.userService.count() };
  }

  // @ts-ignore - decorator type inference
  @Put('/:id')
  update({ res, params, body }: T.Context) {
    const user = this.userService.update(params.id as number, body);
    if (!user) {
      throw res.notFound("User not found");
    }
    return { updated: user };
  }

  // @ts-ignore - decorator type inference
  @Delete('/:id')
  remove({ res, params }: T.Context) {
    const deleted = this.userService.delete(params.id as number);
    if (!deleted) {
      throw res.notFound("User not found");
    }
    return { deleted: true, remaining: this.userService.count() };
  }

  // @ts-ignore - decorator type inference
  @Get('/stats/count')
  count() {
    return { count: this.userService.count() };
  }
}

@Controller('/products')
@Service(ProductService)
class ProductsController {

  constructor(private productService: ProductService) {}

  // @ts-ignore - decorator type inference
  @Get('/')
  list() {
    return { products: this.productService.findAll() };
  }

  // @ts-ignore - decorator type inference
  @Get('/:id')
  show({ res, params }: T.Context<{ params: { id: number } }>) {
    const product = this.productService.findById(params.id);
    if (!product) {
      throw res.notFound("Product not found");
    }
    return { product };
  }

  // @ts-ignore - decorator type inference
  @Post('/')
  create({ body, res }: T.Context) {
    const { name, price } = body as { name: string; price: number };
    
    if (!name || typeof price !== 'number') {
      return res.status(400).json({ error: "Name and price are required" });
    }

    const product = this.productService.create(name, price);
    return { created: product };
  }

  // @ts-ignore - decorator type inference
  @Delete('/:id')
  remove({ res, params }: T.Context) {
    const deleted = this.productService.delete(params.id as number);
    if (!deleted) {
      throw res.notFound("Product not found");
    }
    return { deleted: true };
  }
}

@Controller('/orders')
@Service(OrderService, UserService)
class OrdersController {

  constructor(
    private orderService: OrderService,
    private userService : UserService
  ){}

  // @ts-ignore - decorator type inference
  @Post('/')
  create({ body, res }: T.Context) {
    const { userId, products, total } = body as { userId: number; products: number[]; total: number };
    
    // Verify user exists
    const user = this.userService.findById(userId);
    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    const order = this.orderService.create(userId, products, total);
    return { created: order };
  }

  // @ts-ignore - decorator type inference
  @Get('/:id')
  show({ res, params }: T.Context<{ params: { id: number } }>) {
    const order = this.orderService.findById(params.id);
    if (!order) {
      throw res.notFound("Order not found");
    }
    
    // Include user info
    const user = this.userService.findById(order.userId);
    return { order, user };
  }

  // @ts-ignore - decorator type inference
  @Get('/user/:userId')
  findByUser({ res, params }: T.Context<{ params: { userId: number } }>) {
    // Verify user exists
    const user = this.userService.findById(params.userId);
    if (!user) {
      throw res.notFound("User not found");
    }

    const orders = this.orderService.findByUserId(params.userId);
    return { orders, user };
  }
}

describe("Controller + Service Tests (no DTO)", () => {
  
  let server: Server;
  let client: ApiClient<any>;

  const app = new Spear({
    logger: false,
    controllers: [
      UsersController,
      ProductsController,
      OrdersController
    ]
  });

  app.useBodyParser();

  before((done) => {
    app.listen(5014, ({ port, server: sCallback }) => {
      server = sCallback;
      client = new ApiClient(`http://localhost:${port}`);
      done();
    });
  });

  after((done) => {
    server?.close(() => done());
  });

  describe("UsersController - /users", () => {
    it("should list all users", async () => {
      const res = await client.get("/users");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data = res.data;
        expect(data.users).to.be.an("array").with.length(2);
      }
    });

    it("should get user by id", async () => {
      const res = await client.get("/users/1");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data = res.data;
        expect(data.user).to.have.property("name", "Alice");
      }
    });

    it("should return 404 for non-existent user", async () => {
      const res = await client.get("/users/999");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(404);
    });

    it("should search users by name", async () => {
      const res = await client.get("/users/search/Alice");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data = res.data;
        expect(data.users).to.be.an("array").with.length(1);
        expect(data.count).to.equal(1);
      }
    });

    it("should return 404 when no users found by name", async () => {
      const res = await client.get("/users/search/NonExistent");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(404);
    });

    it("should create new user", async () => {
      const res = await client.post("/users", {
        body: { name: "Charlie", email: "charlie@example.com" }
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data = res.data;
        expect(data.created).to.have.property("name", "Charlie");
        expect(data.total).to.equal(3);
      }
    });

    it("should reject creation without name", async () => {
      const res = await client.post("/users", {
        body: { email: "test@example.com" } as any
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });

    it("should reject creation without email", async () => {
      const res = await client.post("/users", {
        body: { name: "Test" } as any
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });

    it("should update user", async () => {
      const res = await client.put("/users/1", {
        body: { name: "Alice Updated" }
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data = res.data;
        expect(data.updated).to.have.property("name", "Alice Updated");
      }
    });

    it("should return 404 when updating non-existent user", async () => {
      const res = await client.put("/users/999", {
        body: { name: "Test" }
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(404);
    });

    it("should delete user", async () => {
      // First create a user to delete
      await client.post("/users", {
        body: { name: "ToDelete", email: "delete@example.com" }
      });
      
      const res = await client.delete("/users/4");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data = res.data;
        expect(data.deleted).to.be.true;
      }
    });

    it("should return 404 when deleting non-existent user", async () => {
      const res = await client.delete("/users/999");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(404);
    });

    it("should get user count", async () => {
      const res = await client.get("/users/stats/count");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data = res.data;
        expect(data.count).to.be.a("number");
      }
    });
  });

  describe("ProductsController - /products", () => {
    it("should list all products", async () => {
      const res = await client.get("/products");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data = res.data;
        expect(data.products).to.be.an("array").with.length(2);
      }
    });

    it("should get product by id", async () => {
      const res = await client.get("/products/1");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data = res.data;
        expect(data.product).to.have.property("name", "Widget");
      }
    });

    it("should return 404 for non-existent product", async () => {
      const res = await client.get("/products/999");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(404);
    });

    it("should create new product", async () => {
      const res = await client.post("/products", {
        body: { name: "New Product", price: 29.99 }
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data = res.data;
        expect(data.created).to.have.property("name", "New Product");
      }
    });

    it("should reject creation without name", async () => {
      const res = await client.post("/products", {
        body: { price: 10 } as any
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });

    it("should reject creation without price", async () => {
      const res = await client.post("/products", {
        body: { name: "Test" } as any
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });

    it("should delete product", async () => {
      const res = await client.delete("/products/3");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data = res.data;
        expect(data.deleted).to.be.true;
      }
    });
  });

  describe("OrdersController - /orders (with multiple services)", () => {
    it("should create order with valid user", async () => {
      const res = await client.post("/orders", {
        body: { userId: 1, products: [1, 2], total: 29.98 }
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data = res.data;
        expect(data.created).to.have.property("userId", 1);
      }
    });

    it("should reject order with invalid user", async () => {
      const res = await client.post("/orders", {
        body: { userId: 999, products: [1], total: 10 }
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });

    it("should get order with user info", async () => {
      const res = await client.get("/orders/1");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data = res.data;
        expect(data.order).to.exist;
        expect(data.user).to.exist;
      }
    });

    it("should return 404 for non-existent order", async () => {
      const res = await client.get("/orders/999");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(404);
    });

    it("should get orders by user", async () => {
      const res = await client.get("/orders/user/1");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data = res.data;
        expect(data.orders).to.be.an("array");
        expect(data.user).to.exist;
      }
    });

    it("should return 404 for orders by non-existent user", async () => {
      const res = await client.get("/orders/user/999");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(404);
    });
  });

});