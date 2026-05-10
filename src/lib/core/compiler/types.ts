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