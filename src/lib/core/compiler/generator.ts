import ts   from "typescript";
import fs   from "fs";
import path from "path";

import { 
  ParameterDeclaration, 
  Project, 
  Type 
} from "ts-morph";

const HTTP_METHODS = {
  Get: "GET", Post: "POST", Put: "PUT", Patch: "PATCH",
  Delete: "DELETE", Options: "OPTIONS", Head: "HEAD",
} as const;

type Route = {
  method: string; path: string; body: string; params: string;
  query: string; files: string; headers: string;
  response: string; errors: string;
};

type Options = { folder: string; name: RegExp; output?: string };

const normalizeType = (t: string): string => {
  return t
    .split("|")
    .map(v => v.trim())
    .filter(v => v !== "null" && v !== "undefined")[0] || "string";
};

const maybeObject = (v: string): boolean => {
  const s = v.trim();
  return s.startsWith("{") && s.endsWith("}");
};

const maybeArrayObject = (v: string): boolean => {
  return v.trim().endsWith("}[]");
};

const normalizePath = (p: string): string => {
  return "/" + p
    .replace(/['"`]/g, "")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "")
    .replace(/^\//, "");
};

const splitTopLevel = (input: string): string[] => {
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
};

const parseType = (type: string): any => {
  type = type.trim();

  if (type === "true" || type === "false") return "boolean";
  if (type === "never") return undefined;
  if (type.startsWith("Record<")) return {};

  if (type.startsWith("Partial<")) {
    const inner = type.replace(/^Partial</, "").replace(/>$/, "");
    const parsed = parseType(inner);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const key in parsed) {
        parsed[key] = parsed[key] + " | null";
      }
    }
    return parsed;
  }

  if (type.startsWith("Promise<")) {
    const inner = type.replace(/^Promise</, "").replace(/>$/, "");
    return parseType(inner);
  }

  if (type.endsWith("[]")) {
    return [parseType(type.slice(0, -2))];
  }

  if (type.startsWith("{") && type.endsWith("}")) {
    const result: Record<string, any> = {};
    const fields = splitTopLevel(type.slice(1, -1)).map(x => x.trim()).filter(Boolean);

    for (const field of fields) {
      const match = field.replace(/"([^"]+)"(?=\s*:)/g, "$1").match(/^([\w-]+)(\??):\s*(.+)$/);
      if (!match) continue;

      const [, key, optional, value] = match;
      let parsed: any;

      if (value === "string") {
        parsed = optional ? "string | null" : "string";
      } else if (value === "number" || typeof value === "number" || /^\d+$/.test(value)) {
        parsed = optional ? "number | null" : "number";
      } else if (value === "boolean" || typeof value === "boolean" || /^(true|false)$/i.test(value)) {
        parsed = optional ? "boolean | null" : "boolean";
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
  if (type === "date" || type === "Date") return type;

  if (type.endsWith(" | undefined")) return type.slice(0, -11);
  if (type.includes(" | undefined") || type.includes(" | null")) return type;
  if (type.includes(" | ")) return type.replace(/"/g, "");

  return "string";
};

const resolveType = (type: Type): string => {
  if (type.getSymbol()?.getName() === "Promise") {
    type = type.getTypeArguments()[0];
  }

  if (type.isString()) return "string";
  if (type.isNumber()) return "number";
  if (type.isBoolean()) return "boolean";
  if (type.isNull()) return "null";
  if (type.isUndefined()) return "undefined";
  if (type.isAny()) return "any";
  if (type.isUnknown()) return "unknown";

  if (type.isStringLiteral() || type.isBooleanLiteral() || type.isNumberLiteral()) {
    return type.getText();
  }

  if (type.getText() === "Date" && type.getSymbol()?.getName() === "Date") {
    return "Date";
  }

  if (type.getText().includes("TResponseError")) {

    const mapping = type.isUnion()
        ? type.getUnionTypes()
        : [type];

    const response = mapping.find(t => {
      return t.isIntersection() &&
        t.getIntersectionTypes().some(i =>
            i.getText().includes("TResponse")
        );
    });

    if (response) {
      const filtered = response.getIntersectionTypes().filter(t => {
          const text = t.getText();
          return !text.includes("Response") &&
              !text.includes("TResponse");
      });

      if (filtered[0] != null) {
          return resolveType(filtered[0]);
      }
    }

    // return { ... } without res.json
    const pureResponse = mapping[mapping.length - 1];
    return resolveType(pureResponse);
  }

  if (type.getText().includes("Response") && type.getText().includes("TResponse")) {

    const filtered = type.getIntersectionTypes().filter(t => {
      const text = t.getText();
      return !text.includes("Response") && !text.includes("TResponse");
    });
    if (filtered[0] == null) return "never";
    return resolveType(filtered[0]);
  }

  if (type.isUnion()) {
    const text = type.getText();
    if (text.startsWith("import")) return "{}";
    return text;
  }

  if (type.isArray()) {
    const element = resolveType(type.getArrayElementTypeOrThrow());
    return `${element}[]`;
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

      if (/^\s*(\(.*\)\s*=>|function\b)/.test(value)) continue;
      if (text.includes("[x: string]")) value = text;

      const maybeOptional = value.includes(" | undefined");
      if (maybeOptional) {
        value = value.replace(" | undefined", "");
      }

      const optionalMarker = maybeOptional ? "?" : "";
      const keyStr = key.includes("-")
        ? `"${key}${optionalMarker}": ${value}`
        : `${key}${optionalMarker}: ${value}`;
      obj.push(keyStr);
    }
    return `{ ${obj.join("; ")} }`;
  }

  return type.getText();
};

const resolveTypeErrorOnly = (type: Type): string => {
  if (!type.getText().includes("TResponseError")) {
    return "never";
  }

  const mapping = type.getText().replace(/^Promise<(.*)>$/, "$1").split(" | ");
  const result = mapping.flatMap(type => {
    const match = type.match(/^(?:import\([^)]*\)\.)?TResponseError<\s*(["'`])([\s\S]*?)\1\s*,\s*(\d+)\s*>$/);
    if (!match) return [];
    const [, quote, message, statusCode] = match;
    return [`{ message: ${quote}${message}${quote}; statusCode: ${statusCode}; }`];
  });

  if (!result.length) return "never";
  return result.join(" | ");
};

const formatExampleErrorsValue = (v: any): string => {
  if (v === "never") return "[]";
  return `[${v
    .replace(/\s*\|\s*/g, ", ")
    .replace(/;\s*(?=\w+\s*:)/g, ", ")
    .replace(/;\s*}/g, " }")
  }]`;
};

const extractPropertyType = (type: Type, key: string, node: ParameterDeclaration): string => {
  const prop = type.getProperty(key);
  if (!prop) return "never";

  const t = prop.getTypeAtLocation(node);
  const text = t.getText(node);

  if (text.includes("[x: string]")) return text;
  if (!text || text.includes("undefined")) return "never";

  const resolved = resolveType(t);
  return resolved ?? "never";
};

const formatExampleValue = (v: any): string => {
  if (v === "{}" || v === null || v === "null") {
    return v === "{}" ? "{}" : "null";
  }
  if (v === undefined || v === "undefined") return "undefined";

  if (typeof v === "string") {
    const t = normalizeType(v.trim());

    if (maybeObject(t)) {
      const inner = t.trim().slice(1, -1);
      const result = Object.fromEntries(
        splitTopLevel(inner).map(s => s.trim()).filter(Boolean).map(pair => {
          const idx = pair.indexOf(":");
          const key = pair.slice(0, idx).trim();
          const type = pair.slice(idx + 1).trim();
          return [key.replace(/\?/g, ""), type];
        })
      );
      return formatExampleValue(result);
    }

    if (maybeArrayObject(t)) {
      const output = v.trim()
        .replace(/(\w+):\s*(\{[^}]+\})\[\]/, "$1: [$2]")
        .match(/\{(.*)\}/)?.[1];
      if (!output) return `[]`;
      const result = Object.fromEntries(
        splitTopLevel(output).map(s => s.trim()).filter(Boolean).map(pair => {
          const idx = pair.indexOf(":");
          const key = pair.slice(0, idx).trim();
          const type = pair.slice(idx + 1).trim();
          return [key, type];
        })
      );
      return formatExampleValue(result);
    }

    const examples: Record<string, string> = {
      "string": `"string"`,
      "string[]": `["string", "string"]`,
      "number": "0",
      "number[]": "[0, 0]",
      "boolean": "true",
      "boolean[]": "[true, false]",
      "null": "null",
      "null[]": "[null, null]",
      "undefined": "undefined",
      "undefined[]": "[undefined, undefined]",
      "date": `"2000-01-01T00:00:00.000Z"`,
      "Date": `"2000-01-01T00:00:00.000Z"`,
      "date[]": `["2000-01-01T00:00:00.000Z","2000-01-02T00:00:00.000Z","2000-01-03T00:00:00.000Z"]`,
      "Date[]": `["2000-01-01T00:00:00.000Z","2000-01-02T00:00:00.000Z","2000-01-03T00:00:00.000Z"]`,
    };
    return examples[t] ?? `"${t.replace(/"/g, "")}"`;
  }

  if (Array.isArray(v)) {
    if (!v.length) return "[]";
    const first = formatExampleValue(v[0]);
    return `[\n  ${first},\n  ${first}\n]`;
  }

  if (typeof v === "object") {
    const entries = Object.entries(v).map(([key, value]) => {
      if (String(value).includes("any[]")) return `"${key}": []`;
      if (key.includes(`[x: string]`)) return undefined;
      if (key.includes("uuid")) return `"${key}": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"`;
      if (key === "id" || key.endsWith("id")) return `"${key}": 0`;
      return `"${key}": ${formatExampleValue(value)}`;
    });
    return `{ ${entries.filter(Boolean).join(", ")} }`;
  }

  return JSON.stringify(v);
};

const transformMockData = (obj: any): any => {
  if (obj === null || typeof obj !== "object") return obj;

  const result: any = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;

    let value = obj[key];

    if(value === 'never') {
      result[key] = undefined;
      continue;
    };

    if (key === "errors") {
      result[key] = value.map((v: any) => {
        if(!v.message || !v.statusCode) {
          return null;
        }
        return {
          message: v.message,
          statusCode: +v.statusCode,
        }
      }).filter(Boolean);
      continue;
    }

    if (value && typeof value === "object") {
      const isEmpty = Object.keys(value).length === 0 || "[x: string]" in value;
      result[key] = isEmpty ? undefined : transformMockData(value);
      continue;
    }

    if (typeof value === "string" && value.includes("|")) {
      value = value.split("|")[0].trim();
    }

    const mappings: Record<string, any> = {
      "date[]": ["2000-01-01T00:00:00.000Z", "2000-01-02T00:00:00.000Z", "2000-01-03T00:00:00.000Z"],
      "Date[]": ["2000-01-01T00:00:00.000Z", "2000-01-02T00:00:00.000Z", "2000-01-03T00:00:00.000Z"],
      "Date": "2000-01-01T00:00:00.000Z",
      "string": key === "uuid" ? "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" : "string",
      "string[]": ["string", "string"],
      "number": 0,
      "number[]": [0, 0],
      "boolean": true,
      "boolean[]": [true, false],
      "null": null,
      "null[]": [null, null],
      "undefined": undefined,
      "undefined[]": [undefined, undefined],
    };

    const mapped = mappings[value];
    result[key] = mapped ?? (!isNaN(Number(value)) ? Number(value) : "string");
  }

  return result;
};

interface Token {
  type: "string" | "id" | "array_suffix" | "punct";
  value: string;
}

const parseBaseContractTypeString = (input: string): Record<string, any> => {
  const tokens: Token[] = [];
  const lexer = /"([^"]*)"|'([^']*)'|(\[[a-zA-Z]+:\s*string\])|(\[\])|([{}|:;,])|([A-Za-z0-9_]+(?:\[\])*)/g;
  let match: RegExpExecArray | null;

  while ((match = lexer.exec(input)) !== null) {
    if (match[1] !== undefined) tokens.push({ type: "string", value: match[1] });
    else if (match[2] !== undefined) tokens.push({ type: "string", value: match[2] });
    else if (match[3] !== undefined) tokens.push({ type: "id", value: "[x: string]" });
    else if (match[4] !== undefined) tokens.push({ type: "array_suffix", value: "[]" });
    else if (match[5] !== undefined) tokens.push({ type: "punct", value: match[5] });
    else if (match[6] !== undefined) tokens.push({ type: "id", value: match[6] });
  }

  let current = 0;
  const peek = () => tokens[current];
  const consume = () => tokens[current++];

  const expect = (val: string): Token => {
    const t = consume();
    if (!t || t.value !== val) {
      throw new Error(`Expected '${val}', got '${t ? t.value : "EOF"}'`);
    }
    return t;
  };

  const parseTypeWithoutUnion = (): any => {
    const t = peek();
    if (!t) throw new Error("Unexpected EOF");

    let node: any;
    if (t.type === "punct" && t.value === "{") {
      node = parseObject();
    } else if (t.type === "string" || t.type === "id") {
      consume();
      node = t.value;
    } else {
      throw new Error(`Unexpected token: ${t.value}`);
    }

    while (peek() && peek().type === "array_suffix") {
      consume();
      node = [node];
    }
    return node;
  };

  const parseType = (currentKey?: string): any => {
    let node = parseTypeWithoutUnion();
    let isUnion = false;
    const unionNodes: any[] = [node];

    while (peek() && peek().type === "punct" && peek().value === "|") {
      consume();
      isUnion = true;
      unionNodes.push(parseTypeWithoutUnion());
    }

    if (isUnion) {
      const filtered = unionNodes.filter(n => n !== "undefined");
      node = currentKey === "errors" ? filtered : unionNodes[0];
    } else if (currentKey === "errors") {
      node = Array.isArray(node) ? node : [node];
    }

    return node;
  };

  const parseObject = (): Record<string, any> => {
    expect("{");
    const obj: Record<string, any> = {};

    while (peek() && peek().value !== "}") {
      const key = consume().value;
      expect(":");
      const valueType = parseType(key);
      if (peek() && (peek().value === ";" || peek().value === ",")) consume();
      obj[key] = valueType;
    }

    expect("}");
    return obj;
  };

  return parseType();
};

export const generateRoutes = async (globalPrefix: string, options: Options): Promise<Route[] | void> => {
  const project = new Project({
    tsConfigFilePath: path.resolve(process.cwd(), "tsconfig.json"),
    skipAddingFilesFromTsConfig: false,
  });

  project.addSourceFilesAtPaths(path.join(options.folder, "**/*"));
  const files = project.getSourceFiles();

  if (!files.length) {
    console.log("No controller files found");
    return;
  }

  const routes: Route[] = [];

  for (const file of files) {
    const filename = file.getBaseName();
    if (!options.name.test(filename)) continue;

    for (const cls of file.getClasses()) {
      const controller = cls.getDecorator("Controller");
      if (!controller) continue;

      const basePath = controller.getArguments()[0]?.getText().replace(/['"`]/g, "") || "";

      for (const method of cls.getMethods()) {
        for (const [decName, http] of Object.entries(HTTP_METHODS)) {
          const decorator = method.getDecorator(decName);
          if (!decorator) continue;

          const methodPath = decorator.getArguments()[0]?.getText().replace(/['"`]/g, "") || "";
          const fullPath = normalizePath(`${basePath}/${methodPath}`);
          const resultTyped = method.getReturnType();
          const response = resolveType(resultTyped);
          const errors = resolveTypeErrorOnly(resultTyped);

          let body = "never";
          let params = "never";
          let query = "never";
          let files = "never";
          let headers = "never";

          const firstParam = method.getParameters()[0];
          if (firstParam) {
            const type = firstParam.getType();
            params = extractPropertyType(type, "params", firstParam);
            query = extractPropertyType(type, "query", firstParam);
            body = extractPropertyType(type, "body", firstParam);
            files = extractPropertyType(type, "files", firstParam);
            headers = extractPropertyType(type, "headers", firstParam);
            if (body === "Record<string, any>") body = "never";
          }

          routes.push({
            method: http,
            path: fullPath,
            body,
            params,
            query,
            files,
            headers,
            response,
            errors,
          });
        }
      }
    }
  }

  const groupedTypes = routes.reduce((acc, r) => {
    acc[r.path] = acc[r.path] ?? {};
    acc[r.path][r.method] = {
      body: r.body,
      params: r.params,
      query: r.query,
      files: r.files,
      headers: r.headers,
      response: r.response,
      errors: r.errors,
    };
    return acc;
  }, {} as Record<string, any>);

  const routeMapTypes = Object.entries(groupedTypes).map(([path, methods]) => {
    const methodBlock = Object.entries(methods).map(([method, c]: any) => `
    ${method}: {
      params: ${c.params}
      query: ${c.query}
      body: ${c.body}
      files: ${c.files}
      headers: ${c.headers}
      response: ${c.response}
      errors: ${c.errors}
    }`).join("\n");
    return `\n  "${path}": {\n  ${methodBlock}\n  }`;
  }).join("\n");

  const groupedValues = routes.reduce((acc, route) => {
    if (!acc[route.path]) acc[route.path] = {};
    acc[route.path][route.method] = {
      params: parseType(route.params),
      query: parseType(route.query),
      body: parseType(route.body),
      files: parseType(route.files),
      headers: parseType(route.headers),
      response: parseType(route.response),
      errors: route.errors,
    };
    return acc;
  }, {} as Record<string, any>);

  const routerMapValues = Object.entries(groupedValues).map(([path, methods]) => {
    const methodBlock = Object.entries(methods).map(([method, c]: any) => `
    ${method}: {
      params: ${formatExampleValue(c.params)},
      query: ${formatExampleValue(c.query)},
      body: ${formatExampleValue(c.body)},
      files: ${formatExampleValue(c.files)},
      headers: ${formatExampleValue(c.headers)},
      response: ${formatExampleValue(c.response)},
      errors: ${formatExampleErrorsValue(c.errors)}
    }`).join(",\n");
    return `\n  "${path}": {\n  ${methodBlock}\n  }`;
  }).join(",\n");

  const output = `// @ts-nocheck
// AUTO GENERATED FILE
// DO NOT EDIT
// **Response values shown here are examples only.
${globalPrefix ? `// **The App is using the configuration:\n// globalPrefix: '${globalPrefix}'` : ""}
export interface AppRoutes {
${routeMapTypes}
};

export type AppRoute = keyof AppRoutes;

export const appRoutes = {
${routerMapValues}
};
`;

  const outPath = options.output
    ? `${__dirname}/${options.output}/pre-routes.ts`
    : `${__dirname}/pre-routes.ts`;

  await fs.promises.mkdir(path.dirname(outPath), { recursive: true });

  const compiled = ts.transpileModule(output, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ESNext,
    },
  });

  await Promise.all([
    fs.promises.writeFile(outPath, output),
    fs.promises.writeFile(outPath.replace(/\.ts$/, ".js"), compiled.outputText),
  ]);

  return routes;
};

export const transformBaseContract = async (complie: string): Promise<any> => {
  const project = new Project({
    tsConfigFilePath: path.resolve(process.cwd(), "tsconfig.json"),
  });

  const entry = typeof Bun !== "undefined" ? Bun.main : require.main?.filename;
  const filePath = path.resolve(entry!);
  const source = project.getSourceFile(filePath)!;
  const appDeclaration = source.getVariableDeclaration(complie)!;
  const appType = appDeclaration.getType();
  const contractProperty = appType.getProperty("baseContract")!;
  const contractType = contractProperty.getTypeAtLocation(appDeclaration);

  const typeText = contractType.getText();
  const parsed = parseBaseContractTypeString(typeText);
  const mock =  transformMockData(parsed);

  return mock;
};