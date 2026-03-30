export const AppHono = ({ name, port, message }: {
  name: string
  port: number
  message: string
}) => {

    const { Hono } = require('hono')
   
    const app = new Hono()

    //@ts-ignore
    app.get('/', (c) => {
        return c.text(message)
    })

    //@ts-ignore
    Bun.serve({
        port,
        fetch: app.fetch
  })

    console.log(`Server '${name}' running at : http://localhost:${port}`)

    return app
}

export const AppHonoNode = ({ name, port, message }: {
  name: string
  port: number
  message: string
}) => {


    const { Hono } = require('hono')
    const { serve } = require('@hono/node-server')

    const app = new Hono()

    //@ts-ignore
    app.get('/', (c) => {
        return c.text(message)
    })

    const server = serve({
        fetch: app.fetch,
        port
    })

    console.log(`Server '${name}' running at : http://localhost:${port}`)

    return server
}