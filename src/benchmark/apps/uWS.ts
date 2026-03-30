export const AppUWS = ({ name , port , message }: { 
    name   : string; 
    port   : number; 
    message: string;
}) => {
    try {
        
        const uWS  = require('uWebSockets.js');
        
        const app = uWS.App();

        //@ts-ignore
        app.get('/', (res) => {
            res.end(message);
            return;
        });

        app.listen(port, () => console.log(`Server '${name}' running at : http://localhost:${port}`));

        return app;

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