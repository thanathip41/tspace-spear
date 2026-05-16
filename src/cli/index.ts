#!/usr/bin/env node

import { createApp } from "./generators/app";
import { createModule } from "./generators/module";
import { createController } from "./generators/controller";
import { createService } from "./generators/service";
import { createMiddleware } from "./generators/middleware";
import { createDto } from "./generators/dto";

const [, , command, type, name] = process.argv;

/**
 * spear create new <name>
 * spear g module <name>
 * spear g controller <name>
 * spear g service <name>
 * spear g middleware <name>
 */

if (command === "create" && type === "new") {
  createApp(name)
  .then(_ => process.exit(1))
  .catch(_ => process.exit(1))
}

if (command === "g") {
  if (!name) {
    printUsage();
    process.exit(1);
  }

  const root = 'src';

  switch (type) {
    
    case "module":
      createModule(root,name);
      break;

    case "controller":
      createController(root,name);
      break;

    case "service":
      createService(root,name);
      break;

    case "dto":
      createDto(root,name);
      break;

    case "middleware":
      createMiddleware(root,name);
      break;

    default:
      printUsage();
  }

  process.exit(0);
}

function printUsage() {
  console.log(`
Usage:

  spear create new <project>

Generators:

  spear g module <name>
  spear g controller <name>
  spear g service <name>
  spear g middleware <name>
`);
}