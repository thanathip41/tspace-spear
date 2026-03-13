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
 * const authMiddleware: T.RequestFunction = (ctx, next) => {
 *   if (!ctx.user) {
 *     return next(new Error("Unauthorized"));
 *   }
 *   next();
 * };
 * ```
 *
 * @param {T.RequestFunction} middleware - Middleware function to execute before the route handler.
 * @returns {MethodDecorator}
 */
export const Middleware = (middleware: T.RequestFunction): Function => {

  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = function (ctx: T.Context, next: T.NextFunction) {
      try {

        Reflect.defineMetadata("middlewares", descriptor, target);

        return middleware(ctx, (err?: any) => {
          if (err != null) {
            return next(err);
          }

          return originalMethod.call(this, ctx, next);
        });

      } catch (error: any) {
        return next(error);
      }
    };
  };
};