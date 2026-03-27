import { runBenchmark, sleep } from './utils';

import { AppExpress } from './apps/express'
import { AppFastify } from './apps/fastify'
import { AppHttp }    from './apps/http'
import { 
    AppSpear, 
    AppSpearUWS 
} from './apps/spear'
import { AppElysiaNode } from './apps/elysia';

const runApps = async () => {

    const apps = [
        { name: 'express',           app : AppExpress },
        { name: 'http',              app : AppHttp },
        { name: 'fastify',           app : AppFastify },
        { name: 'tspace-spear',      app : AppSpear },
        { name: 'tspace-spear(uWS)', app : AppSpearUWS },
        { name: 'elysia(node)',      app : AppElysiaNode }
    ].map((s,i) => {
        return {
            ...s,
            port: 3000 + i
        }
    })

    await Promise.all(
        apps.map(v =>
            v.app({
                name: v.name,
                port: v.port,
                message: 'Hello world!'
            })
        )
    )

    await sleep(5000)
    await runBenchmark(apps)

    await sleep(3000)
    
    process.exit(0)
}

runApps();



