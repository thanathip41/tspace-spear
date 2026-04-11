import { type T } from '../types';

export function createDtoDecorator(
    validator: (ctx: T.Context) => void | Promise<void>,
    onError?: (ctx: T.Context, error: any) => any
): MethodDecorator {
    return (_target, _key, descriptor: PropertyDescriptor) => {
        const original = descriptor.value;

        descriptor.value = async function (ctx: T.Context, next: T.NextFunction) {
            try {
                await validator(ctx);

                return await original.call(this, ctx, next);

            } catch (err: any) {

                if (onError) {
                    return onError(ctx, err);
                }

                let message = err?.message ?? "Bad Request";
                let issues = err.issues ?? [];
                let status : 400 | 422 = 400;

                if(err.name === "ZodError") {
                    const zodIssues = err.issues
                    .map((i: { path: any[]; message: string; }) => ({
                        path: i.path.join("."),
                        message: i.message,
                    }));

                    message = "Validation failed";
                    issues = zodIssues;
                    status = 422;
                }

                return ctx.res.status(status).json({
                    message,
                    issues,
                });
            }
        };

        return descriptor;
    };
}
export function createContextDecorator(
    hook: (
        ctx: T.Context,
        next: T.NextFunction,
        meta: {
            target: any;
            key: string | symbol;
            descriptor: PropertyDescriptor;
        }
    ) => any | Promise<any>
): MethodDecorator {
    return (target, key, descriptor: PropertyDescriptor) => {
        const original = descriptor.value;

        descriptor.value = async function (ctx: T.Context, next: T.NextFunction) {
            return await hook(ctx, async () => {
                return await original.call(this, ctx, next);
            }, {
                target,
                key,
                descriptor,
            });
        };

        return descriptor;
    };
}

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
export const Body = (...keys: string[]) : MethodDecorator => {
    return createContextDecorator(async (ctx, next) => {
        const body = ctx.body;
    
        ctx.body = keys.reduce(
            (prev, curr) => (body[curr] != null ? { ...prev, [curr]: body[curr] } : prev),
            {}
        );

        return await next();
    });
}
    
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
 * @param {...string} keys - File field names to extract.
 * @returns {MethodDecorator}
 */
export const Files = (...keys: string[]): MethodDecorator => {
    return createContextDecorator(async (ctx, next) => {
        const files = ctx.files;
    
        ctx.files = keys.reduce(
            (prev, curr) => (files[curr] != null ? { ...prev, [curr]: files[curr] } : prev),
            {}
        );

        return await next();
    });
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
 * @param {...string} keys - Route parameter names to extract.
 * @returns {MethodDecorator}
 */
export const Params = (...keys: string[]): MethodDecorator => {
    return createContextDecorator(async (ctx, next) => {
        const params = ctx.params;
    
        ctx.params = keys.reduce(
            (prev, curr) => (params[curr] != null ? { ...prev, [curr]: params[curr] } : prev),
            {}
        );

        return await next();
    });
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
 * @param {...string} keys - Query parameter names to extract.
 * @returns {MethodDecorator}
 */
export const Query = (...keys: string[]): MethodDecorator => {
    return createContextDecorator(async (ctx, next) => {
        const query = ctx.query;
    
        ctx.query = keys.reduce(
            (prev, curr) => (query[curr] != null ? { ...prev, [curr]: query[curr] } : prev),
            {}
        );

        return await next();
    });
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
 * @param {...string} keys - Cookie names to extract.
 * @returns {MethodDecorator}
 */
export const Cookies = (...keys: string[]): MethodDecorator => {
    return createContextDecorator(async (ctx, next) => {
        const cookies = ctx.cookies;
    
        ctx.cookies = keys.reduce(
            (prev, curr) => (cookies[curr] != null ? { ...prev, [curr]: cookies[curr] } : prev),
            {}
        );

        return await next();
    });
};