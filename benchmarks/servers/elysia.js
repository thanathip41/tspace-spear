const { Elysia } = require('elysia');
const { node } = require('@elysiajs/node');

const ServerElysia = ({ name, port, message }) => {
 
  const server = new Elysia()

  server.get('/', () => message)

  server.listen(port, () =>
    console.log(`Server '${name}' running at : http://localhost:${port}`)
  )

  return server
}

// require Node 22
const ServerElysiaNode = ({ name, port, message }) => {
    
  const server = new Elysia({ adapter: node() })

  server.get('/', () => message)

  server.listen(port, () =>
    console.log(`Server '${name}' running at : http://localhost:${port}`)
  )

  return server
}

module.exports = {
  ServerElysia,
  ServerElysiaNode,
}