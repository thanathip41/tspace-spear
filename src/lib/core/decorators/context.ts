import Package from '../package';
import { type T } from '../types';

type ClassConstructor<T = any> =
  new (...args: any[]) => T;

type ZodSchemaLike = {
  parse: (input: unknown) => any;   
  parseAsync: (input: unknown) => Promise<any>;
  safeParseAsync: (input: unknown) => Promise<{ success: boolean; data?: any; error?: any }>;
  safeParse: (input: unknown) => { success: boolean; data?: any; error?: any };
};

type Target = "params" | "query" | "body" | "files";

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
                let issues = err.issues ?? err.errors ?? [];
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
 * @param {...string} keys - Body field names to extract.
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

/**
 * Validates required fields from a request target.
 *
 * @param keys - List of required field names.
 * @param options - Validation options.
 * @property options.target - Request source to validate. defaults to `"body"`.
 *
 * @property options.required - Enables required-value validation.
 *
 * - `true`
 *   - Rejects `null`
 *   - Rejects empty strings (`""`)
 *
 * - `object`
 *   - Allows customizing required rules.
 *
 * @property options.required.allowNull - Allow `null` values. Default: `false`
 *
 * @property options.required.allowEmptyString - Allow empty string values. Default: `false`
 * @returns {MethodDecorator}
 *
 * @throws {Object} Throws a validation error object when
 * one or more required fields are missing.
 *
 * @example
 * ```ts
 * \@Validate(["email", "password"], {
 *   required: {
 *     allowEmptyString : true,
 *     allowNull        : false
 *   }
 * });
 * ```
 *
 * @example
 * ```ts
 * \@Validate(["id"], { target: "query" });
 * ```
 */
export const Validate = ( keys: string[], { target, required } : { 
    target ?: Target;
    required ?: boolean | {
        allowNull?: boolean;
        allowEmptyString?: boolean;
    }

} = {}): MethodDecorator => {

    return createDtoDecorator((ctx) => {
        const payload = ctx[target ?? 'body'] ?? {};
        const issues: { path: string; message: string }[] = [];
        const requiredOpts = typeof required === "object"
            ? required
            : {};

        const allowNull = requiredOpts.allowNull ?? false;

        const allowEmptyString = requiredOpts.allowEmptyString ?? false;

        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const value = payload[key]
            if (value === undefined) {
                issues.push({
                    path: key,
                    message: "Missing field",
                });

                continue;
            }

             if (required) {
                const isNull = value === null && !allowNull;

                const isEmptyString =
                    typeof value === "string" &&
                    value.trim() === "" &&
                    !allowEmptyString;

                if (isNull || isEmptyString) {
                    issues.push({
                        path: key,
                        message: "Field is required",
                    });
                }
            }
        }

        if (issues.length) {
            throw {
                message : "Validation failed",
                issues
            }
        }

        return;
    });
}

/**
 * Validate request using either
 * `class-validator` or `zod`. 
 * 
 * Please install the required validation library before using this decorator.
 * @install
 * npm install class-validator class-transformer
 * 
 * npm install zod
 *
 * @example
 * // class-validator (default)
 * \@ValidateDto(UserDto)
 *
 * @example
 * // explicit class-validator
 * \@ValidateDto(UserDto, {
 *   adaptor: "class-validator"
 * })
 *
 * @example
 * // zod
 * \@ValidateDto(UserSchema, {
 *   adaptor: "zod"
 * })
 *
 * @param schema
 * Validation schema/class.
 *
 * - `class-validator`:
 *   Must be a class constructor.
 *
 * - `zod`:
 *   Must be a schema containing `.safeParseAsync()`.
 *
 * @param {Object} options Validation options.
 *
 * @property options.adaptor Validation adaptor. default "class-validator"
 * @property options.message Validation error message.
 * @property options.status Validation error status code.
 * @property options.target Request target to validate. default "body"
 *
 * @returns MethodDecorator
 */
export function ValidateDto(
    schema: ZodSchemaLike,
    options: { 
        adaptor : "zod"  
        message ?: string;
        status  ?: 400 | 422 | 500;
        target  ?: Target;
    }
): MethodDecorator;
export function ValidateDto(
    schema: ClassConstructor,
    options?: { 
        adaptor : "class-validator";
        message ?: string;
        status  ?: 400 | 422 | 500;
        target ?: Target;
    }
): MethodDecorator;
export function ValidateDto(
    schema: ZodSchemaLike | ClassConstructor,
    options?: {
        adaptor ?: "zod" | "class-validator";
        message ?: string;
        status  ?: 400 | 422 | 500;
        target ?: Target;
    }
): MethodDecorator {
   
    const status = options?.status ?? 422;
    const message = options?.message ?? "Validation failed";
    const adaptor = options?.adaptor ?? "class-validator";
    const target = options?.target ?? "body";

    return createDtoDecorator(async (ctx) => {

        if (adaptor === "zod") {
            const result = await (schema as ZodSchemaLike).safeParseAsync(ctx[target]);
           
            if(result.success) {
                ctx[target] = result.data;
                return;
            }

            const issues = result.error?.issues;

            const errors = Object
            .values(
                issues.reduce((acc:any, issue:any) => {

                    const key = issue.path.join(".");

                    if (!acc[key]) {

                    acc[key] = {
                        path: key,
                        constraints: {
                            [issue.code]: issue.message
                        },
                        message: issue.message
                    };

                    } else {
                        acc[key].constraints[issue.code] = issue.message;
                        acc[key].message +=`, ${issue.message}`;
                    }

                    return acc;

                }, {} as Record<string, {
                    path: string;
                    constraints: Record<string, string>;
                    message: string;
                }>)
            );

            return ctx.res.status(status).json({
                message: message,
                issues: errors
            });
        } 
    
        if (adaptor === "class-validator") {

            const dto = Package
            .classTransformer
            .plainToInstance(
                schema as ClassConstructor,
                ctx[target]
            );

            const errors = await Package
            .classValidator
            .validate(dto);

            if(!errors.length) {
                ctx[target] = dto;
                return;
            }

            const issues = errors.flatMap((error:any) => {
                const constraints = error.constraints ?? {};

                return {
                    path: error.property,
                    constraints,
                    message: Object.values(constraints).join(","),
                };
            })

            return ctx.res
            .status(status)
            .json({
                message: message,
                issues: issues
            });
        }

        throw new Error("Invalid validation adaptor specified");
    });
}