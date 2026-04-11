import { 
  type T,
  Swagger, Controller , Middleware , 
  Get , Post , Delete, Patch, Put,
  Files , Body , Query, Cookies, StatusCode , Params,
  createDtoDecorator
} from 'tspace-spear';

const ValidateDtoBody = (keys: string[]) => {
  return createDtoDecorator((ctx) => {
    const body = ctx.body ?? {};
    const issues: Array<{ path: string; message: string }> = [];

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];

        if (body[key] == null) {
            issues.push({
                path: key,
                message: "Missing field",
            });
        }
    }

    if (issues.length > 0) {
        throw {
          message : "Validation failed",
          issues
        }
    }
  });
}

const loggingMiddleware1 = async (ctx : T.Context , next : T.NextFunction)  => {
  console.log('Logging middleware #1');

  ctx.req.catx = {
    id : 1,
    username : 'cat lover'
  }
  return next();
}

const loggingMiddleware2 = async (ctx : T.Context , next : T.NextFunction) => {
    console.log('Logging middleware #2');
    return next()
}

@Controller('/api/cats')
class CatController {
  @Get('/')
  @Query('cat','id') // allow only query param named 'cat' and 'id'
  @Middleware(loggingMiddleware1)
  @Middleware(loggingMiddleware2)
  public async index({ query, req }  : T.Context) {
    if(query.id === "1") {
      throw new Error('hi error!')
    }
    return { query , catx : req.catx }
  }

  @Get('/:id')
  @Swagger({
    description : '- message',
    params : {
      id : {
        type : 'integer'
      }
    },
    responses : [
      { status : 200 , description : "OK" , example : { id : 'catz' }},
      { status : 400 , description : "Bad request" , example : { id : 'catz' }}
    ]
  })
  public async show({ params } : T.Context) {
    return {
      params
    }
  }

  @Post('/')
  @Swagger({
    bearerToken : true,
    body : {
      description : 'The description !',
      required : true,
      properties : {
        id : {
          type : 'integer',
          example : 1
        },
        name :  {
          type : 'string',
          example : "xxxxx"
        }
      }
    }
  })
  public async store({ body } : T.Context) {
    return {
      body
    }
  }

  @Put('/:uuid')
  @Swagger({
    bearerToken : true,
    body : {
      description : 'The description !',
      required : true,
      properties : {
        id : {
          type : 'integer',
          example : 1
        },
        name :  {
          type : 'string',
          example : "xxxxx"
        }
      }
    }
  })
  public async updated({ body } : T.Context) {
    return {
      body
    }
  }

  @Patch('/:uuid')
  @Swagger({
    bearerToken : true,
    body : {
      description : 'The description !',
      required : true,
      properties : {
        id : {
          type : 'integer',
          example : 1
        },
        name :  {
          type : 'string',
          example : "xxxxx"
        }
      }
    }
  })
  public async update({ body } : T.Context) {
    return {
      body
    }
  }

  @Delete('/:uuid')
  @Swagger({
    bearerToken : true
  })
  public async delete({ params } : T.Context) {
    return {
      params
    }
  }

  @Post('/upload')
  @Swagger({
    bearerToken : true,
    files : {
      required : true,
      properties : {
        file : {
          type : 'array',
          items: {
            type:"string",
            format:"binary"
          }
        }
      }
    }
  })
  public async upload({ body , files } : T.Context) {
    return {
      body,
      files
    }
  }

  @Post('/dto')
  @ValidateDtoBody(["name", "age"])
  public async basic(ctx : T.Context) {
    const body = ctx.body;
    return {
      body
    }
  }
}

export { CatController }
export default CatController
