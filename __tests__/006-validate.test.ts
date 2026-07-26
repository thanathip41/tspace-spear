import { describe, it, before, after } from "mocha";
import { expect } from "chai";
import {
  Spear,
  Controller,
  Get,
  Post,
  Put,
  Validate,
  type T,
} from "../src/lib";
import { ApiClient } from "../src/lib/core/client";
import { getAdapter } from "./app/adapter";

@Controller("/auth")
class AuthController {
  private users: any[] = [
    { id: 1, email: "user@example.com", password: "hashed123" },
  ];

  @Post("/login")
  @Validate(["email", "password"], {
    required: {
      allowNull: false,
      allowEmptyString: false,
    },
  })
  login({ body }: T.Context): any {
    const user = this.users.find((u) => u.email === body.email);
    if (!user) {
      return { error: "Invalid credentials" };
    }
    return { token: "fake-token", email: body.email };
  }

  @Post("/register")
  @Validate(["email", "password", "name"], {
    required: true,
  })
  register({ body }: T.Context): any {
    const newUser = { id: this.users.length + 1, ...body };
    this.users.push(newUser);
    return { created: newUser };
  }
}

@Controller("/users")
class UsersController {
  @Post("/")
  @Validate(["name", "email"], {
    required: {
      allowNull: false,
      allowEmptyString: false,
    },
  })
  create({ body }: T.Context): any {
    return { created: body };
  }

  @Post("/optional")
  @Validate(["name"], {
    required: {
      allowNull: true,
      allowEmptyString: false,
    },
  })
  createOptional({ body }: T.Context): any {
    return { created: body };
  }

  @Post("/allow-empty")
  @Validate(["name"], {
    required: {
      allowNull: false,
      allowEmptyString: true,
    },
  })
  createAllowEmpty({ body }: T.Context): any {
    return { created: body };
  }
}

@Controller("/products")
class ProductsController {
  @Post("/")
  @Validate(["name", "price", "category"], {
    required: true,
  })
  create({ body }: T.Context): any {
    return { created: body };
  }

  @Put("/:id")
  @Validate(["name", "price"], {
    required: false,
  })
  update({ body }: T.Context): any {
    return { updated: body };
  }
}

@Controller("/query-test")
class QueryTestController {
  @Get("/search")
  @Validate(["q", "page"], {
    target: "query",
    required: true,
  })
  search({ query }: T.Context): any {
    return { results: `Searching for "${query.q}" on page ${query.page}` };
  }

  @Get("/filter")
  @Validate(["category"], {
    target: "query",
    required: {
      allowNull: false,
      allowEmptyString: false,
    },
  })
  filter({ query }: T.Context): any {
    return { category: query.category };
  }
}

@Controller("/params-test")
class ParamsTestController {
  @Get("/:id/:action")
  @Validate(["id", "action"], {
    target: "params",
    required: true,
  })
  getAction({ params }: T.Context): any {
    return { id: params.id, action: params.action };
  }
}

describe("Pure @Validate Decorator Tests", () => {
  let server;
  let client: ApiClient<any>;
  let app: any;

  const { portOffset, adapter } = getAdapter();

  app = new Spear({
    logger: true,
    adapter,
    controllers: [
      AuthController,
      UsersController,
      ProductsController,
      QueryTestController,
      ParamsTestController,
    ],
  });

  app.useBodyParser();

  before((done) => {
    app.listen(5012 + portOffset, ({ port, server: sCallback }: any) => {
      server = sCallback;
      client = new ApiClient(`http://localhost:${port}`);
      done();
    });
  });

  after((done) => {
    done();
  });

  describe("Body Validation - required: { allowNull: false, allowEmptyString: false }", () => {
    it("should reject missing required field", async () => {
      const res = await client.post("/auth/login", {
        body: { email: "user@example.com" },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
      if (!res.ok) {
        const data: any = res.data;
        expect(data).to.have.property("issues");
        expect(data.issues.find((i: any) => i.path === "password")).to.exist;
      }
    });

    it("should reject null value when allowNull: false", async () => {
      const res = await client.post("/auth/login", {
        body: { email: null, password: "test123" },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });

    it("should reject empty string when allowEmptyString: false", async () => {
      const res = await client.post("/auth/login", {
        body: { email: "", password: "test123" },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });

    it("should accept valid data", async () => {
      const res = await client.post("/auth/login", {
        body: { email: "user@example.com", password: "test123" },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });
  });

  describe("Body Validation - required: true (default strict)", () => {
    it("should reject missing field", async () => {
      const res = await client.post("/users", {
        body: { name: "Test" } as any,
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });

    it("should reject null value", async () => {
      const res = await client.post("/users", {
        body: { name: null, email: "test@example.com" },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });

    it("should reject empty string", async () => {
      const res = await client.post("/users", {
        body: { name: "", email: "test@example.com" },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });

    it("should accept valid data", async () => {
      const res = await client.post("/users", {
        body: { name: "Test User", email: "test@example.com" },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });
  });

  describe("Body Validation - required: { allowNull: true }", () => {
    it("should accept null value when allowNull: true", async () => {
      const res = await client.post("/users/optional", {
        body: { name: null },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });

    it("should still reject empty string when allowEmptyString: false", async () => {
      const res = await client.post("/users/optional", {
        body: { name: "" },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });

    it("should accept valid string", async () => {
      const res = await client.post("/users/optional", {
        body: { name: "Valid Name" },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });
  });

  describe("Body Validation - required: { allowEmptyString: true }", () => {
    it("should accept empty string when allowEmptyString: true", async () => {
      const res = await client.post("/users/allow-empty", {
        body: { name: "" },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });

    it("should still reject null when allowNull: false", async () => {
      const res = await client.post("/users/allow-empty", {
        body: { name: null },
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });
  });

  describe("Multiple Fields Validation", () => {
    it("should reject when any of multiple fields is missing", async () => {
      const res = await client.post("/products", {
        body: { name: "Product", price: 10 } as any,
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
      if (!res.ok) {
        const data: any = res.data;
        expect(data.issues.find((i: any) => i.path === "category")).to.exist;
      }
    });

    it("should report all missing fields", async () => {
      const res = await client.post("/products", {
        body: {} as any,
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
      if (!res.ok) {
        const data: any = res.data;
        expect(data.issues).to.have.length(3);
        expect(data.issues.map((i: any) => i.path)).to.include.members([
          "name",
          "price",
          "category",
        ]);
      }
    });

    it("should accept all required fields", async () => {
      const res = await client.post("/products", {
        body: { name: "Product", price: 10, category: "Electronics" },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });
  });

  describe("required: false (no required validation)", () => {
    it("should accept request without required fields when required: false", async () => {
      const res = await client.put("/products/1", {
        body: {
          name: null,
          price: null,
        },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });

    it("should still accept with fields provided", async () => {
      const res = await client.put("/products/1", {
        body: { name: "Updated", price: 20 },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });
  });

  describe("Query Validation - target: 'query'", () => {
    it("should reject missing required query param", async () => {
      const res = await client.get("/query-test/search");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });

    it("should reject null query param", async () => {
      const res = await client.get("/query-test/search?q=test");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });

    it("should accept valid query params", async () => {
      const res = await client.get("/query-test/search?q=test&page=1");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data: any = res.data;
        expect(data).to.have.property("results");
      }
    });

    it("should reject empty query string when allowEmptyString: false", async () => {
      const res = await client.get("/query-test/filter?category=");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });

    it("should accept valid query param", async () => {
      const res = await client.get("/query-test/filter?category=electronics");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
    });
  });

  describe("Params Validation - target: 'params'", () => {
    it("should validate route params", async () => {
      const res = await client.get("/params-test/123/view");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        expect(res.data).to.have.property("id", 123);
        expect(res.data).to.have.property("action", "view");
      }
    });
  });
});
