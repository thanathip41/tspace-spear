 # Streaming with Async Generators - tspace-spear
 
 > **📖 Guide:** Learn how to use async generators with `yield` for streaming responses in tspace-spear. This enables real-time data streaming, progress updates, and efficient handling of large datasets.
 
 ## Overview
 
 tspace-spear supports **async generator functions** that use `yield` to stream data progressively to clients. This is perfect for:
 
 - 📊 Real-time progress tracking
 - 📡 Server-Sent Events (SSE)
 - 📄 Large dataset pagination
 - 🔄 Live data feeds
 - 📹 Video/audio streaming
 - 📝 Log streaming
 
 ## Basic Concept
 
 Async generators are functions declared with `async function*` or `async *` that can `yield` values over time. The framework automatically converts these into streaming HTTP responses.
 
 ```typescript
 async function* generateData() {
   for (let i = 1; i <= 5; i++) {
     await delay(1000);
     yield { progress: i * 20, message: `Step ${i}` };
   }
 }
 ```
 
 ---
 
 ## Quick Start
 
 ### Simple Stream Route
 
 ```typescript
 import Spear from "tspace-spear";
 
 function delay(ms: number) {
   return new Promise(resolve => setTimeout(resolve, ms));
 }
 
 const app = new Spear()
   .get('/stream', async function* () {
     for (let i = 1; i <= 5; i++) {
       await delay(1000); // Wait 1 second
       yield { 
         progress: i * 20, 
         message: `Processing ${i}/5` 
       };
     }
   });
 
 app.listen(8000);
 ```
 
 **Client receives:**
 ```json
 {"progress":20,"message":"Processing 1/5"}
 {"progress":40,"message":"Processing 2/5"}
 {"progress":60,"message":"Processing 3/5"}
 {"progress":80,"message":"Processing 4/5"}
 {"progress":100,"message":"Processing 5/5"}
 ```
 
 ---
 
 ## Using Controllers
 
 ### Basic Controller Stream
 
 ```typescript
 import { Controller, Get, type T } from "tspace-spear";
 
 @Controller("/stream")
 class StreamController {
   @Get("/numbers")
   async *numbers() {
     for (let i = 1; i <= 10; i++) {
       yield { number: i };
     }
   }
 }
 
 // Usage in app
 import Spear from "tspace-spear";
 
 const app = new Spear({
   controllers: [StreamController]
 });
 ```
 
 ### Progress Tracking with Dependencies
 
 ```typescript
 import { Controller, Get, Dependencies, type T } from "tspace-spear";
 
 class ProcessingService {
   async *process(items: string[]) {
     const total = items.length;
     
     for (let i = 0; i < total; i++) {
       // Simulate processing
       await new Promise(resolve => setTimeout(resolve, 500));
       
       yield {
         current: i + 1,
         total,
         progress: Math.round(((i + 1) / total) * 100),
         item: items[i],
         status: 'completed'
       };
     }
   }
 }
 
 @Controller("/process")
 class ProcessController {
   constructor(private processingService: ProcessingService) {}
 
   @Get("/batch")
   async *processBatch() {
     const items = ["item1", "item2", "item3", "item4", "item5"];
     
     for await (const result of this.processingService.process(items)) {
       yield result;
     }
   }
 }
 
 const app = new Spear({
   controllers: [ProcessController],
   providers: [ProcessingService]
 });
 ```
 
 ---
 
 ## Advanced Patterns
 
 ### 1. Delayed Streaming with Timestamps
 
 ```typescript
 @Controller("/stream")
 class StreamController {
   @Get("/delayed")
   async *delayed() {
     for (let i = 1; i <= 5; i++) {
       yield { 
         chunk: i, 
         timestamp: Date.now() 
       };
       await new Promise(resolve => setTimeout(resolve, 100));
     }
   }
 }
 ```
 
 **Client receives:**
 ```json
 {"chunk":1,"timestamp":1709876543210}
 {"chunk":2,"timestamp":1709876543310}
 {"chunk":3,"timestamp":1709876543410}
 ```
 
 ### 2. Large Dataset Streaming
 
 ```typescript
 @Controller("/data")
 class DataController {
   @Get("/large")
   async *largeDataset() {
     for (let i = 0; i < 1000; i++) {
       yield { 
         item: `Item ${i}`, 
         data: "x".repeat(100) 
       };
       
       // Yield control back to event loop periodically
       if (i % 100 === 0) {
         await new Promise(resolve => setImmediate(resolve));
       }
     }
   }
 }
 ```
 
 ### 3. Database Query Streaming
 
 ```typescript
 import { Controller, Get } from "tspace-spear";
 import { getDatabase } from "./db";
 
 @Controller("/users")
 class UserController {
   @Get("/stream")
   async *streamUsers() {
     const db = getDatabase();
     const query = db.query('SELECT * FROM users');
     
     for await (const row of query) {
       yield {
         id: row.id,
         name: row.name,
         email: row.email
       };
     }
   }
 }
 ```
 
 ### 4. File Processing Stream
 
 ```typescript
 import { Controller, Post, T } from "tspace-spear";
 import { createReadStream } from "fs";
 import { pipeline } from "stream/promises";
 
 @Controller("/files")
 class FileController {
   @Post("/process")
   async *processFile({ body }: T.Context<{ body: { filePath: string } }>) {
     const stream = createReadStream(body.filePath);
     
     let lineNumber = 0;
     let buffer = "";
     
     for await (const chunk of stream) {
       buffer += chunk.toString();
       const lines = buffer.split("\n");
       buffer = lines.pop() || "";
       
       for (const line of lines) {
         lineNumber++;
         yield {
           line: lineNumber,
           content: line,
           processed: true
         };
       }
     }
   }
 }
 ```
 
 ### 5. Error Handling in Streams
 
 ```typescript
 @Controller("/stream")
 class StreamController {
   @Get("/error")
   async *withError() {
     try {
       for (let i = 1; i <= 5; i++) {
         if (i === 3) {
           throw new Error("Processing failed at step 3");
         }
         yield { chunk: i, status: "success" };
       }
     } catch (error) {
       yield { 
         error: true, 
         message: error.message,
         recovered: true 
       };
     }
   }
 }
 ```
 
 ### 6. Conditional Streaming
 
 ```typescript
 @Controller("/stream")
 class StreamController {
   @Get("/conditional")
   async *conditional({ query }: T.Context<{ query: { limit?: number } }>) {
     const limit = query.limit || 10;
     let count = 0;
     
     const dataStream = this.generateInfiniteData();
     
     for await (const item of dataStream) {
       if (count >= limit) {
         break;
       }
       yield item;
       count++;
     }
   }
   
   private async *generateInfiniteData() {
     let i = 0;
     while (true) {
       i++;
       yield { id: i, value: `Item ${i}` };
       await new Promise(resolve => setTimeout(resolve, 100));
     }
   }
 }
 ```
 
 ### 7. Multiple Yield Sources
 
 ```typescript
 @Controller("/stream")
 class StreamController {
   @Get("/merged")
   async *mergedStreams() {
     const stream1 = this.numbers(1, 3);
     const stream2 = this.letters();
     const stream3 = this.symbols();
     
     // Yield from multiple sources
     for await (const item of stream1) yield item;
     for await (const item of stream2) yield item;
     for await (const item of stream3) yield item;
   }
   
   private async *numbers(start: number, end: number) {
     for (let i = start; i <= end; i++) {
       yield { type: "number", value: i };
       await new Promise(resolve => setTimeout(resolve, 50));
     }
   }
   
   private async *letters() {
     for (const letter of ["a", "b", "c"]) {
       yield { type: "letter", value: letter };
       await new Promise(resolve => setTimeout(resolve, 50));
     }
   }
   
   private async *symbols() {
     for (const symbol of ["!", "@", "#"]) {
       yield { type: "symbol", value: symbol };
       await new Promise(resolve => setTimeout(resolve, 50));
     }
   }
 }
 ```
 
 ---
 
 ## Client-Side Consumption
 
 ### Using Fetch API
 
 ```typescript
 async function consumeStream() {
   const response = await fetch('http://localhost:8000/stream/numbers');
   const reader = response.body.getReader();
   const decoder = new TextDecoder();
   
   while (true) {
     const { value, done } = await reader.read();
     
     if (done) break;
     
     const text = decoder.decode(value);
     const lines = text.split('\\n').filter(line => line.trim());
     
     for (const line of lines) {
       const data = JSON.parse(line);
       console.log('Received:', data);
     }
   }
 }
 ```
 
 ### Using tspace-spear ApiClient
 
 ```typescript
 import { ApiClient } from "tspace-spear/client";
 import app from "./server";
 
 const client = new ApiClient<typeof app.contract>('http://localhost:8000');
 
 async function consumeStream() {
   const res = await client.get('/stream/numbers');
   
   if (res.ok && res.data instanceof ReadableStream) {
     const reader = res.data.getReader();
     const decoder = new TextDecoder();
     
     while (true) {
       const { value, done } = await reader.read();
       if (done) break;
       
       const text = decoder.decode(value);
       const lines = text.split('\\n').filter(line => line.trim());
       
       for (const line of lines) {
         const data = JSON.parse(line);
         console.log('Received:', data);
       }
     }
   }
 }
 ```
 
 ### Helper Function for Stream Reading
 
 ```typescript
 async function streamValues(data: ReadableStream) {
   const values: any[] = [];
   const reader = data.getReader();
   const decoder = new TextDecoder();
   
   while (true) {
     const { value, done } = await reader.read();
     
     if (done) break;
     
     const text = decoder.decode(value, { stream: true });
     const lines = text.split('\\n');
     
     for (const line of lines) {
       if (!line.trim()) continue;
       const data = JSON.parse(line);
       values.push(data);
     }
   }
   
   return values;
 }
 
 // Usage
 const res = await client.get('/stream/numbers');
 const values = await streamValues(res.data);
 console.log(values); // [{ number: 1 }, { number: 2 }, ...]
 ```
 
 ---
 
 ## Server-Sent Events (SSE)
 
 ```typescript
 @Controller("/events")
 class EventController {
   @Get("/sse")
   async *serverSentEvents() {
     // Set SSE headers
     // Note: Framework handles this automatically for async generators
     
     for (let i = 1; i <= 10; i++) {
       yield {
         event: "message",
         data: { count: i },
         id: i
       };
       await new Promise(resolve => setTimeout(resolve, 1000));
     }
   }
 }
 ```
 
 **Client-side:**
 ```typescript
 const eventSource = new EventSource('http://localhost:8000/events/sse');
 
 eventSource.onmessage = (event) => {
   const data = JSON.parse(event.data);
   console.log('Event received:', data);
 };
 ```
 
 ---
 
 ## Real-World Examples
 
 ### 1. Build Process Progress
 
 ```typescript
 @Controller("/build")
 class BuildController {
   @Post("/start")
   async *startBuild({ body }: T.Context<{ body: { projectId: string } }>) {
     const steps = [
       'Initializing...',
       'Compiling TypeScript...',
       'Running tests...',
       'Building assets...',
       'Deploying...',
       'Complete!'
     ];
     
     for (let i = 0; i < steps.length; i++) {
       yield {
         step: i + 1,
         total: steps.length,
         message: steps[i],
         progress: Math.round(((i + 1) / steps.length) * 100),
         timestamp: Date.now()
       };
       
       // Simulate build time
       await new Promise(resolve => setTimeout(resolve, 2000));
     }
   }
 }
 ```
 
 ### 2. Real-time Analytics
 
 ```typescript
 @Controller("/analytics")
 class AnalyticsController {
   @Get("/live")
   async *liveAnalytics() {
     while (true) {
       const metrics = {
         activeUsers: Math.floor(Math.random() * 1000),
         requestsPerSecond: Math.floor(Math.random() * 500),
         avgResponseTime: Math.floor(Math.random() * 200),
         timestamp: Date.now()
       };
       
       yield metrics;
       await new Promise(resolve => setTimeout(resolve, 5000));
     }
   }
 }
 ```
 
 ### 3. Search Results Streaming
 
 ```typescript
 @Controller("/search")
 class SearchController {
   @Get("/stream")
   async *streamSearch({ query }: T.Context<{ query: { q: string } }>) {
     const results = await this.searchService.search(query.q);
     
     let count = 0;
     for await (const result of results) {
       count++;
       yield {
         rank: count,
         result,
         hasMore: count < results.total
       };
     }
   }
 }
 ```
 
 ### 4. Log Streaming
 
 ```typescript
 @Controller("/logs")
 class LogController {
   @Get("/stream")
   async *streamLogs({ query }: T.Context<{ query: { service?: string } }>) {
     const logStream = this.logService.tail(query.service);
     
     for await (const log of logStream) {
       yield {
         timestamp: log.timestamp,
         level: log.level,
         service: log.service,
         message: log.message,
         metadata: log.metadata
       };
     }
   }
 }
 ```
 
 ---
 
 ## Testing Stream Endpoints
 
 ```typescript
 import { describe, it, before, after } from "mocha";
 import { expect } from "chai";
 import { Spear, Controller, Get } from "tspace-spear";
 import { ApiClient } from "tspace-spear/client";
 
 @Controller("/stream")
 class TestStreamController {
   @Get("/test")
   async *test() {
     for (let i = 1; i <= 3; i++) {
       yield { value: i };
     }
   }
 }
 
 describe("Stream Tests", () => {
   let app, server, client;
   
   before((done) => {
     app = new Spear({ controllers: [TestStreamController] });
     app.listen(3001, ({ port, server: s }) => {
       server = s;
       client = new ApiClient(`http://localhost:${port}`);
       done();
     });
   });
   
   after((done) => {
     server.close(done);
   });
   
   it("should stream values correctly", async () => {
     const res = await client.get("/stream/test");
     
     expect(res.ok).to.be.true;
     expect(res.data).to.be.instanceOf(ReadableStream);
     
     const values = await streamValues(res.data);
     expect(values).to.deep.equal([
       { value: 1 },
       { value: 2 },
       { value: 3 }
     ]);
   });
 });
 ```
 
 ---
 
 ## Best Practices
 
 ### 1. Handle Client Disconnection
 
 ```typescript
 async *streamWithAbort() {
   try {
     for (let i = 1; i <= 100; i++) {
       // Check if client disconnected (framework handles this)
       yield { progress: i };
       await new Promise(resolve => setTimeout(resolve, 100));
     }
   } catch (error) {
     if (error.name === 'AbortError') {
       console.log('Client disconnected');
       return;
     }
     throw error;
   }
 }
 ```
 
 ### 2. Memory Management
 
 ```typescript
 // ✅ Good: Yield items one at a time
 async *goodExample() {
   for (let i = 0; i < 1000000; i++) {
     yield { id: i };
     if (i % 1000 === 0) {
       await new Promise(resolve => setImmediate(resolve));
     }
   }
 }
 
 // ❌ Bad: Load everything into memory
 async *badExample() {
   const allData = await loadAllData(); // Loads 1M items into memory
   for (const item of allData) {
     yield item;
   }
 }
 ```
 
 ### 3. Error Boundaries
 
 ```typescript
 async *withErrorHandling() {
   try {
     for await (const item of this.dataSource()) {
       yield { success: true, data: item };
     }
   } catch (error) {
     yield { 
       success: false, 
       error: error.message 
     };
   }
 }
 ```
 
 ### 4. Rate Limiting
 
 ```typescript
 async *rateLimited() {
   const startTime = Date.now();
   let count = 0;
   
   for await (const item of this.fastSource()) {
     count++;
     yield item;
     
     // Limit to 100 items per second
     const elapsed = Date.now() - startTime;
     const expectedTime = (count / 100) * 1000;
     if (elapsed < expectedTime) {
       await new Promise(resolve => 
         setTimeout(resolve, expectedTime - elapsed)
       );
     }
   }
 }
 ```
 
 ---
 
 ## Technical Details
 
 ### How It Works
 
 1. **Async Generator Detection**: Framework detects `async function*` or functions returning `AsyncIterable`
 2. **Response Headers**: Automatically sets appropriate headers:
    - `Content-Type: application/x-ndjson; charset=utf-8`
    - `Cache-Control: no-cache, no-transform`
    - `X-Accel-Buffering: no`
 3. **Streaming**: Each `yield` value is:
    - Stringified to JSON
    - Appended with newline (`\\n`)
    - Sent to client immediately
 4. **Backpressure**: Framework handles backpressure automatically
 5. **Connection Management**: Cleans up when client disconnects
 
 ### Response Format
 
 Each yielded value is sent as **NDJSON (Newline Delimited JSON)**:
 
 ```
 {"progress":20}
 {"progress":40}
 {"progress":60}
 {"progress":80}
 {"progress":100}
 ```
 
 ### Performance Considerations
 
 - **Memory Efficient**: Only one item in memory at a time
 - **Low Latency**: Client receives data as soon as it's available
 - **Scalable**: Can handle large datasets without memory issues
 - **Network Efficient**: No buffering delays
 
 ---
 
 ## Common Patterns
 
 ### Pattern 1: Progress Reporter
 
 ```typescript
 async *processWithProgress(items: any[]) {
   const total = items.length;
   
   for (let i = 0; i < total; i++) {
     await this.processItem(items[i]);
     
     yield {
       current: i + 1,
       total,
       percentage: Math.round(((i + 1) / total) * 100),
       eta: this.calculateETA(i, total)
     };
   }
 }
 ```
 
 ### Pattern 2: Batch Processor
 
 ```typescript
 async *processInBatches(items: any[], batchSize: number = 100) {
   for (let i = 0; i < items.length; i += batchSize) {
     const batch = items.slice(i, i + batchSize);
     const results = await this.processBatch(batch);
     
     yield {
       batch: Math.floor(i / batchSize) + 1,
       results,
       processed: Math.min(i + batchSize, items.length)
     };
   }
 }
 ```
 
 ### Pattern 3: Fan-Out Pattern
 
 ```typescript
 async *fanOut(sources: AsyncIterable<any>[]) {
   const iterators = sources.map(s => s[Symbol.asyncIterator]());
   let active = iterators.length;
   
   while (active > 0) {
     const results = await Promise.all(
       iterators.map(it => it.next())
     );
     
     results.forEach((result, index) => {
       if (!result.done) {
         yield { source: index, data: result.value };
       } else {
         active--;
         iterators.splice(index, 1);
       }
     });
   }
 }
 ```
 
 ---
 
 ## Troubleshooting
 
 ### Issue: Stream Not Sending Data
 
 **Solution**: Ensure you're using `async function*` and `yield`:
 ```typescript
 // ✅ Correct
 async function* stream() {
   yield { data: 'test' };
 }
 
 // ❌ Wrong
 async function stream() {
   return { data: 'test' }; // Not a generator
 }
 ```
 
 ### Issue: Client Receives All Data at Once
 
 **Solution**: Add delays between yields:
 ```typescript
 async *stream() {
   for (let i = 1; i <= 5; i++) {
     yield { progress: i };
     await new Promise(resolve => setTimeout(resolve, 100)); // Add delay
   }
 }
 ```
 
 ### Issue: Memory Leak
 
 **Solution**: Yield items individually, don't accumulate:
 ```typescript
 // ✅ Good
 async *stream() {
   for await (const item of database.query()) {
     yield item; // One at a time
   }
 }
 
 // ❌ Bad
 async *stream() {
   const all = await database.query().toArray(); // All in memory
   for (const item of all) {
     yield item;
   }
 }
 ```
 
 ---
 
 ## See Also
 
 - [Response Handling](./05-response.md) - Other response types
 - [Testing](./06-testing.md) - How to test stream endpoints
 - [E2E Types](./07-e2e-types.md) - Type-safe client usage
 - [WebSocket](./09-websocket.md) - Alternative for real-time communication
 
 ---
 
 **📝 Summary**: Async generators with `yield` provide a powerful way to stream data progressively. Use them for progress tracking, large datasets, real-time feeds, and any scenario where you want to send data as it becomes available rather than waiting for everything to complete.