import type {
  AnyRoutes,
  RoutesWithMethod,
  RequestBody,
  RequestQuery,
  RequestParams,
  RequestFiles,
  ResponseType,
} from "../compiler/types";

type RequestInput<
  TRoutes extends AnyRoutes,
  TPath extends keyof TRoutes,
  TMethod extends keyof TRoutes[TPath],
> =
  RequestParams<TRoutes,TPath,TMethod> extends never
    ? {
        params ?: never;

        query  ?: RequestQuery<TRoutes,TPath,TMethod>;

        body   ?: RequestBody<TRoutes,TPath,TMethod>;

        files  ?: RequestFiles<TRoutes,TPath,TMethod>;
      }
    : {
        params : RequestParams<TRoutes,TPath,TMethod>;

        query  ?: RequestQuery<TRoutes,TPath,TMethod>;

        body   ?: RequestBody<TRoutes,TPath,TMethod>;

        files  ?: RequestFiles<TRoutes,TPath,TMethod>;
      };

let fetchFn: typeof fetch | null = null;

async function getFetch() {
  if (fetchFn) return fetchFn;

  if (globalThis.fetch) {
    fetchFn = globalThis.fetch;
    return fetchFn;
  }

  const mod = await import("node-fetch");
  fetchFn = mod.default as unknown as typeof fetch;

  return fetchFn;
}

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
 * console.log(res.cats)
 * ```
 */
class ApiClient<
  TRoutes extends AnyRoutes,
> {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  protected async request<
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
  ): Promise<{
    ok     : boolean;
    status : number;
    data   : ResponseType<
      TRoutes,
      TPath,
      TMethod
    >  
  }> {
    
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

    // if (!res.ok) {
    //   throw new Error(
    //     data?.message ||
    //       data?.error ||
    //       (typeof data === "string"
    //         ? data
    //         : `HTTP ${res.status}`),
    //   );
    // }

    return {
      ok : res.ok,
      status: res.status,
      data,
    }
  }

  public async get<
    TPath extends RoutesWithMethod<
      TRoutes,
      "GET"
    >,
  >(
    path: TPath,
    input?: RequestInput<
      TRoutes,
      TPath,
      "GET"
    >
  ) {
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
    input: RequestInput<
      TRoutes,
      TPath,
      "POST"
    >,
  ) {
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
    input: RequestInput<
      TRoutes,
      TPath,
      "PUT"
    >,
  ) {
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
    input: RequestInput<
      TRoutes,
      TPath,
      "PATCH"
    >,
  ) {
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
    input?: RequestInput<
      TRoutes,
      TPath,
      "DELETE"
    >,
  ) {
    return this.request(
      "DELETE",
      path,
      input,
    );
  }
}

export { ApiClient };
export default ApiClient;