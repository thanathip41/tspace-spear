export const CatController = `
import {
  type T,
  Controller,
  Get,
  Post,
  Put,
  Delete
} from "tspace-spear";

type Cat = {
  id: number;
  name: string;
  age: number;
};

let cats: Cat[] = [
  {
    id: 1,
    name: "cat 1",
    age: 2
  },
  {
    id: 2,
    name: "cat 2",
    age: 4
  }
];

@Controller("/cats")
export default class CatController {

  @Get("/")
  async index() {
    return {
      cats
    };
  }

  @Get("/:id")
  async show({
    res,
    params
  }: T.Context<{
    params: {
      id: number;
    };
  }>) {

    const cat = cats.find(
      d => d.id === Number(params.id)
    );

    if (!cat) {
      throw res.notFound(
        "Cat not found"
      );
    }

    return {
      cat
    };
  }

  @Post("/")
  async create({
    body
  }: T.Context<{
    body: {
      name: string;
      age: number;
    };
  }>) {

    const cat: Cat = {
      id: cats.length + 1,
      name: body.name,
      age: body.age
    };

    cats.push(cat);

    return {
      message: "Created",
      cat
    };
  }

  @Put("/:id")
  async update({
    res,
    params,
    body
  }: T.Context<{
    params: {
      id: number;
    };
    body: Partial<{
      name: string;
      age: number;
    }>;
  }>) {

    const index = cats.findIndex(
      d => d.id === Number(params.id)
    );

    if (index === -1) {
      throw res.notFound(
        "Cat not found"
      );
    }

    cats[index] = {
      ...cats[index],
      ...body
    };

    return {
      message: "Updated",
      cat: cats[index]
    };
  }

  @Delete("/:id")
  async remove({
    res,
    params
  }: T.Context<{
    params: {
      id: number;
    };
  }>) {

    const index = cats.findIndex(
      d => d.id === Number(params.id)
    );

    if (index === -1) {
      throw res.notFound(
        "Cat not found"
      );
    }

    cats = cats.filter(
      d => d.id !== Number(params.id)
    );

    return {
      message: "Deleted"
    };
  }
}
`;