# Changelog

All notable changes to **tspace-spear** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Bug Fixes
- Fixed part value in fast-router
- Fixed example in Swagger documentation
- Fixed compile type issues
- Fixed CLI example app

---

## [1.3.2] - 2026-08-09

### Features
- Added skills documentation for LLMs
- Added compiler types for main & controllers
- Added compiler types to values for Swagger examples
- Added `useRouter` with TOptions for known types
- Added type definitions for `baseContract` & `compiledContract`
- Added testing capabilities with adapter support
- Added HTTP status codes: 206, 405, 408, 413
- Added WebSocket support for net adapter
- Added `res.set()` for setting response properties
- Added script `npm test` for all adapters
- Added type definitions for params in routes app
- Added decorator middleware support (class, method, and function)
- Added custom context type support
- Added GraphQL support
- Added generator types and client types
- Added CLI tool for project scaffolding
- Added validate DTO support
- Added pre-routes for end-to-end types
- Added adapter for uWS (uWebSockets.js)
- Added fast router integration
- Added body parser & cookies parser
- Added file upload support with busboy
- Added cluster & logger support

### Bug Fixes
- Fixed part value in fast-router
- Fixed example in Swagger documentation
- Fixed compile type issues
- Fixed CLI example app
- Fixed compile issues in `useSwagger` (allow disabled)
- Fixed header type changed to `Record`
- Fixed compiler types for response error
- Fixed types for response handling
- Fixed compile type example UUID format
- Fixed compile app in Swagger
- Fixed test cases for testing (change offsetPort to port)
- Fixed clone dependency class for testing
- Replaced all `@Service` to `@Dependencies`
- Fixed compile type for maybe app maybe server
- Fixed `MockService` in testing
- Fixed `useRouter` add TOptions for known types
- Fixed removed write keepalive
- Fixed constructor server
- Fixed response send set content text
- Fixed merge types `TRoutes` + `AppRoutes`
- Fixed decorator middleware bug with pure function
- Fixed documentation updates
- Fixed adapter for test cases on Node.js 14
- Fixed `@StatusCode` decorator
- Fixed file upload & response net adapter
- Fixed file upload uWS adapter
- Fixed `nextError` corrected for statusCode hook by server
- Fixed write head in uWS
- Fixed test case file upload
- Fixed write head null in uWS
- Fixed value in raw response can't getter value in raw response (all adapters)
- Fixed client detect response body type instead of form headers
- Fixed `setStatusCode` can content-type
- Fixed code and ts-morph for Node.js 14 support
- Fixed response handling
- Fixed benchmark issues
- Fixed test cases how to use `useRouter`
- Fixed type constructor
- Fixed type App
- Fixed hotfix for CLI (forgot await in controller)
- Fixed test cases
- Fixed types for response HTTP
- Fixed client & E2E types
- Fixed bug `@ValidateDto`
- Fixed types namespace T
- Fixed params in fast router (transform value if number)
- Fixed CLI generator (write fast and global prefix, response examples)
- Fixed compiler types
- Fixed Swagger documentation
- Fixed types `.d.ts`
- Fixed net & uWS adapter
- Fixed benchmark issues
- Fixed pipe stream in HTTP and uWS
- Fixed remove "find my way" to fast router
- Fixed benchmark & performance improvements
- Fixed body parser not support payload stream binary
- Fixed busboy can't save file name UTF-8
- Fixed response when result null & messages in Swagger
- Fixed CORS issues
- Fixed file upload issues
- Fixed type cluster support

### Changed
- Cleaned code for adapter any server
- Changed console logging
- Updated package.json dependencies
- Updated content-types handling
- Updated logger in test cases
- Updated test cases
- Updated types for response
- Updated CLI console
- Updated keywords
- Updated documentation

### Documentation
- Updated skills documentation for LLMs
- Updated README and docs
- Added example Dockerfile for uWS
- Added benchmark for pure uWS
- Updated Swagger documentation

---

## [1.3.1] - 2026-07-29

### Documentation
- Updated documentation

---

## [1.3.0] - 2026-07-05

### Features
- Added decorator middleware support
- Added middleware decorator supporting class, method, function, and class

### Changed
- Updated content-types handling
- Fixed pipeStream for HTTP adapter

---

## [1.2.9] - 2026-05-24

### Features
- Added GraphQL support
- Added generator types
- Added test cases

### Bug Fixes
- Fixed test cases
- Fixed types for response HTTP
- Fixed documentation

---

## [1.2.8] - 2026-05-17

### Features
- Added CLI tool for project scaffolding

### Documentation
- Updated documentation

---

## [1.2.7] - 2026-05-15

### Bug Fixes
- Fixed CLI issues
- Fixed type generator

### Documentation
- Updated documentation

---

## [1.2.6] - 2026-05-14

### Features
- Added release script (`release.sh`)

### Bug Fixes
- Fixed Swagger with pre-routes (default Swagger when `app.useSwagger`)
- Fixed port in E2E tests
- Fixed global prefix in Swagger

### Documentation
- Updated documentation

---

## [1.2.5] - 2026-05-07

### Bug Fixes
- Fixed throw error to `.use` catch

---

## [1.2.4] - 2026-05-06

### Bug Fixes
- Fixed Swagger documentation
- Fixed `@Swagger` property options

---

## [1.2.3] - 2026-03-25

### Features
- Added adapter for uWS (uWebSockets.js)

---

## [1.1.9] - 2025-06-18

### Features
- Added status code: Too Many Requests (429)

### Bug Fixes
- Fixed body parser not supporting payload stream binary
- Fixed busboy can't save file name UTF-8

---

## [1.0.8] - 2024-07-22

### Bug Fixes
- Fixed cluster & logger support
- Fixed type cluster support

---

## [1.0.2] - 2024-07-20

### Performance
- Improved middleware file handling

---

## [1.0.0] - 2024-07-08

### Initial Release
- Initial release of tspace-spear
- Core server implementation
- Request/Response handling
- Swagger/OpenAPI documentation
- File upload support
- CORS middleware
- Body parser & cookies
- Fast router integration
- WebSocket support
- Testing adapters
- CLI scaffolding
- End-to-end types
- Decorator-based middleware
- Dependency injection
- DTO validation

---

## Summary of Key Features

- **Fast Router**: High-performance routing with fast-router integration
- **TypeScript First**: Full type safety with end-to-end types
- **Swagger/OpenAPI**: Auto-generated API documentation
- **Multiple Adapters**: Support for HTTP, uWS, and net adapters
- **File Upload**: Busboy-based file upload handling
- **WebSocket**: Built-in WebSocket support
- **CLI Tool**: Project scaffolding and code generation
- **Testing**: Comprehensive E2E and unit testing support
- **Middleware**: Decorator-based middleware support
- **Dependency Injection**: Auto-loading dependency injection
- **DTO Validation**: Class-validator and Zod support
- **Performance**: Optimized for high throughput and low latency

---

*For more information, visit the [repository](https://github.com/thanathip41/tspace-spear)*