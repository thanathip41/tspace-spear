const { runBenchmark, sleep } = require('./utils')

const { ServerUWS } = require('../servers/uWS')
const { ServerExpress } = require('../servers/express')
const { ServerFastify } = require('../servers/fastify')
const { ServerHttp } = require('../servers/http')
const { ServerElysiaNode } = require('../servers/elysia')
const { ServerHonoNode } = require('../servers/hono')
const { 
  ServerSpear, 
  ServerSpearNet, 
  ServerSpearUWS 
} = require('../servers/spear')

const runApps = async () => {
  const apps = [
    // base on uWS
    { name: 'tspace-spear(uWS)', app: ServerSpearUWS },
    { name: 'uWS', app: ServerUWS },

    // // base on http
    { name: 'tspace-spear(net)', app: ServerSpearNet },
    { name: 'tspace-spear', app: ServerSpear },
    { name: 'express', app: ServerExpress },
    { name: 'http', app: ServerHttp },
    { name: 'fastify', app: ServerFastify },
   
    // // base on bun
    { name: 'elysia(node)', app: ServerElysiaNode },
    { name: 'hono(node)', app: ServerHonoNode },
  ]
    .sort(() => Math.random() - 0.5)
    .map((s, i) => {
      return {
        ...s,
        port: 5000 + i,
      }
    })

  await Promise.all(
    apps.map((v) =>
      v.app({
        name: v.name,
        port: v.port,
        message: 'Hello world!',
      })
    )
  )

  await sleep(5000)
  await runBenchmark(apps)

  await sleep(3000)

  process.exit(0)
}

runApps()