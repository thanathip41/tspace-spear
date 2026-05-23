import {
  type T,
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  ValidateDto,
  Validate
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
      message: "ok",
      query,
      cats,
    };
  }

  @Get('/:id')
  public async show({ res, params }: T.Context<{ params: { id: number } }>) {

    const cat = cats.find((d) => d.id === Number(params.id));

    if(cat == null) {
      throw res.notFound('not found cat')
    }

    return {
      message: "ok",
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
      message: 'created',
      cat
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

    const index = cats.findIndex((d) => d.id === params.id);

    if (index === -1) {
      throw res.notFound('not found cat')
    }

    cats[index] = {
      ...cats[index],
      ...body,
      id : params.id
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
      deleted : true
    };
  }

  @Post('/upload')
  @Validate(['image'], { target : 'files'})
  public async upload({ files } : T.Context<{ files: { image : T.FileInput[] }}>) {
    return {
      message: "uploaded",
      image: files.image[0]
    }
  }
}

export { CatController };
export default CatController;