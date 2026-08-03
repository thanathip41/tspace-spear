import { describe, it, before, after } from "mocha";
import { expect } from "chai";
import {
  Controller,
  Get,
  Post,
  Dependencies,
  type T,
} from "../src/lib";

import {
  TestingService,
  TestingController,
  TestModule,
  createTestServer,
  createMockService,
  type TestModuleResult,
} from "../src/lib/core/testing";

class UserService {
  private users: Map<number, { id: number; name: string; email: string }> =
    new Map([
      [1, { id: 1, name: "Alice", email: "alice@example.com" }],
      [2, { id: 2, name: "Bob", email: "bob@example.com" }],
    ]);

  private nextId = 3;

  findAll() {
    return Array.from(this.users.values());
  }

  findById(id: number) {
    return this.users.get(id);
  }

  create(name: string, email: string) {
    const id = this.nextId++;
    const user = { id, name, email };
    this.users.set(id, user);
    return user;
  }
}

@Controller("/users")
@Dependencies(UserService)
class UsersController {
  constructor(private userService: UserService) {}

  @Get("/")
  list() {
    return { users: this.userService.findAll() };
  }

  @Get("/:id")
  show({ res, params }: T.Context<{ params: { id: number } }>) {
    const user = this.userService.findById(params.id);
    if (!user) {
      throw res.notFound("User not found");
    }
    return { user };
  }

  @Post("/")
  create({ body, res }: T.Context) {
    const { name, email } = body as { name: string; email: string };
    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }
    const user = this.userService.create(name, email);
    return { created: user };
  }
}

describe("Example 1: Unit Testing a Service", () => {
  let userService: UserService;

  before(() => {
    userService = new UserService();
  });

  it("should return all users", () => {
    const users = userService.findAll();
    expect(users).to.have.length(2);
  });

  it("should find user by id", () => {
    const user = userService.findById(1);
    expect(user).to.have.property("name", "Alice");
  });

  it("should return undefined for non-existent user", () => {
    const user = userService.findById(999);
    expect(user).to.be.undefined;
  });
});

describe("Example 2: Unit Testing a Controller with Mocked Service", () => {
  const testing = new TestingController();
  let controller: UsersController;

  const mockUserService = createMockService(UserService, {
    findAll: () => [
      { id: 1, name: "Mock User", email: "mock@example.com" },
    ],
    findById: (id: number) => ({
      id,
      name: `User ${id}`,
      email: `user${id}@example.com`,
    }),
    create: (name: string, email: string) => ({ id: 100, name, email }),
  });

  before(() => {
    // Create controller with mocked service
    controller = testing.createController(UsersController, {
      mocks: new Map([[UserService, mockUserService]]),
    });
  });

  it("should return mocked users", () => {
    const result = controller.list();
    expect(result).to.have.property("users");
    expect(result.users).to.have.length(1);
    expect(result.users[0]).to.have.property("name", "Mock User");
  });

  it("should return user by id using mocked service", () => {
    const ctx = testing.createContext({
      params: { id: 5 },
    });
    const result = controller.show(ctx);
    expect(result).to.have.property("user");
    expect(result.user).to.have.property("name", "User 5");
  });
});

describe("Example 3: Testing with createTestContext", () => {
  const testing = new TestingController();

  const mockUserService = createMockService(UserService, {
    findAll: () => [],
    findById: (id: number) => undefined, // Simulate not found
    create: (name: string, email: string) => ({ id: 1, name, email }),
  });

  const controller = testing.createController(UsersController, {
    mocks: new Map([[UserService, mockUserService]]),
  });

  it("should throw 404 for non-existent user", () => {
    const ctx = testing.createContext({
      params: { id: 999 },
    });

    expect(() => controller.show(ctx)).to.throw("User not found");
  });

  it("should create user with valid body", () => {
    const ctx = testing.createContext({
      body: { name: "Test User", email: "test@example.com" },
    });

    const result = controller.create(ctx);
    expect(result).to.have.property("created");
    expect(result.created).to.have.property("name", "Test User");
  });
});

describe("Example 4: Integration Testing with TestModule", () => {
  let module: TestModuleResult;

  before(async () => {
   
    module = await TestModule.create()
      .setControllers([UsersController])
      .setLogger(false)
      .setPortOffset(200)
      .compile();
  });

  after(async () => {
    await module.close();
  });

  it("should GET /users", async () => {
    const res = await module.client.get("/users");
    expect(res.ok).to.be.true;
    expect(res.status).to.equal(200);
    if (res.ok) {
      expect(res.data.users).to.be.an("array");
    }
  });

  it("should GET /users/:id", async () => {
    const res = await module.client.get("/users/1");
    expect(res.ok).to.be.true;
    expect(res.status).to.equal(200);
    if (res.ok) {
      expect(res.data.user).to.have.property("id", 1);
    }
  });

  it("should return 404 for non-existent user", async () => {
    const res = await module.client.get("/users/999");
    expect(res.ok).to.be.false;
    expect(res.status).to.equal(404);
  });

  it("should POST /users", async () => {
    const res = await module.client.post("/users", {
      body: { name: "New User", email: "new@example.com" },
    });
    expect(res.ok).to.be.true;
    expect(res.status).to.equal(200);
    if (res.ok) {
      expect(res.data.created).to.have.property("name", "New User");
    }
  });
});

describe("Example 5: Integration Testing with createTestServer", () => {
  let testServer: TestModuleResult;

  before(async () => {
    testServer = await createTestServer({
      controllers: [UsersController],
      logger: false,
      portOffset: 300,
    });
  });

  after(async () => {
    await testServer.close();
  });

  it("should list all users", async () => {
    const res = await testServer.client.get("/users");
    expect(res.ok).to.be.true;
    expect(res.status).to.equal(200);
  });

  it("should get user by id", async () => {
    const res = await testServer.client.get("/users/2");
    expect(res.ok).to.be.true;
    if (res.ok) {
      expect(res.data.user).to.have.property("id", 2);
    }
  });
});

describe("Example 6: Using TestingService for Service Testing", () => {
  const testing = new TestingService();

  it("should create service instance", () => {
    const service = testing.createService(UserService);
    expect(service).to.be.instanceOf(UserService);
  });

  it("should create service with mocked dependencies", () => {
    const service = testing.createService(UserService);
    const users = service.findAll();
    expect(users).to.have.length(2);
  });

  it("should create mock service", () => {
    const mockService = testing.createMockService(UserService, {
      findAll: () => [{ id: 999, name: "Mocked", email: "mocked@example.com" }],
    });
    expect(mockService.findAll()).to.have.length(1);
  });

  it("should spy on method calls", () => {
    const service = new UserService();
    const spy = testing.spyOn(service as unknown as Record<string, Function>, "findAll");
    
    service.findAll();
    service.findAll();
    
    expect(spy.callCount).to.equal(2);
    expect(spy.calls).to.have.length(2);
  });
});

describe("Example 7: Integration Testing with Real Service", () => {
  let module: TestModuleResult;

  before(async () => {
    module = await TestModule.create()
      .setControllers([UsersController])
      .setPortOffset(400)
      .compile();
  });

  after(async () => {
    await module.close();
  });

  it("should return real users from UserService", async () => {
    const res = await module.client.get("/users");
    expect(res.ok).to.be.true;
    if (res.ok) {
      // Real service returns 2 users (Alice and Bob)
      expect(res.data.users).to.have.length(2);
      expect(res.data.users[0]).to.have.property("name", "Alice");
      expect(res.data.users[1]).to.have.property("name", "Bob");
    }
  });

  it("should return user by id from real service", async () => {
    const res = await module.client.get("/users/1");
    expect(res.ok).to.be.true;
    if (res.ok) {
      expect(res.data.user).to.have.property("name", "Alice");
    }
  });

  it("should create user with real service", async () => {
    const res = await module.client.post("/users", {
      body: { name: "Charlie", email: "charlie@example.com" },
    });
    expect(res.ok).to.be.true;
    if (res.ok) {
      expect(res.data.created).to.have.property("name", "Charlie");
      expect(res.data.created).to.have.property("id", 3);
    }
  });
});

describe("Example 8: Complete CRUD Test Pattern", () => {
  let module: TestModuleResult;

  before(async () => {
    module = await TestModule.create()
      .setControllers([UsersController])
      .setPortOffset(500)
      .compile();
  });

  after(async () => {
    await module.close();
  });

  it("GET /users - should list all users", async () => {
    const res = await module.client.get("/users");
    expect(res.ok).to.be.true;
    expect(res.status).to.equal(200);
    if (res.ok) {
      expect(res.data.users).to.be.an("array").with.lengthOf(2);
    }
  });

  it("GET /users/:id - should get single user", async () => {
    const res = await module.client.get("/users/1");
    expect(res.ok).to.be.true;
    if (res.ok) {
      expect(res.data.user).to.deep.include({ id: 1, name: "Alice" });
    }
  });

  it("GET /users/:id - should return 404 for non-existent user", async () => {
    const res = await module.client.get("/users/999");
    expect(res.ok).to.be.false;
    expect(res.status).to.equal(404);
  });

  it("POST /users - should create new user", async () => {
    const res = await module.client.post("/users", {
      body: { name: "Charlie", email: "charlie@example.com" },
    });
    expect(res.ok).to.be.true;
    if (res.ok) {
      expect(res.data.created).to.include({
        id: 3,
        name: "Charlie",
        email: "charlie@example.com",
      });
    }
  });

  it("POST /users - should return 400 for missing fields", async () => {
    const res = await module.client.post("/users", {
      body: { name: "No Email" },
    });
    expect(res.ok).to.be.false;
    expect(res.status).to.equal(400);
  });
});