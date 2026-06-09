import { MIDDLEWARE_METADATA } from '../metadata';
import { T } from '../types';

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
 * @returns {MethodDecorator}
 */
export const Middleware = (...middlewares: (T.ContextHandler | T.ContextHandler[])[]): MethodDecorator => {

  return (target: any, _: any, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = function (ctx: T.Context, next: T.NextFunction) {
      try {

        Reflect.defineMetadata(MIDDLEWARE_METADATA, descriptor, target);

        let index = 0;

        const nextMiddleware = (err?: any): any => {
          if (err) {
            return next(err);
          }

          const middleware = middlewares.flat()[index++];

          if (!middleware) {
            return originalMethod.call(this, ctx, next);
          }

          return middleware(ctx, nextMiddleware);
        };

        return nextMiddleware();

      } catch (error: any) {

        return next(error);
      }
    };
  };
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