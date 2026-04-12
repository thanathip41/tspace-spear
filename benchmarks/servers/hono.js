const { Hono } = require('hono');
const { serve } = require('@hono/node-server');

const ServerHono = ({ name, port, message }) => {
 

  const app = new Hono()

  app.get('/', (c) => {
    return c.text(message)
  })

  // Bun runtime server
  Bun.serve({
    port,
    fetch: app.fetch,
  })

  console.log(`Server '${name}' running at : http://localhost:${port}`)

  return app
}

const ServerHonoNode = ({ name, port, message }) => {
    
  const app = new Hono()

  app.get('/', (c) => {
    return c.text(message)
  })

  const server = serve({
    fetch: app.fetch,
    port,
  })

  console.log(`Server '${name}' running at : http://localhost:${port}`)

  return server
}

module.exports = {
  ServerHono,
  ServerHonoNode,
}