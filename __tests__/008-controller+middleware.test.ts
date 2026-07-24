import { describe, it, before, after } from "mocha";
import { expect } from "chai";
import { Server } from "http";
import { Spear, Controller, Get, Post, Middleware, type T } from "../src/lib";
import { ApiClient } from "../src/lib/core/client";
import { getAdapter } from "./app/adapter";

// Auth middleware function (checks for API key header)
const authMiddleware: T.ContextHandler = (ctx: any, next) => {
  const apiKey = ctx.headers?.["x-api-key"];

  if (!apiKey || apiKey !== "secret-key") {
    return ctx.res.status(401).json({ error: "Unauthorized: Invalid API key" });
  }

  ctx.req.user = { id: 1, name: "Test User" };

  return next();
};

// Role middleware function (checks for admin role)
const roleMiddleware: T.ContextHandler = (ctx: any, next) => {
  const user = ctx.req.user;

  if (!user) {
    return ctx.res.status(401).json({ error: "Unauthorized" });
  }

  // For this simple test, we check a header for role
  const role = ctx.req.headers?.["x-user-role"];

  if (role !== "admin") {
    return ctx.res
      .status(403)
      .json({ error: "Forbidden: Admin access required" });
  }

  return next();
};

@Controller("/public")
class PublicController {
  private items = [
    { id: 1, name: "Public Item 1" },
    { id: 2, name: "Public Item 2" },
  ];

  @Get("/")
  list() {
    return { items: this.items };
  }

  @Get("/:id")
  show({ res, params }: T.Context<{ params: { id: number } }>) {
    const item = this.items.find((i) => i.id === params.id);
    if (!item) {
      throw res.notFound("Item not found");
    }
    return { item };
  }
}

// Protected controller - auth middleware on all route
@Controller("/protected")
class ProtectedController {
  private items = [
    { id: 1, name: "Protected Item 1" },
    { id: 2, name: "Protected Item 2" },
  ];

  @Get("/")
  @Middleware(authMiddleware)
  public list({ req }: T.Context) {
    const user = req.user;
    return { items: this.items, user };
  }

  @Get("/:id")
  @Middleware(authMiddleware)
  show({ res, params }: T.Context<{ params: { id: number } }>) {
    const item = this.items.find((i) => i.id === params.id);
    if (!item) {
      throw res.notFound("Item not found");
    }
    return { item };
  }

  @Post("/")
  @Middleware(authMiddleware)
  create({ body }: T.Context) {
    const newItem = { id: this.items.length + 1, name: body.name };
    this.items.push(newItem);
    return { created: newItem };
  }
}

// Admin controller - method-level middleware for specific routes
@Controller("/admin")
class AdminController {
  private adminStats = { views: 100, clicks: 50 };

  @Get("/stats")
  @Middleware(authMiddleware, roleMiddleware)
  getStats() {
    return { stats: this.adminStats };
  }

  @Get("/logs")
  @Middleware(authMiddleware, roleMiddleware)
  getLogs() {
    return { logs: ["log1", "log2", "log3"] };
  }

  @Post("/clear")
  @Middleware(authMiddleware, roleMiddleware)
  clearStats() {
    this.adminStats = { views: 0, clicks: 0 };
    return { message: "Stats cleared" };
  }
}

// Mixed middleware controller
@Controller("/api")
class ApiController {
  @Get("/public")
  publicEndpoint() {
    return { message: "This is public" };
  }

  @Get("/protected")
  @Middleware(authMiddleware)
  protectedEndpoint({ req }: T.Context) {
    const user = req.user;
    return { message: "This is protected", user };
  }

  @Get("/admin")
  @Middleware(authMiddleware, roleMiddleware)
  adminEndpoint() {
    return { message: "This is admin only" };
  }
}

describe("Controller + Middleware Tests", () => {
  let server: Server;
  let client: ApiClient<any>;
  let app: any;

  const { portOffset, adapter } = getAdapter();

  app = new Spear({
    logger: true,
    adapter,
    controllers: [
      PublicController,
      ProtectedController,
      AdminController,
      ApiController,
    ],
  });

  app.useBodyParser();

  before((done) => {
    app.listen(5010 + portOffset, ({ port, server: sCallback }: any) => {
      server = sCallback;
      client = new ApiClient(`http://localhost:${port}`);
      done();
    });
  });

  after((done) => {
    done()
  });

  describe("PublicController - /public (no middleware)", () => {
    it("should return all items without auth", async () => {
      const res = await client.get("/public");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data = res.data;
        expect(data).to.have.property("items");
        expect(data.items).to.be.an("array").with.length(2);
      }
    });

    it("should get item by id", async () => {
      const res = await client.get("/public/1");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data = res.data;
        expect(data).to.have.property("item");
        expect(data.item).to.have.property("id", 1);
      }
    });

    it("should return 404 for non-existent item", async () => {
      const res = await client.get("/public/999");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(404);
    });
  });

  describe("ProtectedController - /protected (auth middleware)", () => {
    it("should reject request without API key", async () => {
      const res = await client.get("/protected");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(401);
    });

    it("should reject request with invalid API key", async () => {
      const res = await client.get("/protected", {
        headers: { "x-api-key": "wrong-key" },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(401);
    });

    it("should return items with valid API key", async () => {
      const res = await client.get("/protected", {
        headers: { "x-api-key": "secret-key" },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data = res.data;
        expect(data).to.have.property("items");
        expect(data).to.have.property("user");
        expect(data.user).to.have.property("name", "Test User");
      }
    });

    it("should get item by id with valid API key", async () => {
      const res = await client.get("/protected/1", {
        headers: { "x-api-key": "secret-key" },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data = res.data;
        expect(data).to.have.property("item");
        expect(data.item).to.have.property("id", 1);
      }
    });

    it("should create new item with valid API key", async () => {
      const res = await client.post("/protected", {
        headers: { "x-api-key": "secret-key" },
        body: { name: "New Item" },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data = res.data;
        expect(data).to.have.property("created");
        expect(data.created).to.have.property("name", "New Item");
      }
    });
  });

  describe("AdminController - /admin (method-level middleware)", () => {
    it("should reject stats without auth", async () => {
      const res = await client.get("/admin/stats");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(401);
    });

    it("should reject stats with valid auth but no admin role", async () => {
      const res = await client.get("/admin/stats", {
        headers: { "x-api-key": "secret-key" },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(403);
    });

    it("should return stats with valid auth and admin role", async () => {
      const res = await client.get("/admin/stats", {
        headers: {
          "x-api-key": "secret-key",
          "x-user-role": "admin",
        },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data = res.data;
        expect(data).to.have.property("stats");
        expect(data.stats).to.have.property("views");
      }
    });

    it("should return logs with valid auth and admin role", async () => {
      const res = await client.get("/admin/logs", {
        headers: {
          "x-api-key": "secret-key",
          "x-user-role": "admin",
        },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data = res.data;
        expect(data).to.have.property("logs");
        expect(data.logs).to.be.an("array");
      }
    });

    it("should clear stats with valid auth and admin role", async () => {
      const res = await client.post("/admin/clear", {
        headers: {
          "x-api-key": "secret-key",
          "x-user-role": "admin",
        },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data = res.data;
        expect(data).to.have.property("message", "Stats cleared");
      }
    });
  });

  describe("ApiController - /api (mixed middleware)", () => {
    it("should return public endpoint without auth", async () => {
      const res = await client.get("/api/public");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data = res.data;
        expect(data).to.have.property("message", "This is public");
      }
    });

    it("should reject protected endpoint without auth", async () => {
      const res = await client.get("/api/protected");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(401);
    });

    it("should return protected endpoint with valid auth", async () => {
      const res = await client.get("/api/protected", {
        headers: { "x-api-key": "secret-key" },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data = res.data;
        expect(data).to.have.property("message", "This is protected");
        expect(data).to.have.property("user");
      }
    });

    it("should reject admin endpoint without auth", async () => {
      const res = await client.get("/api/admin");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(401);
    });

    it("should reject admin endpoint with auth but no admin role", async () => {
      const res = await client.get("/api/admin", {
        headers: { "x-api-key": "secret-key" },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(403);
    });

    it("should return admin endpoint with valid auth and admin role", async () => {
      const res = await client.get("/api/admin", {
        headers: {
          "x-api-key": "secret-key",
          "x-user-role": "admin",
        },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data = res.data;
        expect(data).to.have.property("message", "This is admin only");
      }
    });
  });
});