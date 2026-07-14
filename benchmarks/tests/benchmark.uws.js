const { runBenchmark, sleep } = require('./utils')

const { ServerUWS } = require('../servers/uWS')
const { ServerHyperExpress } = require('../servers/hyper-express')
const { ServerSpearUWS } = require('../servers/spear')


const runApps = async () => {
  const apps = [
    { name: 'uWS', app: ServerUWS },
    { name: 'tspace-spear(uWS)', app: ServerSpearUWS },
    { name: 'hyper-express', app: ServerHyperExpress },
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