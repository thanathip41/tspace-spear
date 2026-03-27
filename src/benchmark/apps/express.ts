export const AppExpress = ({ name , port , message }: { 
    name   : string; 
    port   : number; 
    message: string;
}) => {

    const express = require('express');
    
    const server = express()
    
    server.get('/', (req: any, res:any) => {
        return res.send(message);
    })
   
    server.listen(port , () =>  console.log(`Server '${name}' running at : http://localhost:${port}`))

    return server;
}