import { describe, it, before, after } from "mocha";
import { expect } from "chai";
import { Server } from "http";
import {
  Spear,
  Controller,
  Get,
  Post,
  Put,
  createDtoDecorator,
  type T,
} from "../src/lib";
import { ApiClient } from "../src/lib/core/client";
import { getAdapter } from "./app/adapter";

// ============== Custom DTO Validators ==============

/**
 * Custom body validator - checks if specified fields exist (not null or undefined)
 */
const ValidateDtoCustomBody = (keys: string[]) => {
  return createDtoDecorator(
    (ctx: any) => {
      const body = ctx.body ?? {};
      const issues: Array<{ path: string; message: string }> = [];

      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];

        if (body[key] == null) {
          issues.push({
            path: key,
            message: "Missing field",
          });
        }
      }

      if (issues.length > 0) {
        throw {
          message: "Validation failed",
          issues,
        };
      }
    },
    (ctx: any, error: any) => {
      return ctx.res.status(400).json({
        message: error.message || "Validation failed",
        issues: error.issues || [],
      });
    },
  );
};

/**
 * Custom body validator with type check - validates field types
 */
const ValidateTypes = (types: Record<string, string>) => {
  return createDtoDecorator((ctx: any) => {
    const body = ctx.body ?? {};
    const issues: Array<{ path: string; message: string }> = [];

    for (const [key, expectedType] of Object.entries(types)) {
      const value = body[key];

      if (value === undefined) {
        issues.push({
          path: key,
          message: `Missing field: ${key}`,
        });
        continue;
      }

      const actualType = Array.isArray(value) ? "array" : typeof value;

      if (actualType !== expectedType) {
        issues.push({
          path: key,
          message: `Expected type '${expectedType}' but got '${actualType}'`,
        });
      }
    }

    if (issues.length > 0) {
      throw {
        message: "Validation failed",
        issues,
      };
    }
  });
};

/**
 * Custom query validator - checks if specified query params exist
 */
const ValidateQueryParams = (keys: string[]) => {
  return createDtoDecorator((ctx: any) => {
    const query = ctx.query ?? {};
    const issues: Array<{ path: string; message: string }> = [];

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];

      if (query[key] == null || query[key] === "") {
        issues.push({
          path: key,
          message: `Missing query parameter: ${key}`,
        });
      }
    }

    if (issues.length > 0) {
      throw {
        message: "Validation failed",
        issues,
      };
    }
  });
};

/**
 * Custom validator with min/max value check for numbers
 */
const ValidateNumberRange = (key: string, min: number, max: number) => {
  return createDtoDecorator((ctx: any) => {
    const body = ctx.body ?? {};
    const issues: Array<{ path: string; message: string }> = [];
    const value = body[key];

    if (value == null) {
      issues.push({
        path: key,
        message: `Missing field: ${key}`,
      });
    } else if (typeof value !== "number") {
      issues.push({
        path: key,
        message: `Expected number but got '${typeof value}'`,
      });
    } else if (value < min || value > max) {
      issues.push({
        path: key,
        message: `Value must be between ${min} and ${max}`,
      });
    }

    if (issues.length > 0) {
      throw {
        message: "Validation failed",
        issues,
      };
    }
  });
};

/**
 * Custom validator for email format (simple regex check)
 */
const ValidateEmail = (key: string = "email") => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return createDtoDecorator((ctx: any) => {
    const body = ctx.body ?? {};
    const issues: Array<{ path: string; message: string }> = [];
    const value = body[key];

    if (value == null) {
      issues.push({
        path: key,
        message: `Missing field: ${key}`,
      });
    } else if (typeof value !== "string") {
      issues.push({
        path: key,
        message: `Expected string but got '${typeof value}'`,
      });
    } else if (!emailRegex.test(value)) {
      issues.push({
        path: key,
        message: "Invalid email format",
      });
    }

    if (issues.length > 0) {
      throw {
        message: "Validation failed",
        issues,
      };
    }
  });
};

// ============== Controllers ==============

@Controller("/custom")
class CustomDtoController {
  @Post("/basic")
  @ValidateDtoCustomBody(["name", "age"])
  basic(ctx: T.Context<{ body: { name: string; age: number } }>): any {
    return { body: ctx.body };
  }

  @Post("/types")
  @ValidateTypes({ name: "string", age: "number", active: "boolean" })
  types(ctx: T.Context): any {
    return { body: ctx.body };
  }

  @Post("/range")
  @ValidateNumberRange("score", 0, 100)
  range(ctx: T.Context): any {
    return { body: ctx.body };
  }

  @Post("/email")
  @ValidateEmail("email")
  email(ctx: T.Context): any {
    return { body: ctx.body };
  }

  @Post("/combined")
  @ValidateDtoCustomBody(["name", "email"])
  @ValidateEmail("email")
  combined(ctx: T.Context): any {
    return { body: ctx.body };
  }
}

@Controller("/custom-query")
class CustomQueryController {
  @Get("/search")
  @ValidateQueryParams(["q", "page"])
  search(ctx: T.Context): any {
    return { query: ctx.query };
  }

  @Get("/filter")
  @ValidateQueryParams(["category"])
  filter(ctx: T.Context): any {
    return { query: ctx.query };
  }
}

@Controller("/custom-params")
class CustomParamsController {
  @Get("/:id/:action")
  @ValidateQueryParams(["id", "action"])
  action(ctx: T.Context): any {
    return { params: ctx.params };
  }
}

describe("Custom DTO Validator Tests", () => {
  let server: Server;
  let client: ApiClient<any>;
  let app: any;

  const { portOffset, adapter } = getAdapter();

  app = new Spear({
    logger: true,
    adapter,
    controllers: [
      CustomDtoController,
      CustomQueryController,
      CustomParamsController,
    ],
  });

  app.useBodyParser();

  before((done) => {
    app.listen(5013 + portOffset, ({ port, server: sCallback }: any) => {
      server = sCallback;
      client = new ApiClient(`http://localhost:${port}`);
      done();
    });
  });

  after((done) => {
    done()
  });

  describe("ValidateDtoCustomBody - Basic field existence check", () => {
    it("should accept valid data with all required fields", async () => {
      const res = await client.post("/custom/basic", {
        body: { name: "Test", age: 25 },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data: any = res.data;
        expect(data.body).to.have.property("name", "Test");
        expect(data.body).to.have.property("age", 25);
      }
    });

    it("should reject when name is missing", async () => {
      const res = await client.post("/custom/basic", {
        body: { age: 25 } as any,
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
      if (!res.ok) {
        const data: any = res.data;
        expect(data.issues.find((i: any) => i.path === "name")).to.exist;
      }
    });

    it("should reject when age is missing", async () => {
      const res = await client.post("/custom/basic", {
        body: { name: "Test" } as any,
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
      if (!res.ok) {
        const data: any = res.data;
        expect(data.issues.find((i: any) => i.path === "age")).to.exist;
      }
    });

    it("should reject when both fields are missing", async () => {
      const res = await client.post("/custom/basic", {
        body: {} as any,
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
      if (!res.ok) {
        const data: any = res.data;
        expect(data.issues).to.have.length(2);
      }
    });

    it("should reject when field is null", async () => {
      const res = await client.post("/custom/basic", {
        body: { name: null, age: 25 },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });
  });

  describe("ValidateTypes - Type checking validator", () => {
    it("should accept correct types", async () => {
      const res = await client.post("/custom/types", {
        body: { name: "Test", age: 25, active: true },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });

    it("should reject wrong type for name", async () => {
      const res = await client.post("/custom/types", {
        body: { name: 123, age: 25, active: true },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
      if (!res.ok) {
        const data: any = res.data;
        expect(data.issues.find((i: any) => i.path === "name")).to.exist;
      }
    });

    it("should reject wrong type for age", async () => {
      const res = await client.post("/custom/types", {
        body: { name: "Test", age: "25", active: true },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });

    it("should reject wrong type for active", async () => {
      const res = await client.post("/custom/types", {
        body: { name: "Test", age: 25, active: "yes" },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });

    it("should reject missing field", async () => {
      const res = await client.post("/custom/types", {
        body: { name: "Test", age: 25 } as any,
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });
  });

  describe("ValidateNumberRange - Min/Max value validator", () => {
    it("should accept value within range", async () => {
      const res = await client.post("/custom/range", {
        body: { score: 50 },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });

    it("should accept minimum value", async () => {
      const res = await client.post("/custom/range", {
        body: { score: 0 },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });

    it("should accept maximum value", async () => {
      const res = await client.post("/custom/range", {
        body: { score: 100 },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });

    it("should reject value below minimum", async () => {
      const res = await client.post("/custom/range", {
        body: { score: -1 },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });

    it("should reject value above maximum", async () => {
      const res = await client.post("/custom/range", {
        body: { score: 101 },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });

    it("should reject non-number value", async () => {
      const res = await client.post("/custom/range", {
        body: { score: "50" },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });

    it("should reject missing field", async () => {
      const res = await client.post("/custom/range", {
        body: {},
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });
  });

  describe("ValidateEmail - Email format validator", () => {
    it("should accept valid email", async () => {
      const res = await client.post("/custom/email", {
        body: { email: "user@example.com" },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });

    it("should reject invalid email format", async () => {
      const res = await client.post("/custom/email", {
        body: { email: "not-an-email" },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });

    it("should reject email without domain", async () => {
      const res = await client.post("/custom/email", {
        body: { email: "user@" },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });

    it("should reject email without local part", async () => {
      const res = await client.post("/custom/email", {
        body: { email: "@example.com" },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });

    it("should reject missing email field", async () => {
      const res = await client.post("/custom/email", {
        body: {},
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });
  });

  describe("Combined Validators", () => {
    it("should pass both validators with valid data", async () => {
      const res = await client.post("/custom/combined", {
        body: { name: "Test", email: "test@example.com" },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });

    it("should fail first validator when name missing", async () => {
      const res = await client.post("/custom/combined", {
        body: { email: "test@example.com" } as any,
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });

    it("should fail second validator when email invalid", async () => {
      const res = await client.post("/custom/combined", {
        body: { name: "Test", email: "invalid" },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });
  });

  describe("Custom Query Validator", () => {
    it("should accept valid query params", async () => {
      const res = await client.get("/custom-query/search?q=test&page=1");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });

    it("should reject missing query param", async () => {
      const res = await client.get("/custom-query/search?q=test");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });

    it("should reject empty query param", async () => {
      const res = await client.get("/custom-query/search?q=&page=1");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });

    it("should accept single required param", async () => {
      const res = await client.get("/custom-query/filter?category=books");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });
  });
});