import z from 'zod';
import {
  type T,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  createDtoDecorator
} from "../../../src/lib";

const catSchema = z.object({
  id: z.number(),
  name: z.string(),
  age: z.number(),
});

const catSchemaAction = z.object({
  name: z.string(),
  age: z.number(),
});

type Cat = z.infer<typeof catSchema>

let cats: z.infer<typeof catSchema>[] = [
  { id: 1, name: 'cat1', age: 1.6 },
  { id: 2, name: 'cat2', age: 1.8 },
];

const ValidateDtoBody = (schema: z.ZodTypeAny) => {
  return createDtoDecorator((ctx) => {
    const result = schema.parse(ctx.body);
    ctx.body = result as T.Body;
  });
};


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
      return res.notFound('not found cat')
    }

    return {
      cat
    };
  }

  @Post('/')
  @ValidateDtoBody(catSchemaAction)
  public async create({
    body,
  }: T.Context<{ body: z.infer<typeof catSchemaAction> }>) {

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
  @ValidateDtoBody(catSchemaAction.partial())
  public async update({
    params,
    body,
  }: T.Context<{
    params: { id: number };
    body: Partial<z.infer<typeof catSchemaAction>>;
  }>) {
    const id = Number(params.id);

    const index = cats.findIndex((d) => d.id === id);

    if (index === -1) {
      return { message: 'not found', cat: null };
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
  public async remove({ params }: T.Context<{ params: { id: number } }>) {
    const id = Number(params.id);

    const before = cats.length;
    cats = cats.filter((d) => d.id !== id);

    return {
      message: before === cats.length ? 'not found' : 'deleted',
    };
  }
}

export { CatController };
export default CatController;