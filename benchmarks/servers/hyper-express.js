const HyperExpress = require('hyper-express')
const ServerHyperExpress = ({ name, port, message }) => {
    const server = new HyperExpress.Server();

    server.get('/', (req, res) => {
        return res.send(message)
    })

    server.listen(port, () =>
        console.log(`Server '${name}' running at : http://localhost:${port}`)
    )

    return server
}

module.exports = { ServerHyperExpress }