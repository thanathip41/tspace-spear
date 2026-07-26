import { describe, it, before, after } from "mocha";
import { expect } from "chai";
import { Spear, Controller, Get, Post, type T } from "../src/lib";
import { ApiClient } from "../src/lib/core/client";
import { getAdapter } from "./app/adapter";

@Controller("/client-test")
class ClientTestController {
  @Get("/echo")
  echo({ headers, query }: T.Context) {
    return {
      headers: {
        contentType: headers["content-type"],
        authorization: headers["authorization"],
        userAgent: headers["user-agent"],
        customHeader: headers["x-custom-header"],
      },
      query,
    };
  }

  @Get("/delay/:ms")
  async delay({ params }: T.Context<{ params: { ms: number } }>) {
    await new Promise((resolve) => setTimeout(resolve, params.ms));
    return { delayed: true, ms: params.ms };
  }

  @Get("/large-response")
  largeResponse() {
    return {
      items: Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        description: `Description for item ${i}`,
      })),
    };
  }

  @Post("/echo-body")
  echoBody({ body }: T.Context) {
    return { received: body };
  }

  @Get("/status/:code")
  status({ params }: T.Context<{ params: { code: number } }>) {
    return { status: params.code };
  }

  @Get("/json-error")
  jsonError() {
    // This will try to send invalid JSON
    return "{ invalid json }";
  }

  @Get("/empty")
  empty() {
    return {};
  }

  @Get("/null")
  null() {
    return null;
  }

  @Get("/undefined")
  undefined() {
    return undefined;
  }

  @Get("/special-chars")
  specialChars() {
    return {
      unicode: "Hello \u4e16\u754c",
      emoji: "Hello \ud83d\udc4b",
      newline: "Line1\nLine2",
      tab: "Col1\tCol2",
      quotes: 'He said "Hello"',
      backslash: "Path\\to\\file",
    };
  }
}

describe("ApiClient Edge Cases Tests", () => {
  let server;
  let client: ApiClient<any>;
  let app: any;

  const { portOffset, adapter } = getAdapter();

  app = new Spear({
    logger: true,
    adapter,
    controllers: [ClientTestController],
  });

  app.useBodyParser();

  before((done) => {
    app.listen(5032 + portOffset, ({ port, server: sCallback }: any) => {
      server = sCallback;
      client = new ApiClient(`http://localhost:${port}`);
      done();
    });
  });

  after((done) => {
    done();
  });

  describe("ApiClient Basic Request Tests", () => {
    it("should handle GET request with headers", async () => {
      const res = await client.get("/client-test/echo", {
        headers: {
          Authorization: "Bearer test-token",
          "X-Custom-Header": "custom-value",
        },
      });
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data.headers.authorization).to.equal("Bearer test-token");
        expect(res.data.headers.customHeader).to.equal("custom-value");
      }
    });

    it("should handle GET request with query parameters", async () => {
      const res = await client.get("/client-test/echo?name=test&value=123");
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data.query).to.include({ name: "test", value: "123" });
      }
    });

    it("should handle POST request with body", async () => {
      const res = await client.post("/client-test/echo-body", {
        body: { name: "Test", value: 42 },
      });
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data.received).to.deep.equal({ name: "Test", value: 42 });
      }
    });

    it("should handle empty response body", async () => {
      const res = await client.get("/client-test/empty");
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data).to.deep.equal({});
      }
    });

    it("should handle null response body", async () => {
      const res = await client.get("/client-test/null");
      expect(res.ok).to.be.equal(true);
    });

    it("should handle undefined response body", async () => {
      const res = await client.get("/client-test/undefined");
      expect(res.ok).to.be.equal(true);
    });
  });

  describe("ApiClient Special Characters Tests", () => {
    it("should handle unicode characters in response", async () => {
      const res = await client.get("/client-test/special-chars");
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data.unicode).to.equal("Hello 世界");
        expect(res.data.emoji).to.equal("Hello 👋");
      }
    });

    it("should handle newline and tab characters", async () => {
      const res = await client.get("/client-test/special-chars");
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data.newline).to.include("\n");
        expect(res.data.tab).to.include("\t");
      }
    });

    it("should handle quotes and backslashes", async () => {
      const res = await client.get("/client-test/special-chars");
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data.quotes).to.include('"');
        expect(res.data.backslash).to.include("\\");
      }
    });
  });

  describe("ApiClient Large Response Tests", () => {
    it("should handle large JSON response", async () => {
      const res = await client.get("/client-test/large-response");
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data.items).to.be.an("array").with.length(1000);
        expect(res.data.items[0]).to.have.property("id", 0);
        expect(res.data.items[999]).to.have.property("id", 999);
      }
    });

    it("should maintain response integrity for large payloads", async () => {
      const res = await client.get("/client-test/large-response");
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        // Verify all items are present and correct
        for (let i = 0; i < 1000; i++) {
          expect(res.data.items[i]).to.have.property("id", i);
          expect(res.data.items[i]).to.have.property("name", `Item ${i}`);
        }
      }
    });
  });

  describe("ApiClient Delayed Response Tests", () => {
    it("should handle short delay (100ms)", async () => {
      const start = Date.now();
      const res = await client.get("/client-test/delay/100");
      const elapsed = Date.now() - start;

      expect(res.ok).to.be.equal(true);
      expect(elapsed).to.be.at.least(90); // Allow some tolerance
      if (res.ok) {
        expect(res.data.delayed).to.be.true;
        expect(res.data.ms).to.equal(100);
      }
    });

    it("should handle medium delay (500ms)", async () => {
      const start = Date.now();
      const res = await client.get("/client-test/delay/500");
      const elapsed = Date.now() - start;

      expect(res.ok).to.be.equal(true);
      expect(elapsed).to.be.at.least(450);
      if (res.ok) {
        expect(res.data.ms).to.equal(500);
      }
    });

    it("should handle concurrent delayed requests", async () => {
      const start = Date.now();
      const requests = [
        client.get("/client-test/delay/100"),
        client.get("/client-test/delay/100"),
        client.get("/client-test/delay/100"),
      ];

      const results = await Promise.all(requests);
      const elapsed = Date.now() - start;

      // All should complete in ~100ms since they run concurrently
      expect(elapsed).to.be.lessThan(250);
      results.forEach((res) => {
        expect(res.ok).to.be.equal(true);
      });
    });
  });

  describe("ApiClient Error Handling Tests", () => {
    it("should handle 404 not found", async () => {
      const res = await client.get("/non-existent-route");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(404);
    });

    it("should handle various status codes", async () => {
      const statusCodes = [200, 201, 400, 401, 403, 404, 500];

      for (const code of statusCodes) {
        const res = await client.get(`/client-test/status/${code}`);
        expect(res.status).to.be.equal(200); // Route always returns 200 with status in body
      }
    });

    it("should handle request with empty headers", async () => {
      const res = await client.get("/client-test/echo");
      expect(res.ok).to.be.equal(true);
    });

    it("should handle POST with empty body", async () => {
      const res = await client.post("/client-test/echo-body", {
        body: {},
      });
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data.received).to.deep.equal({});
      }
    });
  });

  describe("ApiClient Sequential Requests Tests", () => {
    it("should handle multiple sequential requests", async () => {
      const results = [];

      for (let i = 0; i < 5; i++) {
        const res = await client.get("/client-test/echo");
        results.push(res);
      }

      results.forEach((res) => {
        expect(res.ok).to.be.equal(true);
      });
    });

    it("should maintain connection across requests", async () => {
      const requests = [
        client.get("/client-test/empty"),
        client.get("/client-test/empty"),
        client.get("/client-test/empty"),
        client.get("/client-test/empty"),
        client.get("/client-test/empty"),
      ];

      const results = await Promise.all(requests);
      results.forEach((res) => {
        expect(res.ok).to.be.equal(true);
      });
    });

    it("should handle mixed request types sequentially", async () => {
      const res1 = await client.get("/client-test/empty");
      const res2 = await client.post("/client-test/echo-body", {
        body: { test: 1 },
      });
      const res3 = await client.get("/client-test/large-response");
      const res4 = await client.get("/client-test/special-chars");

      expect(res1.ok).to.be.equal(true);
      expect(res2.ok).to.be.equal(true);
      expect(res3.ok).to.be.equal(true);
      expect(res4.ok).to.be.equal(true);
    });
  });

  describe("ApiClient Custom Headers Tests", () => {
    it("should send custom headers correctly", async () => {
      const res = await client.get("/client-test/echo", {
        headers: {
          "X-API-Key": "secret-key-123",
          "X-Request-ID": "req-456",
          "X-Custom-Data": "custom-value",
        },
      });
      expect(res.ok).to.be.equal(true);
    });

    it("should handle headers with special characters", async () => {
      const res = await client.get("/client-test/echo", {
        headers: {
          "X-Special": "value-with-dashes_and_underscores",
          "X-Number": "12345",
        },
      });
      expect(res.ok).to.be.equal(true);
    });

    it("should preserve header case insensitivity", async () => {
      const res = await client.get("/client-test/echo", {
        headers: {
          "x-custom-header": "test-value",
        },
      });
      expect(res.ok).to.be.equal(true);
    });
  });

  describe("ApiClient Query Parameter Tests", () => {
    it("should handle query with special characters", async () => {
      const res = await client.get(
        "/client-test/echo?name=John%20Doe&email=test%40example.com",
      );
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data.query.name).to.equal("John Doe");
        expect(res.data.query.email).to.equal("test@example.com");
      }
    });

    it("should handle query with array values", async () => {
      const res = await client.get(
        "/client-test/echo?tags=tag1&tags=tag2&tags=tag3",
      );
      expect(res.ok).to.be.equal(true);
    });

    it("should handle query with boolean-like strings", async () => {
      const res = await client.get(
        "/client-test/echo?active=true&enabled=false",
      );
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data.query.active).to.equal("true");
        expect(res.data.query.enabled).to.equal("false");
      }
    });

    it("should handle query with numeric strings", async () => {
      const res = await client.get("/client-test/echo?count=100&price=19.99");
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data.query.count).to.equal("100");
        expect(res.data.query.price).to.equal("19.99");
      }
    });

    it("should handle empty query string", async () => {
      const res = await client.get("/client-test/echo");
      expect(res.ok).to.be.equal(true);
    });
  });

  describe("ApiClient Body Type Tests", () => {
    it("should handle string body", async () => {
      const res = await client.post("/client-test/echo-body", {
        body: "plain text body",
      });
      expect(res.ok).to.be.equal(true);
    });

    it("should handle number body", async () => {
      const res = await client.post("/client-test/echo-body", {
        body: 42,
      });
      expect(res.ok).to.be.equal(true);
    });

    it("should handle boolean body", async () => {
      const res = await client.post("/client-test/echo-body", {
        body: true,
      });
      expect(res.ok).to.be.equal(true);
    });

    it("should handle array body", async () => {
      const res = await client.post("/client-test/echo-body", {
        body: [1, 2, 3, "test"],
      });
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data.received).to.be.an("array");
      }
    });

    it("should handle nested object body", async () => {
      const res = await client.post("/client-test/echo-body", {
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
        expect(res.data.received.user).to.have.property("address");
      }
    });

    it("should handle body with null values", async () => {
      const res = await client.post("/client-test/echo-body", {
        body: { name: null, value: "test" },
      });
      expect(res.ok).to.be.equal(true);
    });

    it("should handle body with falsy values", async () => {
      const res = await client.post("/client-test/echo-body", {
        body: { name: "", count: 0, active: false },
      });
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data.received.name).to.equal("");
        expect(res.data.received.count).to.equal(0);
        expect(res.data.received.active).to.equal(false);
      }
    });
  });

  describe("ApiClient Stress Tests", () => {
    it("should handle 100 concurrent requests", async () => {
      const requests = Array.from({ length: 100 }, () =>
        client.get("/client-test/empty"),
      );

      const results = await Promise.all(requests);
      const successCount = results.filter((r) => r.ok).length;

      expect(successCount).to.equal(100);
    });

    it("should handle rapid sequential requests", async () => {
      for (let i = 0; i < 50; i++) {
        const res = await client.get("/client-test/empty");
        expect(res.ok).to.be.equal(true);
      }
    });
  });
});
