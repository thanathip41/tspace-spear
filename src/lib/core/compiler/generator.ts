import { Project } from "ts-morph"
import fs from "fs"
import path from "path"

const HTTP_METHODS = {
  Get: "GET",
  Post: "POST",
  Put: "PUT",
  Patch: "PATCH",
  Delete: "DELETE",
  Options: "OPTIONS",
  Head: "HEAD",
} as const

type Route = {
  method: string
  path: string
  response: string
  body: string
  params: string
  query: string
  files: string
}

type Options = {
  controllers: {
    folder: string
    name: RegExp
  }
  output?: string
}

function normalizePath(p: string) {
  return (
    "/" +
    p
      .replace(/['"`]/g, "")
      .replace(/\/+/g, "/")
      .replace(/\/$/, "")
      .replace(/^\//, "")
  )
}

function extractPropertyType(
  type: any,
  key: string,
  node: any
) {
  const prop = type.getProperty(key)
  if (!prop) return "never"

  const t = prop.getTypeAtLocation(node)

  const text = t.getText(node)

  if (!text || text.includes("undefined")) return "never"

  return text
}

export async function generateRoutes(options: Options) {
  const project = new Project({
    tsConfigFilePath: path.resolve(process.cwd(), "tsconfig.json"),
  })

  project.addSourceFilesAtPaths(
    path.join(options.controllers.folder, "**/*")
  )

  const files = project.getSourceFiles()

  if (!files.length) {
    console.log("No controller files found")
    return;
  }

  const routes: Route[] = []

  for (const file of files) {
    const filename = file.getBaseName()

    if (!options.controllers.name.test(filename)) continue

    for (const cls of file.getClasses()) {
      const controller = cls.getDecorator("Controller")
      if (!controller) continue

      const basePath =
        controller.getArguments()[0]
          ?.getText()
          .replace(/['"`]/g, "") || ""

      for (const method of cls.getMethods()) {
        for (const [decName, http] of Object.entries(HTTP_METHODS)) {
          const decorator = method.getDecorator(decName)
          if (!decorator) continue

          const methodPath =
            decorator
              .getArguments()[0]
              ?.getText()
              .replace(/['"`]/g, "") || ""

          const fullPath = normalizePath(`${basePath}/${methodPath}`)

          const response = method.getReturnType().getText(method)

          let body = "never"
          let params = "never"
          let query = "never"
          let files = "never"

          const firstParam = method.getParameters()[0]

          if (firstParam) {
            const type = firstParam.getType()

            body   = extractPropertyType(type, "body", firstParam)
            params = extractPropertyType(type, "params", firstParam)
            query  = extractPropertyType(type, "query", firstParam)
            files  = extractPropertyType(type, "files", firstParam)
          }

          routes.push({
            method: http,
            path: fullPath,
            response,
            body,
            params,
            query,
            files,
          })
        }
      }
    }
  }

  const grouped: Record<string, any> = {}

  for (const r of routes) {
    grouped[r.path] ??= {}
    grouped[r.path][r.method] = {
      response: r.response,
      body: r.body,
      params: r.params,
      query: r.query,
      files: r.files,
    }
  }

  const routeMap = Object.entries(grouped)
    .map(([path, methods]) => {
      const methodBlock = Object.entries(methods)
        .map(
          ([method, c]: any) => `
    ${method}: {
      params: ${c.params}
      query: ${c.query}
      body: ${c.body}
      files: ${c.files}
      response: ${c.response}
    }`
        )
        .join("\n")

      return `
  "${path}": {
${methodBlock}
  }`
    })
    .join("\n")

  const output = `
// AUTO GENERATED FILE
// DO NOT EDIT

export interface AppRoutes {
${routeMap}
}

export type AppRoute = keyof AppRoutes
`

  const outPath = options.output
    ? `${__dirname}/${options.output}/pre-routes.ts`
    : `${__dirname}/pre-routes.ts`

  await fs.promises.mkdir(path.dirname(outPath), {
    recursive: true,
  })

  await fs.promises.writeFile(outPath, output)

  return routes
}