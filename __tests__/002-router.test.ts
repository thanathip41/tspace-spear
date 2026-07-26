import { describe, it, before, after } from "mocha";
import { expect } from "chai";
import { Spear, Router } from "../src/lib";
import { ApiClient } from "../src/lib/core/client";
import { getAdapter } from "./app/adapter";

describe("Router Unit Tests", () => {
  const { portOffset } = getAdapter();

  let server;
  let client: ApiClient<any>;

  // Create a router for users
  const userRouter = new Router()
    .get("/users", () => ({
      users: [
        { id: 1, name: "John" },
        { id: 2, name: "Jane" },
      ],
    }))
    .get("/users/:id", (ctx) => ({ userId: ctx.params.id }))
    .post("/users", (ctx) => ({ created: ctx.body }))
    .put("/users/:id", (ctx) => ({
      updated: { id: ctx.params.id, ...ctx.body },
    }))
    .patch("/users/:id", (ctx) => ({
      patched: { id: ctx.params.id, ...ctx.body },
    }))
    .delete("/users/:id", () => ({ deleted: true }));

  // Create a router for cats (demonstrating multiple routers)
  const catRouter = new Router()
    .get("/cats", () => ({
      cats: [
        { id: 1, name: "Whiskers" },
        { id: 2, name: "Mittens" },
      ],
    }))
    .get("/cats/:id", (ctx) => ({ catId: ctx.params.id }))
    .post("/cats", (ctx) => ({ created: ctx.body }));

  // Create main app and use routers with dynamic adapter
  const { adapter } = getAdapter();
  const app = new Spear({ logger: true, adapter })
    .useBodyParser()
    .useRouter(userRouter)
    .useRouter(catRouter)
    .get("/hello", () => ({ message: "Hello World" }))
    .get("/query-test", (ctx) => ({ query: ctx.query }));

  before((done) => {
    app.listen(5002 + portOffset, ({ port, server: sCallback }) => {
      server = sCallback;
      client = new ApiClient(`http://localhost:${port}`);
      done();
    });
  });

  after((done) => {
    done();
  });

  // Tests for /hello route (direct app route)
  it("GET /hello should return Hello World message", async () => {
    const res = await client.get("/hello");
    expect(res.ok).to.be.equal(true);
    expect(res.status).to.be.equal(200);
    if (res.ok) {
      expect(res.data).to.deep.equal({ message: "Hello World" });
    }
  });

  // Tests for user routes (from userRouter)
  describe("User Router Tests", () => {
    it("GET /users should return all users", async () => {
      const res = await client.get("/users");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        expect(res.data).to.deep.equal({
          users: [
            { id: 1, name: "John" },
            { id: 2, name: "Jane" },
          ],
        });
      }
    });

    it("GET /users/:id should return user with param id", async () => {
      const res = await client.get("/users/123");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data: any = res.data;
        expect(data.userId).to.be.equal(123);
      }
    });

    it("POST /users should create new user", async () => {
      const res = await client.post("/users", {
        body: { name: "John", email: "john@example.com" },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data: any = res.data;
        expect(data.created).to.deep.equal({
          name: "John",
          email: "john@example.com",
        });
      }
    });

    it("PUT /users/:id should update user", async () => {
      const res = await client.put("/users/123", {
        body: { name: "Jane" },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data: any = res.data;
        expect(data.updated).to.deep.equal({ id: 123, name: "Jane" });
      }
    });

    it("PATCH /users/:id should patch user", async () => {
      const res = await client.patch("/users/123", {
        body: { email: "jane@example.com" },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data: any = res.data;
        expect(data.patched).to.deep.equal({
          id: 123,
          email: "jane@example.com",
        });
      }
    });

    it("DELETE /users/:id should delete user", async () => {
      const res = await client.delete("/users/123");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data: any = res.data;
        expect(data.deleted).to.be.equal(true);
      }
    });
  });

  // Tests for cat routes (from catRouter)
  describe("Cat Router Tests", () => {
    it("GET /cats should return all cats", async () => {
      const res = await client.get("/cats");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        expect(res.data).to.deep.equal({
          cats: [
            { id: 1, name: "Whiskers" },
            { id: 2, name: "Mittens" },
          ],
        });
      }
    });

    it("GET /cats/:id should return cat with param id", async () => {
      const res = await client.get("/cats/456");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data: any = res.data;
        expect(data.catId).to.be.equal(456);
      }
    });

    it("POST /cats should create new cat", async () => {
      const res = await client.post("/cats", {
        body: { name: "Fluffy", age: 3 },
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data: any = res.data;
        expect(data.created).to.deep.equal({
          name: "Fluffy",
          age: 3,
        });
      }
    });
  });

  // Tests for query parameters
  it("GET /query-test should parse query parameters", async () => {
    const res = await client.get("/query-test?name=John&age=30&active=true");
    expect(res.ok).to.be.equal(true);
    expect(res.status).to.be.equal(200);
    if (res.ok) {
      const data: any = res.data;
      expect(data.query).to.include({
        name: "John",
        age: "30",
        active: "true",
      });
    }
  });

  // Test for 404
  it("GET /nonexistent should return 404", async () => {
    const res = await client.get("/nonexistent");
    expect(res.ok).to.be.equal(false);
    expect(res.status).to.be.equal(404);
  });
});
