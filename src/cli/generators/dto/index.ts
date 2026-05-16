import fs from "fs";
import path from "path";
import { 
    capitalize, 
    toPlural, 
    toSingular 
} from "../shared";

export function createDto(root : string,name?: string) {
    if (!name) {
        console.log("Missing dto path, try spear g dto dog");
        process.exit(1);
    }

  const resolvedPath = path.resolve(process.cwd(), root , 'modules', toPlural(name));

  const fileName = `${toSingular(name)}.dto.ts`;

  const target = path.join(resolvedPath, fileName);

  fs.mkdirSync(resolvedPath, { recursive: true });

  const className = capitalize(toSingular(name)) + "Dto";

  fs.writeFileSync(
    target,
    `
import {
  IsString,
  Min,
  IsNotEmpty,
  IsNumber,
} from "class-validator";

export class Create${className} {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @Min(0.1)
  age!: number;
}

export class Update${className} {
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
CREATE   ${target}

✔ Successfully generated dto "${name}"

`)
}