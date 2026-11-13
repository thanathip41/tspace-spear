const { runBenchmark, sleep } = require('./utils')

const { ServerUWS } = require('../servers/uWS')
const { ServerHyperExpress } = require('../servers/hyper-express')
const { ServerSpearUWS } = require('../servers/spear')
const { ServerMesh } = require('../servers/mesh')
const { ServerFulmine } = require('../servers/fulmine')
const { ServerUltimateExpress }  = require('../servers/ultimate-express')


const runApps = async () => {
  const apps = [
    { name: 'uWS', app: ServerUWS },
    { name: 'tspace-spear(uWS)', app: ServerSpearUWS },
    { name: 'hyper-express', app: ServerHyperExpress },
    { name: 'mesh' , app : ServerMesh },
    { name : 'fulmine', app : ServerFulmine },
    { name : 'ultimate-express' , app : ServerUltimateExpress }
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