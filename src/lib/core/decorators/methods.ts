import { type T } from '../types'

const methodDecorator = (method: T.Method) => {
  return (path: `/${string}`): MethodDecorator => {
    return (target:any, propertyKey:any) => {
      const controller = target.constructor;

      const routers: T.Router[] = Reflect.hasMetadata("routers", controller) 
        ? Reflect.getMetadata("routers", controller) 
        : [];

      routers.push({
        method,
        path,
        handler: propertyKey,
      });

      Reflect.defineMetadata("routers", routers, controller);
    }
  }
}

/**
 * Maps a controller method to an HTTP GET route.
 *
 * @example
 * ```ts
 * \@Get('/users')
 * async list(ctx: T.Context) {
 *   return [{ id: 1, name: "John" }];
 * }
 * ```
 */
export const Get = methodDecorator('get');

/**
 * Maps a controller method to an HTTP POST route.
 *
 * @example
 * ```ts
 * \@Post('/users')
 * async create(ctx: T.Context) {
 *   return { success: true };
 * }
 * ```
 */
export const Post = methodDecorator('post');

/**
 * Maps a controller method to an HTTP PUT route.
 *
 * Used for replacing a resource.
 *
 * @example
 * ```ts
 * \@Put('/users/:id')
 * async update(ctx: T.Context) {}
 * ```
 */
export const Put = methodDecorator('put');

/**
 * Maps a controller method to an HTTP PATCH route.
 *
 * Used for partially updating a resource.
 *
 * @example
 * ```ts
 * \@Patch('/users/:id')
 * async patch(ctx: T.Context) {}
 * ```
 */
export const Patch = methodDecorator('patch');

/**
 * Maps a controller method to an HTTP DELETE route.
 *
 * @example
 * ```ts
 * \@Delete('/users/:id')
 * async remove(ctx: T.Context) {}
 * ```
 */
export const Delete = methodDecorator('delete');

/**
 * Maps a controller method to an HTTP HEAD route.
 *
 * HEAD responses contain only headers and no response body.
 *
 * @example
 * ```ts
 * \@Head('/health')
 * async health(ctx: T.Context) {}
 * ```
 */
export const Head = methodDecorator('head');

/**
 * Maps a controller method to an HTTP OPTIONS route.
 *
 * Typically used for CORS preflight requests.
 *
 * @example
 * ```ts
 * \@Options('/users')
 * async options(ctx: T.Context) {}
 * ```
 */
export const Options = methodDecorator('options');