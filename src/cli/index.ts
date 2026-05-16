#!/usr/bin/env node

import { createApp } from "./generators/app";
import { createModule } from "./generators/module";
import { createController } from "./generators/controller";
import { createService } from "./generators/service";
import { createMiddleware } from "./generators/middleware";

const [, , command, type, name] = process.argv;

/**
 * spear create new <name>
 * spear g module <name>
 * spear g controller <name>
 * spear g service <name>
 * spear g middleware <name>
 */

if (command === "create" && type === "new") {
  createApp(name);
  process.exit(0);
}

if (command === "g") {
  if (!name) {
    printUsage();
    process.exit(1);
  }

  const root = 'ddd';

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

    case "middleware":
      createMiddleware(root,name);
      break;

    default:
      printUsage();
  }

  process.exit(0);
}

printUsage();

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