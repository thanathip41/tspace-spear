const express = require('express')
const ServerExpress = ({ name, port, message }) => {
    const server = express();

    server.set('etag', false);
    server.set('x-powered-by', false);

    server.get('/', (req, res) => {
        return res.end(message)
    })

    server.listen(port, () =>
        console.log(`Server '${name}' running at : http://localhost:${port}`)
    )

    return server
}

module.exports = { ServerExpress }