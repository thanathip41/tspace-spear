import { MIDDLEWARE_METADATA } from '../metadata';
import { T } from '../types';

type MiddlewareDecorator = {
  <TFunction extends Function>(target: TFunction): void | TFunction;
  <T>(
    target: Object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>,
  ): void | TypedPropertyDescriptor<T>;
};

type MiddlewareClass = new (...args:any) => any;

const isClass = (value: Function): boolean => {
  return /^class\s/.test(Function.prototype.toString.call(value));
};

const normalizeMiddlewares = (mid: any): T.ContextHandler[] => {
  const items = Array.isArray(mid) ? mid.flat(Infinity) : [mid];
  const result: T.ContextHandler[] = [];

  for (const item of items) {

    if (!item || typeof item !== "function") {
      continue;
    }

    if (isClass(item)) {
      const instance = new item();

      for (const name of Object.getOwnPropertyNames(item.prototype)) {
        
          if (name === "constructor") {
              continue;
          }

          const handler = instance[name];

          if (typeof handler === "function") {
              result.push(handler.bind(instance));
          }
      }

      continue;
    }

    result.push(item);
  }

  return result;
};

/**
 * Attaches a middleware function to a controller method.
 *
 * The middleware will be executed **before the route handler**.
 * If the middleware calls `next(err)`, the error will be forwarded
 * to the framework's error handler. Otherwise, the original
 * controller method will be executed.
 *
 * This decorator also stores middleware metadata using `Reflect.defineMetadata`
 * so the framework can discover and execute it during the request lifecycle.
 *
 * @example
 * ```ts
 * class UserController {
 *
 *   \@Middleware(authMiddleware)
 *   async profile(ctx: T.Context) {
 *     return { user: ctx.user };
 *   }
 *
 * }
 * ```
 *
 * Example middleware:
 *
 * ```ts
 * const authMiddleware: T.ContextHandler = (ctx, next) => {
 *   if (!ctx.user) {
 *     return next(new Error("Unauthorized"));
 *   }
 *   next();
 * };
 * ```
 *
 * @param {T.ContextHandler[]} middlewares - Middleware function to execute before the route handler.
 * @returns {MiddlewareDecorator}
 */
export function Middleware(
  ...middlewares: 
    | (T.ContextHandler | T.ContextHandler[])[] 
    | (MiddlewareClass | MiddlewareClass[])[]
) : MiddlewareDecorator {

  return ((target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
    
    if(descriptor == null) {
      Reflect.defineMetadata(MIDDLEWARE_METADATA, middlewares.flat(), target);
      return;
    }

    const originalMethod = descriptor.value;

    descriptor.value = function (ctx: T.Context, next: T.NextFunction) {
      try {
        let groupIndex = 0;

        const nextMiddleware = (err?: Error): any => {
          if (err) {
            return next(err);
          }

          const currentMiddlewares = normalizeMiddlewares(
            middlewares.flat()[groupIndex++]
          );

          if (currentMiddlewares.length === 0) {
            return originalMethod.call(this, ctx, next);
          }

          const last = currentMiddlewares.length - 1;

          for (let i = 0; i <= last; i++) {
            const middleware = currentMiddlewares[i];

            if (i === last) {
              return middleware(ctx, nextMiddleware);
            }

            middleware(ctx, nextMiddleware);
            continue;
          }
        };

        return nextMiddleware();

      } catch (err) {
        return next(err as Error);
      }
    };
  }) as MiddlewareDecorator;
};


/**
 * Attaches a middleware function to a controller method.
 *
 * The middleware will be executed **before the route handler**.
 * If the middleware calls `next(err)`, the error will be forwarded
 * to the framework's error handler. Otherwise, the original
 * controller method will be executed.
 *
 * This decorator also stores middleware metadata using `Reflect.defineMetadata`
 * so the framework can discover and execute it during the request lifecycle.
 *
 * @example
 * ```ts
 * class UserController {
 *
 *   \@UseGuards(authMiddleware)
 *   async profile(ctx: T.Context) {
 *     return { user: ctx.user };
 *   }
 *
 * }
 * ```
 *
 * Example middleware:
 *
 * ```ts
 * const authMiddleware: T.ContextHandler = (ctx, next) => {
 *   if (!ctx.user) {
 *     return next(new Error("Unauthorized"));
 *   }
 *   next();
 * };
 * ```
 *
 * @param {T.ContextHandler[]} middlewares - Middleware function to execute before the route handler.
 * @returns {MethodDecorator}
 */
export const UseGuards = Middleware