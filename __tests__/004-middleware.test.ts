import { describe, it, before, after } from "mocha";
import { expect } from "chai";
import { Server } from "http";
import { Spear } from "../src/lib";
import { ApiClient } from "../src/lib/core/client";
import { getAdapter } from "./app/adapter";

describe("Middleware Unit Tests", () => {
  let server: Server;
  let client: ApiClient<any>;
  let app: any;

  const executionOrder: string[] = [];
  const { portOffset, adapter } = getAdapter();

  before((done) => {
    app = new Spear({ logger: true, adapter })
      .use((ctx: any, next: any) => {
        executionOrder.push("global-1-start");
        return next();
      })
      .use((ctx: any, next: any) => {
        executionOrder.push("global-2-start");
        return next();
      })
      .use((ctx: any, next: any) => {
        (ctx.req as any).customHeader = "injected-by-middleware";
        return next();
      })
      .get("/middleware-test", (ctx: any) => {
        return {
          customHeader: (ctx.req as any).customHeader,
          message: "handled",
        };
      })
      .get(
        "/middleware-next",
        (ctx: any, next: any) => {
          executionOrder.push("handler");
          return next();
        },
        (ctx: any) => {
          return { executed: true };
        },
      )
      .get(
        "/middleware-status",
        (ctx: any, next: any) => {
          ctx.res.set(201);
          return next();
        },
        (ctx: any) => {
          return { status: "modified" };
        },
      )
      .useCookiesParser()
      .get("/cookies-parser", (ctx: any) => {
        return { cookies: ctx.cookies };
      });

    app.listen(5004 + portOffset, ({ port, server: sCallback }: any) => {
      server = sCallback;
      client = new ApiClient(`http://localhost:${port}`);
      done();
    });
  });

  after((done) => {
    console.log('done!!')
    done()
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
    const res = await client.get("/cookies-parser");
    expect(res.ok).to.be.equal(true);
    expect(res.status).to.be.equal(200);
  });
});

describe("Global Prefix Middleware Tests", () => {
  let server: Server;
  let client: ApiClient<any>;
  let app: any;

  const { portOffset, adapter } = getAdapter();

  app = new Spear({ logger: true, adapter })
    .useGlobalPrefix("api", {
      exclude: [{ path: "health" }],
    })
    .get("/users", () => ({ prefixed: true }))
    .get("/health", () => ({ health: "ok" }));

  before((done) => {
    app.listen(5005 + portOffset, ({ port, server: sCallback }: any) => {
      server = sCallback;
      client = new ApiClient(`http://localhost:${port}`);
      done();
    });
  });

  after((done) => {
    done()
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
  let app: any;

  const { portOffset, adapter } = getAdapter();

  app = new Spear({ logger: true, adapter })
    .get("/error", () => {
      throw new Error("Test error");
    })
    .get("/error-with-status", (ctx: any) => {
      ctx.res.set(422);
      throw new Error("Validation failed");
    })
    .catch((err: any, ctx: any) => {
      return ctx.res.status(err.statusCode || 500).json({
        customError: true,
        message: err.message,
      });
    });

  before((done) => {
    app.listen(5006 + portOffset, ({ port, server: sCallback }: any) => {
      server = sCallback;
      client = new ApiClient(`http://localhost:${port}`);
      done();
    });
  });

  after((done) => {
    done()
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