import autocannon , { Result } from 'autocannon'
import Fastify from 'fastify'
import express, { Request, Response } from 'express'
import http from 'http'
import yargs from 'yargs';
import Spear from "../dist/lib"

const MESSAGE = 'Hello world!'

const { argv } : Record<string,any> = yargs(process.argv.slice(2))
let duration = argv.d || argv.duration
let connections = argv.c || argv.connections
let pipelining = argv.p || argv.pipelining

connections = connections == null ? 100 : Number(connections)
pipelining  = pipelining == null ? 10 : Number(pipelining)
duration    = duration == null ? 10 : Number(duration)

const getURL = (port : number) => `http://localhost:${port}`

const onListen = ({ name , port }: { name: string, port : number }) => {
    console.log(`Server '${name}' running at : http://localhost:${port}`)
}

const sleep = (ms : number) => {
    return new Promise(resolve => setTimeout(resolve, ms,null));
}

const toMs = (v: number) => Number((v / 1000).toFixed(3));

const score = (r: Record<string, any>) => {
  return (
    r["req/sec"] -
    r["p99(ms)"] * 10 -
    r["stddev"] * 5 -
    r["errors"] * 1000
  )
}


function runExpress ({ name , port }: { name: string, port : number }) {
    
    express()
    .get('/', (req: Request, res: Response) => {
        return res.send(MESSAGE);
    })
    .listen(port , () => onListen({name , port}))
}

function runHttp ({ name , port }: { name: string, port : number }) {
   
    const server = http.createServer((req, res) => {
        res.end(MESSAGE);
        return;
    });

    server.listen(port , () => onListen({name , port}))
}

function runFastify ({ name , port }: { name: string, port : number }) {
  
    Fastify()
    .get('/', (request, reply) => {
        return reply
        .send(MESSAGE);
    })
    .listen({ port }, () => onListen({name , port}))
}

function runSpear ({ name , port }: { name: string, port : number }) {
    new Spear()
    .get('/' , () => MESSAGE)
    .listen(port , () => onListen({name , port}))
}

function runSpearUWS ({ name , port }: { name: string, port : number }) {
    try {
        const uWS  = require('uWebSockets.js');
        
        new Spear({ adapter : uWS })
        .get('/' , () => MESSAGE)
        .listen(port , () => onListen({name , port}))

    } catch (err) {
        console.log(`
            Requirements for uWebSockets.js Node.js 18 or higher is required Installation.

            Install via package.json
            "dependencies": {
              "uWebSockets.js": "github:uNetworking/uWebSockets.js#v20.45.0"
            }    
        `)
    }
}
const runBenchmark = async (servers : { name: string, port: number }[]): Promise<void> => {

    const results: any[] = []
    const randomized = shuffle(servers)

    for (const { name, port } of randomized) {

        const url = getURL(port)
        const result = await new Promise((resolve, reject) => {
            autocannon({
                url,
                connections,
                duration,
                pipelining
            }, (err, result) => {

                if (err) return reject(err)
                
                return resolve(result)

            })
        })
        .catch(() => null) as unknown as Result;

        if(result == null) continue;

        const latency = result.latency

        let ctx = {
            name,
            url,

            // Core throughput
            [`reqs(${duration}s)`]: result.requests.total,
            "req/sec": Number(result.requests.average.toFixed(0)),

            // Latency
            "avg(ms)": toMs(latency.average),
            "p50(ms)": toMs(latency.p50),
            "p99(ms)": toMs(latency.p99),
            "max(ms)": toMs(latency.max),

            // Stability
            "stddev": Number(latency.stddev.toFixed(2)),

            "errors": result.errors,
            "timeouts": result.timeouts,
            "throughput(kB/s)": Number((result.throughput.average / 1024).toFixed(2))
        }

        results.push(ctx)
    }

    results.forEach(r => {
        r.score = Math.round(score(r))
    })

    results.sort((a, b) => b.score - a.score)

    console.log("\n🚀 Benchmark Config")
    console.log("-------------------")
    console.log(`connections : ${connections}`)
    console.log(`pipelining  : ${pipelining}`)
    console.log(`duration    : ${duration}s`)
    console.log("-------------------\n")

    console.log("📊 Metrics Guide:")
    console.log("req/sec  → throughput (higher is better)")
    console.log("avg      → average latency (can be misleading)")
    console.log("p50      → typical latency (median)")
    console.log("p99      → slow latency users actually feel (IMPORTANT)")
    console.log("max      → slowest request (outlier, for debugging)")
    console.log("stddev   → stability (lower is better)")
    console.log("errors   → should be 0")
    console.log("timeouts → should be 0")
    console.log("-------------------\n")

    // winner
    const winner = results[0]
    if (winner) {
        console.log(
        `🏆 Fastest: ${winner.name} → (${winner["req/sec"]} req/sec)\n`
        )
    }

    console.table(results)
}

const shuffle = <T>(arr: T[]): T[] => {
    const a = [...arr];

    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }

    return a;
};

async function runApps() {

    const servers = [
        { name: 'express',               port: 3000, app : runExpress },
        { name: 'http',                  port: 3001, app : runHttp },
        { name: 'fastify',               port: 3002, app : runFastify},
        { name: 'tspace-spear',          port: 3003, app : runSpear },
        { name: 'tspace-spear(uWs)',     port: 3004, app : runSpearUWS}
    ];

    await Promise.all(servers.map(v => v.app({ name: v.name, port: v.port })))

    await sleep(5000)
    console.log('benchmarking !!')
    await runBenchmark(servers)

    console.log('benchmarking done !!')
}

runApps()



