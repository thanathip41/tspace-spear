import fs from "fs";
import path from "path";
import { 
    capitalize, 
    toPlural, 
    toSingular 
} from "../shared";

export function createModule(root : string,name?: string) {

    if (!name) {
        console.log("Missing module path, try spear g module dogs");
        process.exit(1);
    }

    const modulePath = path.resolve(process.cwd(), root , 'modules', toPlural(name));

    fs.mkdirSync(modulePath, { recursive: true });

    const controllerPath = path.resolve(
        process.cwd(),
        root,
        "modules",
        toPlural(name),
        `${toSingular(name)}.controller.ts`
    )

    const servicePath = path.resolve(
        process.cwd(),
        root,
        "modules",
        toPlural(name),
        `${toSingular(name)}.service.ts`
    )

    const dtoPath = path.resolve(
        process.cwd(),
        root,
        "modules",
        toPlural(name),
        `${toSingular(name)}.dto.ts`
    )

    const controllerName = capitalize(toSingular(name)) + "Controller";
    const serviceName = capitalize(toSingular(name)) + "Service";
    const dtoName = capitalize(toSingular(name)) + "Dto";

    fs.writeFileSync(
      controllerPath,
`import {
  type T,
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  ValidateDto
} from "tspace-spear";

import { ${serviceName} } from "./${toSingular(name)}.service";

import { 
    Create${dtoName}, 
    Update${dtoName} 
}  from "./${toSingular(name)}.dto";

@Controller("/${name}")
class ${controllerName} {

    constructor(
        private ${toSingular(name)}Service: ${serviceName} = new ${serviceName}()
    ) {}

    @Get("/")
    async index() {
        return this.${toSingular(name)}Service.index();
    }

    @Get("/:id")
    async show({
        params
    }: T.Context<{ params: { id: number } }>) {
        return this.${toSingular(name)}Service.show(params.id);
    }

    @Post("/")
    @ValidateDto(Create${dtoName})
    async create({
        body
    }: T.Context<{ body: Create${dtoName} }>) {
        return this.${toSingular(name)}Service
        .create({ 
            name: body.name, 
            age: body.age 
        });
    }

    @Put("/:id")
    @Patch("/:id")
    @ValidateDto(Update${dtoName})
    async update({
        params,
        body
    }: T.Context<{
        params: { id: number };
        body: Update${dtoName};
    }>) {

        return this.${toSingular(name)}Service
        .update(params.id, { 
            name: body.name, 
            age: body.age 
        });
    }

    @Delete("/:id")
    async remove({
        params
    }: T.Context<{ params: { id: number } }>) {
        return this.${toSingular(name)}Service
        .remove(params.id);
    }
}

export { ${controllerName} };
export default ${controllerName};      
`
    );

    fs.writeFileSync(
      servicePath,
`import { 
    Create${dtoName}, 
    Update${dtoName} 
}  from "./${toSingular(name)}.dto";

class ${serviceName} {
    public async index() {
        return [];
    };

    public async show(id: number) {
        return {};
    };

    public async create(body : Create${dtoName}) {
        return {};
    }
    
    public async update(id: number, body: Update${dtoName}) {
       return {};
    }

    public async remove(id: number) {
       return {};
    }
}

export { ${serviceName} };
export default ${serviceName};
`
    );
  
    fs.writeFileSync(
     dtoPath,
`import {
  IsString,
  Min,
  IsNotEmpty,
  IsNumber,
} from "class-validator";

export class Create${dtoName} {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @Min(0.1)
  age!: number;
}

export class Update${dtoName} {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @Min(0.1)
  age!: number;
}
      
`
    );

    console.log(`
CREATE   ${modulePath}
CREATE   ${controllerPath}
CREATE   ${servicePath}
CREATE   ${dtoPath}

✔ Successfully generated module "${name}"

Controller  ${controllerName}
Service     ${serviceName}
DTO         ${dtoName}
`)
}