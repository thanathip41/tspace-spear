const express = require('express')
const ServerExpress = ({ name, port, message }) => {
    const server = express();

    server.get('/', (req, res) => {
        return res.send(message)
    })

    server.listen(port, () =>
        console.log(`Server '${name}' running at : http://localhost:${port}`)
    )

    return server
}

module.exports = { ServerExpress }