# 🚀 tspace-benchmark

A high-performance benchmarking suite for comparing HTTP servers and frameworks in the Node.js ecosystem.

---

## 📌 About

This project is designed to evaluate the real-world performance of different HTTP server implementations under load.

It focuses on measuring:

- ⚡ Throughput (requests per second)
- ⏱ Latency (avg, p50, p99, max)
- 📊 Stability (standard deviation)
- ❌ Reliability (errors, timeouts)

The goal is to provide a fair and reproducible comparison between popular frameworks and low-level implementations.

---

## 🧪 Tested Implementations

- **tspace-spear (uWebSockets.js adapter)** — ultra high performance (C++ based)
- **tspace-spear** — custom HTTP implementation
- **Node.js HTTP (native)** — baseline performance
- **Fastify** — fast and production-ready framework
- **Elysia (Node adapter)** — Bun-first framework running on Node
- **Express** — widely used traditional framework

---

## ⚙️ Benchmark Configuration

```bash
connections : 100
pipelining  : 10
duration    : 10s

```

## 🚀 How to Run
1️⃣ Prerequisites

Make sure you have the following installed:

Node.js (v20+ recommended, v22 used in tests)
Bun (latest version, v1.3.1 used in tests)

2️⃣ Install Dependencies

```bash
npm install
```

3️⃣ Run Benchmarks

🟢 Node.js benchmark
```bash
npm run benchmark:node
```

🟡 Bun benchmark
```bash
npm run benchmark:bun
```

## 📂 Project Structure

```bash
benchmark/
  ├──apps
    ├── elysia.ts
    ├── fastify.ts
    ├── express.ts
    ├── http.ts
    ├── spear.ts

⚠️ Notes
All frameworks return a simple string response
Logging is disabled during benchmarking
Results may vary depending on:
    CPU / hardware
    Node.js version
    OS environment
    🔥 Conclusion

Maximum performance → tspace-spear adaoter(uWebSockets.js)
Best balance → Fastify
Simple baseline → native HTTP
Modern DX → Elysia (best on Bun, not Node)
```