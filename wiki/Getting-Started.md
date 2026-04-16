# Getting Started

## Prerequisites

- Node.js 18+
- npm 9+

## Install dependencies

```bash
cd DataService
npm install
```

## Library mode (quickest path)

Import `DataService` directly into your app.

### 1. Create a service instance

```typescript
import { DataService } from './lib';

const ds = new DataService({ storage: 'auto' });
```

`storage: 'auto'` picks the best available backend — IndexedDB in the browser, Memory in Node.

### 2. Register a data source

```typescript
ds.registerDefinition({
  key: 'posts',
  url: 'https://jsonplaceholder.typicode.com/posts',
  type: 'rest',
  method: 'GET',
  cacheTTL: 30_000,   // 30 seconds
});
```

### 3. Request data

```typescript
// With an observer — notified on this fetch and every future update
const data = await ds.get('posts', {
  id: 'PostList',
  onUpdate: (fresh) => console.log('Updated:', fresh),
});

console.log(data); // array of posts
```

### 4. One-time fetch (no observer)

```typescript
const snapshot = await ds.get('posts', undefined, { once: true });
```

### 5. Force a refresh

```typescript
await ds.refresh('posts'); // clears cache, re-fetches, notifies observers
```

### 6. Unsubscribe

```typescript
ds.unsubscribe('posts', 'PostList');
```

### 7. Clean up

```typescript
ds.destroy(); // closes WebSocket connections and polling intervals
```

---

## Microservice mode

### 1. Add definitions to `definitions.json`

```json
[
  {
    "key": "posts",
    "url": "https://jsonplaceholder.typicode.com/posts",
    "type": "rest",
    "method": "GET",
    "cacheTTL": 30000
  }
]
```

### 2. Start the server

```bash
npm run server
# or with custom options:
PORT=3000 DEFINITIONS_FILE=./definitions.json STORAGE=memory npm run server
```

Output:
```
[Config] Loaded 1 definition(s) from /path/to/definitions.json
[DataService] HTTP  → http://localhost:3000/api
[DataService] WS    → ws://localhost:3000/ws
[DataService] Storage mode: memory
```

### 3. Fetch via HTTP

```bash
curl http://localhost:3000/api/data/posts
```

### 4. Subscribe via WebSocket

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({ action: 'subscribe', key: 'posts' }));
};

ws.onmessage = (event) => {
  const { type, key, data } = JSON.parse(event.data);
  if (type === 'data') console.log(key, data);
};
```

---

## Environment variables (microservice)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP and WebSocket port |
| `DEFINITIONS_FILE` | `./definitions.json` | Path to definitions config |
| `STORAGE` | `memory` | Storage backend: `memory`, `local`, `session`, `indexeddb` |

---

## Running tests

```bash
npm test
```

See [[Testing]] for the full breakdown.
