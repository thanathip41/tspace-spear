
export const AppHyperExpress = ({ name , port , message }: { 
    name   : string; 
    port   : number; 
    message: string;
}) => {

    const HyperExpress = require('hyper-express');
    const app = new HyperExpress.Server();

    //@ts-ignore
    app.get('/', (request, response) => {
        response.send(message);
        return;
    })

    app.listen(port)
    .then(() => console.log(`Server '${name}' running at : http://localhost:${port}`))

    return app
}