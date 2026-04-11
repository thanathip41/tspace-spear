import Spear , { Router, type T } from "tspace-spear";
import { CatController } from './controllers/cat-controller';
import { CatMiddleware } from './middlewares/cat-middleware';
import path from 'path';
import fs   from 'fs';

const router = new Router();

router.get('/router' , () => 'GET: router here')
router.post('/router' , () => 'POST: router here')

new Spear({
    logger: true,
    /**use uWS adapter (make sure to install uWebSockets.js package)
       import uWS from 'uWebSockets.js'
    */
    // adapter: uWS, // use uWS adapter for better performance
    // adapter: http, // use Node's built-in HTTP adapter, by default
    controllers: [ CatController ],
    // dynamic controllers loading example :
      // controllers : {
      //   folder : `${__dirname}/controllers`,
      //   name :  /controller\.(ts|js)$/i
      // },
    middlewares: [ CatMiddleware ]
    // dynamic middlewares loading example :
      // middlewares : {
      //   folder : `${__dirname}/middlewares`,
      //   name :  /middleware\.(ts|js)$/i
      // }
})
.useRouter(router)
// will be served at http://localhost:3000/api/docs
.useSwagger({
  options: {
    decoratedOnly : true
  }
})
.useBodyParser() // for enabling body parsing
.useFileUpload() // for enabling file upload handling
.useCookiesParser() // for enabling cookies parsing
.get('/', () => 'Hello wor1ld!')
.get('/file/*', (ctx) => {
    // serve static files from the 'example' directory
    // example/bbb.pdf will be served at http://localhost:3000/file/bbb.pdf
    const filePath = path.join(path.resolve(), 'example', ctx.params['*']!);
    return ctx.res.serveMedia(filePath);
})
.post('/', (ctx) => {
  return ctx.res.json({
    cat     : ctx.req.cat, // from LogMiddleware
    ip      : ctx.ip,
    query   : ctx.query,
    headers : ctx.headers,
    cookies : ctx.cookies,
    body    : ctx.body,
    files   : ctx.files,
  })
})
.get('/ws',(ctx) => {
  const htmlWs = fs.readFileSync(path.join(path.resolve(), 'example', 'ws.html'), 'utf-8');
  return ctx.res.html(htmlWs);
})
.ws(() => {
  const clients = new Map<string, any>();
  return {
    connection: (ws) => {
      console.log("connected");
    },

    message: (ws, msg) => {
      const data = JSON.parse(msg.toString());

      if (data.type === "register") {
        ws.userId = data.userId;
        clients.set(data.userId, ws);

        ws.send(JSON.stringify({
          type: "system",
          message: `registered as ${data.userId}`
        }));

        return;
      }

      if (data.type === "chat") {
        const targetWs = clients.get(data.to);

        if (!targetWs) {
          ws.send(JSON.stringify({
            type: "error",
            message: "User not online"
          }));
          return;
        }

        targetWs.send(JSON.stringify({
          type: "chat",
          from: ws.userId,
          text: data.text
        }));

        return;
      }
    },

    close: (ws) => {
      if (ws.userId) {
        clients.delete(ws.userId);
      }
    },
    
    error: (ws, error) => {
      console.error('WebSocket error:', error);
    }
  };
})
.response((results : any, statusCode : number) => {

    if (typeof results === 'string') return results

    if (Array.isArray(results)) {
        return {
          success: statusCode < 400,
          data: results,
          statusCode
        }
    }

    if (typeof results === 'object' && results !== null) {
        return {
          success: statusCode < 400,
          ...results,
          statusCode
        }
    }

    return {
        success: statusCode < 400,
        data: results,
        statusCode
    }
})
// .notfound(({ res } : T.Context) => {
//   return res.notFound('Not found!')
// })
.catch((err:any, { res } : T.Context) => {

    // Handle Zod validation errors

    // if(err instanceof z.ZodError) {
    //     return res
    //     .status(422)
    //     .json({
    //         success    : false,
    //         message    : "Validation failed",
    //         issues     : err?.issues,
    //         statusCode : 422
    //     });
    // }

    return res
    .status(500)
    .json({
        success    : false,
        message    : err?.message,
        statusCode : 500
    });
}) 
.listen(3000 , ({ port }) =>  {
  console.log(`server listening on : http://localhost:${port}`)
})