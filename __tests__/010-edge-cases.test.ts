import { describe, it, before, after } from "mocha";
import { expect } from "chai";
import { Server } from "http";
import { Spear, Router } from "../src/lib";
import { ApiClient } from "../src/lib/core/client";

describe("Edge Cases and Additional Coverage Tests", () => {
  let server: Server;
  let client: ApiClient<any>;

  const app = new Spear({ logger: true })
    .useBodyParser()
    .useCookiesParser()
    // Test response formatting
    .response((result, statusCode) => {
      if (typeof result === "string") return result;
      if (Array.isArray(result)) {
        return {
          success: statusCode < 400,
          data: result,
          statusCode,
        };
      }
      if (typeof result === "object" && result !== null) {
        return {
          success: statusCode < 400,
          ...result,
          statusCode,
        };
      }
      return {
        success: statusCode < 400,
        data: result,
        statusCode,
      };
    })
    // Test custom notfound handler
    .notfound((ctx) => {
      return ctx.res.status(404).json({
        custom: true,
        message: "Custom not found handler",
        path: ctx.req.url,
      });
    })
    // Test error handler
    .catch((err, ctx) => {
      return ctx.res.status(err.statusCode || 500).json({
        customError: true,
        message: err.message,
        stack: process.env.NODE_ENV === "test" ? undefined : err.stack,
      });
    })
    // Test CORS
    .cors({
      origins: [/^http:\/\/localhost:\d+$/],
      credentials: true,
    })
    // Basic routes
    .get("/hello", () => ({ message: "Hello World" }))
    .get("/error", () => {
      throw new Error("Test error");
    })
    .get("/error-with-status", (ctx) => {
      ctx.res.setStatusCode(422);
      throw new Error("Validation failed");
    })
    .post("/echo", (ctx) => ({ body: ctx.body }))
    .get("/query-params", (ctx) => ({ query: ctx.query }))
    .get("/params/:id/:action", (ctx) => ({
      params: ctx.params,
    }))
    .head("/head-test", () => ({ message: "This should not be returned" }))
    .options("/options-test", () => ({ message: "CORS preflight" }))
    .all("/all-test", (ctx) => ({
      method: ctx.req.method,
      message: "All methods accepted",
    }));

  // Router for additional testing
  const testRouter = new Router()
    .get("/router-test", () => ({ fromRouter: true }))
    .post("/router-echo", (ctx) => ({ body: ctx.body }));

  app.useRouter(testRouter);

  before((done) => {
    app.listen(5020, ({ port, server: sCallback }) => {
      server = sCallback;
      client = new ApiClient(`http://localhost:${port}`);
      done();
    });
  });

  after((done) => {
    server?.close(() => done());
  });

  describe("Response Formatting", () => {
    it("should format object response with success and statusCode", async () => {
      const res = await client.get("/hello");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        expect(res.data).to.have.property("success", true);
        expect(res.data).to.have.property("statusCode", 200);
        expect(res.data).to.have.property("message", "Hello World");
      }
    });
  });

  describe("Custom Notfound Handler", () => {
    it("should return custom 404 response for non-existent routes", async () => {
      const res = await client.get("/nonexistent-route-xyz");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(404);
      if (!res.ok) {
        expect(res.data).to.have.property("custom", true);
        expect(res.data).to.have.property("message", "Custom not found handler");
        expect(res.data).to.have.property("path", "/nonexistent-route-xyz");
      }
    });
  });

  describe("Custom Error Handler", () => {
    it("should handle thrown errors with custom error handler", async () => {
      const res = await client.get("/error");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(500);
      if (!res.ok) {
        expect(res.data).to.have.property("customError", true);
        expect(res.data).to.have.property("message", "Test error");
      }
    });

    it("should preserve status code when throwing error", async () => {
      const res = await client.get("/error-with-status");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(422);
      if (!res.ok) {
        expect(res.data).to.have.property("customError", true);
        expect(res.data).to.have.property("message", "Validation failed");
      }
    });
  });

  describe("CORS Headers", () => {
    it("should include CORS headers for localhost origin", async () => {
      const res = await client.get("/hello", {
        headers: { origin: "http://localhost:3000" },
      });
 
      expect(res.ok).to.be.equal(true);
      // Check CORS headers are present in response
      expect(res.headers.has("access-control-allow-origin"));
      expect(res.headers.get("access-control-allow-origin")).to.equal(
        "http://localhost:3000"
      );
      expect(res.headers.has("access-control-allow-credentials"));
    });

    it("should handle OPTIONS preflight request", async () => {
      // Note: ApiClient may not send OPTIONS directly, but we test the route
      const res = await client.get("/options-test", {
        headers: { origin: "http://localhost:3000" },
      });
      expect(res.ok).to.be.equal(false);
    });
  });

  describe("HEAD Method", () => {
    it("should respond to HEAD request", async () => {
      // HEAD requests typically don't return body
      const res = await client.head("/head-test");
      // The route exists and responds
      expect(res.status).to.be.oneOf([200, 204]);
    });
  });

  describe("OPTIONS Method", () => {
    it("should respond to OPTIONS request", async () => {
      const res = await client.options("/options-test");
      expect(res.ok).to.be.equal(true);
    });
  });

  describe("ALL Method", () => {
    it("should accept GET request via ALL", async () => {
      const res = await client.get("/all-test");
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data).to.have.property("method", "GET");
      }
    });

    it("should accept POST request via ALL", async () => {
      const res = await client.post("/all-test", {
        body: { test: "data" },
      });
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data).to.have.property("method", "POST");
      }
    });

    it("should accept PUT request via ALL", async () => {
      const res = await client.put("/all-test", {
        body: { test: "data" },
      });
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data).to.have.property("method", "PUT");
      }
    });

    it("should accept DELETE request via ALL", async () => {
      const res = await client.delete("/all-test");
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data).to.have.property("method", "DELETE");
      }
    });
  });

  describe("Query Parameter Edge Cases", () => {
    it("should handle empty query string", async () => {
      const res = await client.get("/query-params");
      expect(res.ok).to.be.equal(true);
    });

    it("should handle query with special characters", async () => {
      const res = await client.get(
        "/query-params?name=John%20Doe&email=test%40example.com"
      );
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        const data: any = res.data.data || res.data;
        expect(data.query).to.have.property("name", "John Doe");
        expect(data.query).to.have.property("email", "test@example.com");
      }
    });

    it("should handle query with array values", async () => {
      const res = await client.get("/query-params?tags=tag1&tags=tag2&tags=tag3");
      expect(res.ok).to.be.equal(true);
    });

    it("should handle query with boolean-like strings", async () => {
      const res = await client.get("/query-params?active=true&enabled=false");
      expect(res.ok).to.be.equal(true);
    });

    it("should handle query with numeric strings", async () => {
      const res = await client.get("/query-params?count=100&price=19.99");
      expect(res.ok).to.be.equal(true);
    });

    it("should handle query with null-like values", async () => {
      const res = await client.get("/query-params?value=null&empty=undefined");
      expect(res.ok).to.be.equal(true);
    });
  });

  describe("Route Parameters Edge Cases", () => {
    it("should handle numeric params", async () => {
      const res = await client.get("/params/123/view");
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        const data: any = res.data.data || res.data;
        expect(data.params).to.have.property("id", 123);
        expect(data.params).to.have.property("action", "view");
      }
    });

    it("should handle string params with special characters", async () => {
      const res = await client.get("/params/test-123/edit");
      expect(res.ok).to.be.equal(true);
    });

    it("should handle unicode params", async () => {
      const res = await client.get("/params/%E4%B8%AD%E6%96%87/view");
      expect(res.ok).to.be.equal(true);
    });
  });

  describe("Body Parsing Edge Cases", () => {
    it("should handle empty object body", async () => {
      const res = await client.post("/echo", {
        body: {},
      });
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        const data: any = res.data.data || res.data;
        expect(data.body).to.deep.equal({});
      }
    });

    it("should handle nested object body", async () => {
      const res = await client.post("/echo", {
        body: {
          user: {
            name: "John",
            address: {
              city: "NYC",
              zip: "10001",
            },
          },
        },
      });
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        const data: any = res.data.data || res.data;
        expect(data.body).to.have.property("user");
        expect(data.body.user).to.have.property("address");
      }
    });

    it("should handle array body", async () => {
      const res = await client.post("/echo", {
        body: [1, 2, 3, "test"],
      });
      expect(res.ok).to.be.equal(true);
    });

    it("should handle body with null values", async () => {
      const res = await client.post("/echo", {
        body: { name: null, value: "test" },
      });
      expect(res.ok).to.be.equal(true);
    });

    it("should handle body with undefined-like values", async () => {
      const res = await client.post("/echo", {
        body: { name: "", count: 0, active: false },
      });
      expect(res.ok).to.be.equal(true);
    });
  });

  describe("Router Integration", () => {
    it("should handle routes from router", async () => {
      const res = await client.get("/router-test");
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        const data: any = res.data.data || res.data;
        expect(data).to.have.property("fromRouter", true);
      }
    });

    it("should handle POST from router", async () => {
      const res = await client.post("/router-echo", {
        body: { echoed: "test" },
      });
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        const data = res.data;
        expect(data.body).to.have.property("echoed", "test");
      }
    });
  });

  describe("Cookie Parsing", () => {
    it("should parse cookies when sent", async () => {
      const res = await client.get("/hello", {
        headers: {
          cookie: "session=abc123; user=john",
        },
      });
      expect(res.ok).to.be.equal(true);
    });
  });

  describe("Multiple Sequential Requests", () => {
    it("should handle multiple sequential requests correctly", async () => {
      const requests = [
        client.get("/hello"),
        client.get("/hello"),
        client.get("/hello"),
      ];

      const results = await Promise.all(requests);
      results.forEach((res) => {
        expect(res.ok).to.be.equal(true);
        expect(res.status).to.be.equal(200);
      });
    });
  });

  describe("Large Payload Handling", () => {
    it("should handle large JSON payload", async () => {
      const largeData = {
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: `This is a description for item ${i}`,
        })),
      };

      const res = await client.post("/echo", {
        body: largeData,
      });

      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        const data: any = res.data.data || res.data;
        expect(data.body).to.have.property("items");
        expect(data.body.items).to.have.length(1000);
      }
    });
  });
});