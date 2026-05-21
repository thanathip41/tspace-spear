import {
  type T,
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  ValidateDto
} from "../../../../src/lib";

import { 
  CreateCatDto, 
  UpdateCatDto 
} from "./cat-dto";

type Cat = {
  id   : number;
  name : string;
  age  : number;
}

let cats: Cat[] = [
  { id: 1, name: 'cat1', age: 1.6 },
  { id: 2, name: 'cat2', age: 1.8 },
];

@Controller('/cats')
class CatController {
  @Get('/')
  public async index({
    query,
  }: T.Context<{ query: { id?: string ; name?: string } }>) {
    return {
      query,
      cats,
    };
  }

  @Get('/:id')
  public async show({ res, params }: T.Context<{ params: { id: number } }>) : Promise<{
    cat : Cat
  }> {
    const cat = cats.find((d) => d.id === Number(params.id));

    if(cat == null) {
      throw res.notFound('not found cat')
    }

    return {
      cat
    };
  }

  @Post('/')
  @ValidateDto(CreateCatDto)
  public async create({
    body,
  }: T.Context<{ body: CreateCatDto }>) {

    const cat = {
      id: cats.length + 1,
      ...body
    }

    cats.push(cat);

    return {
      cat,
      message: 'created',
    };
  }

  @Put('/:id')
  @Patch('/:id')
  @ValidateDto(UpdateCatDto)
  public async update({
    res,
    params,
    body,
  }: T.Context<{
    params: { id: number };
    body: UpdateCatDto;
  }>) {

    const id = Number(params.id);

    const index = cats.findIndex((d) => d.id === id);

    if (index === -1) {
      throw res.notFound('not found cat')
    }

    cats[index] = {
      ...cats[index],
      ...body,
      id
    };

    const cat = cats[index]

    return {
      message: 'updated',
      cat,
    };
  }

  @Delete('/:id')
  public async remove({ res, params }: T.Context<{ params: { id: number } }>) {
    const id = Number(params.id);

    const index = cats.findIndex((d) => d.id === id);

    if (index === -1) {
      throw res.notFound('not found cat')
    }

    cats = cats.filter((d) => d.id !== id);

    return {
      message: 'deleted',
    };
  }
}

export { CatController };
export default CatController;