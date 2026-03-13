import { type T } from '../types';

/**
 * Sets the HTTP response status code before executing the controller method.
 *
 * The provided status code will be automatically clamped between **100** and **599**
 * to ensure a valid HTTP status range. It also sets the default
 * `Content-Type` header to `application/json`.
 *
 * @example
 * ```ts
 * class UserController {
 *   \@StatusCode(201)
 *   async create(ctx: T.Context) {
 *     return { success: true };
 *   }
 * }
 * ```
 *
 * In this example the response will be sent with:
 * - Status: **201 Created**
 * - Header: `Content-Type: application/json`
 *
 * @param {T.StatusCode} statusCode - HTTP status code to send with the response.
 * @returns {MethodDecorator}
 */
export const StatusCode = (statusCode: T.StatusCode): Function => {
    return (target: any, key: string, descriptor: PropertyDescriptor) => {
        const originalMethod = descriptor.value;

        const code = statusCode < 100 ? 100 : statusCode > 599 ? 599 : statusCode;

        descriptor.value = async function (ctx: T.Context, next: T.NextFunction) {
            ctx.res.writeHead(code, { 'Content-Type': 'application/json' });
            return await originalMethod.call(this, ctx, next);
        };

        return descriptor;
    };
};