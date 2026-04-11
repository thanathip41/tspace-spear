import http from "http";

export const AppHttp = ({ name , port , message }: { 
    name   : string; 
    port   : number; 
    message: string;
}) => {
   
    const server = http.createServer((req, res) => {
        if (req.url === "/" && req.method === "GET") {
            return res.end(message);
        } 

        res.statusCode = 404;

        return res.end("Not Found");
        
    });

    server.listen(port , () => console.log(`Server '${name}' running at : http://localhost:${port}`))

    return server
}