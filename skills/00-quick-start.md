# Quick Start - tspace-spear

## Installation

```bash
npm install tspace-spear --save
```

## Hello World

```typescript
import Spear, { type T } from "tspace-spear";

new Spear()
  .get('/', () => 'Hello World!')
  .listen(8000, () => console.log('Server: http://localhost:8000'));
```

## JSON Response

```typescript
app.get('/json', () => ({ message: 'Hello!' }));
app.get('/api', ({ res }) => res.json({ data: [1, 2, 3] }));
```

## Route Parameters

```typescript
app.get('/users/:id', ({ params }) => `User ${params.id}`);
app.get('/users/:id/posts/:postId', ({ params }) => 
  `Post ${params.postId} of User ${params.id}`
);
```

## Query Parameters

```typescript
app.get('/search', ({ query }) => `Searching for: ${query.q}`);
```

## POST Request

```typescript
app.post('/users', ({ body, res }) => {
  return res.created({ id: 1, ...body });
});
```

## Full Example

```typescript
import Spear, { type T } from "tspace-spear";

const app = new Spear({ logger: true })
  .useBodyParser()
  .get('/', () => 'Home')
  .get('/users', () => [{ id: 1, name: 'Alice' }])
  .get('/users/:id', ({ params }) => ({ id: params.id }))
  .post('/users', ({ body, res }) => res.created({ id: 1, ...body }))
  .listen(8000);