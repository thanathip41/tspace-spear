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

  // Force garbage collection between tests to reduce memory pressure
  if (global.gc) {
    global.gc()
  }

  for (const { name, port } of randomized) {
    const url = getFullURL(port)

    console.log(`\n>>> Starting benchmark for: ${name} at ${url}`)

    // warm-up run - stabilize the server before actual benchmark
    console.log(`    Warming up...`)
    await autocannon({
      url,
      path: '/',
      connections: 10,
      duration: 3,
      pipelining: 1,
      title: `warmup-${name}`,
    })

    // cool-down between warmup and real benchmark
    await sleep(1000)

    // main benchmark run
    console.log(`    Running main benchmark...`)
    const result = await autocannon({
      url,
      path: '/',
      connections,
      duration,
      pipelining,
      title: name,
      verifyBody: false,
      // reduce memory footprint
      excludeErrorStats: false,
    })

    if (!result) {
      console.log(`    ! Failed to get results for ${name}`)
      continue
    }

    const latency = result.latency
    const errorCount = typeof result.errors === 'number' ? result.errors : (result.errors?.total || 0)
    const timeoutCount = typeof result.timeouts === 'number' ? result.timeouts : (result.timeouts?.total || 0)

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

      errors: errorCount,
      timeouts: timeoutCount,
      'throughput(kB/s)': Number((result.throughput.average / 1024).toFixed(2)),
    }

    results.push(ctx)
    console.log(`    Completed: ${name} - ${ctx['req/sec']} req/sec`)

    // cool-down between servers to reduce CPU/memory pressure
    console.log(`    Cooling down...`)
    await sleep(2000)

    // Force garbage collection after each server benchmark
    if (global.gc) {
      global.gc()
    }
  }

  results.forEach((r) => {
    r.score = Math.round(score(r))
  })

  results.sort((a, b) => b.score - a.score)

  console.log('\n=== Benchmark Results (sorted by score) ===\n')
  console.table(results)
}

module.exports = {
  runBenchmark,
  getFullURL,
  sleep,
  shuffle,
}