export const ControllerTemplate = `
import {
  type T,
  Controller,
  Middleware,
  Get,
  Post,
  Put,
  Delete,
  ValidateDto
} from "tspace-spear";
import { CatService }    from "./cat.service";
import { CreateCatDto , UpdateCatDto }  from "./cat.dto";
import { LogMiddleware } from "../../common/middlewares/log.middleware";

@Controller("/cats")
class CatController {

  constructor(
    private catService: CatService = new CatService()
  ) {}

  @Get("/")
  @Middleware(LogMiddleware)
  async index() {
    const cats = this.catService.index();
    return { cats };
  }

  @Get("/:id")
  @Middleware(LogMiddleware)
  async show({
    params
  }: T.Context<{
    params: {
      id: number;
    };
  }>) {
    const cat = this.catService.show(+params.id);
    return { cat }
  }

  @Post("/")
  @ValidateDto(CreateCatDto)
  @Middleware(LogMiddleware)
  async create({
    body
  }: T.Context<{
    body: CreateCatDto;
  }>) {

    const cat = this.catService
    .create({ 
      name: body.name, 
      age: body.age 
    });

    return { cat };
  }

  @Put("/:id")
  @ValidateDto(UpdateCatDto)
  @Middleware(LogMiddleware)
  async update({
    params,
    body
  }: T.Context<{
    params: {
      id: number;
    };
    body: UpdateCatDto;
  }>) {

    const cat = this.catService
    .update(+params.id, { 
      name: body.name, 
      age: body.age 
    });

    return { cat }
  }

  @Delete("/:id")
  @Middleware(LogMiddleware)
  async remove({
    params
  }: T.Context<{
    params: {
      id: number;
    };
  }>) {

    const deleted = this.catService
    .remove(+params.id);

    return deleted;
  }
}

export { CatController };
export default CatController;
`;