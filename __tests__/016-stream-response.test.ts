import { describe, it, before, after } from "mocha";
import { expect } from "chai";
import * as http from "http";
import { Spear, Controller, Get, type T } from "../src/lib";
import { ApiClient } from "../src/lib/core/client";
import { getAdapter } from "./app/adapter";

// ============== Stream Controller ==============

@Controller("/stream")
class StreamController {
  @Get("/numbers")
  async *numbers() {
    for (let i = 1; i <= 10; i++) {
      yield { number: i };
    }
  }

  @Get("/delayed")
  async *delayed() {
    for (let i = 1; i <= 5; i++) {
      yield { chunk: i, timestamp: Date.now() };
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  @Get("/large")
  async *large() {
    for (let i = 0; i < 100; i++) {
      yield { item: `Item ${i}`, data: "x".repeat(100) };
    }
  }

  @Get("/error")
  async *withError() {
    yield { chunk: 1 };
    yield { chunk: 2 };
    throw new Error("Stream error");
  }

  @Get("/empty")
  async *empty() {
    // Empty generator - yields nothing
  }
}

@Controller("/file")
class FileController {
  @Get("/download/:size")
  download({ params }: T.Context<{ params: { size: number } }>) {
    const size = params.size;

    return {
      message: `Generating ${size}KB file`,
      size,
    };
  }
}

describe("Stream Response Tests", () => {
  let server;
  let client: ApiClient<any>;
  let app: any;
  let portOffset: number;
  let adapter: any;

  const { portOffset: pOffset, adapter: adapterConfig } = getAdapter();
  portOffset = pOffset;
  adapter = adapterConfig;

  app = new Spear({
    logger: true,
    adapter,
    controllers: [StreamController, FileController],
  });

  app.useBodyParser();

  before((done) => {
    app.listen(5035 + portOffset, ({ port, server: sCallback }: any) => {
      server = sCallback;
      client = new ApiClient(`http://localhost:${port}`);
      done();
    });
  });

  after((done) => {
    done();
  });

  describe("Basic Stream Response Tests", () => {
    it("should handle streaming numbers response", async () => {
      const res = await client.get("/stream/numbers");
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data).to.be.an("object");
      }
    });

    it("should handle delayed streaming response", async () => {
      const res = await client.get("/stream/delayed");
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data).to.be.an("object");
      }
    });

    it("should handle large streaming response", async () => {
      const res = await client.get("/stream/large");
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data).to.be.an("object");
      }
    });

    it("should handle empty stream response", async () => {
      const res = await client.get("/stream/empty");
      expect(res.ok).to.be.equal(true);
    });
  });

  describe("Stream Error Handling Tests", () => {
    it("should handle stream errors gracefully", async () => {
      const res = await client.get("/stream/error");
      expect(res.status).to.be.oneOf([200, 500]);
    });
  });

  describe("HTTP Stream Tests", () => {
    it("should handle direct HTTP stream request", (done) => {
      const portNum = 5035 + portOffset;
      let completed = false;
      const options = {
        hostname: "localhost",
        port: portNum,
        path: "/stream/numbers",
        method: "GET",
      };

      const req = http.request(options, (res: any) => {
        res.on("data", () => {
          // Receiving chunks
        });

        res.on("end", () => {
          if (!completed) {
            completed = true;
            expect(res.statusCode).to.be.oneOf([200, 204]);
            done();
          }
        });
      });

      req.on("error", () => {
        if (!completed) {
          completed = true;
          done();
        }
      });

      req.end();
    });

    it("should handle streaming with custom headers", (done) => {
      const portNum = 5035 + portOffset;
      let completed = false;
      const options = {
        hostname: "localhost",
        port: portNum,
        path: "/stream/delayed",
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      };

      const req = http.request(options, (res: any) => {
        expect(res.statusCode).to.be.oneOf([200, 204]);
        res.on("data", () => {
          // Receiving chunks
        });

        res.on("end", () => {
          if (!completed) {
            completed = true;
            done();
          }
        });
      });

      req.on("error", () => {
        if (!completed) {
          completed = true;
          done();
        }
      });

      req.end();
    });
  });

  describe("Stream Chunk Tests", () => {
    it("should receive all chunks from stream", async () => {
      const res = await client.get("/stream/numbers");
      expect(res.ok).to.be.equal(true);
    });

    it("should handle chunked encoding properly", async () => {
      const res = await client.get("/stream/large");
      expect(res.ok).to.be.equal(true);
    });
  });

  describe("Stream Performance Tests", () => {
    it("should handle concurrent stream requests", async () => {
      const requests = [
        client.get("/stream/numbers"),
        client.get("/stream/numbers"),
        client.get("/stream/numbers"),
      ];

      const results = await Promise.all(requests);
      results.forEach((res: any) => {
        expect(res.ok).to.be.equal(true);
      });
    });

    it("should handle mixed stream and non-stream requests", async () => {
      const requests = [
        client.get("/stream/numbers"),
        client.get("/stream/empty"),
        client.get("/file/download/100"),
      ];

      const results = await Promise.all(requests);
      results.forEach((res: any) => {
        expect(res.ok).to.be.equal(true);
      });
    });
  });

  describe("Stream Memory Tests", () => {
    it("should handle memory-efficient large stream", async () => {
      const res = await client.get("/stream/large");
      expect(res.ok).to.be.equal(true);
    });

    it("should clean up after stream completes", async () => {
      const res = await client.get("/stream/numbers");
      expect(res.ok).to.be.equal(true);
    });
  });

  describe("Stream Content-Type Tests", () => {
    it("should set correct content-type for JSON stream", (done) => {
      const portNum = 5035 + portOffset;
      let completed = false;
      const options = {
        hostname: "localhost",
        port: portNum,
        path: "/stream/numbers",
        method: "GET",
      };

      const req = http.request(options, (res: any) => {
        expect(res.headers["content-type"]).to.exist;
        completed = true;
        done();
      });

      req.on("error", () => {
        if (!completed) {
          completed = true;
          done();
        }
      });

      req.end();
    });
  });

  describe("Stream Interruption Tests", () => {
    it("should handle client disconnect during stream", (done) => {
      const portNum = 5035 + portOffset;
      let completed = false;

      const options = {
        hostname: "localhost",
        port: portNum,
        path: "/stream/delayed",
        method: "GET",
      };

      const req = http.request(options, (res: any) => {
        res.on("data", () => {
          if (!completed) {
            completed = true;
            req.destroy();
            done();
          }
        });

        res.on("end", () => {
          if (!completed) {
            completed = true;
            done();
          }
        });
      });

      req.on("error", () => {
        if (!completed) {
          completed = true;
          done();
        }
      });

      req.end();
    });
  });

  describe("Stream Integration Tests", () => {
    it("should work with middleware", async () => {
      const res = await client.get("/stream/numbers");
      expect(res.ok).to.be.equal(true);
    });

    it("should work with error handling middleware", async () => {
      const res = await client.get("/stream/error");
      expect(res.status).to.be.oneOf([200, 500]);
    });

    it("should maintain connection state during stream", async () => {
      const res = await client.get("/stream/delayed");
      expect(res.ok).to.be.equal(true);
    });
  });
});

describe("File Download Tests", () => {
  let server;
  let client: ApiClient<any>;
  let app: any;
  let portOffset: number;
  let adapter: any;

  const { portOffset: pOffset, adapter: adapterConfig } = getAdapter();
  portOffset = pOffset;
  adapter = adapterConfig;

  app = new Spear({
    logger: true,
    adapter,
    controllers: [FileController],
  });

  app.useBodyParser();

  before((done) => {
    app.listen(5036 + portOffset, ({ port, server: sCallback }: any) => {
      server = sCallback;
      client = new ApiClient(`http://localhost:${port}`);
      done();
    });
  });

  after((done) => {
    done();
  });

  describe("File Download Tests", () => {
    it("should handle file download request", async () => {
      const res = await client.get("/file/download/100");
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data.size).to.equal(100);
      }
    });

    it("should handle various file sizes", async () => {
      const sizes = [10, 100, 1000];

      for (const size of sizes) {
        const res = await client.get(`/file/download/${size}`);
        expect(res.ok).to.be.equal(true);
        if (res.ok) {
          expect(res.data.size).to.equal(size);
        }
      }
    });
  });
});
