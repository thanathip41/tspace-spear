export const App0Http = ({ name , port , message }: { 
    name   : string; 
    port   : number; 
    message: string;
}) => {

    const cero = require('0http');
    const { router, server } = cero()

    //@ts-ignore
    router.get('/hello', (req, res) => {
        res.end(message);
        return
    })
   
    server.listen(port , () => console.log(`Server '${name}' running at : http://localhost:${port}`))

    return server
}