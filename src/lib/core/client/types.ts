export type AnyRoutes = {
  [key: string]: any;
};

export type RoutesWithMethod<
  TRoutes extends AnyRoutes,
  TMethod extends string,
> = {
  [K in keyof TRoutes]:
    TMethod extends keyof TRoutes[K]
      ? K
      : never;
}[keyof TRoutes];

export type ExtractFrom<
  TRoutes extends AnyRoutes,
  TPath extends keyof TRoutes,
  TMethod extends keyof TRoutes[TPath],
  Key extends string,
> =
  TRoutes[TPath][TMethod] extends Record<
    Key,
    infer R
  >
    ? R
    : never

export type RequestBody<
  TRoutes extends AnyRoutes,
  TPath extends keyof TRoutes,
  TMethod extends keyof TRoutes[TPath],
> = ExtractFrom<
  TRoutes,
  TPath,
  TMethod,
  "body"
>;

export type RequestQuery<
  TRoutes extends AnyRoutes,
  TPath extends keyof TRoutes,
  TMethod extends keyof TRoutes[TPath],
> = ExtractFrom<
  TRoutes,
  TPath,
  TMethod,
  "query"
>;

export type RequestHeaders<
  TRoutes extends AnyRoutes,
  TPath extends keyof TRoutes,
  TMethod extends keyof TRoutes[TPath],
> = ExtractFrom<
  TRoutes,
  TPath,
  TMethod,
  "headers"
>;

export type RequestParams<
  TRoutes extends AnyRoutes,
  TPath extends keyof TRoutes,
  TMethod extends keyof TRoutes[TPath],
> = ExtractFrom<
  TRoutes,
  TPath,
  TMethod,
  "params"
>;

export type RequestFiles<
  TRoutes extends AnyRoutes,
  TPath extends keyof TRoutes,
  TMethod extends keyof TRoutes[TPath],
> = ExtractFrom<
  TRoutes,
  TPath,
  TMethod,
  "files"
>;

export type ResponseType<
  TRoutes extends AnyRoutes,
  TPath extends keyof TRoutes,
  TMethod extends keyof TRoutes[TPath],
> =
  TRoutes[TPath][TMethod] extends {
    response: infer R;
  }
    ? Awaited<R>
    : never;

export type Prettify<T> = { [K in keyof T]: T[K] } & {};

export type ExactProperty<Key extends string, T> =
  [T] extends [never] ? { [K in Key]?: never } :
  undefined extends T ? { [K in Key]?: T } :
  {} extends T ? { [K in Key]?: T } : 
  { [K in Key]: T };

export type OptionalIfEmpty<T> = {} extends T ? [input?: T] : [input: T];

export type RequestInput<
  TRoutes extends AnyRoutes,
  TPath extends keyof TRoutes,
  TMethod extends keyof TRoutes[TPath],
> = Prettify<
  ExactProperty<"params", RequestParams<TRoutes, TPath, TMethod>> &
  ExactProperty<"headers", RequestHeaders<TRoutes, TPath, TMethod>> &
  ExactProperty<"query", RequestQuery<TRoutes, TPath, TMethod>> &
  ExactProperty<"body", RequestBody<TRoutes, TPath, TMethod>> &
  ExactProperty<"files", RequestFiles<TRoutes, TPath, TMethod>>
>;

export type SuccessStatus =
  | 200 | 201 | 202 | 203 | 204 | 205 | 206 | 207 | 208 | 226

export type ErrorStatus =
  | 400 | 401 | 402 | 403 | 404 | 405 | 406 | 407 | 408 | 409
  | 410 | 411 | 412 | 413 | 414 | 415 | 416 | 417 | 418 | 421
  | 422 | 423 | 424 | 425 | 426 | 428 | 429 | 431 | 451
  | 500 | 501 | 502 | 503 | 504 | 505 | 506 | 507 | 508 | 510 | 511;

export type ApiResponse<
  T,
  E = any
> =
  | {
      ok: true;
      status: SuccessStatus;
      headers: Headers;
      data: T;
    }
  | {
      ok: false;
      status: ErrorStatus;
      headers: Headers;
      data: E;
    };
  