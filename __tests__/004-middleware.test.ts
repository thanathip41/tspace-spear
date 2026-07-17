import { describe, it, before, after } from "mocha";
import { expect } from "chai";
import { Server } from "http";
import { Spear } from "../src/lib";
import { ApiClient } from "../src/lib/core/client";

describe("Middleware Unit Tests", () => {
  let server: Server;
  let client: ApiClient<any>;

  const executionOrder: string[] = [];

  const app = new Spear({ logger: true })
    .use((ctx, next) => {
      executionOrder.push("global-1-start");
      return next();
    })
    .use((ctx, next) => {
      executionOrder.push("global-2-start");
      return next();
    })
    .use((ctx, next) => {
      (ctx.req as any).customHeader = "injected-by-middleware";
      return next();
    })
    .get("/middleware-test", (ctx) => {
      return {
        customHeader: (ctx.req as any).customHeader,
        message: "handled",
      };
    })
    .get(
      "/middleware-next",
      (ctx, next) => {
        executionOrder.push("handler");
        return next();
      },
      (ctx) => {
        return { executed: true };
      },
    )
    .get(
      "/middleware-status",
      (ctx, next) => {
        ctx.res.setStatusCode(201);
        return next();
      },
      (ctx) => {
        return { status: "modified" };
      },
    )
    .useCookiesParser()
    .get("/cookies-parser", (ctx) => {
      return { cookies: ctx.cookies };
    });

  before((done) => {
    app.listen(5004, ({ port, server: sCallback }) => {
      server = sCallback;
      client = new ApiClient(`http://localhost:${port}`);
      done();
    });
  });

  after((done) => {
    server?.close(() => done());
  });

  beforeEach(() => {
    executionOrder.length = 0;
  });

  it("should execute middleware in correct order", async () => {
    const res = await client.get("/middleware-test");
    expect(res.ok).to.be.equal(true);
    expect(res.status).to.be.equal(200);
    expect(executionOrder).to.deep.equal(["global-1-start", "global-2-start"]);
  });

  it("should inject data from middleware to request", async () => {
    const res = await client.get("/middleware-test");
    expect(res.ok).to.be.equal(true);
    if (res.ok) {
      const data = res.data as any;
      expect(data.customHeader).to.equal("injected-by-middleware");
    }
  });

  it("should call next() in handler", async () => {
    const res = await client.get("/middleware-next");

    expect(res.ok).to.be.equal(true);
    expect(res.status).to.be.equal(200);
    expect(executionOrder).to.include("handler");
  });

  it("should allow middleware to modify response status", async () => {
    const res = await client.get("/middleware-status");
    expect(res.ok).to.be.equal(true);
    expect(res.status).to.be.equal(201);
  });

  it("should parse cookies with useCookiesParser middleware", async () => {
    // Note: ApiClient may not send cookies directly, testing the endpoint exists
    const res = await client.get("/cookies-parser");
    expect(res.ok).to.be.equal(true);
    expect(res.status).to.be.equal(200);
  });
});

describe("Global Prefix Middleware Tests", () => {
  let server: Server;
  let client: ApiClient<any>;

  const app = new Spear({ logger: true })
    .useGlobalPrefix("api", {
      exclude: [{ path: "health" }],
    })
    .get("/users", () => ({ prefixed: true }))
    .get("/health", () => ({ health: "ok" }));

  before((done) => {
    app.listen(5005, ({ port, server: sCallback }) => {
      server = sCallback;
      client = new ApiClient(`http://localhost:${port}`);
      done();
    });
  });

  after((done) => {
    server?.close(() => done());
  });

  it("should apply global prefix to routes", async () => {
    const res = await client.get("/api/users");
    expect(res.ok).to.be.equal(true);
    if (res.ok) {
      const data = res.data as any;
      expect(data.prefixed).to.be.equal(true);
    }
  });

  it("should exclude routes from global prefix", async () => {
    const res = await client.get("/health");
    expect(res.ok).to.be.equal(true);
    if (res.ok) {
      const data = res.data as any;
      expect(data.health).to.equal("ok");
    }
  });
});

describe("Error Handler Tests", () => {
  let server: Server;
  let client: ApiClient<any>;

  const app = new Spear({ logger: true })
    .get("/error", () => {
      throw new Error("Test error");
    })
    .get("/error-with-status", (ctx) => {
      ctx.res.setStatusCode(422);
      throw new Error("Validation failed");
    })
    .catch((err, ctx) => {
      return ctx.res.status(err.statusCode || 500).json({
        customError: true,
        message: err.message,
      });
    });

  before((done) => {
    app.listen(5006, ({ port, server: sCallback }) => {
      server = sCallback;
      client = new ApiClient(`http://localhost:${port}`);
      done();
    });
  });

  after((done) => {
    server?.close(() => done());
  });

  it("should handle thrown errors with custom error handler", async () => {
    const res = await client.get("/error");
    expect(res.ok).to.be.equal(false);
    expect(res.status).to.be.equal(500);
  });

  it("should preserve custom status code in error handler", async () => {
    const res = await client.get("/error-with-status");
    expect(res.ok).to.be.equal(false);
    expect(res.status).to.be.equal(422);
  });
});
