import chai from "chai";
import { describe, it, before, after } from "mocha";
import chaiJsonSchema from "chai-json-schema";
import { app } from "./app";
import { ApiClient } from "../src/lib/core/client";
import { Server } from 'http';

chai.use(chaiJsonSchema);
const { expect } = chai;

let server: Server;
let api: ApiClient;

describe("TSpear E2E Test", () => {
  before((done) => {
    app.listen(9090, ({ port , server : sCallback }) => {
      console.log(`server listening on http://localhost:${port}`);
      server = sCallback
      api = new ApiClient(`http://localhost:${port}/api`);
      done();
    });
  });

  after((done) => {
    server?.close(() => done());
  });

  it("should get cats", async () => {
    const res = await api.get("/cats");

    expect(res.status).to.be.equal(200);

    expect(res.data.cats).to.deep.equal([
      { id: 1, name: "cat1", age: 1.6 },
      { id: 2, name: "cat2", age: 1.8 }
    ]);
  });

  it("should create new cat id = 3", async () => {

    const res = await api.post("/cats", { 
      body : { 
        name : 'new cat' , 
        age : 1
      }
    });

    expect(res.status).to.be.equal(200);

    expect(res.data.cat).to.deep.equal({
      id : 3,
      name: 'new cat',
      age: 1
    });
  });

  it("should get cat by id 3", async () => {
    const res = await api.get("/cats/:id", { params: { id : 3 }});

    expect(res.status).to.be.equal(200);

    expect(res.data.cat).to.deep.equal({
      id : 3,
      name: 'new cat',
      age: 1
    });
  });

  it("should get cat by id 4", async () => {
    const res = await api.get("/cats/:id", { params: { id : 4 }})
    expect(res.ok).to.be.equal(false);
    expect(res.status).to.be.equal(404);

  });

  it("should update cat by id 3", async () => {
    const res = await api.put("/cats/:id", { 
      params: { id : 3 },
      body : { name : 'update cat' , age : 5 }
    });
    
    expect(res.data.cat).to.deep.equal({
      id : 3,
      name: 'update cat',
      age: 5
    });
  });

  it("should delete cat by id 3", async () => {

    const res = await api.delete("/cats/:id", { 
      params: { id : 3 }
    });
    
    expect(res.data.message).to.deep.equal('deleted');
  });

});