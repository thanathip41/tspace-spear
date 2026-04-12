const cero = require('0http');
const Server0Http = ({ name, port, message }) => {

  const { router, server } = cero()

  router.get('/', (req, res) => {
    res.end(message)
    return
  })

  server.listen(port, () =>
    console.log(`Server '${name}' running at : http://localhost:${port}`)
  )

  return server
}

module.exports = { Server0Http }