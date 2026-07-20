import type {
  AnyRoutes,
  RoutesWithMethod,
  ResponseType,
  RequestInput,
  OptionalIfEmpty,
  ApiResponse,
} from "./types";

let fetchFn: typeof fetch | null = null;

const getFetch = async () => {
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

const isFormData = (value: unknown): boolean => {
  
  // In Node.js 18+ it is compatible with the browser implementation.
  if(typeof globalThis.FormData !== "undefined") {
    return value instanceof globalThis.FormData;
  }

  // In Node.js below 18-, FormData is not the same as in the browser
  // using from pkg form-data
  return (
    value != null &&
    typeof value === "object" &&
    typeof (value as any).append === "function" &&
    typeof (value as any).getHeaders === "function"
  );
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

    fetchFn = await getFetch();

    if (!fetchFn) {
      throw new Error("Fetch is not available. Use Node 18+ or polyfill.");
    }
  
    let url = this.baseURL + (path as string);

    let headers :any = {
      "Content-Type":
        "application/json",
    }

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

    if(input?.headers) {
      headers = {
        ...headers,
        ...input.headers
      }
    }

    let body :any = input?.body
      ? JSON.stringify(input.body)
      : undefined

    const isFileUpload = isFormData(input?.body);
  
    if(isFileUpload) {
      body = input?.body;
      headers = typeof body?.getHeaders === "function"
        ? body?.getHeaders() 
        : undefined

      // Legacy Node fallback
      if (body?._streams?.length === 0) {
        body = undefined;
        headers = undefined
      }
    }

    const res = await fetchFn(url, {
      method: method as string,
      headers,
      body
    })

    const contentType = res.headers.get("content-type");
    const isJson = contentType?.includes("application/json");

    const hasBody =
      res.body !== null &&
      res.status !== 204 &&
      res.status !== 205 &&
      res.status !== 304;

    let data = undefined;

    try {
      data = !hasBody
        ? null
        : isJson
          ? await res.json()
          : await res.text();
    } catch (err) {}
   
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

  public async upload<
    TMethod extends "POST" | "PUT" | "PATCH" = "POST",
    TPath extends RoutesWithMethod<TRoutes, TMethod> = RoutesWithMethod<TRoutes, TMethod>,
  >(
    path: TPath,
    options: {
      method?: TMethod;
      formdata: FormData
    }
  ) {
    const { method = "POST" as TMethod, formdata } = options;

    return this.request(
      method, 
      path,
      //@ts-ignore
      {
        body : formdata
      },
    );
  }

  public async options<
    TPath extends RoutesWithMethod<
      TRoutes,
      "GET"
    >,
  >(
    path: TPath,
    ...args: OptionalIfEmpty<RequestInput<TRoutes, TPath, "OPTIONS">>
  ) {
    const input = args[0];
    return this.request(
      "OPTIONS",
      path,
      input,
    );
  }

  public async head<
    TPath extends RoutesWithMethod<
      TRoutes,
      "HEAD"
    >,
  >(
    path: TPath,
    ...args: OptionalIfEmpty<RequestInput<TRoutes, TPath, "HEAD">>
  ) {
    const input = args[0];
    
    return this.request(
      "HEAD",
      path,
      input,
    );
  }

}

export { ApiClient };
export default ApiClient;