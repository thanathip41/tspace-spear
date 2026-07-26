import { describe, it, before, after } from "mocha";
import { expect } from "chai";
import { Spear, Controller, Get, Post, Middleware, type T } from "../src/lib";
import { ApiClient } from "../src/lib/core/client";
import { getAdapter } from "./app/adapter";

// ============== Security Middleware ==============

const rateLimitMiddleware = (maxRequests: number, windowMs: number) => {
  const requests: Map<string, { count: number; resetTime: number }> = new Map();

  return (ctx: T.Context, next: T.NextFunction) => {
    const ip = (ctx.ip as string) || "unknown";
    const now = Date.now();
    const record = requests.get(ip);

    if (!record || now > record.resetTime) {
      requests.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    record.count++;
    if (record.count > maxRequests) {
      return ctx.res.status(429).json({
        error: "Too many requests",
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      });
    }

    return next();
  };
};

const csrfMiddleware = (ctx: T.Context, next: T.NextFunction) => {
  const token = ctx.headers["x-csrf-token"];

  if (!token || token !== "valid-csrf-token") {
    return ctx.res.status(403).json({
      error: "CSRF token missing or invalid",
    });
  }

  return next();
};

// ============== Controllers ==============

@Controller("/security")
class SecurityController {
  @Get("/info")
  info() {
    return { message: "Security test endpoint" };
  }

  @Post("/echo")
  echo({ body }: T.Context) {
    return { received: body };
  }

  @Post("/csrf-protected")
  @Middleware(csrfMiddleware)
  csrfProtected({ body }: T.Context) {
    return { protected: true, received: body };
  }

  @Get("/headers-check")
  securityHeaders({ headers }: T.Context) {
    return {
      hasContentType: !!headers["content-type"],
      hasAuthorization: !!headers["authorization"],
      hasCookie: !!headers["cookie"],
    };
  }
}

@Controller("/rate-limited")
class RateLimitedController {
  @Get("/resource")
  @Middleware(rateLimitMiddleware(5, 10000)) // 5 requests per 10 seconds
  resource() {
    return { data: "Protected resource" };
  }
}

@Controller("/input-validation")
class InputValidationController {
  @Post("/text")
  text({ body }: T.Context) {
    const { text } = body as { text?: string };
    if (!text || typeof text !== "string") {
      return { error: "Invalid input" };
    }
    return { received: text, length: text.length };
  }

  @Post("/number")
  number({ body }: T.Context) {
    const { value } = body as { value?: number };
    if (typeof value !== "number" || isNaN(value)) {
      return { error: "Invalid number" };
    }
    return { received: value, doubled: value * 2 };
  }

  @Post("/array")
  array({ body }: T.Context) {
    const { items } = body as { items?: any[] };
    if (!Array.isArray(items)) {
      return { error: "Invalid array" };
    }
    return { count: items.length, items };
  }
}

describe("Security Tests", () => {
  let server;
  let client: ApiClient<any>;
  let app: any;

  const { portOffset, adapter } = getAdapter();

  app = new Spear({
    logger: true,
    adapter,
    controllers: [
      SecurityController,
      RateLimitedController,
      InputValidationController,
    ],
  });

  app.useBodyParser();

  before((done) => {
    app.listen(5033 + portOffset, ({ port, server: sCallback }: any) => {
      server = sCallback;
      client = new ApiClient(`http://localhost:${port}`);
      done();
    });
  });

  after((done) => {
    done();
  });

  describe("CSRF Protection Tests", () => {
    it("should reject request without CSRF token", async () => {
      const res = await client.post("/security/csrf-protected", {
        body: { data: "test" },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(403);
    });

    it("should reject request with invalid CSRF token", async () => {
      const res = await client.post("/security/csrf-protected", {
        body: { data: "test" },
        headers: { "X-CSRF-Token": "invalid-token" },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(403);
    });

    it("should accept request with valid CSRF token", async () => {
      const res = await client.post("/security/csrf-protected", {
        body: { data: "test" },
        headers: { "X-CSRF-Token": "valid-csrf-token" },
      });
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data.protected).to.be.true;
      }
    });

    it("should reject empty CSRF token", async () => {
      const res = await client.post("/security/csrf-protected", {
        body: { data: "test" },
        headers: { "X-CSRF-Token": "" },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(403);
    });
  });

  describe("Rate Limiting Tests", () => {
    it("should allow requests within limit", async () => {
      for (let i = 0; i < 5; i++) {
        const res = await client.get("/rate-limited/resource");
        expect(res.ok).to.be.equal(true);
      }
    });

    it("should reject requests exceeding limit", async () => {
      // First, exhaust the limit
      for (let i = 0; i < 5; i++) {
        await client.get("/rate-limited/resource");
      }

      // This should be rejected
      const res = await client.get("/rate-limited/resource");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(429);
      if (!res.ok) {
        expect(res.data.error).to.equal("Too many requests");
        expect(res.data.retryAfter).to.be.a("number");
      }
    });

    it("should include retry-after information", async () => {
      // Exhaust limit first
      for (let i = 0; i < 5; i++) {
        await client.get("/rate-limited/resource");
      }

      const res = await client.get("/rate-limited/resource");
      expect(res.ok).to.be.equal(false);
      if (!res.ok) {
        expect(res.data).to.have.property("retryAfter");
        expect(res.data.retryAfter).to.be.greaterThan(0);
      }
    });
  });

  describe("Input Validation Tests", () => {
    it("should accept valid text input", async () => {
      const res = await client.post("/input-validation/text", {
        body: { text: "Hello World" },
      });
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data.received).to.equal("Hello World");
        expect(res.data.length).to.equal(11);
      }
    });

    it("should reject missing text input", async () => {
      const res = await client.post("/input-validation/text", {
        body: {},
      });
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data.error).to.equal("Invalid input");
      }
    });

    it("should reject non-string text input", async () => {
      const res = await client.post("/input-validation/text", {
        body: { text: 123 },
      });
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data.error).to.equal("Invalid input");
      }
    });

    it("should accept valid number input", async () => {
      const res = await client.post("/input-validation/number", {
        body: { value: 42 },
      });
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data.received).to.equal(42);
        expect(res.data.doubled).to.equal(84);
      }
    });

    it("should reject invalid number input", async () => {
      const res = await client.post("/input-validation/number", {
        body: { value: "not-a-number" },
      });
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data.error).to.equal("Invalid number");
      }
    });

    it("should accept valid array input", async () => {
      const res = await client.post("/input-validation/array", {
        body: { items: [1, 2, 3] },
      });
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data.count).to.equal(3);
      }
    });

    it("should reject non-array input", async () => {
      const res = await client.post("/input-validation/array", {
        body: { items: "not-an-array" },
      });
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data.error).to.equal("Invalid array");
      }
    });

    it("should accept empty array", async () => {
      const res = await client.post("/input-validation/array", {
        body: { items: [] },
      });
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data.count).to.equal(0);
      }
    });
  });

  describe("Security Headers Tests", () => {
    it("should receive request headers", async () => {
      const res = await client.get("/security/headers-check", {
        headers: {
          Authorization: "Bearer token123",
        },
      });
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data.hasAuthorization).to.be.true;
      }
    });

    it("should handle requests without custom headers", async () => {
      const res = await client.get("/security/headers-check");
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        // Note: ApiClient may automatically set Content-Type header
        // So we only check for Authorization which we didn't send
        expect(res.data.hasAuthorization).to.be.false;
      }
    });
  });

  describe("Input Sanitization Tests", () => {
    it("should handle XSS-like input by accepting it as text", async () => {
      const res = await client.post("/input-validation/text", {
        body: { text: "<script>alert('xss')</script>" },
      });
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        // The input is accepted as-is since it's a valid string
        expect(res.data.received).to.include("<script>");
      }
    });

    it("should handle SQL-like input as text", async () => {
      const res = await client.post("/input-validation/text", {
        body: { text: "'; DROP TABLE users; --" },
      });
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data.received).to.include("DROP TABLE");
      }
    });

    it("should handle path traversal as text", async () => {
      const res = await client.post("/input-validation/text", {
        body: { text: "../../../etc/passwd" },
      });
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data.received).to.include("../");
      }
    });
  });

  describe("Security Integration Tests", () => {
    it("should handle rapid requests with CSRF protection", async () => {
      for (let i = 0; i < 3; i++) {
        const res = await client.post("/security/csrf-protected", {
          body: { iteration: i },
          headers: { "X-CSRF-Token": "valid-csrf-token" },
        });
        expect(res.ok).to.be.equal(true);
      }
    });

    it("should maintain security under load", async () => {
      const requests = Array.from({ length: 10 }, (_, i) =>
        client.post("/security/echo", {
          body: { attempt: i, payload: "test data" },
        }),
      );

      const results = await Promise.all(requests);
      results.forEach((res) => {
        expect(res.ok).to.be.equal(true);
      });
    });
  });
});
