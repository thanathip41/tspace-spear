import express, { Request, Response } from 'express'

export const AppExpress = ({ name , port , message }: { 
    name   : string; 
    port   : number; 
    message: string;
}) => {
    
    const server = express()
    
    server.get('/', (req: Request, res: Response) => {
        return res.send(message);
    })
   
    server.listen(port , () =>  console.log(`Server '${name}' running at : http://localhost:${port}`))

    return server;
}