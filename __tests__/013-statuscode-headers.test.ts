import { describe, it, before, after } from "mocha";
import { expect } from "chai";
import {
  Spear,
  Controller,
  Get,
  Post,
  StatusCode,
  WriteHeader,
  type T,
} from "../src/lib";
import { ApiClient } from "../src/lib/core/client";
import { getAdapter } from "./app/adapter";

// ============== Controllers with StatusCode Decorator ==============

@Controller("/status")
class StatusCodeController {
  @Get("/default")
  default() {
    return { message: "Default status 200" };
  }

  @Get("/created")
  @StatusCode(201)
  created() {
    return { message: "Resource created", id: 1 };
  }

  @Get("/accepted")
  @StatusCode(202)
  accepted() {
    return { message: "Request accepted for processing" };
  }

  @Get("/no-content")
  @StatusCode(204)
  noContent() {
    return null;
  }

  @Get("/bad-request")
  @StatusCode(400)
  badRequest() {
    return { error: "Bad request" };
  }

  @Get("/unauthorized")
  @StatusCode(401)
  unauthorized() {
    return { error: "Unauthorized" };
  }

  @Get("/forbidden")
  @StatusCode(403)
  forbidden() {
    return { error: "Forbidden" };
  }

  @Get("/not-found")
  @StatusCode(404)
  notFound() {
    return { error: "Not found" };
  }

  @Get("/too-many-requests")
  @StatusCode(429)
  tooManyRequests() {
    return { error: "Rate limit exceeded" };
  }

  @Get("/internal-error")
  @StatusCode(500)
  internalError() {
    return { error: "Internal server error" };
  }

  @Get("/service-unavailable")
  @StatusCode(503)
  serviceUnavailable() {
    return { error: "Service unavailable" };
  }

  @Post("/custom-created")
  @StatusCode(201)
  customCreated({ body }: T.Context) {
    return { created: body, id: 99 };
  }
}

// ============== Controllers with WriteHeader Decorator ==============

@Controller("/headers")
class WriteHeaderController {
  @Get("/basic")
  @WriteHeader(200, { "X-Custom-Header": "custom-value" })
  basic() {
    return { message: "Basic headers" };
  }

  @Get("/multiple")
  @WriteHeader(200, {
    "X-Custom-Header": "custom-value",
    "X-Request-ID": "12345",
    "X-API-Version": "1.0.0",
  })
  multiple() {
    return { message: "Multiple headers" };
  }

  @Get("/cors")
  @WriteHeader(200, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  })
  cors() {
    return { message: "CORS headers" };
  }

  @Get("/security")
  @WriteHeader(200, {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  })
  security() {
    return { message: "Security headers" };
  }

  @Post("/echo-headers")
  @WriteHeader(200, { "X-Response-By": "WriteHeaderController" })
  echoHeaders({ headers }: T.Context) {
    return {
      receivedHeaders: {
        contentType: headers["content-type"],
        authorization: headers["authorization"],
      },
    };
  }
}

// ============== Combined StatusCode + Headers ==============

@Controller("/combined")
class CombinedController {
  @Get("/success")
  @StatusCode(200)
  @WriteHeader(200, { "X-Status": "Success" })
  success() {
    return { status: "ok", message: "Operation successful" };
  }

  @Get("/created-resource")
  @StatusCode(201)
  @WriteHeader(201, {
    "X-Resource-ID": "123",
    Location: "/api/users/123",
  })
  createdResource() {
    return { id: 123, name: "New Resource" };
  }

  @Get("/rate-limit-info")
  @StatusCode(200)
  @WriteHeader(200, {
    "X-RateLimit-Limit": "100",
    "X-RateLimit-Remaining": "95",
  })
  rateLimitInfo() {
    return { message: "Rate limit information" };
  }
}

describe("StatusCode & WriteHeader Decorator Tests", () => {
  let server;
  let client: ApiClient<any>;
  let app: any;

  const { portOffset, adapter } = getAdapter();

  app = new Spear({
    logger: true,
    adapter,
    controllers: [
      StatusCodeController,
      WriteHeaderController,
      CombinedController,
    ],
  });

  app.useBodyParser();

  before((done) => {
    app.listen(5031 + portOffset, ({ port, server: sCallback }: any) => {
      server = sCallback;
      client = new ApiClient(`http://localhost:${port}`);
      done();
    });
  });

  after((done) => {
    done();
  });

  describe("StatusCode Decorator Tests", () => {
    it("should return default 200 status without decorator", async () => {
      const res = await client.get("/status/default");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });

    it("should return 201 Created status", async () => {
      const res = await client.get("/status/created");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(201);
      if (res.ok) {
        expect(res.data).to.have.property("id", 1);
      }
    });

    it("should return 202 Accepted status", async () => {
      const res = await client.get("/status/accepted");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(202);
    });

    it("should return 204 No Content status", async () => {
      const res = await client.get("/status/no-content");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(204);
    });

    it("should return 400 Bad Request status", async () => {
      const res = await client.get("/status/bad-request");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });

    it("should return 401 Unauthorized status", async () => {
      const res = await client.get("/status/unauthorized");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(401);
    });

    it("should return 403 Forbidden status", async () => {
      const res = await client.get("/status/forbidden");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(403);
    });

    it("should return 404 Not Found status", async () => {
      const res = await client.get("/status/not-found");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(404);
    });

    it("should return 429 Too Many Requests status", async () => {
      const res = await client.get("/status/too-many-requests");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(429);
    });

    it("should return 500 Internal Server Error status", async () => {
      const res = await client.get("/status/internal-error");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(500);
    });

    it("should return 503 Service Unavailable status", async () => {
      const res = await client.get("/status/service-unavailable");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(503);
    });

    it("should return 201 for POST with body", async () => {
      const res = await client.post("/status/custom-created", {
        body: { name: "Test Resource" },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(201);
    });
  });

  describe("WriteHeader Decorator Tests", () => {
    it("should set single custom header", async () => {
      const res = await client.get("/headers/basic");
      expect(res.ok).to.be.equal(true);
    });

    it("should set multiple custom headers", async () => {
      const res = await client.get("/headers/multiple");
      expect(res.ok).to.be.equal(true);
    });

    it("should set CORS headers", async () => {
      const res = await client.get("/headers/cors");
      expect(res.ok).to.be.equal(true);
    });

    it("should set security headers", async () => {
      const res = await client.get("/headers/security");
      expect(res.ok).to.be.equal(true);
    });

    it("should receive and echo request headers", async () => {
      const res = await client.post("/headers/echo-headers", {
        body: { test: "data" },
        headers: {
          Authorization: "Bearer token123",
        },
      });
      expect(res.ok).to.be.equal(true);
    });
  });

  describe("Combined StatusCode + Headers Tests", () => {
    it("should set both status code and headers for success", async () => {
      const res = await client.get("/combined/success");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        expect(res.data).to.have.property("status", "ok");
      }
    });

    it("should set 201 status with resource location header", async () => {
      const res = await client.get("/combined/created-resource");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(201);
      if (res.ok) {
        expect(res.data).to.have.property("id", 123);
      }
    });

    it("should set rate limit headers with 200 status", async () => {
      const res = await client.get("/combined/rate-limit-info");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });
  });
});
