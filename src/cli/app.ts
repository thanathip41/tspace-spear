export const app = `
import Spear from "tspace-spear";

export const app = new Spear({
  logger: true,
  controllers: {
    folder: \`\${__dirname}/controllers\`,
    name: /controller\\\.(ts|js)$/i,

    // don't forget to set this option for auto-generate route metadata for type-safe E2E usage, 
    // and swagger documentation. By default if use .useSwagger() in app no need to set any description
    preRouteTypes: true
  }
})

app.useGlobalPrefix("api");
app.useSwagger();
app.useBodyParser();

app.listen(8000 , ({ port , server }) =>  {
  console.log(\`Server listening on : http://localhost:\${port}\`)
  console.log(\`Docs listening on : http://localhost:\${port}/api/docs\`)
})
`;