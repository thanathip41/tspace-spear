const { runBenchmark, sleep } = require('./utils')

const { ServerSpear } = require('../servers/spear')
const { ServerSpearUWS } = require('../servers/spear')
const { ServerSpearNet } = require('../servers/spear')
const { ServerExpress } = require('../servers/express')
const { ServerFastify } = require('../servers/fastify')
const { ServerHttp } = require('../servers/http')
const { ServerElysiaNode } = require('../servers/elysia')
const { ServerUWS } = require('../servers/uWS')
const { ServerHonoNode } = require('../servers/hono')
const { Server0Http } = require('../servers/0http')
const { ServerNet } = require('../servers/net')

const runApps = async () => {
  const apps = [
    // base on uWS
    { name: 'tspace-spear(uWS)', app: ServerSpearUWS },
    // { name: 'uWS', app: ServerUWS },

    // base on http
    { name: 'tspace-spear', app: ServerSpear },
    { name: 'tspace-spear(net)', app: ServerSpearNet },
    // { name: 'express', app: ServerExpress },
    { name: 'http', app: ServerHttp },
    { name: 'fastify', app: ServerFastify },
   
    { name: 'elysia(node)', app: ServerElysiaNode },
    { name: 'hono(node)', app: ServerHonoNode },
    // { name: '0http', app: Server0Http },
    // { name: 'net', app: ServerNet },
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