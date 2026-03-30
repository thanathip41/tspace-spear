import { runBenchmark, sleep }   from './utils';

import { AppSpear }        from './apps/spear';
import { AppSpearUWS }     from './apps/spear';
import { AppExpress }      from './apps/express';
import { AppFastify }      from './apps/fastify';
import { AppHttp }         from './apps/http';
import { AppElysiaNode }   from './apps/elysia';
import { AppUWS }          from './apps/uWS';
import { AppHyperExpress } from './apps/hyper-express';
import { AppHonoNode }     from './apps/hono';
import { App0Http }        from './apps/0http';

const runApps = async () => {

    const apps = [
        // bese on uWS
        { name: 'tspace-spear(uWS)', app : AppSpearUWS }, // but return like http
        { name: 'uWS' ,              app : AppUWS },
        { name: 'hyper-express',     app : AppHyperExpress },

        // base on http
        { name: 'express',           app : AppExpress },
        { name: 'http',              app : AppHttp },
        { name: 'fastify',           app : AppFastify },
        { name: 'tspace-spear',      app : AppSpear },
        { name: 'elysia(node)',      app : AppElysiaNode },
        { name: 'hono(node)',        app: AppHonoNode },
        { name: '0http',             app : App0Http }
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



