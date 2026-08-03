import { 
  ParameterDeclaration, 
  Project, 
  Type 
} from "ts-morph";

import ts   from "typescript";
import fs   from "fs";
import path from "path";

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
  method: string;
  path: string;
  body: string;
  params: string;
  query: string;
  files: string;
  headers: string;
  response: string;
}

type Options = {
  folder: string;
  name: RegExp;
  output?: string;
}

const normalizeType = (t: string) => {
  return t
    .split("|")
    .map(v => v.trim())
    .filter(v =>
      v !== "null" &&
      v !== "undefined"
    )[0] || "string";
};

const maybeObject = (v : string) => {
  const s = v.trim();
  return s.startsWith("{") && s.endsWith("}");
}

const maybeArrayObject = (v : string) => {
  const s = v.trim();
  return s.endsWith("}[]");
}


const normalizePath = (p: string) => {
  return (
    "/" +
    p
      .replace(/['"`]/g, "")
      .replace(/\/+/g, "/")
      .replace(/\/$/, "")
      .replace(/^\//, "")
  )
}

const splitTopLevel = (input: string) => {
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

const parseType = (type: string): any => {
  type = type.trim();

  if (type === "never") {
    return undefined;
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
      const match = field
      .replace(/"([^"]+)"(?=\s*:)/g, '$1')
      .match(/^([\w-]+)(\??):\s*(.+)$/);

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
  if (type === "Date") return "Date";

  if (type === "string | undefined") return "string";
  if (type === "number | undefined") return "number";
  if (type === "boolean | undefined") return "boolean";
  if (type === "date | undefined") return "date";
  if (type === "Date | undefined") return "Date";
  
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
  return "string"
}

const resolveType = (type: Type): string => {

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

  if (
    type.isStringLiteral()  || 
    type.isBooleanLiteral() ||
    type.isNumberLiteral()
  ) {
    return type.getText();
  }
  
  if (type.getText() === 'Date' && 
      type.getSymbol()?.getName() === 'Date'
  ) {
    return "Date";
  }

  if (
    type.getText().includes("Response") &&
    type.getText().includes("TResponse")
  ) {
    
    const filtered = type
    .getIntersectionTypes()
    .filter((t) => {
      const text = t.getText();

      return (
        !text.includes("Response") &&
        !text.includes("TResponse")
      );
    })
   
    const t = filtered[0];

    if(t == null) return 'never';

    return resolveType(t);
  }

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

  if (type.getProperties().length) {
    
    const props = type.getProperties();

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

      if(key.includes('-')) {
        obj.push(
          `"${key}"${colon} ${value}`
        );
        continue;
      }
     
      obj.push(
        `${key}${colon} ${value}`
      );
    }

    return `{ ${obj.join("; ")} }`;
  }

  return type.getText();
}

const extractPropertyType = (
  type: Type,
  key: string,
  node: ParameterDeclaration
) => {
  const prop = type.getProperty(key)
  if (!prop) return "never"

  const t = prop.getTypeAtLocation(node)

  const text = t.getText(node)

  if (text.includes('[x: string]')) return text

  if (!text || text.includes("undefined")) return "never"

  return resolveType(t) ?? "never";
}

const formatExampleValue = (v: any): string => {

  if (v === null) {
    return "null";
  }

  if(v === undefined) {
    return "undefined"
  }

  if (typeof v === "string") {
    const t = normalizeType(v.trim());

    if (maybeObject(t)) {
      const inner = t.trim().slice(1, -1);
      
      const result = Object.fromEntries(
        splitTopLevel(inner)
          .map(s => s.trim())
          .filter(Boolean)
          .map(pair => {
            const idx = pair.indexOf(":");
            const key = pair.slice(0, idx).trim();
            const type = pair.slice(idx + 1).trim();
            return [key.replace(/\?/g, ''), type];
          })
      );
      return formatExampleValue(result);
    } 

    if(maybeArrayObject(t)) {

      const s = v.trim();

      const output = s.replace(
        /(\w+):\s*(\{[^}]+\})\[\]/,
        '$1: [$2]'
      ).match(/\{(.*)\}/)?.[1]
      
      if(!output) return `[]`;
      
      const result = Object.fromEntries(
        splitTopLevel(output)
          .map(s => s.trim())
          .filter(Boolean)
          .map(pair => {
            const idx = pair.indexOf(":");
            const key = pair.slice(0, idx).trim();
            const type = pair.slice(idx + 1).trim();
            return [key, type];
          })
      );

      return formatExampleValue(result)
    }
  
    switch (t) {
      case "string":
        return `"example"`;

      case "string[]":
        return `["example1", "example2", "example3"]`;

      case "number":
        return "123";
      
      case "number[]":
        return "[1 ,2, 3]"

      case "boolean":
        return "true";

      case "boolean[]":
        return "[true, false, true]";

      case "null":
        return "null";

      case "null[]":
        return "[null, null, null]";

      case "undefined":
        return "undefined";

      case "undefined[]":
        return "[undefined, undefined, undefined]";

      case "date":
      case "Date":
        return `"2000-01-01T00:00:00.000Z"`;

      case "date[]":
      case "Date[]":
        return `["2000-01-01T00:00:00.000Z","2000-01-02T00:00:00.000Z","2000-01-03T00:00:00.000Z"]`;

      default:
        return `"${t.replace(/"/g, "")}"`;
    }
  }

  if (Array.isArray(v)) {
    if (!v.length) {
      return "[]";
    }

    return `[
      ${formatExampleValue(v[0])},
      ${formatExampleValue(v[0])},
      ${formatExampleValue(v[0])}
    ]`;
  }

  if (typeof v === "object") {
    const entries = Object.entries(v).map(
      ([key, value]) => {

        if (key.includes("uuid")) {
          return `"${key}": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"`;
        }
  
        if (key === "id" || key.endsWith("id")) {
          return `"${key}": 123`;
        }

        return `"${key}": ${formatExampleValue(value)}`;
      }
    );
    return `{ ${entries.map(v => `${v}`).join(", ")} }`;
  }

  return JSON.stringify(v);
};

type MockData = Record<string, any>;

const transformMockData = (obj: MockData): void => {
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;

    const value = obj[key];

    if (value && typeof value === 'object') {
      if (Object.keys(value).length === 0 || "[x: string]" in value) {
        obj[key] = undefined;
      } else {
        transformMockData(value);
      }
    } else {
      switch (value) {
        case 'string':
          obj[key] = "example";
          break;
        case 'number':
          obj[key] = 123;
          break;
        case 'boolean':
          obj[key] = true;
          break;
        default:
          obj[key] = undefined;
          break;
      }
    }
  }
};

const parseTypeScriptString = (tsString: string): MockData => {
  const jsonStr = tsString
    .replace(/;/g, ',')
    .replace(/\[x:\s*string\]/g, '"[x: string]"')
    .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
    .replace(/:\s*([^"'{},]+)(?=[,}])/g, (_, p1) => `: "${p1.trim()}"`)
    .replace(/,\s*}/g, '}');

  const parsedObj: MockData = JSON.parse(jsonStr);

  transformMockData(parsedObj);
  
  return parsedObj;
};

export const generateRoutes = async (globalPrefix: string, options: Options) => {
  const project = new Project({
    tsConfigFilePath: path.resolve(process.cwd(), "tsconfig.json"),
  })

  project.addSourceFilesAtPaths(
    path.join(options.folder, "**/*")
  )

  const files = project.getSourceFiles()

  if (!files.length) {
    console.log("No controller files found")
    return;
  }

  const routes: Route[] = []

  for (const file of files) {
    const filename = file.getBaseName()

    if (!options.name.test(filename)) continue

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
          let headers = "never"
          
          const firstParam = method.getParameters()[0]

          if (firstParam) {
            const type = firstParam.getType()

            params  = extractPropertyType(type, "params", firstParam)
            query   = extractPropertyType(type, "query", firstParam)
            body    = extractPropertyType(type, "body", firstParam)
            files   = extractPropertyType(type, "files", firstParam)
            headers = extractPropertyType(type, "headers", firstParam)

            if(body === 'Record<string, any>') body = "never";
          }

          routes.push({
            method: http,
            path: fullPath,
            response,
            body,
            params,
            query,
            files,
            headers
          })
        }
      }
    }
  }

  const groupedTypes = routes.reduce((acc, r) => {
    
    acc[r.path] = acc[r.path] ?? {};

    acc[r.path][r.method] = {
      response: r.response,
      body: r.body,
      params: r.params,
      query: r.query,
      files: r.files,
      headers: r.headers
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
      headers: ${c.headers}
      response: ${c.response}
    }`).join("\n")

    return `
  "${path}": {
  ${methodBlock}
  }`
  })
  .join("\n");

  const groupedValues = routes.reduce((acc, route) => {
    if (!acc[route.path]) {
      acc[route.path] = {};
    }

    acc[route.path][route.method] = {
      params: parseType(route.params),
      query: parseType(route.query),
      body: parseType(route.body),
      files: parseType(route.files),
      headers: parseType(route.headers),
      response: parseType(route.response),
    };

    return acc;
  }, {} as Record<string, any>);

  const routerMapValues= Object.entries(groupedValues)
  .map(([path, methods]) => {
   
    const methodBlock = Object.entries(methods)
      .map(([method, c]: any) => `
    ${method}: {
      params: ${formatExampleValue(c.params)},
      query: ${formatExampleValue(c.query)},
      body: ${formatExampleValue(c.body)},
      files: ${formatExampleValue(c.files)},
      headers: ${formatExampleValue(c.headers)},
      response: ${formatExampleValue(c.response)}
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
// **Response values shown here are examples only.
${globalPrefix ? 
`// **The App is using the configuration:
// globalPrefix: '${globalPrefix}'` : ''
}
export interface AppRoutes {
${routeMapTypes}
};

export type AppRoute = keyof AppRoutes;

export const appRoutes = {
${routerMapValues}
};

`

  const outPath = options.output
    ? `${__dirname}/${options.output}/pre-routes.ts`
    : `${__dirname}/pre-routes.ts`

  await fs.promises.mkdir(path.dirname(outPath), {
    recursive: true,
  })

  const compiled = ts.transpileModule(output, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ESNext
    },
  })

  await Promise.all([
    fs.promises.writeFile(outPath, output),
    fs.promises.writeFile(
      outPath.replace(/\.ts$/, ".js"),
      compiled.outputText
    )
  ])

  return routes
}

export const transformBaseContract = async () => {

  const project = new Project({
      tsConfigFilePath: path.resolve(process.cwd(), "tsconfig.json"),
  });

  const entry = typeof Bun !== "undefined"
      ? Bun.main
      : require.main?.filename;

  const filePath = path.resolve(entry!);
                    
  const source = project.getSourceFile(filePath)!

  const appDeclaration = (source.getVariableDeclaration("app") 
  ?? source.getVariableDeclaration("server"))!;

  const appType = appDeclaration.getType();

  const contractProperty = appType.getProperty("baseContract")!;

  const contractType = contractProperty.getTypeAtLocation(appDeclaration);

  return parseTypeScriptString(contractType.getText());
}