import { describe, it, before, after } from "mocha";
import { expect } from "chai";
import { Server } from "http";
import { Spear } from "../src/lib";
import { ApiClient } from "../src/lib/core/client";

describe("Router Unit Tests", () => {
  let server: Server;
  let client: ApiClient<any>;

  const app = new Spear({ logger: true })
    .useBodyParser()
    .get("/hello", () => ({ message: "Hello World" }))
    .get("/users/:id", (ctx) => ({ userId: ctx.params.id }))
    .post("/users", (ctx) => ({ created: ctx.body }))
    .put("/users/:id", (ctx) => ({
      updated: { id: ctx.params.id, ...ctx.body },
    }))
    .patch("/users/:id", (ctx) => ({
      patched: { id: ctx.params.id, ...ctx.body },
    }))
    .delete("/users/:id", () => ({ deleted: true }))
    .get("/query-test", (ctx) => ({ query: ctx.query }));

  before((done) => {
    app.listen(5003, ({ port, server: sCallback }) => {
      server = sCallback;
      client = new ApiClient(`http://localhost:${port}`);
      done();
    });
  });

  after((done) => {
    server?.close(() => done());
  });

  it("GET /hello should return Hello World message", async () => {
    const res = await client.get("/hello");
    expect(res.ok).to.be.equal(true);
    expect(res.status).to.be.equal(200);
    if (res.ok) {
      expect(res.data).to.deep.equal({ message: "Hello World" });
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

  it("GET /nonexistent should return 404", async () => {
    const res = await client.get("/nonexistent");
    expect(res.ok).to.be.equal(false);
    expect(res.status).to.be.equal(404);
  });
});
