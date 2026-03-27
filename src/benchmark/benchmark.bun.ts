import { runBenchmark, sleep } from './utils';

import { AppExpress } from './apps/express'
import { AppFastify } from './apps/fastify'
import { AppHttp }    from './apps/http'
import { AppElysia }  from './apps/elysia';
import { AppSpear }   from './apps/spear'


const runApps = async () => {

    const apps = [
        { name: 'express',           app : AppExpress },
        { name: 'http',              app : AppHttp },
        { name: 'fastify',           app : AppFastify },
        { name: 'tspace-spear',      app : AppSpear },
        { name: 'elysia',            app : AppElysia }
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
    console.log('\nuWebSockets.js is not supported in Bun, so it is excluded from this benchmark.\n')
    await runBenchmark(apps)

    await sleep(3000)
    process.exit(0)
}

runApps();



