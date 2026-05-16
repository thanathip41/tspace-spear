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

app.cors({
  origins: [ 
    /^http:\\/\\/localhost:\\d+$/\
    
  ],
  credentials: true
});

app.useGlobalPrefix("api");
app.useSwagger();
app.useBodyParser();

app.listen(8000 , ({ port , server }) =>  {
  console.log(\`Server listening on : http://localhost:\${port}\`)
  console.log(\`Docs listening on : http://localhost:\${port}/api/docs\`)
});

type AppRouter = typeof app.contract;

export { AppRouter };
export { app };
export default app;
`;