import fs from "fs";
import path from "path";
import { capitalize, toPlural, toSingular } from "../shared";

export function createController(root : string,name?: string) {
  if (!name) {
    console.log("Missing controller path, try spear g controller dogs");
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), root , 'modules', toPlural(name));

  const fileName = `${toSingular(name)}.controller.ts`;

  const target = path.join(resolvedPath, fileName);

  fs.mkdirSync(resolvedPath, { recursive: true });

  const className = capitalize(name) + "Controller";

  fs.writeFileSync(
    target,
    `
import {
  type T,
  Controller,
  Get,
  Post,
  Put,
  Delete
} from "tspace-spear";

@Controller("/${name}")
class ${className} {

  @Get("/")
  async index() {
    return {};
  }

  @Get("/:id")
  async show({
    params
  }: T.Context<{ params: { id: number } }>) {
    return { id: params.id };
  }

  @Post("/")
  async create({
    body
  }: T.Context<{ body: {} }>) {
    return { body };
  }

  @Put("/:id")
  async update({
    params,
    body
  }: T.Context<{ params: { id: number }; body: {} }>) {
    return { id: params.id, body };
  }

  @Delete("/:id")
  async remove({
    params
  }: T.Context<{ params: { id: number } }>) {
    return { id: params.id };
  }
}

export { ${className} };
export default ${className};
`
  );

  console.log(`Controller created: ${target}`);
}