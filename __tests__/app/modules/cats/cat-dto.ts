import { 
  IsString, 
  IsInt,
  IsOptional,
  IsNotEmpty
} from "class-validator";
export class CreateCatDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  age!: number;
}

export class UpdateCatDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  age?: number;
}