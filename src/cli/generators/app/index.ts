import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { AppTemplate } from "./template";
import { ClientTemplate } from "../client/template";
import { MiddlewareTemplate } from "../middleware/template";
import { ControllerTemplate } from "../controller/template";
import { ServiceTemplate } from "../service/template";
import { DtoTemplate } from "../dto/template";


export function createApp(inputPath?: string) {
  if (!inputPath) {
    console.log("Missing target path, try: spear g app src");
    process.exit(1);
  }

  const root = path.resolve(process.cwd(), inputPath);

  fs.mkdirSync(root, { recursive: true });

  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify(
      {
        name: path.basename(root),
        version: "1.0.0",
        main: "dist/index.js",
        scripts: {
          dev: "ts-node src/index.ts",
          build: "tsc",
          start: "node dist/index.js",
        },
        dependencies: {},
        devDependencies: {
          typescript: "^5.0.0",
          "ts-node": "^10.9.0",
          "@types/node": "^20.0.0",
        },
      },
      null,
      2
    )
  );

  // 3. tsconfig.json
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2020",
          module: "commonjs",
          outDir: "dist",
          rootDir: "src",
          strict: true,
          esModuleInterop: true,
        },
      },
      null,
      2
    )
  );

  // 4. src structure
  const src = path.join(root, "src");

  fs.mkdirSync(src, { recursive: true });

  fs.mkdirSync(path.join(src, "common", "middlewares"), { recursive: true });
  fs.mkdirSync(path.join(src, "modules", "cats"), { recursive: true });

  // 5. core files
  fs.writeFileSync(path.join(src, "index.ts"), AppTemplate);
  fs.writeFileSync(path.join(src, "client.ts"), ClientTemplate);

  fs.writeFileSync(
    path.join(src, "common", "middlewares", "log.middleware.ts"),
    MiddlewareTemplate
  );

  fs.writeFileSync(
    path.join(src, "modules", "cats", "cat.controller.ts"),
    ControllerTemplate
  );

  fs.writeFileSync(
    path.join(src, "modules", "cats", "cat.service.ts"),
    ServiceTemplate
  );

  fs.writeFileSync(
    path.join(src, "modules", "cats", "cat.dto.ts"),
    DtoTemplate
  );

  // 6. install dependencies automatically
  console.log("Installing dependencies...");

  execSync("npm install", {
    cwd: root,
    stdio: "inherit",
  });

  console.log(`\n✅ App created at: ${root}`);
  console.log(`👉 Next: cd ${inputPath} && npm run dev`);
}