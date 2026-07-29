/**
 * Testing utilities for tspace-spear framework.
 * 
 * Provides NestJS-like testing capabilities for Controllers and Services.
 * 
 * @module tspace-spear/testing
 */

import { Spear } from '../server';
import { ApiClient } from '../client';
import { CONTROLLER_METADATA, SERVICE_METADATA } from '../metadata';
import type { T } from '../types';

type ClassType = new (...args: any) => any;

/**
 * Options for creating a test module.
 */
export interface TestModuleOptions {
  controllers?: ClassType[];
  services?: ClassType[];
  mocks?: Map<ClassType, any>;
  logger?: boolean;
  portOffset?: number;
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
  createService<T extends ClassType>(
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
   * Creates a mock service with type inference from the service class.
   * TypeScript will check that method names match the actual service.
   * The return type only includes the methods you provide.
   */
  createMockService<
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
  
  spyOn<T extends Record<string, Function>>(
    target: T,
    methodName: keyof T
  ): {
    callCount: number;
    calls: any[][];
    results: any[];
    original: Function;
  } {
    const original = target[methodName] as Function;
    const callCount = { value: 0 };
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
  private testingService = new TestingService();
  
  createController<T extends ClassType>(
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
        resolvedDeps.push(mocks.get(dep));
      } else {
        resolvedDeps.push(new (dep as any)());
      }
    }
    
    return new ControllerClass(...resolvedDeps);
  }
  
  createMockController<T extends Record<string, Function>>(
    handlers: T
  ): T {
    return handlers;
  }
  
  createContext<T extends Partial<T.Context> = Partial<T.Context>>(
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
  private portOffset: number = 0;
  
  private constructor() {}
  
  static create(): TestModule {
    return new TestModule();
  }
  
  setControllers(controllers: ClassType[]): this {
    this.controllers = controllers;
    return this;
  }
  
  addController(controller: ClassType): this {
    this.controllers.push(controller);
    return this;
  }
  
  setServices(services: ClassType[]): this {
    this.services = services;
    return this;
  }
  
  addService(service: ClassType): this {
    this.services.push(service);
    return this;
  }
  
  setMocks(mocks: Map<ClassType, any>): this {
    this.mocks = mocks;
    return this;
  }
  
  addMock(service: ClassType, mock: any): this {
    this.mocks.set(service, mock);
    return this;
  }
  
  setLogger(enabled: boolean): this {
    this.logger = enabled;
    return this;
  }
  
  setPortOffset(offset: number): this {
    this.portOffset = offset;
    return this;
  }
  
  async compile(): Promise<TestModuleResult> {
    const app = new Spear({
      controllers: this.controllers,
      logger: this.logger
    });
    
    app.useBodyParser();
    app.useFileUpload();
    
    const port = 5000 + this.portOffset;
    
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
    portOffset = 0
  } = options;
  
  return TestModule.create()
    .setControllers(controllers)
    .setServices(services)
    .setMocks(mocks)
    .setLogger(logger)
    .setPortOffset(portOffset)
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
