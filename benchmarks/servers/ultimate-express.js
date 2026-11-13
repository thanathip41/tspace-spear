const ultimateExpress = require('ultimate-express')
const ServerUltimateExpress = ({ name, port, message }) => {

    const server = ultimateExpress();

    server.set('etag', false);
    server.set('x-powered-by', false);

    server.get('/', (req, res) => {
        res.end(message)
    })

    server.listen(port, () =>
        console.log(`Server '${name}' running at : http://localhost:${port}`)
    )

    return server
}

module.exports = { ServerUltimateExpress }