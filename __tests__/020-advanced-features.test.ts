import { describe, it, before, after } from "mocha";
import { expect } from "chai";
import { Server } from "http";
import { Spear, Controller, Get, Post, Delete, type T } from "../src/lib";
import { ApiClient } from "../src/lib/core/client";
import { getAdapter } from "./app/adapter";

// ============== Cache Test Controller ==============

@Controller("/cache")
class CacheController {
  private cache = new Map<string, { data: any; expiry: number }>();

  @Get("/set/:key/:value")
  setCache(
    { params, query }: T.Context<{ params: { key: string; value: string } }>
  ) {
    const ttl = query.ttl ? parseInt(query.ttl) : 60000;

    const key = decodeURIComponent(params.key);
    const value = decodeURIComponent(params.value);

    this.cache.set(key, {
      data: value,
      expiry: Date.now() + ttl,
    });

    return {
      success: true,
      key,
      value,
    };
  }

  @Get("/get/:key")
  getCache({ params, res }: T.Context<{ params: { key: string } }>) {
    const item = this.cache.get(params.key);
    if (!item) {
      throw res.notFound("Key not found");
    }
    if (Date.now() > item.expiry) {
      this.cache.delete(params.key);
      throw res.notFound("Key expired");
    }
    return { key: params.key, value: item.data };
  }

  @Delete("/clear")
  clearCache() {
    this.cache.clear();
    return { success: true, message: "Cache cleared" };
  }
}

// ============== Global Prefix Test Controller ==============

@Controller("/users")
class PrefixController {
  private users = [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ];

  @Get("/")
  list() {
    return { users: this.users };
  }

  @Get("/:id")
  get({ params, res }: T.Context<{ params: { id: number } }>) {
    const user = this.users.find((u) => u.id === params.id);
    if (!user) {
      throw res.notFound("User not found");
    }
    return { user };
  }
}

// ============== Middleware Chain Test Controller ==============

const middlewareLog: string[] = [];

function createLoggingMiddleware(name: string) {
  return (ctx: T.Context, next: T.NextFunction) => {
    middlewareLog.push(`${name}-before`);
    return next().then(() => {
      middlewareLog.push(`${name}-after`);
    });
  };
}

@Controller("/middleware-chain")
class MiddlewareChainController {
  @Get("/test")
  test() {
    middlewareLog.push("handler");
    return { middlewareLog: [...middlewareLog] };
  }

  @Get("/clear")
  clear() {
    middlewareLog.length = 0;
    return { success: true };
  }
}

describe("Advanced Features Tests", () => {
  let portOffset: number;
  let adapter: any;

  const adapterConfig = getAdapter();
  portOffset = adapterConfig.portOffset;
  adapter = adapterConfig.adapter;

  describe("Cache Tests", () => {
    let server: Server;
    let client: ApiClient<any>;

    before((done) => {
      const cacheApp = new Spear({
        logger: false,
        adapter,
        controllers: [CacheController],
      });
      cacheApp.useBodyParser();

      cacheApp.listen(5110 + portOffset, ({ port, server: sCallback }: any) => {
        server = sCallback;
        client = new ApiClient(`http://localhost:${port}`);
        done();
      });
    });

    after((done) => {
      done();
    });

    it("should set cache value", async () => {
      const res = await client.get("/cache/set/testkey/testvalue?ttl=60000");
      expect(res.ok).to.be.equal(true);
      expect(res.data.success).to.be.equal(true);
    });

    it("should set a cache value with URL-encoded key and value", async () => {
      const res = await client.get(
        "/cache/set/test-key%40special/test%20value?ttl=60000"
      );

      expect(res.ok).to.equal(true);
      expect(res.data.success).to.equal(true);
      expect(res.data.key).to.equal("test-key@special");
    });
  
    it("should get cached value", async () => {
      const res = await client.get("/cache/get/testkey");
      expect(res.ok).to.be.equal(true);
      expect(res.data.value).to.equal("testvalue");
    });

    it("should return 404 for non-existent key", async () => {
      const res = await client.get("/cache/get/nonexistent");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(404);
    });

    it("should clear cache", async () => {
      const res = await client.delete("/cache/clear");
      expect(res.ok).to.be.equal(true);
      
      // Verify cache is cleared
      const getRes = await client.get("/cache/get/testkey");
      expect(getRes.ok).to.be.equal(false);
    });

    it("should handle expired cache", async () => {
      // Set cache with 100ms TTL
      await client.get("/cache/set/shortkey/shortvalue?ttl=100");
      
      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 150));
      
      // Should be expired now
      const res = await client.get("/cache/get/shortkey");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(404);
    });

    it("should handle cache with special characters in key", async () => {
      const res = await client.get("/cache/set/test-key%40special/test%20value?ttl=60000");
      expect(res.ok).to.be.equal(true);
      expect(res.data.success).to.be.equal(true);
      expect(res.data.key).to.include("test-key");
    });
  });

  describe("Global Prefix Tests", () => {
    let prefixClient: ApiClient<any>;
    let prefixServer: Server;

    before((done) => {
      const prefixApp = new Spear({
        logger: false,
        adapter,
        controllers: [PrefixController],
      });
      prefixApp.useBodyParser();
      prefixApp.useGlobalPrefix("api/v1");

      prefixApp.listen(5112 + portOffset, ({ port, server: sCallback }: any) => {
        prefixServer = sCallback;
        prefixClient = new ApiClient(`http://localhost:${port}`);
        done();
      });
    });

    after((done) => {
      done();
    });

    it("should access endpoint with global prefix", async () => {
      const res = await prefixClient.get("/api/v1/users");
      expect(res.ok).to.be.equal(true);
      expect(res.data.users).to.be.an("array");
    });

    it("should return 404 without global prefix", async () => {
      const res = await prefixClient.get("/users");
      expect(res.ok).to.be.equal(false);
    });

    it("should access nested endpoint with global prefix", async () => {
      const res = await prefixClient.get("/api/v1/users/1");
      expect(res.ok).to.be.equal(true);
      expect(res.data.user.name).to.equal("Alice");
    });
  });

  describe("Middleware Tests", () => {
    let chainClient: ApiClient<any>;
    let chainServer: Server;

    before((done) => {
      const chainApp = new Spear({
        logger: false,
        adapter,
        controllers: [MiddlewareChainController],
      });
      chainApp.useBodyParser();
      
      // Add middleware chain
      chainApp.use(createLoggingMiddleware("mw1"));

      chainApp.listen(5113 + portOffset, ({ port, server: sCallback }: any) => {
        chainServer = sCallback;
        chainClient = new ApiClient(`http://localhost:${port}`);
        done();
      });
    });

    after((done) => {
      done();
    });

    beforeEach(async () => {
      await chainClient.get("/middleware-chain/clear");
      middlewareLog.length = 0;
    });

    it("should execute middleware", async () => {
      const res = await chainClient.get("/middleware-chain/test");
      
      // Middleware should have been executed
      expect(middlewareLog.length).to.be.greaterThan(0);
      expect(middlewareLog).to.include("mw1-before");
    });

    it("should execute handler after middleware", async () => {
      const res = await chainClient.get("/middleware-chain/test");
      
      // Handler should log "handler"
      expect(middlewareLog).to.include("handler");
    });

    it("should track middleware execution", async () => {
      await chainClient.get("/middleware-chain/clear");
      middlewareLog.length = 0;
      
      const res = await chainClient.get("/middleware-chain/test");
      
      // Verify middleware log is tracked
      expect(middlewareLog.length).to.be.greaterThan(0);
    });

    it("should reset middleware log on clear", async () => {
      await chainClient.get("/middleware-chain/clear");
      expect(middlewareLog.length).to.equal(0);
    });
  });
})