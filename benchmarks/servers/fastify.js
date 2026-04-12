const fastify = require('fastify');
const ServerFastify = ({ name, port, message }) => {
  
  const server = fastify()

  server.get('/', () => message)

  server.listen({ port }, () =>
    console.log(`Server '${name}' running at : http://localhost:${port}`)
  )

  return server
}

module.exports = { ServerFastify }