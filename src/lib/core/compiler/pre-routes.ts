
// AUTO GENERATED FILE
// DO NOT EDIT

export interface AppRoutes {

  "/cats": {

    GET: {
      params: never
      query: { id?: string; name?: string; }
      body: Record<string, any>
      files: never
      response: Promise<{ query: { id?: string; name?: string; }; cats: { id: number; name: string; age: number; }[]; }>
    }

    POST: {
      params: never
      query: never
      body: { name: string; age: number; }
      files: never
      response: Promise<{ cat: { name: string; age: number; id: number; }; message: string; }>
    }
  }

  "/cats/:id": {

    GET: {
      params: { id: number; }
      query: never
      body: Record<string, any>
      files: never
      response: Promise<{ cat: Cat; }>
    }

    PUT: {
      params: { id: number; }
      query: never
      body: Partial<{ name: string; age: number; }>
      files: never
      response: Promise<{ message: string; cat?: undefined; } | { message: string; cat: { id: number; name: string; age: number; }; }>
    }

    DELETE: {
      params: { id: number; }
      query: never
      body: Record<string, any>
      files: never
      response: Promise<{ message: string; }>
    }
  }
}

export type AppRoute = keyof AppRoutes
