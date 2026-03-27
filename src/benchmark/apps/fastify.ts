import fastify from 'fastify'

export const AppFastify = ({ name , port , message }: { 
    name   : string; 
    port   : number; 
    message: string;
}) => {
  
    const server = fastify()
    server.get('/', () => message)
    server.listen({ port }, () => console.log(`Server '${name}' running at : http://localhost:${port}`))

    return server;
}