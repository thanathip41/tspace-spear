import { Server }     from 'http';
import fs             from "fs";
import FormData       from 'form-data';
import path           from 'path';
import chai           from "chai";
import chaiJsonSchema from "chai-json-schema";
import { 
  describe, 
  it, 
  before, 
  after 
} from "mocha";
import { app }       from "./app";
import { ApiClient } from "../src/lib/core/client";

chai.use(chaiJsonSchema);
const { expect } = chai;

let server: Server;
let client: ApiClient<typeof app.contract>;

describe("TSpear E2E Test", () => {
  
  before((done) => {
    app.listen(5001, ({ port , server : sCallback }) => {
      console.log(`server listening on http://localhost:${port}`);
      server = sCallback
      client = new ApiClient(
        `http://localhost:${port}/api`
      );
      done();
    });
  });

  after((done) => {
    server?.close(() => done());
  });

  it("should return all cats", async () => {
    const res = await client.get("/cats");

    expect(res.ok).to.be.equal(true);
    expect(res.status).to.be.equal(200);

    if(res.ok)
      expect(res.data.cats).to.deep.equal([
        { id: 1, name: "cat1", age: 1.6 },
        { id: 2, name: "cat2", age: 1.8 }
      ]);
  });

  it("should return an error when the request body is empty", async () => {

    // type checked
    // const t = await client.post("/cats",{
    //   body : {} // Type '{}' is missing the following properties from type '{ name: string; age: number; }': name
    // });
   
    const res = await client.post("/cats",{
      body : {
        name : '',
        age  : 0
      }
    });

    expect(res.ok).to.be.equal(false);
    expect(res.status).to.be.equal(422);

    if(!res.ok) {
      expect(res.data).to.have.property("message");
      expect(res.data).to.have.property("issues");
      expect(res.data).to.have.property("message").that.is.a("string");
      expect(res.data).to.have.property("issues").that.is.an("array");

      for (const issue of res.data.issues) {
        expect(issue).to.have.property("path").that.is.a("string");
        expect(issue).to.have.property("constraints").that.is.an("object");
        expect(issue).to.have.property("message").that.is.a("string");
      }
    }
    
  });

  it("should return a newly created cat with id 3", async () => {

    const res = await client.post("/cats", { 
      body : { 
        name : 'new cat' , 
        age : 1
      }
    });

    expect(res.ok).to.be.equal(true);
    expect(res.status).to.be.equal(200);

    if(res.ok)
      expect(res.data.cat).to.deep.equal({
        id : 3,
        name: 'new cat',
        age: 1
      });
  });

  it("should return the cat with id 3", async () => {
    const res = await client.get("/cats/:id", { params: { id : 3 }});

    expect(res.ok).to.be.equal(true);
    expect(res.status).to.be.equal(200);

    if(res.ok) 
      expect(res.data.cat).to.deep.equal({
        id : 3,
        name: 'new cat',
        age: 1
      });
  });

  it("should return 404 when getting a cat by id 4", async () => {
    const res = await client.get("/cats/:id", { params: { id : 44 }})
    expect(res.ok).to.be.equal(false);
    expect(res.status).to.be.equal(404);
  });

  it("should update the cat with id 3 using PUT", async () => {
    const res = await client.put("/cats/:id", { 
      params: { id : 3 },
      body : { name : 'update cat PUT' , age : 5 }
    });

    expect(res.ok).to.be.equal(true);
    expect(res.status).to.be.equal(200);
    
    if(res.ok)
      expect(res.data.cat).to.deep.equal({
        id : 3,
        name: 'update cat PUT',
        age: 5
      });
  });

  it("should update the cat with id 3 using PATCH", async () => {
    const res = await client.patch("/cats/:id", { 
      params: { id : 3 },
      body : { name : 'update cat PATCH' }
    });
  
    expect(res.ok).to.be.equal(true);
    expect(res.status).to.be.equal(200);
    
    if(res.ok)
      expect(res.data.cat).to.deep.equal({
        id : 3,
        name: 'update cat PATCH'
      });
  });

  it("should return 404 when updating the cat with id 4", async () => {
    const res = await client.put("/cats/:id", { 
      params: { id : 4 },
      body : { name : 'update cat' , age : 5 }
    });

    expect(res.ok).to.be.equal(false);
    expect(res.status).to.be.equal(404);
  });

  it("should delete the cat with id 3", async () => {

    const res = await client.delete("/cats/:id", { 
      params: { id : 3 }
    });

    expect(res.ok).to.be.equal(true);
    expect(res.status).to.be.equal(200);

    if(res.ok)
      expect(res.data.message).to.deep.equal('deleted');
  });

  it("should return 404 after deleting the cat with id 3", async () => {

    const res = await client.delete("/cats/:id", { 
      params: { id : 3 }
    });
    
    expect(res.ok).to.be.equal(false);
    expect(res.status).to.be.equal(404);
  });

  it("should upload file", async () => {
    const catPath = path.join(path.resolve(),'__tests__','image.png')
    const buffer = await fs.promises.readFile(catPath);

    const formData = new FormData();

    formData.append("image", buffer, {
      filename: "cat.png",
      contentType: "image/png",
    });

    // @ts-ignore
    // In Node.js, FormData is not the same as in the browser, 
    // but in Node.js 18+ it is compatible with the browser implementation.
    const res = await client.upload("/cats/upload", { formdata : formData });

    expect(res.ok).to.be.equal(true);
    expect(res.status).to.be.equal(200);

    if(res.ok)
      expect(res.data).to.have.property("image").that.is.an("object");
      expect(res.data.image).to.have.property("name");
      expect(res.data.image).to.have.property("tempFilePath");
      expect(res.data.image).to.have.property("tempFileName");
      expect(res.data.image).to.have.property("mimetype");
      expect(res.data.image).to.have.property("extension");
      expect(res.data.image).to.have.property("size");

  });
});