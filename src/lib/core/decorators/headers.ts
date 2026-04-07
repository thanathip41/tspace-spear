import { OutgoingHttpHeaders } from 'http';
import { type T } from '../types';

/**
 * Sets the HTTP response headers and status code before the controller method executes.
 *
 * This decorator calls `res.writeHead()` on the underlying Node.js response object,
 * allowing you to define the response **status code** and **headers** in advance.
 *
 * @example
 * ```ts
 * class UserController {
 *
 *   \@WriteHeader(200, { "Content-Type": "application/json" })
 *   async profile(ctx: T.Context) {
 *     return { id: 1, name: "John" };
 *   }
 *
 * }
 * ```
 *
 * Example response:
 *
 * ```
 * HTTP/1.1 200 OK
 * Content-Type: application/json
 * ```
 *
 * @param {number} statusCode - HTTP status code to send with the response.
 * @param {OutgoingHttpHeaders} contentType - Response headers to set.
 * @returns {MethodDecorator}
 */
export const WriteHeader = (statusCode: number, contentType: OutgoingHttpHeaders): MethodDecorator => {
  return (target: any, key: any, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (ctx: T.Context, next: T.NextFunction) {
      ctx.res.writeHead(...[statusCode, contentType]);
      return await originalMethod.call(this, ctx, next);
    };

    return descriptor;
  };
};