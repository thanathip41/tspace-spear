const { App } = require('@ionited/mesh')
const ServerMesh = ({ name, port, message }) => {
    const server = new App();

    server.get('/', (req, res) => {
        return res.send(message)
    })

    server.listen(port, () =>
        console.log(`Server '${name}' running at : http://localhost:${port}`)
    )

    return server
}

module.exports = { ServerMesh }