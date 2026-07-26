import { describe, it, before, after } from "mocha";
import { expect } from "chai";
import WebSocket from "ws";
import { Spear, Controller, Get, type T } from "../src/lib";
import { getAdapter } from "./app/adapter";

// ============== Test Controller ==============

@Controller("/api")
class TestController {
  @Get("/health")
  health() {
    return { status: "ok" };
  }
}

describe("WebSocket (.ws) Tests", () => {
  let server;
  let app: any;
  let ws: WebSocket | null;
  let wsBaseUrl: string;

  const { portOffset, adapter } = getAdapter();

  // Track WebSocket events for testing
  let connectionCount = 0;
  let messageCount = 0;
  let closeCount = 0;
  let errorCount = 0;
  const messages: any[] = [];

  app = new Spear({
    logger: true,
    adapter,
    controllers: [TestController],
  });

  app.useBodyParser();

  // Configure WebSocket handler using .ws() method
  app.ws(() => ({
    connection: (wsClient: any) => {
      connectionCount++;
      console.log(`[WS] Client connected. Total: ${connectionCount}`);
    },
    message: (wsClient: any, data: any) => {
      messageCount++;
      try {
        const parsed = JSON.parse(data.toString());
        messages.push(parsed);
      } catch {
        messages.push(data.toString());
      }
      console.log(`[WS] Message received. Total: ${messageCount}`);
    },
    close: (wsClient: any, code: number, reason: Buffer) => {
      closeCount++;
      console.log(`[WS] Client disconnected. Total: ${closeCount}`);
    },
    error: (wsClient: any, error: Error) => {
      errorCount++;
      console.log(`[WS] Error occurred. Total: ${errorCount}`);
    },
  }));

  before((done) => {
    const testPort = 5090 + portOffset;
    app.listen(testPort, ({ port, server: sCallback }: any) => {
      server = sCallback;
      wsBaseUrl = `ws://localhost:${port}`;
      done();
    });
  });

  after((done) => {
    if (ws && ws.readyState !== WebSocket.CLOSED) {
      ws.close();
    }
    done();
  });

  describe("WebSocket Connection Tests", () => {
    beforeEach(() => {
      connectionCount = 0;
      messageCount = 0;
      closeCount = 0;
      errorCount = 0;
      messages.length = 0;
    });

    it("should establish WebSocket connection using .ws()", (done) => {
      ws = new WebSocket(wsBaseUrl);

      ws.on("open", () => {
        expect((ws as WebSocket).readyState).to.equal(WebSocket.OPEN);
        expect(connectionCount).to.equal(1);
        (ws as WebSocket).close();
        done();
      });

      ws.on("error", (err) => {
        done(err);
      });
    });

    it("should handle multiple WebSocket connections", (done) => {
      const clients: WebSocket[] = [];
      let openCount = 0;
      const expectedConnections = 3;

      for (let i = 0; i < expectedConnections; i++) {
        const client = new WebSocket(wsBaseUrl);
        clients.push(client);

        client.on("open", () => {
          openCount++;
          if (openCount === expectedConnections) {
            expect(connectionCount).to.equal(expectedConnections);
            clients.forEach((c) => c.close());
            done();
          }
        });

        client.on("error", (err) => {
          done(err);
        });
      }
    });

    it("should handle WebSocket close event", (done) => {
      ws = new WebSocket(wsBaseUrl);

      ws.on("open", () => {
        (ws as WebSocket).close();
      });

      ws.on("close", (code, reason) => {
        // Give server time to process close event
        setTimeout(() => {
          expect(closeCount).to.be.greaterThan(0);
          expect((ws as WebSocket).readyState).to.equal(WebSocket.CLOSED);
          done();
        }, 50);
      });

      ws.on("error", (err) => {
        done(err);
      });
    });
  });

  describe("WebSocket Message Tests", () => {
    beforeEach(() => {
      connectionCount = 0;
      messageCount = 0;
      closeCount = 0;
      errorCount = 0;
      messages.length = 0;
    });

    it("should send text messages to server", (done) => {
      ws = new WebSocket(wsBaseUrl);

      ws.on("open", () => {
        (ws as WebSocket).send("Hello WebSocket");
      });

      // Server receives the message (tracked by messageCount)
      setTimeout(() => {
        expect(messageCount).to.be.greaterThan(0);
        expect(messages).to.include("Hello WebSocket");
        (ws as WebSocket).close();
        done();
      }, 100);

      ws.on("error", (err) => {
        done(err);
      });
    });

    it("should send JSON messages to server", (done) => {
      ws = new WebSocket(wsBaseUrl);
      const testMessage = { type: "test", data: "Hello JSON" };

      ws.on("open", () => {
        (ws as WebSocket).send(JSON.stringify(testMessage));
      });

      // Server receives the message (tracked by messageCount)
      setTimeout(() => {
        expect(messageCount).to.be.greaterThan(0);
        expect(messages).to.deep.include(testMessage);
        (ws as WebSocket).close();
        done();
      }, 100);

      ws.on("error", (err) => {
        done(err);
      });
    });

    it("should send binary messages to server", (done) => {
      ws = new WebSocket(wsBaseUrl);
      const binaryData = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]);

      ws.on("open", () => {
        (ws as WebSocket).send(binaryData);
      });

      // Server receives the message (tracked by messageCount)
      setTimeout(() => {
        expect(messageCount).to.be.greaterThan(0);
        (ws as WebSocket).close();
        done();
      }, 100);

      ws.on("error", (err) => {
        done(err);
      });
    });

    it("should handle multiple messages from same client", (done) => {
      ws = new WebSocket(wsBaseUrl);
      const messagesToSend = ["msg1", "msg2", "msg3"];

      ws.on("open", () => {
        messagesToSend.forEach((msg) => (ws as WebSocket).send(msg));
      });

      // Server receives all messages (tracked by messageCount)
      setTimeout(() => {
        expect(messageCount).to.equal(messagesToSend.length);
        expect(messages.length).to.equal(messagesToSend.length);
        (ws as WebSocket).close();
        done();
      }, 200);

      ws.on("error", (err) => {
        done(err);
      });
    });
  });

  describe("WebSocket Event Handler Tests", () => {
    beforeEach(() => {
      connectionCount = 0;
      messageCount = 0;
      closeCount = 0;
      errorCount = 0;
      messages.length = 0;
    });

    it("should trigger connection handler on connect", (done) => {
      ws = new WebSocket(wsBaseUrl);

      ws.on("open", () => {
        expect(connectionCount).to.equal(1);
        (ws as WebSocket).close();
        done();
      });

      ws.on("error", (err) => {
        done(err);
      });
    });

    it("should trigger message handler on message", (done) => {
      ws = new WebSocket(wsBaseUrl);

      ws.on("open", () => {
        (ws as WebSocket).send("test message");
      });

      // Server's message handler is triggered (tracked by messageCount)
      setTimeout(() => {
        expect(messageCount).to.equal(1);
        (ws as WebSocket).close();
        done();
      }, 100);

      ws.on("error", (err) => {
        done(err);
      });
    });

    it("should trigger close handler on disconnect", (done) => {
      ws = new WebSocket(wsBaseUrl);

      ws.on("open", () => {
        (ws as WebSocket).close();
      });

      ws.on("close", () => {
        // Give server time to process close event
        setTimeout(() => {
          expect(closeCount).to.be.greaterThan(0);
          done();
        }, 50);
      });

      ws.on("error", (err) => {
        done(err);
      });
    });
  });

  describe("WebSocket Coexistence Tests", () => {
    it("should work alongside HTTP endpoints", async () => {
      // First test HTTP endpoint
      const http = await import("http");

      await new Promise<void>((resolve) => {
        http.get(`http://localhost:${5090 + portOffset}/api/health`, (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            const parsed = JSON.parse(data);
            expect(parsed.status).to.equal("ok");
            resolve();
          });
        });
      });

      // Then test WebSocket
      ws = new WebSocket(wsBaseUrl);

      await new Promise<void>((resolve) => {
        (ws as WebSocket).on("open", () => {
          resolve();
        });
        (ws as WebSocket).on("error", () => resolve());
      });

      (ws as WebSocket).close();
    });

    it("should handle concurrent HTTP and WebSocket requests", async () => {
      const http = await import("http");

      // Make HTTP request
      const httpPromise = new Promise<any>((resolve) => {
        http.get(`http://localhost:${5090 + portOffset}/api/health`, (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            resolve(JSON.parse(data));
          });
        });
      });

      // Make WebSocket connection
      const wsPromise = new Promise<number>((resolve) => {
        const testWs = new WebSocket(wsBaseUrl);
        testWs.on("open", () => {
          resolve(connectionCount);
          testWs.close();
        });
        testWs.on("error", () => {
          resolve(0);
        });
      });

      const [httpResult, wsResult] = await Promise.all([
        httpPromise,
        wsPromise,
      ]);

      expect(httpResult.status).to.equal("ok");
      expect(wsResult).to.be.greaterThan(0);
    });
  });

  describe("WebSocket Stress Tests", () => {
    beforeEach(() => {
      connectionCount = 0;
      messageCount = 0;
      closeCount = 0;
      errorCount = 0;
      messages.length = 0;
    });

    it("should handle rapid connect/disconnect cycles", (done) => {
      let cycles = 0;
      const maxCycles = 5;

      const connect = () => {
        if (cycles >= maxCycles) {
          expect(connectionCount).to.equal(maxCycles);
          expect(closeCount).to.equal(maxCycles);
          done();
          return;
        }

        const testWs: WebSocket = new WebSocket(wsBaseUrl);
        cycles++;

        testWs.on("open", () => {
          testWs.close();
        });

        testWs.on("close", () => {
          setTimeout(connect, 50);
        });

        testWs.on("error", () => {
          setTimeout(connect, 50);
        });
      };

      connect();
    });

    it("should handle multiple rapid messages", (done) => {
      ws = new WebSocket(wsBaseUrl);
      const messagesToSend = 20;

      ws.on("open", () => {
        for (let i = 0; i < messagesToSend; i++) {
          (ws as WebSocket).send(`message-${i}`);
        }
      });

      // Server receives all messages (tracked by messageCount)
      setTimeout(() => {
        expect(messageCount).to.equal(messagesToSend);
        (ws as WebSocket).close();
        done();
      }, 300);

      ws.on("error", (err) => {
        done(err);
      });
    });
  });
});
