const { runBenchmark, sleep } = require('./utils')

const { ServerExpress } = require('../servers/express')
const { ServerFastify } = require('../servers/fastify')
const { ServerHttp } = require('../servers/http')
const { ServerElysia } = require('../servers/elysia')
const { ServerSpear } = require('../servers/spear')
const { ServerHono } = require('../servers/hono')
const { Server0Http } = require('../servers/0http')
const { ServerNet } = require('../servers/net')

const runApps = async () => {
  const apps = [
    // base on node
    { name: 'express', app: ServerExpress },
    { name: 'http', app: ServerHttp },
    { name: 'fastify', app: ServerFastify },
    { name: 'tspace-spear', app: ServerSpear },
    { name: '0http', app: Server0Http },
    { name: 'net', app: ServerNet },

    // base on bun
    { name: 'elysia', app: ServerElysia },
    { name: 'hono', app: ServerHono },
  ].map((s, i) => {
    return {
      ...s,
      port: 6000 + i,
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

  console.log(
    '\nuWebSockets.js is not supported in Bun, so it is excluded from this benchmark.\n'
  )

  await runBenchmark(apps)

  await sleep(3000)
  process.exit(0)
}

runApps()