#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { app } from "./app";
import { CatController } from "./controller";

const [, , action, type, target] = process.argv;

switch (`${action}:${type}`) {

  case "create:app":
    createApp(target);
    break;

  case "create:controller":
    createController(target);
    break;

  default:
    console.log(`
Usage:

tspace-spear create app ./src
tspace-spear create controller ./src/controllers/dogs
`);
}

function createApp(targetPath?: string) {

  if (!targetPath) {
    console.log("Missing target path");
    process.exit(1);
  }

  const root = path.resolve(
    process.cwd(),
    targetPath
  );

  fs.mkdirSync(root, {
    recursive: true
  });

  fs.mkdirSync(
    path.join(root, "controllers"),
    {
      recursive: true
    }
  );

  fs.writeFileSync(
    path.join(root, "index.ts"),
    app
  );

  fs.writeFileSync(
    path.join(
      root,
      "controllers",
      "cat.controller.ts"
    ),CatController
  );

  console.log(
    `App created at: ${root}`
  );
}

function createController(inputPath?: string) {
  if (!inputPath) {
    console.log("Missing controller path");
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), inputPath);

  const name = path.basename(resolvedPath);
  const fileName = `${name}.controller.ts`;

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
export default class ${className} {

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
`
  );

  console.log(`Controller created: ${target}`);
}

function capitalize(
  value: string
) {
  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}