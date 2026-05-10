import type { AppRoutes } from "./pre-routes";

export type RoutesWithMethod<TMethod extends string> = {
  [K in keyof AppRoutes]: TMethod extends keyof AppRoutes[K] ? K : never;
}[keyof AppRoutes];

export type ExtractFrom<
  TPath extends keyof AppRoutes,
  TMethod extends keyof AppRoutes[TPath],
  Key extends string,
> = AppRoutes[TPath][TMethod] extends Record<Key, infer R> ? R : never;

export type RequestBody<
  TPath extends keyof AppRoutes,
  TMethod extends keyof AppRoutes[TPath],
> = ExtractFrom<TPath, TMethod, "body">;

export type RequestQuery<
  TPath extends keyof AppRoutes,
  TMethod extends keyof AppRoutes[TPath],
> = ExtractFrom<TPath, TMethod, "query">;

export type RequestParams<
  TPath extends keyof AppRoutes,
  TMethod extends keyof AppRoutes[TPath],
> = ExtractFrom<TPath, TMethod, "params">;

export type RequestFiles<
  TPath extends keyof AppRoutes,
  TMethod extends keyof AppRoutes[TPath],
> = ExtractFrom<TPath, TMethod, "files">;

export type ResponseType<
  TPath extends keyof AppRoutes,
  TMethod extends keyof AppRoutes[TPath],
> = AppRoutes[TPath][TMethod] extends {
  response: infer R;
}
  ? Awaited<R>
  : never;
