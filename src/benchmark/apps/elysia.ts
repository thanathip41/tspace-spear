import { Elysia } from 'elysia'

export const AppElysia = ({ name , port , message }: { 
    name   : string; 
    port   : number; 
    message: string;
}) => {

    const server = new Elysia()
    server.get('/', () => message)
    server.listen(port , () => console.log(`Server '${name}' running at : http://localhost:${port}`))

    return server
}

// require node 22
export const AppElysiaNode = ({ name , port , message }: { 
    name   : string; 
    port   : number; 
    message: string;
}) => {
    const { node } =  require('@elysiajs/node');

    const server = new Elysia({ adapter : node() })

    server.get('/', () => message)

    server.listen(port , () => console.log(`Server '${name}' running at : http://localhost:${port}`))

    return server;
}

