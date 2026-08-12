import { describe, it, before, after } from "mocha";
import { expect } from "chai";
import { Spear } from "../src/lib";
import { ApiClient } from "../src/lib/core/client";
import { getAdapter } from "./app/adapter";
import { 
  bodyParser,
  fileUpload,
  cookieParser, 
  auth, 
  rateLimiter, 
  timeout, 
  securityHeaders, 
  requestId, 
  validate 
} from "../src/lib/core/middlewares";

describe("Middleware Unit Tests", () => {
  let server;
  let client: ApiClient<any>;
  let app: any;

  const executionOrder: string[] = [];
  const { portOffset, adapter } = getAdapter();

  before((done) => {
    app = new Spear({ logger: true, adapter })
      .use(bodyParser({ adapter }))
      .use(fileUpload({ adapter }))
      .use(cookieParser())
      .use((ctx, next: any) => {
        executionOrder.push("global-1-start");
        return next();
      })
      .use((ctx, next: any) => {
        executionOrder.push("global-2-start");
        return next();
      })
      .use((ctx, next: any) => {
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
        (ctx, next: any) => {
          executionOrder.push("handler");
          return next();
        },
        (ctx) => {
          return { executed: true };
        },
      )
      .get(
        "/middleware-status",
        (ctx, next: any) => {
          ctx.res.set(201);
          return next();
        },
        (ctx) => {
          return { status: "modified" };
        },
      )
      .get("/cookies-parser", (ctx) => {
        return { cookies: ctx.cookies };
      })
      // Test auth middleware - apply to specific route only
      .get("/auth-test", 
        auth({ 
          type: 'bearer',
          validate: async (token) => token === 'valid-token'
        }),
        (ctx) => {
          return { authenticated: true };
        }
      )
      // Test rate limiter - apply to specific route only
      .get("/rate-limit-test", 
        rateLimiter({ windowMs: 60000, max: 3, usePathMethod: false }),
        () => ({ ok: true })
      )
      // Test timeout middleware - apply to specific route only
      .get("/timeout-test", 
        timeout(100, { message: 'Request took too long' }),
        async (ctx) => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return { ok: true };
        }
      )
      // Test security headers - apply to specific route only
      .get("/security-headers-test",
        securityHeaders(),
        () => ({ ok: true })
      )
      // Test request ID - apply to specific route only
      .get("/request-id-test",
        requestId(),
        (ctx) => ({ ok: true })
      )
      // Test validation - apply to specific route only
      .post("/validate-test",
        validate({
          body: {
            name: { type: 'string', required: true, minLength: 2 },
            age: { type: 'integer', min: 18, max: 100 },
            email: { type: 'email' }
          }
        }),
        (ctx) => ({ valid: true })
      );

    app.listen(5004 + portOffset, ({ port, server: sCallback }: any) => {
      server = sCallback;
      client = new ApiClient(`http://localhost:${port}`);
      done();
    });
  });

  after((done) => {
    console.log("done!!");
    done();
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

  it("should authenticate with valid bearer token", async () => {
    const res = await client.get("/auth-test", {
      headers: { Authorization: 'Bearer valid-token' }
    });
    expect(res.ok).to.be.equal(true);
    expect(res.status).to.be.equal(200);
  });

  it("should reject invalid bearer token", async () => {
    const res = await client.get("/auth-test", {
      headers: { Authorization: 'Bearer invalid-token' }
    });
    expect(res.ok).to.be.equal(false);
    expect(res.status).to.be.equal(401);
  });

  it("should reject requests without auth header", async () => {
    const res = await client.get("/auth-test");
    expect(res.ok).to.be.equal(false);
    expect(res.status).to.be.equal(401);
  });

  it("should allow requests within rate limit", async () => {
    for (let i = 0; i < 3; i++) {
      const res = await client.get("/rate-limit-test");
      expect(res.ok).to.be.equal(true);
    }
  });

  it("should reject requests exceeding rate limit", async () => {
    const res = await client.get("/rate-limit-test");
    expect(res.ok).to.be.equal(false);
    expect(res.status).to.be.equal(429);
  });

  it("should complete request within timeout", async () => {
    const res = await client.get("/timeout-test");
    expect(res.ok).to.be.equal(true);
    expect(res.status).to.be.equal(200);
  });

  it("should add security headers to response", async () => {
    const res = await client.get("/security-headers-test");
    expect(res.ok).to.be.equal(true);
    expect(res.headers.get('x-xss-protection')).to.equal('1; mode=block');
    expect(res.headers.get('x-content-type-options')).to.equal('nosniff');
    expect(res.headers.get('x-frame-options')).to.equal('DENY');
  });

  it("should add request ID to response", async () => {
    const res = await client.get("/request-id-test");
    expect(res.ok).to.be.equal(true);
    expect(res.headers.get('x-request-id')).to.exist;
  });

  it("should pass validation with valid data", async () => {
    const res = await client.post("/validate-test", {
      body: { name: 'John', age: 25, email: 'john@example.com' }
    });
    console.log(res)
    expect(res.ok).to.be.equal(true);
  });

  it("should fail validation with missing required field", async () => {
    const res = await client.post("/validate-test", {
      body: { age: 25 }
    });
    expect(res.ok).to.be.equal(false);
    expect(res.status).to.be.equal(400);
  });

  it("should fail validation with invalid email", async () => {
    const res = await client.post("/validate-test", {
      body: { name: 'John', email: 'invalid' }
    });
    expect(res.ok).to.be.equal(false);
    expect(res.status).to.be.equal(400);
  });

  it("should fail validation with age out of range", async () => {
    const res = await client.post("/validate-test", {
      body: { name: 'John', age: 150 }
    });
    expect(res.ok).to.be.equal(false);
    expect(res.status).to.be.equal(400);
  });
});

describe("Global Prefix Middleware Tests", () => {
  let server;
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
    done();
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
  let server;
  let client: ApiClient<any>;
  let app: any;

  const { portOffset, adapter } = getAdapter();

  app = new Spear({ logger: true, adapter })
    .get("/error", () => {
      throw new Error("Test error");
    })
    .get("/error-with-status", (ctx) => {
      ctx.res.set(422);
      throw new Error("Validation failed");
    })
    .catch((err: any, ctx) => {
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
    done();
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
