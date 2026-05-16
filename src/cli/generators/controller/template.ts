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
    return this.catService.index();
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

    return this.catService.show(params.id);
  }

  @Post("/")
  @ValidateDto(CreateCatDto)
  @Middleware(LogMiddleware)
  async create({
    body
  }: T.Context<{
    body: CreateCatDto;
  }>) {

    return this.catService
    .create({ 
      name: body.name, 
      age: body.age 
    });
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

    return this.catService
    .update(params.id, { 
      name: body.name, 
      age: body.age 
    });
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

    return this.catService
    .remove(params.id);
  }
}

export { CatController };
export default CatController;
`;