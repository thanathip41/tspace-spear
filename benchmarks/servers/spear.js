const { Spear } = require('../../dist/lib')
const net = require('net')

const ServerSpear =({ name, port, message }) => {
    const server = new Spear()
    server.get('/' , () => message)
    server.listen(port , () => console.log(`Server '${name}' running at : http://localhost:${port}`))

    return server;
}

const ServerSpearNet =({ name, port, message }) => {
    const server = new Spear({ adapter : net })
    server.get('/' , () => message)
    server.listen(port , () => console.log(`Server '${name}' running at : http://localhost:${port}`))

    return server;
}

const ServerSpearUWS = ({ name, port, message }) => {
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

module.exports = {
  ServerSpear,
  ServerSpearUWS,
  ServerSpearNet
}