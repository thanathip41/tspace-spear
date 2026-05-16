import fs from "fs";
import path from "path";
import { capitalize, toPlural, toSingular } from "../shared";

export function createService(root : string,name?: string) {
  if (!name) {
    console.log("Missing service path, try spear g service dogs");
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), root , 'modules', toPlural(name));

  const fileName = `${toSingular(name)}.service.ts`;

  const target = path.join(resolvedPath, fileName);

  fs.mkdirSync(resolvedPath, { recursive: true });

  const className = capitalize(name) + "Service";

  fs.writeFileSync(
    target,
    `
class ${className} {
    public async index() {
        return [];
    };

    public async show(id: number) {
        return {};
    };

    public async create() {
        return {};
    }
    
    public async update(id: number) {
       return {};
    }

    public async remove(id: number) {
       return {};
    }
}

export { ${className} };
export default ${className};
`
  );

  console.log(`Service created: ${target}`);
}