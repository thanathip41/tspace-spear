const autocannon = require('autocannon')

const connections = 100
const pipelining = 10
const duration = 10

const getFullURL = (port) => `http://localhost:${port}`

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const toMs = (v) => Number((v / 1000).toFixed(3))

const score = (r) => {
  return (
    r['req/sec'] -
    r['p99(ms)'] * 10 -
    r['stddev'] * 5 -
    r['errors'] * 1000
  )
}

const shuffle = (arr) => {
  const a = [...arr]

  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }

  return a
}

const runBenchmark = async (apps) => {
  const results = []
  const randomized = shuffle(apps)

  for (const { name, port } of randomized) {
    const url = getFullURL(port)

    // warm-up run
    await new Promise((resolve, reject) => {
      autocannon(
        {
          url,
          connections: 2,
          duration: 5,
          pipelining: 1,
        },
        (err) => {
          if (err) return reject(err)
          resolve(true)
        }
      )
    }).catch(() => null)

    await sleep(1000)

    // main benchmark
    const result = await new Promise((resolve, reject) => {
      autocannon(
        {
          url,
          connections,
          duration,
          pipelining,
        },
        (err, result) => {
          if (err) return reject(err)
          resolve(result)
        }
      )
    }).catch(() => null)

    if (!result) continue

    const latency = result.latency

    const ctx = {
      name,
      url,

      // Core throughput
      [`reqs(${duration}s)`]: result.requests.total,
      'req/sec': Number(result.requests.average.toFixed(0)),

      // Latency
      'avg(ms)': toMs(latency.average),
      'p50(ms)': toMs(latency.p50),
      'p99(ms)': toMs(latency.p99),
      'max(ms)': toMs(latency.max),

      // Stability
      stddev: Number(latency.stddev.toFixed(2)),

      errors: result.errors,
      timeouts: result.timeouts,
      'throughput(kB/s)': Number((result.throughput.average / 1024).toFixed(2)),
    }

    results.push(ctx)
  }

  results.forEach((r) => {
    r.score = Math.round(score(r))
  })

  results.sort((a, b) => b.score - a.score)

  console.table(results)
}

module.exports = {
  runBenchmark,
  getFullURL,
  sleep,
  shuffle,
}