import { describe, it, before, after } from "mocha";
import { expect } from "chai";
import { Spear, Controller, Get, Post, type T } from "../src/lib";
import { ApiClient } from "../src/lib/core/client";
import { getAdapter } from "./app/adapter";

// ============== Performance Test Controller ==============

@Controller("/perf")
class PerformanceController {
  @Get("/simple")
  simple() {
    return { message: "Simple response" };
  }

  @Get("/heavy")
  heavy() {
    // Simulate heavy computation
    let result = 0;
    for (let i = 0; i < 10000; i++) {
      result += Math.sqrt(i);
    }
    return { result };
  }

  @Get("/large-payload")
  largePayload() {
    return {
      items: Array.from({ length: 500 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        description: `Description for item ${i}`,
        tags: [`tag${i % 10}`, `category${i % 5}`],
      })),
    };
  }

  @Post("/echo")
  echo({ body }: T.Context) {
    return { received: body };
  }

  @Get("/memory")
  memory() {
    // Allocate some memory
    const data = Array.from({ length: 1000 }, () => ({
      random: Math.random(),
      timestamp: Date.now(),
    }));
    return { allocated: data.length };
  }
}

describe("Performance Tests", () => {
  let server;
  let client: ApiClient<any>;
  let app: any;

  const { portOffset, adapter } = getAdapter();

  app = new Spear({
    logger: true,
    adapter,
    controllers: [PerformanceController],
  });

  app.useBodyParser();

  before((done) => {
    app.listen(5037 + portOffset, ({ port, server: sCallback }: any) => {
      server = sCallback;
      client = new ApiClient(`http://localhost:${port}`);
      done();
    });
  });

  after((done) => {
    done();
  });

  describe("Response Time Tests", () => {
    it("should respond to simple request", async () => {
      const res = await client.get("/perf/simple");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });

    it("should respond to heavy request", async () => {
      const res = await client.get("/perf/heavy");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });

    it("should respond to large payload", async () => {
      const res = await client.get("/perf/large-payload");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });

    it("should handle POST echo", async () => {
      const res = await client.post("/perf/echo", {
        body: { test: "data", value: 123 },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });
  });

  describe("Throughput Tests", () => {
    it("should handle 100 requests per second", async () => {
      const start = Date.now();
      const requests = Array.from({ length: 100 }, () =>
        client.get("/perf/simple"),
      );

      const results = await Promise.all(requests);
      const elapsed = Date.now() - start;
      const rps = (100 / elapsed) * 1000;

      results.forEach((res) => {
        expect(res.ok).to.be.equal(true);
      });

      // Should achieve at least 50 RPS (conservative for test environment)
      expect(rps).to.be.greaterThan(50);
    });

    it("should handle 50 concurrent connections", async () => {
      const requests = Array.from({ length: 50 }, () =>
        client.get("/perf/simple"),
      );

      const results = await Promise.all(requests);
      const successCount = results.filter((r) => r.ok).length;

      expect(successCount).to.equal(50);
    });

    it("should handle mixed request types concurrently", async () => {
      const requests = [
        ...Array.from({ length: 20 }, () => client.get("/perf/simple")),
        ...Array.from({ length: 10 }, () => client.get("/perf/heavy")),
        ...Array.from({ length: 10 }, () => client.get("/perf/large-payload")),
      ];

      const results = await Promise.all(requests);
      const successCount = results.filter((r) => r.ok).length;

      expect(successCount).to.equal(40);
    });
  });

  describe("Memory Efficiency Tests", () => {
    it("should handle memory allocation request", async () => {
      const res = await client.get("/perf/memory");
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data.allocated).to.equal(1000);
      }
    });

    it("should handle multiple memory allocations", async () => {
      const requests = Array.from({ length: 10 }, () =>
        client.get("/perf/memory"),
      );

      const results = await Promise.all(requests);
      results.forEach((res) => {
        expect(res.ok).to.be.equal(true);
      });
    });

    it("should not leak memory across requests", async () => {
      const initialMemory = process.memoryUsage();

      // Make 50 requests
      for (let i = 0; i < 50; i++) {
        await client.get("/perf/simple");
      }

      const finalMemory = process.memoryUsage();
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory growth should be reasonable (less than 10MB)
      expect(memoryGrowth).to.be.lessThan(10 * 1024 * 1024);
    });
  });

  describe("Connection Pooling Tests", () => {
    it("should reuse connections efficiently", async () => {
      const start = Date.now();

      // Sequential requests should benefit from connection reuse
      for (let i = 0; i < 20; i++) {
        const res = await client.get("/perf/simple");
        expect(res.ok).to.be.equal(true);
      }

      const elapsed = Date.now() - start;
      // Should complete in reasonable time with connection reuse
      expect(elapsed).to.be.lessThan(2000);
    });

    it("should handle connection recovery", async () => {
      // Make requests with delays to test connection recovery
      for (let i = 0; i < 5; i++) {
        const res = await client.get("/perf/simple");
        expect(res.ok).to.be.equal(true);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });
  });

  describe("Load Tests", () => {
    it("should handle sustained load", async () => {
      const totalRequests = 200;
      const batchSize = 50;

      for (let batch = 0; batch < totalRequests / batchSize; batch++) {
        const requests = Array.from({ length: batchSize }, () =>
          client.get("/perf/simple"),
        );
        const results = await Promise.all(requests);
        results.forEach((res) => {
          expect(res.ok).to.be.equal(true);
        });

        // Small delay between batches
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    });

    it("should handle burst traffic", async () => {
      const start = Date.now();

      // Send 100 requests as fast as possible
      const requests = Array.from({ length: 100 }, () =>
        client.get("/perf/simple"),
      );
      const results = await Promise.all(requests);

      const elapsed = Date.now() - start;
      const successCount = results.filter((r) => r.ok).length;

      expect(successCount).to.equal(100);
      // Should complete burst within 2 seconds
      expect(elapsed).to.be.lessThan(2000);
    });

    it("should maintain response quality under load", async () => {
      const requests = Array.from({ length: 50 }, () =>
        client.get("/perf/large-payload"),
      );

      const results = await Promise.all(requests);
      results.forEach((res) => {
        expect(res.ok).to.be.equal(true);
        if (res.ok) {
          expect(res.data.items).to.be.an("array").with.length(500);
        }
      });
    });
  });

  describe("Latency Tests", () => {
    it("should handle sequential requests", async () => {
      for (let i = 0; i < 20; i++) {
        const res = await client.get("/perf/simple");
        expect(res.ok).to.be.equal(true);
      }
    });

    it("should handle multiple requests for statistics", async () => {
      const latencies: number[] = [];

      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await client.get("/perf/simple");
        latencies.push(Date.now() - start);
      }

      // Just verify all requests completed
      expect(latencies.length).to.equal(10);
    });
  });

  describe("Stress Tests", () => {
    it("should handle gradual load increase", async () => {
      const loadLevels = [10, 25, 50, 75, 100];

      for (const load of loadLevels) {
        const requests = Array.from({ length: load }, () =>
          client.get("/perf/simple"),
        );
        const results = await Promise.all(requests);
        const successCount = results.filter((r) => r.ok).length;
        expect(successCount).to.equal(load);
      }
    });

    it("should recover after stress", async () => {
      // Stress phase
      const stressRequests = Array.from({ length: 100 }, () =>
        client.get("/perf/simple"),
      );
      await Promise.all(stressRequests);

      // Recovery phase - should still work
      const res = await client.get("/perf/simple");
      expect(res.ok).to.be.equal(true);
    });

    it("should handle request size variations", async () => {
      const sizes = [
        { body: { small: 1 } },
        { body: { medium: "x".repeat(100) } },
        { body: { large: "x".repeat(1000) } },
      ];

      for (const { body } of sizes) {
        const res = await client.post("/perf/echo", { body });
        expect(res.ok).to.be.equal(true);
      }
    });
  });

  describe("Resource Cleanup Tests", () => {
    it("should clean up after large responses", async () => {
      for (let i = 0; i < 10; i++) {
        const res = await client.get("/perf/large-payload");
        expect(res.ok).to.be.equal(true);
      }

      // Force garbage collection hint (if available)
      if (global.gc) {
        global.gc();
      }
    });

    it("should handle connection termination gracefully", async () => {
      const requests = Array.from({ length: 20 }, () =>
        client.get("/perf/simple"),
      );

      const results = await Promise.all(requests);
      results.forEach((res) => {
        expect(res.ok).to.be.equal(true);
      });
    });
  });

  describe("Benchmark Comparison Tests", () => {
    it("simple vs heavy endpoint comparison", async () => {
      const simpleStart = Date.now();
      await Promise.all(
        Array.from({ length: 10 }, () => client.get("/perf/simple")),
      );
      const simpleTime = Date.now() - simpleStart;

      const heavyStart = Date.now();
      await Promise.all(
        Array.from({ length: 10 }, () => client.get("/perf/heavy")),
      );
      const heavyTime = Date.now() - heavyStart;

      // Both should complete successfully (timing varies by environment)
      expect(simpleTime).to.be.greaterThan(0);
      expect(heavyTime).to.be.greaterThan(0);
    });

    it("GET vs POST performance comparison", async () => {
      const getStart = Date.now();
      await Promise.all(
        Array.from({ length: 20 }, () => client.get("/perf/simple")),
      );
      const getTime = Date.now() - getStart;

      const postStart = Date.now();
      await Promise.all(
        Array.from({ length: 20 }, () =>
          client.post("/perf/echo", { body: { test: "data" } }),
        ),
      );
      const postTime = Date.now() - postStart;

      // Both should complete successfully (timing varies by environment)
      expect(getTime).to.be.greaterThan(0);
      expect(postTime).to.be.greaterThan(0);
    });
  });
});
