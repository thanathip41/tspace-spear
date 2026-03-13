/**
 * Declares a class as a controller and assigns a base route path.
 *
 * The provided path will be used as the **base URL prefix**
 * for all routes defined inside the controller. The path must
 * start with `/`.
 *
 * This decorator stores the controller path using
 * `Reflect.defineMetadata` under the key `"controllers"`.
 * The framework can later read this metadata to register
 * routes automatically.
 *
 * @example
 * ```ts
 * \@Controller('/users')
 * class UserController {
 *
 *   async list(ctx: T.Context) {
 *     return [{ id: 1, name: "John" }];
 *   }
 *
 * }
 * ```
 *
 * If a route handler defines `/profile`, the final route becomes:
 *
 * ```
 * /users/profile
 * ```
 *
 * @param {`/${string}`} path - Base route path for the controller.
 * @returns {ClassDecorator}
 */
export const Controller = (path: `/${string}`): ClassDecorator => {
  return (target) => {
    return Reflect.defineMetadata("controllers", path, target);
  };
}
