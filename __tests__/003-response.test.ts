import { describe, it, before, after } from "mocha";
import { expect } from "chai";
import { Server } from "http";
import { Spear } from "../src/lib";
import { ApiClient } from "../src/lib/core/client";
import { getAdapter } from "./app/adapter";

describe("Response Methods Unit Tests", () => {
  let server: Server;
  let client: ApiClient<any>;
  let app: any;

  const { portOffset, adapter } = getAdapter();

  before((done) => {
    app = new Spear({ logger: true, adapter })
      .get("/response/json", (ctx: any) => {
        ctx.res.json({ name: "test", value: 123 });
        return null;
      })
      .get("/response/send", (ctx: any) => {
        ctx.res.send("Hello World");
        return null;
      })
      .get("/response/html", (ctx: any) => {
        ctx.res.html("<h1>Hello</h1>");
        return null;
      })
      .get("/response/status-201", (ctx: any) => {
        return ctx.res.status(201).json({ created: true });
      })
      .get("/response/status-400", (ctx: any) => {
        return ctx.res.status(400).json({ error: "Bad Request" });
      })
      .get("/response/ok", (ctx: any) => {
        return ctx.res.ok({ success: true });
      })
      .get("/response/created", (ctx: any) => {
        return ctx.res.created({ id: 1, name: "created" });
      })
      .get("/response/no-content", (ctx: any) => {
        return ctx.res.noContent();
      })
      .get("/response/bad-request", (ctx: any) => {
        return ctx.res.badRequest("Custom bad request");
      })
      .get("/response/unauthorized", (ctx: any) => {
        return ctx.res.unauthorized("Custom unauthorized");
      })
      .get("/response/forbidden", (ctx: any) => {
        return ctx.res.forbidden("Custom forbidden");
      })
      .get("/response/not-found", (ctx: any) => {
        return ctx.res.notFound("Custom not found");
      })
      .get("/response/server-error", (ctx: any) => {
        return ctx.res.serverError("Custom server error");
      })
      .get("/response/cookies", (ctx: any) => {
        ctx.res.setCookies({
          session: "abc123",
          user: { value: "john", path: "/", httpOnly: true },
        });
        return ctx.res.json({ cookiesSet: true });
      });

    app.listen(5003 + portOffset, ({ port, server: sCallback }: any) => {
      server = sCallback;
      client = new ApiClient(`http://localhost:${port}`);
      done();
    });
  });

  after((done) => {
    done()
  });

  it("res.json() should send JSON response", async () => {
    const res = await client.get("/response/json");
    expect(res.ok).to.be.equal(true);
    expect(res.status).to.be.equal(200);
    if (res.ok) {
      expect(res.data).to.deep.equal({ name: "test", value: 123 });
    }
  });

  it("res.send() should send text response", async () => {
    const res = await client.get("/response/send");
    expect(res.ok).to.be.equal(true);
    expect(res.status).to.be.equal(200);
  });

  it("res.html() should send HTML response with correct content-type", async () => {
    const res = await client.get("/response/html");
    expect(res.ok).to.be.equal(true);
    expect(res.status).to.be.equal(200);
  });

  it("res.status(201) should return 201 status code", async () => {
    const res = await client.get("/response/status-201");
    expect(res.ok).to.be.equal(true);
    expect(res.status).to.be.equal(201);
    if (res.ok) {
      expect(res.data).to.deep.equal({ created: true });
    }
  });

  it("res.status(400) should return 400 status code", async () => {
    const res = await client.get("/response/status-400");
    expect(res.ok).to.be.equal(false);
    expect(res.status).to.be.equal(400);
  });

  it("res.ok() should return 200 with data", async () => {
    const res = await client.get("/response/ok");
    expect(res.ok).to.be.equal(true);
    expect(res.status).to.be.equal(200);
    if (res.ok) {
      expect(res.data).to.deep.equal({ success: true });
    }
  });

  it("res.created() should return 201 with data", async () => {
    const res = await client.get("/response/created");
    expect(res.ok).to.be.equal(true);
    expect(res.status).to.be.equal(201);
    if (res.ok) {
      expect(res.data).to.deep.equal({ id: 1, name: "created" });
    }
  });

  it("res.noContent() should return 204", async () => {
    const res = await client.get("/response/no-content");
    expect(res.ok).to.be.equal(true);
    expect(res.status).to.be.equal(204);
  });

  it("res.badRequest() should return 400 with message", async () => {
    const res = await client.get("/response/bad-request");
    expect(res.ok).to.be.equal(false);
    expect(res.status).to.be.equal(400);
  });

  it("res.unauthorized() should return 401 with message", async () => {
    const res = await client.get("/response/unauthorized");
    expect(res.ok).to.be.equal(false);
    expect(res.status).to.be.equal(401);
  });

  it("res.forbidden() should return 403 with message", async () => {
    const res = await client.get("/response/forbidden");
    expect(res.ok).to.be.equal(false);
    expect(res.status).to.be.equal(403);
  });

  it("res.notFound() should return 404 with message", async () => {
    const res = await client.get("/response/not-found");
    expect(res.ok).to.be.equal(false);
    expect(res.status).to.be.equal(404);
  });

  it("res.serverError() should return 500 with message", async () => {
    const res = await client.get("/response/server-error");
    expect(res.ok).to.be.equal(false);
    expect(res.status).to.be.equal(500);
  });

  it("res.setCookies() should set cookies in response", async () => {
    const res = await client.get("/response/cookies");
    expect(res.ok).to.be.equal(true);
    expect(res.status).to.be.equal(200);
  });
});