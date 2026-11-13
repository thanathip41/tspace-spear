const uWS = require('uWebSockets.js');

const ServerUWS = ({ name , port , message }) => {
    try {
        
        uWS._cfg('silent');

        const app = uWS.App();

        app.get('/', new uWS.DeclarativeResponse().end(message));

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

module.exports = { ServerUWS }