import fs from "fs";
import path from "path";
import { capitalize, toSingular } from "../shared";


export function createMiddleware(root: string, name?: string) {
  if (!name) {
    console.log("Missing middleware path, try spear g middleware log");
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), root , "common", "middlewares");

  const fileName = `${toSingular(name)}.middleware.ts`;

  const target = path.join(resolvedPath, fileName);

  fs.mkdirSync(resolvedPath, { recursive: true });

  const middleName = capitalize(toSingular(name)) + "Middleware";

  fs.writeFileSync(
    target,
    `
import { type T } from "tspace-spear";

const ${middleName} = async (ctx : T.Context, next: T.NextFunction) => {
  console.log('hello: ${middleName}')
  return next();
}

export { ${middleName} };
export default ${middleName};
`
  );

  console.log(`
CREATE   ${target}

✔ Successfully generated middleware "${name}"

`)
}