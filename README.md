# tspace-spear

[![NPM version](https://img.shields.io/npm/v/tspace-spear.svg)](https://www.npmjs.com)
[![NPM downloads](https://img.shields.io/npm/dm/tspace-spear.svg)](https://www.npmjs.com)

tspace-spear is a lightweight API framework for Node.js that is fast and highly focused on providing the best developer experience. 
It utilizes the native HTTP server.

## Install

Install with [npm](https://www.npmjs.com/):

```sh
npm install tspace-spear --save

```
## Basic Usage
- [StartServer](#start-server)
  - [CRUD](#crud)
  - [Cluster](#cluster)
- [Cors](#cors)
- [Middleware](#middleware)
- [Controller](#controller)
- [Router](#router)
- [Swagger](#swagger)
- [File Upload](#file-upload)
- [Others](#others)

## StartServer
```js
import { Spear } from "tspace-spear";

new Spear()
.get('/' , () => 'Hello world!')
.get('/json' , () => {
  return {
    message : 'Hello world!'
  }
})
.listen(3000 , ({ server, port }) => 
  console.log(`server listening on : http://localhost:${port}`)
)

```

### CRUD
```js
import { Spear } from "tspace-spear";

const spears = [
  {
    id : 1,
    damage : 100
  },
  {
    id : 2,
    damage : 75
  },
  {
    id : 3,
    damage : 50
  }
]

new Spear()
// enable body payload
.useBodyParser()
.get('/' , () => spears)
.get('/:id' , ({ params }) => spears.find(spear => spear.id === Number(params.id ?? 0)))
.post('/' , ({ body }) =>  {
    // please validation the your body 
    const damage  = Number(body.damage ?? (Math.random() * 100).toFixed(0))

    const id = spears.reduce((max, spear) => spear.id > max ? spear.id : max, 0) + 1

    spears.push({ id , damage })

    return spears.find(spear => spear.id === id)
})
.patch('/:id' , ({ params , body , res }) =>  {
    
    const damage  = Number(body.damage ?? (Math.random() * 100).toFixed(0))

    const id = Number(params.id)

    const spear = spears.find(spear => spear.id === id)

    if (spear == null) return res.status(404).json({ message : 'Spear not found'})

    spear.damage = damage;

    return spears.find(spear => spear.id === id)
})
.delete('/:id', ({ params , res }) => {

  const id = Number(params.id)

  const spear = spears.find(spear => spear.id === id)

  if (spear == null) return res.status(404).json({ message : 'Spear not found'})

  spears.splice(spears.findIndex(spear => spear.id === Number(params.id ?? 0)), 1)

  return res.status(204).json()
})
.listen(3000 , ({ server, port }) => 
  console.log(`server listening on : http://localhost:${port}`)
)
```

## Cluster
```js
import { Spear } from "tspace-spear";
new Spear({
  cluster : 3
})
.get('/' , () => 'Hello world!')
.get('/json' , () => {
  return {
    message : 'Hello world!'
  }
})
.listen(3000 , ({ port }) => 
  console.log(`server listening on : http://localhost:${port}`)
)

```

## Cors

```js
const app = new Spear()
.cors({
    origins: [
      /^http:\/\/localhost:\d+$/
    ],
    credentials: true
})
.listen(port , () => console.log(`Server is now allow cors localhost:* `))

```

## Middleware
```js
// file cat-middleware.ts
export default (ctx : TContext, next: TNextFunction) =>{
  console.log('cat middleware globals');
  return next();
}

import  Spear { Router, TContext, TNextFunction } from "tspace-spear";
import CatMiddleware from './cat-middleware.ts'

(async () => {
  const port = Number(process.env.PORT ?? 3000)
  const app = new Spear({
    middlewares: [ CatMiddleware ]
    // if you want to import middlewares with a directory can you follow the example
    // middlewares : {
    //   folder : `${__dirname}/middlewares`,
    //   name :  /middleware\.(ts|js)$/i
    // }
  })

  // or add a middleware
  app.use((ctx : TContext , next : TNextFunction) => {
    console.log('global middlewares')
    return next()
  })

  app.get('/' , ({ res } : TContext) => {
    return res.json({
      message : 'hello world!'
    });
  })

  app.listen(port , () => console.log(`Server is now listening http://localhost:${port}`))

  // localhost:3000

})()
```

## Controller
```js
import { 
  Controller , 
  Middleware , 
  Get , 
  Post,
  Patch,
  Put,
  Delete,  
  WriteHeader, 
  Query, 
  Body,
  Params,
  Cookies,
  Files, 
  StatusCode,
  TCookies, 
  TParams, 
  TRequest, 
  TResponse ,  
  TQuery, 
  TFiles, 
  TContext, 
  TNextFunction
} from 'tspace-spear';

import CatMiddleware from './cat-middleware.ts'

// file cat-controller.ts
@Controller('/cats')
class CatController {
  @Get('/')
  @Middleware(CatMiddleware)
  @Query('test','id')
  @Cookies('name')
  public async index({ query , cookies } : { 
    query : TQuery<{ id : string }>
    cookies : TCookies<{ name : string}>
  }) {

    return {
      query,
      cookies
    }
  }

  @Get('/:id')
  @Middleware(CatMiddleware)
  @Params('id')
  public async show({ params } : TContext) {
    return {
      params
    }
  }

  @Post('/')
  @Middleware(CatMiddleware)
  public async store({ body } : TContext) {
    return {
      body
    }
  }

  @Put('/:id')
  @Middleware(CatMiddleware)
  public async update({ files } : TContext) {
    return {
     files
    }
  }

  @Post('/upload')
  @Middleware(CatMiddleware)
  public async upload({ files } : TContext) {
    return {
     files
    }
  }

  @Delete('/:id')
  @Middleware(CatMiddleware)
  public async destroy({ params } : TContext) {
    return {
     params
    }
  }
}

import { Spear } , { Router, TContext, TNextFunction } from "tspace-spear";

import CatController from './cat-controller.ts'

(async () => {

  const app = new Spear({
    controllers: [ CatController ]
    // if you want to import controllers with a directory can you follow the example
    // controllers : {
    //   folder : `${__dirname}/controllers`,
    //   name :  /controller\.(ts|js)$/i
    // }
  })

  app.useBodyParser()
  app.useCookiesParser()
  app.useFileUpload()

  app.get('/' , ( { res } : TContext) => {
    return res.json({
      message : 'hello world!'
    });
  })

  const port = 3000

  app.listen(port , () => console.log(`Server is now listening http://localhost:${port}`))

  // localhost:3000/cats 
  // localhost:3000/cats/41

})()
```

## Router

```js
import { Spear } , { Router, TContext, TNextFunction } from "tspace-spear";

const app = new Spear()

const router = new Router()
    
router.groups('/my',(r) => {

  r.get('/cats' , ({ req , res }) => {

      return res.json({
          message : 'Hello, World!'
      })
  })

  return r
})
    
router.get('/cats' , ({ req , res }) => {
  return res.json({
      message : 'Hello, World!'
  })
})

app.useRouter(router)

app.get('/' , ({ res } : TContext) => {
  return res.json({
    message : 'hello world!'
  });
})

let port = 3000

app.listen(port , () => console.log(`Server is now listening http://localhost:${port}`))

// localhost:3000/my/cats
// localhost:3000/cats

```

## Swagger
```js

// file cat-controller.ts
import { 
  TContext,
  Controller, 
  Get , 
  Post,
  Put,
  Patch,
  Delete,
  Swagger
} from 'tspace-spear';

@Controller('/cats')
class CatController {
  @Get('/')
  @Swagger({
    query : {
      id : {
        type : 'integer'
      },
      name :  {
        type : 'string'
      }
    }
  })
  public async index({ query }  : TContext) {

    return {
      query
    }
  }

  @Get('/:id')
  @Swagger({
    description : '- message',
    query : {
      id : {
        type : 'integer'
      }
    },
    responses : [
      { status : 200 , description : "OK" , example : { id : 'catz' }},
      { status : 400 , description : "Bad request" , example : { id : 'catz' }}
    ]
  })
  public async show({ params } : TContext) {
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
  public async store({ body } : TContext) {
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
  public async updated({ body } : TContext) {
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
  public async update({ body } : TContext) {
    return {
      body
    }
  }

  @Delete('/:uuid')
  @Swagger({
    bearerToken : true
  })
  public async delete({ params } : TContext) {
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
            type:"file",
            format:"binary"
          }
        },
        name : {
          type : 'string'
        }
      }
    }
  })
  public async upload({ body , files } : TContext) {
    return {
      body,
      files
    }
  }
}

(async () => {

  await new Spear({
    controllers: [ CatController ]
  })
  .get('/' , ({ res } : TContext) => {
  return res.json({
    message : 'hello world!'
  });
  })
  // .useSwagger() // by default path is "/api/docs"
  .useSwagger({
    path : "/docs",
    servers : [
      { url : "http://localhost:3000" , description : "development"}, 
      { url : "http://localhost:8000" , description : "production"}
    ],
    info : {
      "title" : "Welcome to the the documentation",
      "description" : "This is the documentation"
    }
  })
  .listen(3000 , () => console.log(`Server is now listening http://localhost:3000`))

  // localhost:3000/docs
})()
```

## File Upload

```js

import { Spear } from 'tspace-spear';
import path from 'path'

new Spear()
// use this for enable file upload
.useFileUpload({
  limit : 1000 * 1000, // limit for file upload 1_000_000 bytes by default Infinity
  tempFileDir : 'temp', // folder temporary directory by default tmp
  removeTempFile : {
    remove : true, // remove temporary files by default false
    ms : 1000 * 60 // remove file temporary after 60 seconds
  }
})
.post('/' , ({ files } : TContext) => {

  // you can move the file from temporary to other folder
  // for example please validate the your input file
  const file     = files.file[0]
  const folder   = 'uploads'

  await file.write(path.join(path.resolve(),`${folder}/${+new Date()}.${file.extension}`))

  // after writed the file you should remove the temporary file
  await file.remove()

  return {
    files
  }
})

```

## Others

```js

const app = new Spear({
  logger : true, // logging
  globalPrefix : '/api' // prefix all routes
})
// or use this for logging
app.useLogger({
    methods     : ['GET','POST'],
    exceptPath  : ['/']
})

app.useFileUpload()

app.get('/' , ({ res } : TContext) => {
  return res.json({
    message : 'hello world!'
  });
})

app.get('/bad-request' , ({ res } : TContext) => {
  return res.status(400).json({
    message : 'hello but bad request'
  });
})

app.get('/not-found' , ({ res } : TContext) => {
  return res.status(404).json({
    message : 'hello but not found the world!'
  });
})

app.get('/errors', () => {
  throw new Error('testing Error handler')
})
    
// every response should returns following this format response
app.response((results : unknown , statusCode : number) => {

  if(typeof results === 'string') return results
  
  /// ...

  return {
      success : statusCode < 400,
      ...results,
      statusCode
  }
})
  
// every notfound page should returns following this format response
app.notfound(({ res } : TContext) => {
  return res.notFound();
})
    
// every errors page should returns following this format response
app.catch((err : Error , { res } : TContext) => {

  return res
    .status(500)
    .json({
      success    : false,
      message    : err?.message,
      statusCode : 500
  });
}) 
    
const port = 3000

app.listen(port , () => console.log(`Server is now listening http://localhost:${port}`))

// localhost:3000/*********** // not found
// localhost:3000/errors // errors
// localhost:3000 // format response

```