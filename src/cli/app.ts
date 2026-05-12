export const app = `
import Spear from "tspace-spear";

export const app = new Spear({
  logger: true,
  controllers: {
    folder: \`\${__dirname}/controllers\`,
    name: /controller\\\\.(ts|js)$/i,
    preRouteTypes: true
  }
})

app.useGlobalPrefix("api");

app.useBodyParser();

app.listen(8000 , ({ port , server }) =>  {
    console.log(\`server listening on : http://localhost:\${port}\`)
})
`;