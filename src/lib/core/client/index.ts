import type {
  AnyRoutes,
  RoutesWithMethod,
  ResponseType,
  RequestInput,
  OptionalIfEmpty,
  ApiResponse,
} from "./types";

let fetchFn: typeof fetch | null = null;

export const getFetch = async () => {
  if (fetchFn) return fetchFn;

  // Browser OR modern Node v18+ (preferred)
  if (typeof globalThis.fetch === "function") {
    fetchFn = globalThis.fetch.bind(globalThis);
    return fetchFn;
  }

  // Legacy Node fallback
  const mod = await import("node-fetch");
  fetchFn = mod.default as unknown as typeof fetch;

  return fetchFn;
};

/**
 * Type-safe HTTP client built on top of the native Fetch API.
 *
 * `ApiClient` provides end-to-end type safety for your API routes,
 * including:
 *
 * - `params` typing
 * - `query` typing
 * - `body` typing
 * - typed file uploads
 * - fully inferred response types
 *
 * Route types are inferred from your server route definitions,
 * giving you autocomplete and compile-time validation across
 * the entire request lifecycle.
 *
 * @template TRoutes Application route definitions.
 *
 * @example
 * ```ts
 * import app from '../server/app';
 * 
 * const client = new ApiClient<typeof app.contract>()
 *
 * const res = await client.get("/cats", {
 *   query: {
 *     id: "1",
 *   },
 * })
 *
 * // fully typed response
 * if(res.ok)
 *  console.log(res.cats)
 * ```
 */
class ApiClient<
  TRoutes extends AnyRoutes,
> {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request<
    TPath extends keyof TRoutes,
    TMethod extends keyof TRoutes[TPath],
  >(
    method: TMethod,
    path: TPath,
    input?: RequestInput<
      TRoutes,
      TPath,
      TMethod
    >,
  ): Promise<
      ApiResponse<
        ResponseType<
          TRoutes,
          TPath,
          TMethod
        >
      >
    > {
    
      let url = this.baseURL + (path as string)

   
      if (input?.params) {
        for (const key in input.params) {
          url = url.replace(
            `:${key}`,
            encodeURIComponent((input.params as any)[key])
          )
        }
      }

      if (input?.query) {
        const queryString = new URLSearchParams(
          input.query as any
        ).toString()

        if (queryString) {
          url += `?${queryString}`
        }
      }

    fetchFn = await getFetch();

    if (!fetchFn) {
      throw new Error("Fetch is not available. Use Node 18+ or polyfill.");
    }

    const res = await fetchFn(url, {
      method: method as string,
      headers: {
        "Content-Type":
          "application/json",
      },

      body: input?.body
        ? JSON.stringify(input.body)
        : undefined,
    });

    const contentType =
      res.headers.get("content-type");

    const isJson =
      contentType?.includes(
        "application/json",
      );

    const data = isJson
      ? await res.json()
      : await res.text();

    return {
      ok      : res.ok,
      headers : res.headers,
      status  : res.status as any,
      data    : data,
    }
  }

  public async get<
    TPath extends RoutesWithMethod<
      TRoutes,
      "GET"
    >,
  >(
    path: TPath,
    ...args: OptionalIfEmpty<RequestInput<TRoutes, TPath, "GET">>
  ) {
    const input = args[0];
    return this.request(
      "GET",
      path,
      input,
    );
  }

  public async post<
    TPath extends RoutesWithMethod<
      TRoutes,
      "POST"
    >,
  >(
    path: TPath,
    ...args: OptionalIfEmpty<RequestInput<TRoutes, TPath, "POST">>
  ) {
    const input = args[0];

    return this.request(
      "POST",
      path,
      input,
    );
  }

  public async put<
    TPath extends RoutesWithMethod<
      TRoutes,
      "PUT"
    >,
  >(
    path: TPath,
    ...args: OptionalIfEmpty<RequestInput<TRoutes, TPath, "PUT">>
  ) {
    const input = args[0];

    return this.request(
      "PUT",
      path,
      input,
    );
  }

  public async patch<
    TPath extends RoutesWithMethod<
      TRoutes,
      "PATCH"
    >,
  >(
    path: TPath,
    ...args: OptionalIfEmpty<RequestInput<TRoutes, TPath, "PATCH">>
  ) {
    const input = args[0];

    return this.request(
      "PATCH",
      path,
      input,
    );
  }

  public async delete<
    TPath extends RoutesWithMethod<
      TRoutes,
      "DELETE"
    >,
  >(
    path: TPath,
    ...args: OptionalIfEmpty<RequestInput<TRoutes, TPath, "DELETE">>
  ) {
    const input = args[0];

    return this.request(
      "DELETE",
      path,
      input,
    );
  }
}

export { ApiClient };
export default ApiClient;