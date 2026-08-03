/**
 * Testing utilities for tspace-spear framework.
 * 
 * Provides Testing capabilities for Controllers and Services.
 * 
 * @module tspace-spear/testing
 */
import type { T }           from '../types';
import { Spear }            from '../server';
import { ApiClient }        from '../client';
import { SERVICE_METADATA } from '../metadata';


type ClassType = new (...args: any) => any;

/**
 * Options for creating a test module.
 */
export interface TestModuleOptions {
  controllers?: ClassType[];
  services?: ClassType[];
  mocks?: Map<ClassType, any>;
  logger?: boolean;
  port?: number;
}

/**
 * Result of building a test module.
 */
export interface TestModuleResult {
  app: Spear;
  server: T.Server;
  client: ApiClient<any>;
  port: number;
  close: () => Promise<void>;
}

/**
 * Testing service for creating isolated test instances.
 */
export class TestingService {
  
  /**
   * Creates a service instance with its dependencies.
   *
   * Dependencies are resolved from the `@Dependencies()` decorator metadata
   * or from the `dependencies` option if no metadata exists.
   *
   * Mock implementations can be supplied through the `mocks` map. Any
   * dependency without a mock is instantiated using its default constructor.
   *
   * @template T Service class type.
   * @param ServiceClass The service class to instantiate.
   * @param options Service creation options.
   * @param options.dependencies Fallback dependency classes to inject when
   * no `@Dependencies()` metadata is present.
   * @param options.mocks A map of dependency classes to mock implementations.
   * @returns A fully constructed service instance.
   */
  public createService<T extends ClassType>(
    ServiceClass: T,
    options: {
      dependencies?: ClassType[];
      mocks?: Map<ClassType, any>;
    } = {}
  ): InstanceType<T> {
    const { dependencies = [], mocks = new Map() } = options;
    
    const serviceMetadata = Reflect.getMetadata(
      SERVICE_METADATA,
      ServiceClass
    ) as ClassType[] | undefined;
    
    const depsToResolve = serviceMetadata ?? dependencies;
    const resolvedDeps: any[] = [];
    
    for (const dep of depsToResolve) {
      if (mocks.has(dep)) {
        resolvedDeps.push(mocks.get(dep));
      } else {
        resolvedDeps.push(new (dep as any)());
      }
    }
    
    return new ServiceClass(...resolvedDeps);
  }

  /**
   * Creates a type-safe mock object for a service.
   *
   * Only the specified methods or properties need to be implemented,
   * making it easy to mock a subset of a service's API.
   *
   * @template T Service class type.
   * @template K Keys of the service to mock.
   * @param ServiceClass The service class being mocked.
   * @param methods The mock implementations.
   * @returns The typed mock object.
   */
  public createMockService<
    T extends ClassType,
    K extends keyof InstanceType<T>
  >(
    ServiceClass: T,
    methods: {
      [P in K]: InstanceType<T>[P] extends (...args: infer A) => infer R
        ? (...args: A) => R
        : InstanceType<T>[P];
    }
  ): {
    [P in K]: InstanceType<T>[P] extends (...args: infer A) => infer R
      ? (...args: A) => R
      : InstanceType<T>[P];
  } {
    return methods;
  }
  
  /**
   * Creates a spy for a method on an object.
   *
   * The original method continues to execute while the spy records
   * invocation count, arguments, and return values.
   *
   * @template T Object containing the target method.
   * @param target The object whose method should be spied on.
   * @param methodName The name of the method to spy on.
   * @returns An object containing the original method, call count,
   * captured arguments, and captured return values.
   */
  public spyOn<T extends Record<string, Function>>(
    target: T,
    methodName: keyof T
  ): {
    callCount: number;
    calls: any[][];
    results: any[];
    original: Function;
  } {
    const original = target[methodName] as Function;
    const calls: any[][] = [];
    const results: any[] = [];
    
    const self = { callCount: 0 };
    target[methodName] = function (this: T, ...args: any[]) {
      self.callCount++;
      calls.push(args);
      const result = original.apply(this, args);
      results.push(result);
      return result;
    } as any;
    
    return {
      get callCount() { return self.callCount; },
      calls,
      results,
      original
    };
  }
}

/**
 * Testing controller for creating isolated controller test instances.
 */
export class TestingController {
  
  /**
   * Creates a controller instance with its dependencies.
   *
   * Dependencies are resolved from the `@Dependencies()` decorator metadata
   * or from the `services` option if no metadata exists.
   *
   * Mock implementations can be provided through the `mocks` map.
   * Each mocked service is instantiated from a temporary subclass, so the
   * original service prototype is never modified.
   *
   * @template T Controller class type.
   * @param ControllerClass The controller class to instantiate.
   * @param options Controller creation options.
   * @param options.services Fallback service classes to inject when no
   * `@Dependencies()` metadata is present.
   * @param options.mocks A map of service classes to mock implementations.
   * @returns A fully constructed controller instance.
   */
  public createController<T extends ClassType>(
    ControllerClass: T,
    options: {
      services?: ClassType[];
      mocks?: Map<ClassType, any>;
    } = {}
  ): InstanceType<T> {
    const { services = [], mocks = new Map() } = options;
    
    const serviceMetadata = Reflect.getMetadata(
      SERVICE_METADATA,
      ControllerClass
    ) as ClassType[] | undefined;
    
    const depsToResolve = serviceMetadata ?? services;
    const resolvedDeps: any[] = [];

    for (const dep of depsToResolve) {

      if (mocks.has(dep)) {
        const mockService = mocks.get(dep);

        const mockDep = class extends dep {};

        Object.assign(mockDep.prototype, mockService);

        resolvedDeps.push(new mockDep());

        continue;
      } 
      
      resolvedDeps.push(new dep());
      
    }
    
    return new ControllerClass(...resolvedDeps);
  }
  
   /**
   * Creates a mock controller object from a set of handlers.
   *
   * This is useful for testing middleware, routing, or decorators without
   * creating a controller class.
   *
   * @template T Object containing controller handler functions.
   * @param handlers An object whose properties are controller handlers.
   * @returns The same handlers object with its original type preserved.
   */
  public createMockController<T extends Record<string, Function>>(
    handlers: T
  ): T {
    return handlers;
  }
  

  /**
   * Creates a mock request context for unit tests.
   *
   * Any provided values override the default mock context, allowing tests
   * to customize only the fields they need.
   *
   * The returned response object includes helper methods such as
   * `status()`, `json()`, `send()`, and common HTTP error helpers
   * (`notFound()`, `badRequest()`, etc.).
   *
   * @template T Additional context properties to merge into the mock context.
   * @param partial Partial context values to override the defaults.
   * @returns A mock context object suitable for controller and middleware tests.
   */
  public createContext<T extends Partial<T.Context> = Partial<T.Context>>(
    partial: T
  ): T.Context & T {
    const mockRes = {
      status: (code: number) => mockRes,
      json: (data: any) => data,
      send: (data: any) => data,
      notFound: (msg?: string) => {
        const err = new Error(msg ?? 'Not Found');
        (err as any).statusCode = 404;
        throw err;
      },
      badRequest: (msg?: string) => {
        const err = new Error(msg ?? 'Bad Request');
        (err as any).statusCode = 400;
        throw err;
      },
      unauthorized: (msg?: string) => {
        const err = new Error(msg ?? 'Unauthorized');
        (err as any).statusCode = 401;
        throw err;
      },
      forbidden: (msg?: string) => {
        const err = new Error(msg ?? 'Forbidden');
        (err as any).statusCode = 403;
        throw err;
      },
      internalServerError: (msg?: string) => {
        const err = new Error(msg ?? 'Internal Server Error');
        (err as any).statusCode = 500;
        throw err;
      },
      setHeader: () => {},
      getHeader: () => {},
      statusCode: () => 200
    };
    
    return {
      req: {
        method: 'GET',
        url: '/',
        headers: {},
        query: {},
        params: {},
        body: {},
        cookies: {},
        files: {},
        ...partial.req
      },
      res: mockRes,
      params: {},
      query: {},
      body: {},
      cookies: {},
      files: {},
      ...partial
    } as T.Context & T;
  }
}

/**
 * Test module builder for integration testing.
 */
export class TestModule {
  private controllers: ClassType[] = [];
  private services: ClassType[] = [];
  private mocks: Map<ClassType, any> = new Map();
  private logger: boolean = false;
  private port: number = 5050;
  
  private constructor() {}
  
  /**
   * Creates a new test module builder.
   *
   * The returned instance can be configured with controllers, services,
   * mocks, and other testing options before calling {@link compile}.
   *
   * @returns A new {@link TestModule} instance.
   */
  static create(): TestModule {
    return new TestModule();
  }
  
  /**
   * Replaces the list of controllers registered in this test module.
   *
   * @param controllers Controller classes to register.
   * @returns {this}
   */
  public setControllers(controllers: ClassType[]): this {
    this.controllers = controllers;
    return this;
  }
  
  /**
   * Registers a controller in this test module.
   *
   * @param controller The controller class to register.
   * @returns {this}
   */
  public addController(controller: ClassType): this {
    this.controllers.push(controller);
    return this;
  }
  
  /**
   * Replaces the list of services registered in this test module.
   *
   * @param services Service classes to register.
   * @returns {this}
   */
  public setServices(services: ClassType[]): this {
    this.services = services;
    return this;
  }
  
  /**
   * Registers a service in this test module.
   *
   * @param service The service class to register.
   * @returns {this}
   */
  public addService(service: ClassType): this {
    this.services.push(service);
    return this;
  }
  
  /**
   * Replaces all mocked services.
   *
   * Each key is a service class and its value is the mock implementation
   * that should be used during testing.
   *
   * @param mocks A map of service classes to mock implementations.
   * @returns {this}
   */
  public setMocks(mocks: Map<ClassType, any>): this {
    this.mocks = mocks;
    return this;
  }
  
  /**
   * Registers a mock implementation for a service.
   *
   * @param service The service class to mock.
   * @param mock The mock implementation.
   * @returns {this}
   */
  public addMock(service: ClassType, mock: any): this {
    this.mocks.set(service, mock);
    return this;
  }
  
  /**
   * Enables or disables the application logger.
   *
   * @param enabled Whether logging should be enabled.
   * @returns {this}
   */
  public setLogger(enabled: boolean): this {
    this.logger = enabled;
    return this;
  }
  
  /**
   * Sets the port  used when starting the test server.
   *
   * The application listens on `port`.
   *
   * @param port The port port.
   * @returns {this}
   */
  public setPort(port: number): this {
    this.port = port;
    return this;
  }
  
  /**
   * Compiles the test module and starts a Spear application.
   *
   * The application automatically enables the body parser and file upload
   * middleware. Once the server starts, a test client is created and
   * returned along with helper utilities.
   *
   * @returns A promise that resolves to a {@link TestModuleResult}
   * containing the application, server, API client, listening port,
   * and a helper to gracefully shut down the server.
   */
  public async compile(): Promise<TestModuleResult> {
    const app = new Spear({
      controllers: this.controllers,
      logger: this.logger
    });
    
    app.useBodyParser();
    app.useFileUpload();
    
    const port = this.port;
    
    return new Promise((resolve, reject) => {
      app.listen(port, ({ port: actualPort, server }: any) => {
        const client = new ApiClient(`http://localhost:${actualPort}`);
        
        resolve({
          app,
          server,
          client,
          port: actualPort,
          close: async () => {
            return new Promise<void>((resolveClose) => {
              if (server && typeof server.close === 'function') {
                server.close(() => resolveClose());
              } else {
                resolveClose();
              }
            });
          }
        });
      });
    });
  }
}

/**
 * Creates a test HTTP server with the given controllers.
 */
export async function createTestServer(
  options: TestModuleOptions = {}
): Promise<TestModuleResult> {
  const {
    controllers = [],
    services = [],
    mocks = new Map(),
    logger = false,
    port = 5050
  } = options;
  
  return TestModule.create()
    .setControllers(controllers)
    .setServices(services)
    .setMocks(mocks)
    .setLogger(logger)
    .setPort(port)
    .compile();
}

export function createMockService<
  T extends ClassType,
  K extends keyof InstanceType<T>
>(
  ServiceClass: T,
  methods: {
    [P in K]: InstanceType<T>[P] extends (...args: infer A) => infer R
      ? (...args: A) => R
      : InstanceType<T>[P];
  }
): {
  [P in K]: InstanceType<T>[P] extends (...args: infer A) => infer R
    ? (...args: A) => R
    : InstanceType<T>[P];
} {
  return new TestingService().createMockService(ServiceClass, methods);
}

export function createMockController<T extends Record<string, Function>>(
  handlers: T
): T {
  return new TestingController().createMockController(handlers);
}
