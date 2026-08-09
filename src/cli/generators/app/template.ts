export const AppTemplate = `
import Spear from "tspace-spear";

const app = new Spear({
    logger: true,
    controllers: {
      folder: \`\${__dirname}/modules/*\`,
      name: /controller\\\.(ts|js)$/i,

      // don't forget to set this option for auto-generate route metadata for type-safe E2E usage, 
      // and swagger documentation. By default if use .useSwagger() in app no need to set any description
      preRouteTypes: true
    }
  })
  .cors({
    origins: [ 
      /^http:\\/\\/localhost:\\d+$/\
      
    ],
    credentials: true
  })
  .useGlobalPrefix("api", {
    exclude : [{ path : '/' , methods : '*' }]
  })
  .useSwagger()
  .useBodyParser()

  .get('/',(ctx) => {

    if(ctx.query.code === '400') {
      return ctx.res.badRequest();
    }

    if(ctx.query.code === '401') {
      return ctx.res.unauthorized();
    }

    if(ctx.query.code === '403') {
      return ctx.res.forbidden();
    }

    if(ctx.query.code === '404') {
      return ctx.res.notFound();
    }

    if(ctx.query.code === '500') {
      return ctx.res.serverError();
    }

    return { 
      success : true,
      message : 'GET: Hi app!' 
    }
  })
  .post('/',() => ({ success : true, message : 'POST: Hi app!' }))

app.listen(8000 , ({ port , server }) =>  {
  console.log(\`Server listening on : http://localhost:\${port}\`)
  console.log(\`Docs listening on : http://localhost:\${port}/api/docs\`)
});

type AppRouter = typeof app.contract;

export { AppRouter };
export { app };
export default app;
`;