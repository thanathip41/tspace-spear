import autocannon , { Result } from 'autocannon'

const connections =  100
const pipelining  = 10
const duration    = 10

export const getURL = (port : number) => `http://localhost:${port}`

export const sleep = (ms : number) => {
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

export const shuffle = <T>(arr: T[]): T[] => {
    const a = [...arr];

    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }

    return a;
};

export const runBenchmark = async (
    apps: { name: string, port: number }[]
): Promise<void> => {

    const results: any[] = []
    const randomized = shuffle(apps)

    for (const { name, port } of randomized) {

        const url = getURL(port)

        await new Promise((resolve, reject) => {
            autocannon({
                url,
                connections: Math.max(1, Math.floor(connections / 2)),
                duration: Math.max(2, Math.floor(duration / 5)),
                pipelining: 1,
                workers: 1,
                headers: {
                    connection: 'close'
                }
            }, (err) => {
                if (err) return reject(err)
                resolve(true)
            })
        }).catch(() => null)

        await sleep(500)

        const result = await new Promise((resolve, reject) => {
            autocannon({
                url,
                connections,
                duration,
                pipelining,
                workers: 1,
                headers: {
                    connection: 'close'
                }
            }, (err, result) => {
                if (err) return reject(err);
                return resolve(result);
            })
        })
        .catch(() => null) as unknown as Result;

        if (result == null) continue;

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

    console.table(results)
}
