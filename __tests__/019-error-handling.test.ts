import { describe, it, before, after } from "mocha";
import { expect } from "chai";
import { Spear, Controller, Get, Post, type T } from "../src/lib";
import { ApiClient } from "../src/lib/core/client";
import { getAdapter } from "./app/adapter";

// ============== Error Test Controller ==============

@Controller("/errors")
class ErrorController {
  @Get("/throw")
  throwError() {
    throw new Error("Intentional error for testing");
  }

  @Get("/async-throw")
  async throwAsync() {
    await new Promise((resolve) => setTimeout(resolve, 10));
    throw new Error("Async intentional error");
  }

  @Get("/notfound")
  notFound({ res }: T.Context) {
    throw res.notFound("Resource not found");
  }

  @Get("/unauthorized")
  unauthorized({ res }: T.Context) {
    throw res.unauthorized("Access denied");
  }

  @Get("/forbidden")
  forbidden({ res }: T.Context) {
    throw res.forbidden("You don't have permission");
  }

  @Get("/bad-request")
  badRequest({ res }: T.Context) {
    throw res.badRequest("Invalid input data");
  }

  @Get("/conflict")
  conflict({ res }: T.Context) {
    throw res.status(409).json({ message: "Resource already exists" });
  }

  @Get("/teapot")
  teapot({ res }: T.Context) {
    throw res.status(418).json({ message: "I'm a teapot" });
  }

  @Post("/validation-error")
  validationError({ body, res }: T.Context<{ body: { email?: string } }>) {
    if (!body.email || !body.email.includes("@")) {
      throw res.badRequest("Invalid email format");
    }
    return { success: true };
  }
}

@Controller("/async-errors")
class AsyncErrorController {
  @Get("/rejected-promise")
  async rejectedPromise() {
    return await Promise.reject(new Error("Promise rejection test"));
  }

  @Get("/timeout-error")
  async timeoutError() {
    await new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Timeout simulation")), 50);
    });
  }
}

describe("Error Handling Tests", () => {
  let server;
  let client: ApiClient<any>;
  let app: any;
  let portOffset: number;
  let adapter: any;

  const adapterConfig = getAdapter();
  portOffset = adapterConfig.portOffset;
  adapter = adapterConfig.adapter;

  // Custom error handler
  const errorHandlerCalls: any[] = [];

  app = new Spear({
    logger: false,
    adapter,
    controllers: [ErrorController, AsyncErrorController],
  });

  app.useBodyParser();

  // Custom error handler
  app.catch((err: any, ctx: any) => {
    errorHandlerCalls.push({
      error: err.message,
      path: ctx.req.url,
      method: ctx.req.method,
      timestamp: Date.now(),
    });

    return ctx.res.json({
      error: true,
      message: err.message,
      path: ctx.req.url,
    });
  });

  // Custom notfound handler
  const notFoundCalls: any[] = [];
  app.notfound((ctx: any) => {
    notFoundCalls.push({
      path: ctx.req.url,
      method: ctx.req.method,
      timestamp: Date.now(),
    });

    return ctx.res.json({
      error: true,
      message: "Route not found",
      path: ctx.req.url,
    });
  });

  before((done) => {
    app.listen(5100 + portOffset, ({ port, server: sCallback }: any) => {
      server = sCallback;
      client = new ApiClient(`http://localhost:${port}`);
      done();
    });
  });

  after((done) => {
    done();
  });

  beforeEach(() => {
    errorHandlerCalls.length = 0;
    notFoundCalls.length = 0;
  });

  describe("Basic Error Tests", () => {
    it("should handle synchronous thrown errors", async () => {
      const res = await client.get("/errors/throw");
      expect(res.ok).to.be.equal(true);
      expect(res.data).to.have.property("error", true);
      expect(res.data.message).to.include("Intentional error");
    });

    it("should handle asynchronous thrown errors", async () => {
      const res = await client.get("/errors/async-throw");
      expect(res.ok).to.be.equal(true);
      expect(res.data).to.have.property("error", true);
    });

    it("should handle Promise rejections", async () => {
      const res = await client.get("/async-errors/rejected-promise");
      expect(res.ok).to.be.equal(true);
      expect(res.data).to.have.property("error", true);
    });

    it("should handle timeout errors", async () => {
      const res = await client.get("/async-errors/timeout-error");
      expect(res.ok).to.be.equal(true);
      expect(res.data).to.have.property("error", true);
    });
  });

  describe("HTTP Status Error Tests", () => {
    it("should handle 404 not found errors", async () => {
      const res = await client.get("/errors/notfound");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(404);
      expect(res.data.message).to.equal("Resource not found");
    });

    it("should handle 401 unauthorized errors", async () => {
      const res = await client.get("/errors/unauthorized");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(401);
      expect(res.data.message).to.equal("Access denied");
    });

    it("should handle 403 forbidden errors", async () => {
      const res = await client.get("/errors/forbidden");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(403);
      expect(res.data.message).to.equal("You don't have permission");
    });

    it("should handle 400 bad request errors", async () => {
      const res = await client.get("/errors/bad-request");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
      expect(res.data.message).to.equal("Invalid input data");
    });

    it("should handle 409 conflict errors", async () => {
      const res = await client.get("/errors/conflict");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(409);
      expect(res.data.message).to.equal("Resource already exists");
    });

    it("should handle custom status codes (418 teapot)", async () => {
      const res = await client.get("/errors/teapot");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(418);
    });
  });

  describe("Custom Error Handler Tests", () => {
    it("should call custom error handler on errors", async () => {
      const res = await client.get("/errors/throw");
      expect(errorHandlerCalls.length).to.be.greaterThan(0);
      expect(errorHandlerCalls[0].error).to.include("Intentional error");
      expect(errorHandlerCalls[0].path).to.equal("/errors/throw");
    });

    it("should return custom error response format", async () => {
      const res = await client.get("/errors/throw");
      expect(res.data).to.have.property("error", true);
      expect(res.data).to.have.property("message");
      expect(res.data).to.have.property("path");
    });

    it("should track all error calls", async () => {
      errorHandlerCalls.length = 0;
      // Use endpoints that throw regular Errors (go to catch handler)
      await client.get("/errors/throw");
      await client.get("/errors/async-throw");
      await client.get("/async-errors/rejected-promise");

      expect(errorHandlerCalls.length).to.be.equal(3);
      expect(errorHandlerCalls[0].error).to.include("Intentional error");
      expect(errorHandlerCalls[1].error).to.include("Async intentional");
      expect(errorHandlerCalls[2].error).to.include("Promise rejection");
    });
  });

  describe("Custom Not Found Handler Tests", () => {
    it("should call custom notfound handler for unknown routes", async () => {
      const res = await client.get("/unknown/route/that/does/not/exist");
      expect(res.ok).to.be.equal(true);
      expect(res.data).to.have.property("error", true);
      expect(res.data.message).to.equal("Route not found");
    });

    it("should track notfound calls", async () => {
      await client.get("/nonexistent1");
      await client.get("/nonexistent2");

      expect(notFoundCalls.length).to.be.equal(2);
    });

    it("should return custom notfound response format", async () => {
      const res = await client.get("/does-not-exist");
      expect(res.data).to.have.property("error", true);
      expect(res.data).to.have.property("message", "Route not found");
      expect(res.data).to.have.property("path");
    });
  });

  describe("Validation Error Tests", () => {
    it("should handle validation errors with proper message", async () => {
      const res = await client.post("/errors/validation-error", {
        body: { email: "invalid" },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
      expect(res.data.message).to.equal("Invalid email format");
    });

    it("should pass valid validation", async () => {
      const res = await client.post("/errors/validation-error", {
        body: { email: "valid@example.com" },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      expect(res.data.success).to.be.equal(true);
    });
  });

  describe("Error Response Headers Tests", () => {
    it("should include content-type header in error responses", async () => {
      const res = await client.get("/errors/throw");
      expect(res.headers.get("content-type")).to.exist;
    });

    it("should include proper status code in error response", async () => {
      const res = await client.get("/errors/unauthorized");
      expect(res.status).to.be.equal(401);
    });
  });

  describe("Error Stack and Debug Info Tests", () => {
    it("should not expose stack trace in production-like errors", async () => {
      const res = await client.get("/errors/throw");
      // Error response should not contain stack trace in production mode
      expect(res.data).to.not.have.property("stack");
    });

    it("should preserve error message for debugging", async () => {
      const res = await client.get("/errors/throw");
      expect(res.data.message).to.be.a("string");
      expect(res.data.message.length).to.be.greaterThan(0);
    });
  });

  describe("Multiple Error Types Tests", () => {
    it("should handle different error types from same controller", async () => {
      // Test all error types - some go to catch handler, some return status codes
      const errorTests = [
        { path: "/errors/throw", checkOk: true, checkErrorProp: true },
        { path: "/errors/notfound", checkOk: false, checkStatus: 404 },
        { path: "/errors/unauthorized", checkOk: false, checkStatus: 401 },
        { path: "/errors/forbidden", checkOk: false, checkStatus: 403 },
        { path: "/errors/bad-request", checkOk: false, checkStatus: 400 },
        { path: "/errors/conflict", checkOk: false, checkStatus: 409 },
      ];

      for (const test of errorTests) {
        const res = await client.get(test.path);
        if (test.checkOk) {
          expect(res.ok).to.be.equal(true, `Failed for ${test.path}`);
          if (test.checkErrorProp) {
            expect(res.data).to.have.property(
              "error",
              true,
              `Failed for ${test.path}`,
            );
          }
        } else {
          expect(res.ok).to.be.equal(false, `Failed for ${test.path}`);
          if (test.checkStatus) {
            expect(res.status).to.be.equal(
              test.checkStatus,
              `Failed for ${test.path}`,
            );
          }
        }
      }
    });
  });

  describe("Error Handler Order Tests", () => {
    it("should call error handler before returning response", async () => {
      errorHandlerCalls.length = 0;
      const res = await client.get("/errors/throw");

      // Error handler should be called before response is sent
      expect(errorHandlerCalls.length).to.be.equal(1);
      expect(res.data.message).to.include("Intentional error");
    });
  });
});
