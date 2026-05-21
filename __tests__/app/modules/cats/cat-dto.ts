import { 
  IsString, 
  IsInt,
  IsOptional,
} from "class-validator";


export class CreateCatDto {
  @IsString()
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