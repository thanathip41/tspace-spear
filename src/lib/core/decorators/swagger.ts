import { type T } from "../types";

/**
 * Attaches Swagger/OpenAPI specification metadata to a controller method.
 *
 * This decorator stores route documentation using `Reflect.defineMetadata`
 * so the framework can later collect it and generate **Swagger / OpenAPI**
 * documentation automatically.
 *
 * The metadata is stored on the controller constructor under the key `"swaggers"`.
 * Each decorated method contributes a Swagger specification object.
 *
 * @example
 * ```ts
 * class UserController {
 *
 *   \@Swagger({
 *     summary: "Get user profile",
 *     description: "Returns the authenticated user's profile",
 *     tags: ["Users"],
 *     responses: {
 *       200: {
 *         description: "Successful response"
 *       }
 *     }
 *   })
 *   async profile(ctx: T.Context) {
 *     return { id: 1, name: "John" };
 *   }
 *
 * }
 * ```
 *
 * @param {T.Swagger.Spec} data - Swagger/OpenAPI specification for the route.
 * @returns {MethodDecorator}
 */
export const Swagger = (data: T.Swagger.Spec) => {
  return (target: any, propertyKey: any) => {
    const controller = target.constructor;

    const swaggers: any[] = Reflect.hasMetadata("swaggers", controller)
      ? Reflect.getMetadata("swaggers", controller)
      : [];

    swaggers.push({
      handler: propertyKey,
      ...data,
    });

    Reflect.defineMetadata("swaggers", swaggers, controller);
  };
};