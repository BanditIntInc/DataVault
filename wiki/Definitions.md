# Definitions

An API definition tells DataVault how to fetch data for a given key. Register one per data source using `ds.registerDefinition()` or by adding to `definitions.json` in microservice mode.

## Schema

```typescript
interface IApiDefinition {
  key: string;
  url: string;
  type: 'rest' | 'websocket' | 'poll';
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  pollInterval?: number;
  cacheTTL?: number;
  mapping?: Record<string, string>;
  transform?: (raw: unknown) => unknown;
}
```

## Field reference

### `key` — required

A unique string identifier for this data source. Used as the lookup key in `get()`, `refresh()`, and `unsubscribe()`.

```
"users"
"weather.current"
"stock.AAPL"
```

Key rules (microservice mode): alphanumeric characters plus `.`, `-`, `_`, `:`. Max 128 characters.

---

### `url` — required

The endpoint URL. Must use `http`, `https`, `ws`, or `wss` protocol.

In microservice mode, private and loopback addresses are blocked (see [[Security]]).

---

### `type` — required

The upstream transport.

| Type | Behavior |
|---|---|
| `rest` | Single HTTP request per `get()` or `refresh()` call |
| `websocket` | Persistent connection opened at `registerDefinition()`. Data arrives via server push. Auto-reconnects with exponential backoff (1s–30s). |
| `poll` | Periodic HTTP requests on a `setInterval`. Starts at `registerDefinition()`. |

See [[Transport-Types]] for detailed behavior.

---

### `method`

HTTP method. Only used when `type` is `rest` or `poll`. Defaults to `GET`.

```typescript
method: 'POST'
```

---

### `headers`

Custom HTTP headers passed on every request.

```typescript
headers: {
  'Authorization': 'Bearer my-token',
  'X-Api-Version': '2'
}
```

---

### `body`

Request body for `POST`/`PUT`/`PATCH`. Serialized to JSON automatically.

```typescript
body: { query: 'active users', limit: 100 }
```

---

### `pollInterval`

Interval in milliseconds between poll requests. Only used when `type` is `poll`. Minimum: 1000ms.

```typescript
pollInterval: 15_000  // poll every 15 seconds
```

---

### `cacheTTL`

How long (in milliseconds) fetched data remains valid in the cache. `0` means the entry never expires.

```typescript
cacheTTL: 60_000   // 1 minute
cacheTTL: 0        // never expires
```

---

### `mapping`

A field remapping table. Keys are the names you want in the stored object; values are dot-notation paths into the raw API response.

```typescript
mapping: {
  temperature: 'current.temp_f',
  condition:   'current.condition.text',
  humidity:    'current.humidity',
}
```

Given the API returns:
```json
{ "current": { "temp_f": 72, "condition": { "text": "Sunny" }, "humidity": 55 } }
```

The stored value will be:
```json
{ "temperature": 72, "condition": "Sunny", "humidity": 55 }
```

If `mapping` is omitted, the raw response is stored as-is. See [[Data-Mapping]].

---

### `transform`

An optional function that runs **after** mapping. Its return value replaces whatever mapping produced.

```typescript
transform: (data) => ({
  ...(data as object),
  lastUpdated: new Date().toISOString(),
})
```

> `transform` cannot be serialized to JSON, so it is not available when loading definitions from `definitions.json`. It is only usable in library mode when calling `registerDefinition()` directly.

---

## Examples

### Simple REST (no mapping)

```typescript
ds.registerDefinition({
  key: 'posts',
  url: 'https://jsonplaceholder.typicode.com/posts',
  type: 'rest',
  method: 'GET',
  cacheTTL: 30_000,
});
```

### REST with mapping

```typescript
ds.registerDefinition({
  key: 'weather.current',
  url: 'https://api.weather.example.com/current?city=NYC',
  type: 'rest',
  method: 'GET',
  cacheTTL: 60_000,
  mapping: {
    temperature: 'current.temp_f',
    condition:   'current.condition.text',
  },
});
```

### REST with auth header and transform

```typescript
ds.registerDefinition({
  key: 'orders.recent',
  url: 'https://api.example.com/orders?status=recent',
  type: 'rest',
  method: 'GET',
  headers: { 'Authorization': 'Bearer abc123' },
  cacheTTL: 5_000,
  transform: (data) => (data as unknown[]).slice(0, 10),
});
```

### Polling

```typescript
ds.registerDefinition({
  key: 'stock.AAPL',
  url: 'https://api.example.com/quote?symbol=AAPL',
  type: 'poll',
  pollInterval: 10_000,
  cacheTTL: 10_000,
  mapping: { price: 'quote.latestPrice', change: 'quote.changePercent' },
});
```

### WebSocket

```typescript
ds.registerDefinition({
  key: 'live.feed',
  url: 'wss://stream.example.com/feed',
  type: 'websocket',
  mapping: { event: 'type', payload: 'data' },
});
```

### definitions.json (microservice mode)

```json
[
  {
    "key": "posts",
    "url": "https://jsonplaceholder.typicode.com/posts",
    "type": "rest",
    "method": "GET",
    "cacheTTL": 30000
  },
  {
    "key": "weather.current",
    "url": "https://api.weather.example.com/current?city=NYC",
    "type": "poll",
    "pollInterval": 60000,
    "cacheTTL": 60000,
    "mapping": {
      "temperature": "current.temp_f",
      "condition": "current.condition.text"
    }
  }
]
```
