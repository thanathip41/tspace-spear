import { Spear } from "../../lib"

export const AppSpear = ({ name , port , message }: { 
    name   : string; 
    port   : number; 
    message: string;
}) => {
    const server = new Spear()
    server.get('/' , () => message)
    server.listen(port , () => console.log(`Server '${name}' running at : http://localhost:${port}`))

    return server;
}

export const AppSpearUWS = ({ name , port , message }: { 
    name   : string; 
    port   : number; 
    message: string;
}) => {
    try {
        const uWS  = require('uWebSockets.js');
        
        const server = new Spear({ adapter : uWS })
        
        server.get('/' , () => message)
        
        server.listen(port , () =>  console.log(`Server '${name}' running at : http://localhost:${port}`))

        return server;

    } catch (err) {
        console.log(`
            Requirements for uWebSockets.js Node.js 18 or higher is required Installation.

            Install via package.json
            "dependencies": {
              "uWebSockets.js": "github:uNetworking/uWebSockets.js#v20.76.0"
            }    
        `)
    }
}