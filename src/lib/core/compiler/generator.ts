import { 
  ParameterDeclaration, 
  Project, 
  Type 
} from "ts-morph"
import ts from "typescript"
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

function splitTopLevel(input: string) {
  const parts: string[] = [];

  let current = "";
  let depth = 0;

  for (const char of input) {
    if (char === "{") depth++;
    if (char === "}") depth--;

    if (char === ";" && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

function parseType(type: string): any {
  type = type.trim();

  if (type === "never") {
    return null;
  }

  if (type.startsWith("Record<")) {
    return {};
  }

  if (type.startsWith("Partial<")) {
    const inner = type
      .replace(/^Partial</, "")
      .replace(/>$/, "");

    const parsed = parseType(inner);

    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
    ) {
      for (const key in parsed) {
        parsed[key] =
          parsed[key] + " | null";
      }
    }

    return parsed;
  }

  if (type.startsWith("Promise<")) {
    const inner = type
      .replace(/^Promise</, "")
      .replace(/>$/, "");

    return parseType(inner);
  }

  if (type.endsWith("[]")) {
    return [parseType(type.slice(0, -2))];
  }

  if (
    type.startsWith("{") &&
    type.endsWith("}")
  ) {
    const result: Record<string, any> = {};

    const content = type.slice(1, -1);

    const fields = splitTopLevel(content)
      .map((x) => x.trim())
      .filter(Boolean);

    for (const field of fields) {
      const match =
        field.match(/^(\w+)(\??):\s*(.+)$/);

      if (!match) continue;

      const [, key, optional, value] = match;

      let parsed;

      if (value === "string") {
        parsed = optional
          ? "string | null"
          : "string";
      } else if (value === "number") {
        parsed = optional
          ? "number | null"
          : "number";
      } else if (value === "boolean") {
        parsed = optional
          ? "boolean | null"
          : "boolean";
      } else {
        parsed = parseType(value);
      }

      result[key] = parsed;
    }

    return result;
  }

  if (type === "string") return "string";
  if (type === "number") return "number";
  if (type === "boolean") return "boolean";
  if (type === "date") return "date";

  if (type === "string | undefined") return "string";
  if (type === "number | undefined") return "number";
  if (type === "boolean | undefined") return "boolean";
  if (type === "date | undefined") return "date";
  
  if(type.includes("| undefined")) {
    return type
  }

  if(type.includes("| null")) {
    return type
  }

  if(type.includes(" | ") && !type.startsWith("{")) {
    return type.replace(/"/g, "");
  }

  // fallback
  return {
    $ref: type
  };
}

function resolveType(type: Type): string {

  if (type.getSymbol()?.getName() === "Promise") {
    type = type.getTypeArguments()[0];
  }
  
  if (type.isString())    return "string";
  
  if (type.isNumber())    return "number";
  if (type.isBoolean())   return "boolean";
  if (type.isNull())      return "null";
  if (type.isUndefined()) return "undefined";
  if (type.isAny())       return "any";
  if (type.isUnknown())   return "unknown";
  if (type.isStringLiteral()) return type.getText();

  if (type.isUnion())     {
    const text = type.getText();

    if(text.includes('| null') || text.includes('| undefined')) {

      const types = type.getUnionTypes();

      if (types.length > 1) {
        const nonSpecial = types.filter(
          t => !t.isNull() && !t.isUndefined()
        );

        const hasNull = types.some(t => t.isNull());
        const hasUndefined = types.some(t => t.isUndefined());

        const sorted = [
          ...nonSpecial,
          ...(hasNull ? [types.find(t => t.isNull())!] : []),
          ...(hasUndefined ? [types.find(t => t.isUndefined())!] : []),
        ];

        return sorted.map(t => resolveType(t)).join(" | ");
      }
    }
   
    return text;
  }

  if (type.isArray()) {
    const el = type.getArrayElementTypeOrThrow();
    return `${resolveType(el)}[]`;
  }

  const props = type.getProperties();

  if (props.length) {
    const obj: string[] = [];

    for (const prop of props) {
      const decl = prop.getDeclarations()[0];
      if (!decl) continue;

      const propType = prop.getTypeAtLocation(decl);
      const text = propType.getText(decl);
      const key = prop.getName();
      let value = resolveType(propType);

      if(/^\s*(\(.*\)\s*=>|function\b)/.test(value)) {
        continue;
      }
      
      if (text.includes('[x: string]')) { 
        value = text
      };

      let colon = ":";

      const maybeOptional = value.includes(" | undefined");

      if(maybeOptional) {
        value = value.replace(" | undefined", "")
        colon = "?:"
      }
     
      obj.push(
        `${key}${colon} ${value}`
      );
    }

    return `{ ${obj.join("; ")} }`;
  }

  return type.getText();
}

function extractPropertyType(
  type: Type,
  key: string,
  node: ParameterDeclaration
) {
  const prop = type.getProperty(key)
  if (!prop) return "never"

  const t = prop.getTypeAtLocation(node)

  const text = t.getText(node)

  if (text.includes('[x: string]')) return text

  if (!text || text.includes("undefined")) return "never"

  return resolveType(t) ?? "never";
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

          const response = resolveType(method.getReturnType())
          
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

  const groupedTypes = routes.reduce((acc, r) => {
    acc[r.path] ??= {};

    acc[r.path][r.method] = {
      response: r.response,
      body: r.body,
      params: r.params,
      query: r.query,
      files: r.files,
    };

    return acc;
  }, {} as Record<string, any>);

  const routeMapTypes = Object.entries(groupedTypes)
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
    }`).join("\n")

    return `
  "${path}": {
  ${methodBlock}
  }`
  })
  .join("\n")

  const formatValue = (v: any) => {
    if (typeof v === "string") return `"${v.replace(/"/g,'')}"`;
    return JSON.stringify(v);
  };

  const groupedValues = routes.reduce((acc, route) => {
    if (!acc[route.path]) {
      acc[route.path] = {};
    }

    acc[route.path][route.method] = {
      params: parseType(route.params),
      query: parseType(route.query),
      body: parseType(route.body),
      files: parseType(route.files),
      response: parseType(route.response),
    };

    return acc;
  }, {} as Record<string, any>);

  const routerMapValues= Object.entries(groupedValues)
  .map(([path, methods]) => {
    const methodBlock = Object.entries(methods)
      .map(([method, c]: any) => `
    ${method}: {
      params: ${formatValue(c.params)},
      query: ${formatValue(c.query)},
      body: ${formatValue(c.body)},
      files: ${formatValue(c.files)},
      response: ${formatValue(c.response)}
    }`).join(",\n");

    return `
  "${path}": {
  ${methodBlock}
  }`;
  })
  .join(",\n");

  const output = `
// @ts-nocheck
// AUTO GENERATED FILE
// DO NOT EDIT

export const appRoutes = {
${routerMapValues}
}

export interface AppRoutes {
${routeMapTypes}
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

  const compiled = ts.transpileModule(output, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  })

  const jsPath = outPath.replace(
    /\.ts$/,
    ".js"
  )

  await fs.promises.writeFile(
    jsPath,
    compiled.outputText,
    "utf8"
  )

  return routes
}