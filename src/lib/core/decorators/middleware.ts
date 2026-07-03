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

const normalizeMiddlewares = (mid: any): T.ContextHandler[] => {
    const result: T.ContextHandler[] = [];

    const visit = (item: any): void => {
        if (Array.isArray(item)) {
            item.forEach(visit);
            return;
        }

        if (!item) return;

        if (typeof item === "function") {
            const proto = item.prototype;

            if (proto && proto !== Object.prototype) {
                const instance = new item();

                Object.getOwnPropertyNames(proto)
                    .filter(name => name !== "constructor")
                    .forEach(name => {
                        if (typeof instance[name] === "function") {
                            result.push(instance[name].bind(instance));
                        }
                    });

                return;
            }

            result.push(item);
        }
    };

    visit(mid);

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
  ...middlewares: (T.ContextHandler | T.ContextHandler[])[] | (MiddlewareClass | MiddlewareClass[])[]
) : MiddlewareDecorator {

  return ((target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
    
    if(descriptor == null) {
      Reflect.defineMetadata(MIDDLEWARE_METADATA, middlewares.flat(), target);
      return;
    }

    const originalMethod = descriptor.value;

    descriptor.value = function (ctx: T.Context, next: T.NextFunction) {
      try {

        let index = 0;

        const nextMiddleware = (err?: Error): any => {
          if (err) {
            return next(err);
          }

          const middles = normalizeMiddlewares(middlewares.flat()[index++]);

          console.log(middles)
          if (!middles.length) {
            console.log('call!')
            return originalMethod.call(this, ctx, next);
          }

          for(const middleware of middles) {
            console.log(index,middles.length)
            if(index ===middles.length) {
              return middleware(ctx, nextMiddleware);
            }
            middleware(ctx, nextMiddleware);
          }
        };

        return nextMiddleware();

      } catch (error) {

        return next(error as Error);
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