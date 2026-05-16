import fs from "fs";
import path from "path";
import { exec, execSync, spawn } from "child_process";
import { AppTemplate } from "./template";
import { ClientTemplate } from "../client/template";
import { MiddlewareTemplate } from "../middleware/template";
import { ControllerTemplate } from "../controller/template";
import { ServiceTemplate } from "../service/template";
import { DtoTemplate } from "../dto/template";


const c = {
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
  dim: (text: string) => `\x1b[2m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  underline: (text: string) => `\x1b[4m${text}\x1b[0m`,
  gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
  reset: "\x1b[0m"
};


export async function createApp(inputPath?: string) {
  if (!inputPath) {
    console.log("Missing target path, try: spear g app src");
    process.exit(1);
  }

  const root = path.resolve(process.cwd(), inputPath);

  fs.mkdirSync(root, { recursive: true });

  await fs.promises.writeFile(
    path.join(root, "package.json"),
    JSON.stringify(
      {
        name: path.basename(root),
        version: "1.0.0",
        main: "dist/index.js",
        scripts: {
          build: "tsc",
          start: "node dist/index.js",
          dev: "ts-node src/index.ts",
        },
        dependencies: {
          "tspace-spear": "latest",
          "class-transformer": "0.5.1",
          "class-validator": "0.15.1"
        },
        devDependencies: {
          "typescript": "5.6.2",
          "ts-node": "10.9.2",
          "@types/node": "16.18.126"
        },
      },
      null,
      2
    )
  );

  await fs.promises.writeFile(
    path.join(root, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          "target": "esnext",
          "module": "commonjs",
          "lib": ["esnext","DOM"],
          "types": ["node"],
          "allowJs": true,
          "checkJs": false,
          "outDir": "dist",
          "rootDir": "src",
          "strict": true,
          "esModuleInterop": true,
          "skipLibCheck": true,
          "forceConsistentCasingInFileNames": true,
          "emitDecoratorMetadata": true,
          "experimentalDecorators": true,
        },
      },
      null,
      2
    )
  );

  const src = path.join(root, "src");

  await fs.promises.mkdir(src, { recursive: true });

  await fs.promises.mkdir(path.join(src, "common", "middlewares"), { recursive: true });
  await fs.promises.mkdir(path.join(src, "modules", "cats"), { recursive: true });

  await fs.promises.writeFile(path.join(src, "index.ts"), AppTemplate);
  await fs.promises.writeFile(path.join(src, "client.ts"), ClientTemplate);

  await fs.promises.writeFile(
    path.join(src, "common", "middlewares", "log.middleware.ts"),
    MiddlewareTemplate
  );

  await fs.promises.writeFile(
    path.join(src, "modules", "cats", "cat.controller.ts"),
    ControllerTemplate
  );

  await fs.promises.writeFile(
    path.join(src, "modules", "cats", "cat.service.ts"),
    ServiceTemplate
  );

  await fs.promises.writeFile(
    path.join(src, "modules", "cats", "cat.dto.ts"),
    DtoTemplate
  );

  console.log(`\n${c.bold("$ npm install")}\n`);
 
  const startTime = Date.now();

  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;

  const spinner = setInterval(() => {
    process.stdout.write(`\r  ${c.cyan(frames[i])} Installing dependencies...`);
    i = (i + 1) % frames.length;
  }, 50);

  await new Promise<void>((resolve, reject) => {
    exec("npm install", { cwd: root }, (error) => {
      if (error) return reject(error);
      return resolve();
    });
  });

  await new Promise((resolve) => setTimeout(resolve, 500));

  const nodeModulesPath = path.join(root, "node_modules");
  let totalPhysicalPackages = 0;

  if (fs.existsSync(nodeModulesPath)) {
    const files = await fs.promises.readdir(nodeModulesPath);
    const packages = files.filter(file => !file.startsWith(".") && !file.startsWith("@"));
    totalPhysicalPackages = packages.length;
  }

  clearInterval(spinner);
  process.stdout.write("\r\x1b[K");

  const endTime = Date.now();
  const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);

  console.log(`${c.bold(c.cyan("dependencies"))}`);
  console.log(`${c.gray("├──")} ${c.green("+")} tspace-spear${c.dim("@latest")}`);
  console.log(`${c.gray("├──")} ${c.green("+")} class-transformer${c.dim("@0.5.1")}`);
  console.log(`${c.gray("└──")} ${c.green("+")} class-validator${c.dim("@0.15.1")}`);
  console.log(`${c.gray("│")}`);

  console.log(`${c.bold(c.gray("devDependencies"))}`);
  console.log(`${c.gray("├──")} ${c.green("+")} typescript${c.dim("@5.6.2")}`);
  console.log(`${c.gray("├──")} ${c.green("+")} ts-node${c.dim("@10.9.2")}`);
  console.log(`${c.gray("└──")} ${c.green("+")} @types/node${c.dim("@16.18.126")}\n`);

  console.log(`\n${c.green(`${totalPhysicalPackages} packages installed`)} ${c.dim(`[${elapsedSeconds}s]`)}`);
  console.log(`${c.dim(`[${elapsedSeconds}s] npm install`)}`);

  console.log(`\n--------`)
  console.log("A local project was created for you and dependencies were installed automatically.\n");
  console.log(`${c.green("Created spear project successfully")}\n`);

  console.log(c.bold(c.gray("# To get started, run:")));
  console.log(`\n  cd ${inputPath}\n  ${c.cyan("npm run dev")}\n`);
}
