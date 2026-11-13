const express = require('fulmine.js');

const ServerFulmine = ({ name, port, message }) => {
    
    const server = express();

    server.set('etag', false);
    
    server.set('connection headers', false);
   
    server.set('declarative request values', true);

    server.get('/', (req, res) => {
        res.end(message)
    })

    server.listen(port, () =>
        console.log(`Server '${name}' running at : http://localhost:${port}`)
    )

    return server
}

module.exports = { ServerFulmine }