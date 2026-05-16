export const DtoTemplate = `
import {
  IsString,
  Min,
  IsNotEmpty,
  IsNumber,
} from "class-validator";

export class CreateCatDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @Min(0.1)
  age!: number;
}

export class UpdateCatDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @Min(0.1)
  age!: number;
}
`;
