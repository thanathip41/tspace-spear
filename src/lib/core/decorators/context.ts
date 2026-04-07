import { type T } from '../types';

/**
 * Extract specific fields from `ctx.body`.
 *
 * This decorator filters the request body and keeps only the
 * specified keys. The filtered result replaces `ctx.body`
 * before the controller method is executed.
 *
 * @example
 * ```ts
 * @Body('email', 'password')
 * async login(ctx: T.Context) {
 *   // ctx.body = { email: "...", password: "..." }
 * }
 * ```
 *
 * @param {...string} bodyParms - Body field names to extract.
 * @returns {MethodDecorator}
 */
export const Body = (...bodyParms: string[]): MethodDecorator => {
    return function (target: any, key: any, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (ctx: T.Context, next: T.NextFunction) {
            const q = ctx?.body ?? {};
            const body = bodyParms.reduce(
                (acc, key) => (q[key] != null ? { ...acc, [key]: q[key] } : acc),
                {}
            );

            ctx.body = Object.keys(body).length ? body : {};

            return await originalMethod.call(this, ctx, next);
        };

        return descriptor;
    };
};

/**
 * Extract specific uploaded files from `ctx.files`.
 *
 * Filters uploaded files and keeps only the specified
 * file field names before executing the controller method.
 *
 * @example
 * ```ts
 * \@Files('avatar', 'resume')
 * async upload(ctx: T.Context) {
 *   // ctx.files = { avatar: File, resume: File }
 * }
 * ```
 *
 * @param {...string} filesParms - File field names to extract.
 * @returns {MethodDecorator}
 */
export const Files = (...filesParms: string[]): MethodDecorator => {
    return function (target: any, key: any, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (ctx: T.Context, next: T.NextFunction) {
            const q = ctx?.files ?? {};
            const files = filesParms.reduce(
                (acc, key) => (q[key] != null ? { ...acc, [key]: q[key] } : acc),
                {}
            );

            ctx.files = Object.keys(files).length ? files : {};

            return await originalMethod.call(this, ctx, next);
        };

        return descriptor;
    };
};

/**
 * Extract specific route parameters from `ctx.params`.
 *
 * Filters route parameters and keeps only the specified
 * parameter names.
 *
 * @example
 * ```ts
 * \@Params('id')
 * async getUser(ctx: T.Context) {
 *   // ctx.params = { id: "123" }
 * }
 * ```
 *
 * @param {...string} paramsData - Route parameter names to extract.
 * @returns {MethodDecorator}
 */
export const Params = (...paramsData: string[]): MethodDecorator => {
    return function (target: any, key: any, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (ctx: T.Context, next: T.NextFunction) {
            const q = ctx?.params ?? {};
            const params = paramsData.reduce(
                (acc, key) => (q[key] != null ? { ...acc, [key]: q[key] } : acc),
                {}
            );

            ctx.params = Object.keys(params).length ? params : {};

            return await originalMethod.call(this, ctx, next);
        };

        return descriptor;
    };
};

/**
 * Extract specific query parameters from `ctx.query`.
 *
 * Filters query parameters and keeps only the specified
 * query keys.
 *
 * @example
 * ```ts
 * \@Query('page', 'limit')
 * async listUsers(ctx: T.Context) {
 *   // ctx.query = { page: "1", limit: "10" }
 * }
 * ```
 *
 * @param {...string} queryParms - Query parameter names to extract.
 * @returns {MethodDecorator}
 */
export const Query = (...queryParms: string[]): MethodDecorator => {
    return function (target: any, key: any, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (ctx: T.Context, next: T.NextFunction) {
            const q = ctx?.query ?? {};
            const query = queryParms.reduce(
                (acc, key) => (q[key] != null ? { ...acc, [key]: q[key] } : acc),
                {}
            );

            ctx.query = Object.keys(query).length ? query : {};

            return await originalMethod.call(this, ctx, next);
        };

        return descriptor;
    };
};

/**
 * Extract specific cookies from `ctx.cookies`.
 *
 * Filters cookies and keeps only the specified cookie keys
 * before executing the controller method.
 *
 * @example
 * ```ts
 * \@Cookies('token')
 * async profile(ctx: T.Context) {
 *   // ctx.cookies = { token: "..." }
 * }
 * ```
 *
 * @param {...string} cookiesParms - Cookie names to extract.
 * @returns {MethodDecorator}
 */
export const Cookies = (...cookiesParms: string[]): MethodDecorator => {
    return function (target: any, key: any, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (ctx: T.Context, next: T.NextFunction) {
            const q = ctx?.cookies ?? {};
            const cookies = cookiesParms.reduce(
                (acc, key) => (q[key] != null ? { ...acc, [key]: q[key] } : acc),
                {}
            );

            ctx.cookies = Object.keys(cookies).length ? cookies : {};

            return await originalMethod.call(this, ctx, next);
        };

        return descriptor;
    };
};