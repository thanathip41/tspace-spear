import {
  type T,
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  ValidateDto,
  Validate,
  Service
} from "../../../../src/lib";

import { 
  CreateCatDto, 
  UpdateCatDto 
} from "./cat-dto";
import { CatService } from "./cat-service";

@Service([CatService])
@Controller('/cats')
class CatController {

  constructor(
    private catService: CatService
  ){}
  @Get('/')
  public async index({
    query,
    headers
  }: T.Context<{ 
    query: { id?: string ; name?: string } 
    headers: { 'x-token' : string }
  }>) {

    const cats = this.catService.index();

    return {
      message: "ok",
      query,
      headers,
      cats,
    };
  }

  @Get('/:id')
  public async show({ res, params }: T.Context<{ params: { id: number } }>) {

    const cat = this.catService.show(params.id);

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

    const cat = this.catService.create(body)

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
  
    const cat = this.catService.update(params.id,body);

    if(cat == null) {
      throw res.notFound('not found cat')
    }

    return {
      message: 'updated',
      cat,
    };
  }

  @Delete('/:id')
  public async remove({ res, params }: T.Context<{ params: { id: number } }>) {
   
    const cat = this.catService.remove(params.id);

     if(cat == null) {
      throw res.notFound('not found cat')
    }

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