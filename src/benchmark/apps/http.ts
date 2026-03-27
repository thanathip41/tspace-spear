import http from "http";

export const AppHttp = ({ name , port , message }: { 
    name   : string; 
    port   : number; 
    message: string;
}) => {
   
    const server = http.createServer((req, res) => {
        res.end(message);
        return;
    });

    server.listen(port , () => console.log(`Server '${name}' running at : http://localhost:${port}`))

    return server
}