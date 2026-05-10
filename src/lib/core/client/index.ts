import type { AppRoutes } from "../compiler/pre-routes";

import type {
  RoutesWithMethod,
  RequestBody,
  RequestQuery,
  RequestParams,
  RequestFiles,
  ResponseType,
} from "../compiler/types";

type RequestInput<
  TPath extends keyof AppRoutes,
  TMethod extends keyof AppRoutes[TPath],
> =
  RequestParams<TPath, TMethod> extends never
    ? {
        body?: RequestBody<TPath, TMethod>;
        query?: RequestQuery<TPath, TMethod>;
        files?: RequestFiles<TPath, TMethod>;
      }
    : {
        params: RequestParams<TPath, TMethod>;
        body?: RequestBody<TPath, TMethod>;
        query?: RequestQuery<TPath, TMethod>;
        files?: RequestFiles<TPath, TMethod>;
      };

export class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  protected async request<
    TPath extends keyof AppRoutes,
    TMethod extends keyof AppRoutes[TPath],
  >(
    method: TMethod,
    path: TPath,
    input?: RequestInput<TPath, TMethod>,
  ): Promise<ResponseType<TPath, TMethod>> {
    const url = this.baseURL + path;

    const res = await fetch(url, {
      method: method as string,
      headers: {
        "Content-Type": "application/json",
      },
      body: input?.body ? JSON.stringify(input.body) : undefined,
    });

    const contentType = res.headers.get("content-type");

    const isJson = contentType?.includes("application/json");

    const data = isJson ? await res.json() : await res.text();

    if (!res.ok) {
      throw new Error(
        data?.message ||
          data?.error ||
          (typeof data === "string" ? data : `HTTP ${res.status}`),
      );
    }

    return data;
  }

  public async get<TPath extends RoutesWithMethod<"GET">>(
    path: TPath,
    input?: RequestInput<TPath, "GET">,
  ) {
    return this.request("GET", path, input);
  }

  public async post<TPath extends RoutesWithMethod<"POST">>(
    path: TPath,
    input: RequestInput<TPath, "POST">,
  ) {
    return this.request("POST", path, input);
  }

  public async put<TPath extends RoutesWithMethod<"PUT">>(
    path: TPath,
    input: RequestInput<TPath, "PUT">,
  ) {
    return this.request("PUT", path, input);
  }

  public async patch<TPath extends RoutesWithMethod<"PATCH">>(
    path: TPath,
    input: RequestInput<TPath, "PATCH">,
  ) {
    return this.request("PATCH", path, input);
  }

  public async delete<TPath extends RoutesWithMethod<"DELETE">>(
    path: TPath,
    input?: RequestInput<TPath, "DELETE">,
  ) {
    return this.request("DELETE", path, input);
  }
}
