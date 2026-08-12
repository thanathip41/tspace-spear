import http     from "http";
import net      from "net";
import crypto   from "crypto";
import { T }    from "../..";
import { 
    ParserFactory 
} from '../server/parser-factory';

type ValidateType = 
    | 'string'  | 'number' | 'boolean' | 'array' | 'object' 
    | 'integer' | 'float'  | 'null'    | 'undefined'
    | 'email'   | 'url'    | 'uuid'    | 'date' | 'datetime' 
    | 'ipv4'    | 'ipv6';

type ValidateField = {
    type      : ValidateType;
    required  ?: boolean;
    min       ?: number;
    max       ?: number;
    minLength ?: number;
    maxLength ?: number;
    pattern   ?: string | RegExp;
    enum      ?: string[];
}

type ValidateSchema = {
    body    ?: Record<string, ValidateField>;
    query   ?: Record<string, ValidateField>;
    params  ?: Record<string, ValidateField>;
    headers ?: Record<string, ValidateField>;
}

/**
 * Body parser middleware - Parses request body based on content-type.
 * Supports JSON, URL-encoded, and multipart/form-data payloads.
 * 
 * @param options - Configuration options
 * @param options.except - Array of HTTP methods to skip parsing (e.g., ['GET', 'HEAD'])
 * @returns Express-style middleware function
 * 
 * @example
 * ```typescript
 * app.use(bodyParser());
 * ```
 * 
 * @example
 * ```typescript
 * // Skip parsing for GET requests
 * app.use(bodyParser({ except: ['GET'] }));
 * ```
 */
export const bodyParser = (opts: { 
    adapter ?: T.AdapterServer;
    except  ?: T.MethodInput[];
} = {}) => {
    const parser = new ParserFactory();

    if(opts.adapter) {
        let adapter !: T.Adapter;

        if (opts.adapter === http) {
            adapter = { kind: 'http', server: opts.adapter };
        } 

        else if (opts.adapter === net) {
            adapter = { kind: 'net', server: opts.adapter };
        } 
        
        else {
            //@ts-ignore
            adapter = { kind: 'uWS', server: opts.adapter };
        }

        parser.useAdapter(adapter);
    }

    return (async (ctx : T.Context , next : T.NextFunction) => {
        
        const { req, res } = ctx;

        if(
            Array.isArray(opts.except) && 
            opts.except.some(v => v.toLowerCase() === (req.method!).toLowerCase())
        ) {
            return next();
        }

        const contentType = req?.headers['content-type'] ?? null;

        if(contentType == null) return next();

        const isFileUpload = contentType && contentType.startsWith('multipart/form-data');

        if(isFileUpload) return next();

        if(req?.body != null) return next();

        try {
            const body = await parser.body(req, res);
            req.body = body;
            return next();
            
        } catch (err: any) {
            return next(err);
        }
    })
}

/**
 * File upload middleware - Handles multipart/form-data file uploads.
 * Uses busboy internally for efficient streaming file processing.
 * 
 * @param options - Configuration options
 * @param options.limit - Maximum file size limit (default: Infinity)
 * @param options.tempFileDir - Directory for temporary file storage (default: 'tmp')
 * @param options.removeTempFile - Options for automatic temp file cleanup
 * @param options.removeTempFile.remove - Whether to remove temp files automatically (default: false)
 * @param options.removeTempFile.ms - Delay before removing temp files in milliseconds (default: 600000)
 * @returns Express-style middleware function
 * 
 * @example
 * ```typescript
 * app.use(fileUpload());
 * ```
 * 
 * @example
 * ```typescript
 * // With file size limit and auto-cleanup
 * app.use(fileUpload({ 
 *     limit: 10 * 1024 * 1024, // 10MB
 *     removeTempFile: { remove: true, ms: 60000 }
 * }));
 * ```
 */
export const fileUpload = (opts : {
    adapter ?: T.Adapter;
    limit ?: number
    tempFileDir ?: string
    removeTempFile ?: {
        remove : boolean
        ms : number
    }
} = {}) => {

    const parser = new ParserFactory();

    if(opts.adapter) {
        parser.useAdapter(opts.adapter)
    }

    if(opts.limit == null) {
        opts.limit = Infinity
    }

    if(opts.tempFileDir == null) {
        opts.tempFileDir = 'tmp'
    }

    if(opts.removeTempFile == null) {
        opts.removeTempFile = {
            remove : false,
            ms : 1000 * 60 * 10
        }
    }

    const options = { ...opts } as {
      limit: number;
      tempFileDir: string;
      removeTempFile: {
        remove: boolean;
        ms: number;
      };
    }

    return (async (ctx : T.Context , next : T.NextFunction) => {

        const { req , res } = ctx
          
        if(req.method === 'GET') {
            return next()
        }

        const contentType = req?.headers['content-type'];

        const isFileUpload = contentType && contentType.startsWith('multipart/form-data');

        if(!isFileUpload) return next()

        if(req?.files != null) return next()
        
        try {

            const r = await parser.files({ req , res, options });

            req.files = r.files;
            req.body = r.body;

            return next();
        } catch (err:any) {

            return next(err);
        }
    })
}

/**
 * Cookie parser middleware - Parses Cookie header and populates req.cookies.
 * 
 * @returns Express-style middleware function
 * 
 * @example
 * ```typescript
 * app.use(cookieParser());
 * 
 * // Access cookies in route handler
 * app.get('/', (ctx) => {
 *     const sessionId = ctx.req.cookies?.sessionId;
 * });
 * ```
 */
export const cookieParser = () => {
    const parser = new ParserFactory();

    return (async (ctx: T.Context, next: T.NextFunction) => {
        const { req } = ctx;

        if (req.cookies != null) {
            return next();
        }

        try {
            const cookies = parser.cookies(req);
            req.cookies = cookies as any;
            return next();
        } catch (err: any) {
            return next(err);
        }
    })
}

/**
 * Authentication middleware - Validates authentication credentials from request headers.
 * Supports Bearer token, Basic auth, and API key authentication schemes.
 * 
 * @param options - Configuration options
 * @param options.type - Authentication type: 'bearer' | 'basic' | 'apikey' (default: 'bearer')
 * @param options.header - Header name to extract credentials from (default: 'Authorization')
 * @param options.validate - Async validation function for token/credentials
 * @param options.realm - Realm name for 401 challenge response (default: 'Authentication Required')
 * @returns Express-style middleware function
 * 
 * @example
 * ```typescript
 * // Bearer token authentication
 * app.use(auth({ type: 'bearer' }));
 * ```
 * 
 * @example
 * ```typescript
 * // Bearer token with custom validation
 * app.use(auth({
 *     type: 'bearer',
 *     validate: async (token) => {
 *         const user = await verifyToken(token);
 *         return !!user;
 *     }
 * }));
 * ```
 * 
 * @example
 * ```typescript
 * // API key authentication
 * app.use(auth({ type: 'apikey', header: 'X-API-Key' }));
 * ```
 */
export const auth = (options: {
    type?: 'bearer' | 'basic' | 'apikey'
    header?: string
    validate?: (token: string, ctx: T.Context) => Promise<boolean> | boolean
    realm?: string
} = {}) => {

    const { type = 'bearer', header = 'Authorization', realm = 'Authentication Required' } = options;

    return (async (ctx: T.Context, next: T.NextFunction) => {

        const { req, res } = ctx;

        const authHeader = req.headers?.[header.toLowerCase()] || req.headers?.[header];

        if (!authHeader) {
            res.setHeader('WWW-Authenticate', type === 'basic' ? `Basic realm="${realm}"` : `Bearer realm="${realm}"`);
            return res.unauthorized('Authentication required');
        }

        let token: string = '';

        if (type === 'bearer') {
            const match = authHeader.match(/^Bearer\s+(.+)$/i);

            if (!match) {
                return res.unauthorized('Invalid bearer token format');
            }

            token = match[1];

        } else if (type === 'basic') {

            const match = authHeader.match(/^Basic\s+(.+)$/i);

            if (!match) {
                return res.unauthorized('Invalid basic token format');
            }
            
            token = Buffer.from(match[1], 'base64').toString('utf-8');

        } else if (type === 'apikey') {
            token = authHeader;
        }

        if (options.validate && token) {
            try {
                const isValid = await options.validate(token, ctx);
                if (!isValid) {
                    return res.unauthorized('Invalid credentials');
                }
            } catch (err: any) {
                return res.serverError(err.message)
            }
        }

        return next();
    })
}

/**
 * Rate limiter middleware - Limits request frequency per client.
 * Uses in-memory store to track request counts within time windows.
 * 
 * @param options - Configuration options
 * @param options.windowMs - Time window in milliseconds (default: 60000 = 1 minute)
 * @param options.max - Maximum requests per window (default: 5)
 * @param options.message - Response message when limit exceeded
 * @param options.keyGenerator - Function to generate unique client identifier
 * @param options.handler - Custom handler function when limit exceeded
 * @param options.usePathMethod - Use path + method + IP as rate limit key (default: true)
 * @returns Express-style middleware function
 * 
 * @example
 * ```typescript
 * // Default: 5 requests per minute per endpoint per IP
 * app.use(rateLimiter());
 * ```
 * 
 * @example
 * ```typescript
 * // 100 requests per hour per IP (all endpoints combined)
 * app.use(rateLimiter({
 *     windowMs: 60 * 60 * 1000,
 *     max: 100,
 *     usePathMethod: false
 * }));
 * ```
 */
export const rateLimiter = (options: {
    windowMs?: number
    max?: number
    message?: string
    keyGenerator?: (ctx: T.Context) => string
    handler?: (ctx: T.Context) => void
    /**
     * Use path + method + IP as the rate limit key (default: true)
     * When true, each unique combination of path, method, and IP has its own limit
     * When false, only IP is used for rate limiting
     */
    usePathMethod?: boolean
} = {}) => {

    const {
        windowMs = 1000 * 60,
        max = 5,
        message = 'Rate limit exceeded, please try again later',
        usePathMethod = true,
        keyGenerator = (ctx) => {
            const { req } = ctx;
            const ip = req.ip || 'unknown';
            
            if (usePathMethod) {
                const method = req.method || 'UNKNOWN';
                const path = req.url || 'UNKNOWN';
                return `${method}:${path}:${ip}`;
            }
            return ip;
        }
    } = options;

    const store = new Map<string, { count: number; resetTime: number }>();

    setInterval(() => {
        const now = Date.now();
        for (const [key, value] of store.entries()) {
            if (value.resetTime < now) {
                store.delete(key);
            }
        }
    }, windowMs);

    return (async (ctx: T.Context, next: T.NextFunction) => {
        const {  res } = ctx;
        const key = keyGenerator(ctx);
        const now = Date.now();

        let record = store.get(key);

        if (!record || record.resetTime < now) {
            record = { count: 1, resetTime: now + windowMs };
            store.set(key, record);
        } else {
            record.count++;
        }

        const remaining = Math.max(0, max - record.count);
        const resetTime = Math.ceil((record.resetTime - now) / 1000);

        res.setHeader('X-RateLimit-Limit', String(max));
        res.setHeader('X-RateLimit-Remaining', String(remaining));
        res.setHeader('X-RateLimit-Reset', String(resetTime));

        if (record.count > max) {
            if (options.handler) {
                options.handler(ctx);
            } else {
                return res.tooManyRequests(message);
            }
        }

        return next();
    })
}

/**
 * Timeout middleware - Sets maximum request processing time.
 * Returns 408 Request Timeout if request exceeds specified duration.
 * 
 * Note: This middleware must be used before route handlers to properly
 * intercept and timeout long-running requests.
 * 
 * @param ms - Timeout duration in milliseconds
 * @param options - Configuration options
 * @param options.message - Response message when timeout occurs
 * @returns Express-style middleware function
 * 
 * @example
 * ```typescript
 * // 30 second timeout
 * app.use(timeout(30000));
 * ```
 * 
 * @example
 * ```typescript
 * // Custom timeout message
 * app.use(timeout(5000, { message: 'Request timed out, please try again' }));
 * ```
 */
export const timeout = (ms: number, options: { message?: string } = {}) => {
    const { 
        message = 'The request took too long to process' 
    } = options;

    return (ctx: T.Context, next: T.NextFunction) => {
        const { res } = ctx;
       
        const timeoutPromise = new Promise<void>((resolve) => {
            setTimeout(() => {
                res.timeout(message);
                return resolve();
            }, ms);
        });

        const handlerPromise = (async () => {
            await next();
        })();

        return Promise.race([timeoutPromise, handlerPromise]);
    }
}

/**
 * Security headers middleware - Adds various HTTP security headers to responses.
 * Implements best practices for web security including XSS protection, 
 * content type sniffing prevention, clickjacking protection, and HSTS.
 * 
 * @param options - Configuration options
 * @param options.hidePoweredBy - Remove X-Powered-By header (default: true)
 * @param options.xssProtection - Enable XSS Protection header (default: true)
 * @param options.noSniff - Enable X-Content-Type-Options: nosniff (default: true)
 * @param options.frameguard - X-Frame-Options value: 'DENY' | 'SAMEORIGIN' | string (default: 'DENY')
 * @param options.hsts - Strict-Transport-Security configuration
 * @param options.hsts.maxAge - Max age in seconds (default: 31536000 = 1 year)
 * @param options.hsts.includeSubDomains - Include subdomains (default: false)
 * @param options.hsts.preload - Enable HSTS preload (default: false)
 * @param options.contentSecurityPolicy - Content-Security-Policy header value
 * @param options.referrerPolicy - Referrer-Policy header value (default: 'strict-origin-when-cross-origin')
 * @returns Express-style middleware function
 * 
 * @example
 * ```typescript
 * // Default security headers
 * app.use(securityHeaders());
 * ```
 * 
 * @example
 * ```typescript
 * // Full security configuration with all options
 * app.use(securityHeaders({
 *     hidePoweredBy: true,                    // Remove 'X-Powered-By' header
 *     xssProtection: true,                    // X-XSS-Protection: 1; mode=block
 *     noSniff: true,                          // X-Content-Type-Options: nosniff
 *     frameguard: 'DENY',                     // X-Frame-Options: DENY
 *     hsts: {
 *         maxAge: 31536000,                   // 1 year in seconds
 *         includeSubDomains: true,            // Apply to all subdomains
 *         preload: true                       // Enable HSTS preload list
 *     },
 *     contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://api.example.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
 *     referrerPolicy: 'strict-origin-when-cross-origin'
 * }));
 * ```
 * 
 * @example
 * ```typescript
 * // Strict CSP for API-only application
 * app.use(securityHeaders({
 *     contentSecurityPolicy: "default-src 'none'; script-src 'none'; style-src 'none'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'"
 * }));
 * ```
 * 
 * @example
 * ```typescript
 * // HSTS with subdomains and preload
 * app.use(securityHeaders({
 *     hsts: {
 *         maxAge: 63072000,          // 2 years
 *         includeSubDomains: true,
 *         preload: true
 *     }
 * }));
 * ```
 * 
 */
export const securityHeaders = (options: {
    hidePoweredBy?: boolean
    xssProtection?: boolean
    noSniff?: boolean
    frameguard?: 'DENY' | 'SAMEORIGIN' | string
    hsts?: { maxAge?: number; includeSubDomains?: boolean; preload?: boolean }
    contentSecurityPolicy?: string
    referrerPolicy?: string
} = {}) => {

    const {
        hidePoweredBy = true,
        xssProtection = true,
        noSniff = true,
        frameguard = 'DENY',
        hsts,
        contentSecurityPolicy,
        referrerPolicy = 'strict-origin-when-cross-origin'
    } = options;

    return (async (ctx: T.Context, next: T.NextFunction) => {
        const { res } = ctx;

        if (hidePoweredBy) {
            res.removeHeader('X-Powered-By');
        }

        if (xssProtection) {
            res.setHeader('X-XSS-Protection', '1; mode=block');
        }

        if (noSniff) {
            res.setHeader('X-Content-Type-Options', 'nosniff');
        }

        if (frameguard) {
            res.setHeader('X-Frame-Options', frameguard);
        }

        if (hsts) {
            const { maxAge = 31536000, includeSubDomains = false, preload = false } = hsts;
            let hstsValue = `max-age=${maxAge}`;
            if (includeSubDomains) hstsValue += '; includeSubDomains';
            if (preload) hstsValue += '; preload';
            res.setHeader('Strict-Transport-Security', hstsValue);
        }

        if (contentSecurityPolicy) {
            res.setHeader('Content-Security-Policy', contentSecurityPolicy);
        }

        if (referrerPolicy) {
            res.setHeader('Referrer-Policy', referrerPolicy);
        }

        return next();
    })
}

/**
 * Request ID middleware - Generates/propagates unique request identifiers.
 * Adds X-Request-Id header to responses for request tracing and debugging.
 * 
 * @param options - Configuration options
 * @param options.name - Header name for request ID (default: 'X-Request-Id')
 * @returns Express-style middleware function
 * 
 * @example
 * ```typescript
 * app.use(requestId());
 * 
 * // Access request ID in handlers
 * app.get('/', (ctx) => {
 *     const requestId = (ctx as any).requestId;
 *     logger.info(`Processing request: ${requestId}`);
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Custom header name
 * app.use(requestId({ name: 'X-Correlation-Id' }));
 * ```
 */
export const requestId = (options: { name?: string } = {}) => {
    const { name = 'X-Request-Id' } = options;

    const generateId = () => {
        return crypto.randomBytes(16).toString('hex');
    };

    return (async (ctx: T.Context, next: T.NextFunction) => {
        const { req, res } = ctx;

        let requestId = req.headers[name.toLowerCase()] as string;

        if (!requestId) {
            requestId = generateId();
        }

        res.setHeader(name, requestId);

        (ctx as any).requestId = requestId;

        return next();
    })
}

/**
 * Validation middleware - Validates request data against defined schema.
 * Supports validation of body, query, params, and headers with various
 * type checks and constraints.
 * 
 * @param schema - Validation schema definition
 * @param schema.body - Body validation rules
 * @param schema.query - Query string validation rules
 * @param schema.params - Route params validation rules
 * @param schema.headers - Request headers validation rules
 * @returns Express-style middleware function
 * 
 * @example
 * ```typescript
 * app.post('/users', validate({
 *     body: {
 *         email: { type: 'email', required: true },
 *         age: { type: 'integer', min: 18, max: 100 },
 *         username: { type: 'string', minLength: 3, maxLength: 20 }
 *     }
 * }), (ctx) => {
 *     // Valid request - proceed with handler
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Full validation with all locations
 * app.use(validate({
 *     body: {
 *         name: { type: 'string', required: true, minLength: 1 },
 *         status: { type: 'string', enum: ['active', 'inactive'] }
 *     },
 *     query: {
 *         page: { type: 'integer', min: 1 },
 *         limit: { type: 'integer', min: 1, max: 100 }
 *     },
 *     params: {
 *         id: { type: 'uuid', required: true }
 *     }
 * }));
 * ```
 */
export const validate = (schema: ValidateSchema) => {

    const validateType = (value: any, expectedType: ValidateType): boolean => {
        switch (expectedType) {
            case 'string': return typeof value === 'string';
            case 'number': return typeof value === 'number';
            case 'boolean': return typeof value === 'boolean';
            case 'array': return Array.isArray(value);
            case 'object': return typeof value === 'object' && value !== null && !Array.isArray(value);
            case 'integer': return Number.isInteger(value);
            case 'float': return typeof value === 'number' && !Number.isInteger(value);
            case 'null': return value === null;
            case 'undefined': return value === undefined;
            case 'email': 
                return typeof value === 'string' && 
                    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
            case 'url': 
                return typeof value === 'string' && 
                    /^https?:\/\/.+$/.test(value);
            case 'uuid': 
                return typeof value === 'string' && 
                    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
            case 'date': 
                return typeof value === 'string' && 
                    /^\d{4}-\d{2}-\d{2}$/.test(value) && 
                    !isNaN(new Date(value).getTime());
            case 'datetime': 
                return typeof value === 'string' && 
                    !isNaN(new Date(value).getTime());
            case 'ipv4': 
                return typeof value === 'string' && 
                    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(value);
            case 'ipv6': 
                return typeof value === 'string' && 
                    /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:){1,7}:$|^([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}$|^([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}$|^([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}$|^([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}$|^[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:^((:[0-9a-fA-F]{1,4}){1,7}:)$/.test(value);
            default: return true;
        }
    };

    const validateFields = (data: Record<string, any>, fieldSchema: Record<string, ValidateField>, location: string): string[] => {
        const errors: string[] = [];

        for (const [field, rules] of Object.entries(fieldSchema)) {
            const { type, required = false, min, max, minLength, maxLength, pattern, enum: enumValues } = rules;
            const value = data?.[field];

            if (required && (value === undefined || value === null)) {
                errors.push(`${location}.${field} is required`);
                continue;
            }

            if (value === undefined || value === null) {
                continue;
            }

            if (!validateType(value, type)) {
                errors.push(`${location}.${field} must be of type ${type}`);
                continue;
            }

            if (enumValues && !enumValues.includes(value)) {
                errors.push(`${location}.${field} must be one of: ${enumValues.join(', ')}`);
            }

            if (typeof value === 'number') {
                if (min !== undefined && value < min) {
                    errors.push(`${location}.${field} must be >= ${min}`);
                }
                if (max !== undefined && value > max) {
                    errors.push(`${location}.${field} must be <= ${max}`);
                }
            }

            if (typeof value === 'string') {
                if (minLength !== undefined && value.length < minLength) {
                    errors.push(`${location}.${field} must have at least ${minLength} characters`);
                }
                if (maxLength !== undefined && value.length > maxLength) {
                    errors.push(`${location}.${field} must have at most ${maxLength} characters`);
                }
            }

            if (typeof value === 'string' && pattern) {
                const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
                if (!regex.test(value)) {
                    errors.push(`${location}.${field} must match pattern: ${pattern}`);
                }
            }
        }

        return errors;
    };

    return (async (ctx: T.Context, next: T.NextFunction) => {
        const { req } = ctx;
        const errors: string[] = [];

        if (schema.body) {
            errors.push(...validateFields(req.body, schema.body, 'body'));
        }

        if (schema.query) {
            errors.push(...validateFields(req.query, schema.query, 'query'));
        }

        if (schema.params) {
            errors.push(...validateFields(req.params, schema.params, 'params'));
        }

        if (schema.headers) {
            errors.push(...validateFields(req.headers, schema.headers, 'headers'));
        }

        if (errors.length > 0) {
            return ctx.res
            .status(400)
            .json({ 
                message: 'Validation Error', 
                details: errors 
            });
        }

        return next();
    })
}