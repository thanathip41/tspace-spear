import { describe, it, before, after } from "mocha";
import { expect } from "chai";
import { Server } from 'http';
import { Spear, Controller, Get, Post, Put, Patch, Delete, type T } from "../src/lib";
import { ApiClient } from "../src/lib/core/client";

@Controller('/items')
class ItemsController {
  private items = [
    { id: 1, name: "item1" },
    { id: 2, name: "item2" }
  ];

  @Get('/')
  index() {
    return { items: this.items };
  }

  @Get('/:id')
  show({ res, params }: T.Context<{ params: { id: number } }>) {
    const item = this.items.find(i => i.id === params.id);
    if (!item) {
      throw res.notFound('Item not found');
    }
    return { item };
  }

  @Post('/')
  create({ body }: T.Context<{ body: { name: string } }>) {
    const newItem = { id: this.items.length + 1, ...body };
    this.items.push(newItem);

    console.log({ newItem , body })
    return { created: newItem };
  }

  @Put('/:id')
  update({ res, params, body }: T.Context<{ params: { id: number }; body: { name: string } }>) {
    const index = this.items.findIndex(i => i.id === params.id);
    if (index === -1) {
      throw res.notFound('Item not found');
    }
    this.items[index] = { ...this.items[index], ...body };
    return { updated: this.items[index] };
  }

  @Patch('/:id')
  patch({ res, params, body }: T.Context<{ params: { id: number }; body: { name?: string } }>) {
    const index = this.items.findIndex(i => i.id === params.id);
    if (index === -1) {
      throw res.notFound('Item not found');
    }
    this.items[index] = { ...this.items[index], ...body };
    return { patched: this.items[index] };
  }

  @Delete('/:id')
  remove({ res, params }: T.Context<{ params: { id: number } }>) {
    const index = this.items.findIndex(i => i.id === params.id);
    if (index === -1) {
      throw res.notFound('Item not found');
    }
    this.items.splice(index, 1);
    return { deleted: true };
  }
}

@Controller('/products')
class ProductsController {
  private products = [
    { id: 1, name: "Product A", price: 100 },
    { id: 2, name: "Product B", price: 200 }
  ];

  @Get('/')
  list() {
    return { products: this.products };
  }

  @Get('/:id')
  getProduct({ res, params }: T.Context<{ params: { id: number } }>) {
    const product = this.products.find(p => p.id === params.id);
    if (!product) {
      throw res.notFound('Product not found');
    }
    return { product };
  }

  @Post('/')
  addProduct({ body }: T.Context<{ body: { name: string; price: number } }>) {
    const newProduct = { id: this.products.length + 1, ...body };
    this.products.push(newProduct);
    return { created: newProduct };
  }
}

describe("Controller Unit Tests", () => {
  
  let server: Server;
  let client: ApiClient<any>;

  const app = new Spear({
    logger: false,
    controllers: [ItemsController, ProductsController]
  });
  
  app.useBodyParser();

  before((done) => {
    app.listen(5007, ({ port, server: sCallback }) => {
      server = sCallback;
      client = new ApiClient(`http://localhost:${port}`);
      done();
    });
  });

  after((done) => {
    server?.close(() => done());
  });

  describe("ItemsController - GET /items", () => {
    it("should return all items", async () => {
      const res = await client.get("/items");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data = res.data;
        expect(data).to.have.property("items");
        expect(data.items).to.be.an("array").with.length.greaterThan(0);
      }
    });
  });

  describe("ItemsController - GET /items/:id", () => {
    it("should return an item by id", async () => {
      const res = await client.get("/items/1");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data = res.data;
        expect(data).to.have.property("item");
        expect(data.item).to.have.property("id", 1);
      }
    });

    it("should return 404 when item not found", async () => {
      const res = await client.get("/items/999");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(404);
    });
  });

  describe("ItemsController - POST /items", () => {
    it("should create a new item", async () => {
      const res = await client.post("/items", {
        body: { name: "new-item" }
      });

      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data = res.data;

        console.log(data)
        expect(data).to.have.property("created");
        expect(data.created).to.have.property("name", "new-item");
      }
    });
  });

  describe("ItemsController - PUT /items/:id", () => {
    it("should update an item by id", async () => {
      const res = await client.put("/items/1", {
        body: { name: "updated-item" }
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data = res.data;
        expect(data).to.have.property("updated");
        expect(data.updated).to.have.property("name", "updated-item");
      }
    });

    it("should return 404 when updating non-existent item", async () => {
      const res = await client.put("/items/999", {
        body: { name: "updated-item" }
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(404);
    });
  });

  describe("ItemsController - PATCH /items/:id", () => {
    it("should patch an item by id", async () => {
      const res = await client.patch("/items/1", {
        body: { name: "patched-item" }
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data = res.data;
        expect(data).to.have.property("patched");
        expect(data.patched).to.have.property("name", "patched-item");
      }
    });

    it("should return 404 when patching non-existent item", async () => {
      const res = await client.patch("/items/999", {
        body: { name: "patched-item" }
      });
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(404);
    });
  });

  describe("ItemsController - DELETE /items/:id", () => {
    it("should delete an item by id", async () => {
      const res = await client.delete("/items/1");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data = res.data;
        expect(data).to.have.property("deleted", true);
      }
    });

    it("should return 404 when deleting non-existent item", async () => {
      const res = await client.delete("/items/999");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(404);
    });
  });

  describe("ProductsController - GET /products", () => {
    it("should return all products", async () => {
      const res = await client.get("/products");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data = res.data;
        expect(data).to.have.property("products");
        expect(data.products).to.be.an("array").with.length.greaterThan(0);
      }
    });
  });

  describe("ProductsController - GET /products/:id", () => {
    it("should return a product by id", async () => {
      const res = await client.get("/products/1");
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data = res.data;
        expect(data).to.have.property("product");
        expect(data.product).to.have.property("id", 1);
      }
    });

    it("should return 404 when product not found", async () => {
      const res = await client.get("/products/999");
      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(404);
    });
  });

  describe("ProductsController - POST /products", () => {
    it("should create a new product", async () => {
      const res = await client.post("/products", {
        body: { name: "new-product", price: 300 }
      });
      expect(res.ok).to.be.equal(true);
      expect(res.status).to.be.equal(200);
      if (res.ok) {
        const data = res.data;
        expect(data).to.have.property("created");
        expect(data.created).to.have.property("name", "new-product");
        expect(data.created).to.have.property("price", 300);
      }
    });
  });

});