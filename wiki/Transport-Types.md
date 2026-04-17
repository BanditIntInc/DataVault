# Transport Types

DataVault supports three upstream transport types, each suited to a different data delivery model.

## REST

A single HTTP request is made each time data is needed.

```typescript
ds.registerDefinition({
  key: 'users',
  url: 'https://api.example.com/users',
  type: 'rest',
  method: 'GET',
  cacheTTL: 60_000,
});
```

**Lifecycle:**
- No connection is opened at `registerDefinition()`
- A request is made on the first `get()` call (cache miss)
- Subsequent `get()` calls return the cached value until TTL expires
- `refresh()` forces a new request regardless of cache state

**Options used:** `url`, `method`, `headers`, `body`, `cacheTTL`, `mapping`, `transform`

**Timeout:** All REST requests have a 10-second timeout. Stalled connections are aborted.

```mermaid
sequenceDiagram
    participant C as Consumer
    participant DS as DataVault
    participant FE as Fetcher
    participant API as REST API

    C->>DS: get("users")
    DS->>FE: fetchOnce(definition)
    Note over FE: 10s AbortController timeout
    FE->>API: GET /users
    API-->>FE: 200 JSON
    FE-->>DS: raw data
    DS->>DS: map + cache
    DS-->>C: data
    Note over DS: TTL = 60s
    C->>DS: get("users") again within TTL
    DS-->>C: cached data (no network call)
```

---

## WebSocket

A persistent connection is opened immediately when the definition is registered. Data arrives via server push.

```typescript
ds.registerDefinition({
  key: 'live.prices',
  url: 'wss://stream.example.com/prices',
  type: 'websocket',
  mapping: { symbol: 'ticker', price: 'last' },
});
```

**Lifecycle:**
- Connection opened at `registerDefinition()`
- Incoming messages are parsed (JSON), mapped, cached, and sent to observers
- On disconnect: reconnects with exponential backoff starting at 1s, capping at 30s
- `stopWatching()` / `destroy()` closes the connection permanently — no reconnect

**Auto-reconnect:**

```mermaid
sequenceDiagram
    participant FE as Fetcher
    participant WS as WebSocket Server

    FE->>WS: connect
    WS-->>FE: message (data)
    FE->>FE: map + cache + notify
    WS--xFE: connection drops
    Note over FE: wait 1s (base delay)
    FE->>WS: reconnect attempt
    WS--xFE: still down
    Note over FE: wait 2s
    FE->>WS: reconnect attempt
    WS-->>FE: connected
    WS-->>FE: message (data)
```

**Options used:** `url`, `cacheTTL`, `mapping`, `transform`

> `method`, `headers`, `body`, and `pollInterval` are ignored for WebSocket definitions.

---

## Poll

Periodic HTTP requests are made on an interval.

```typescript
ds.registerDefinition({
  key: 'stock.AAPL',
  url: 'https://api.example.com/quote?symbol=AAPL',
  type: 'poll',
  pollInterval: 15_000,  // every 15 seconds
  cacheTTL: 15_000,
  mapping: { price: 'quote.latestPrice' },
});
```

**Lifecycle:**
- Polling interval starts immediately at `registerDefinition()`
- Each tick makes a REST request, maps the result, caches it, and notifies observers
- Minimum `pollInterval` is 1000ms (enforced in both validator and Fetcher)
- `stopWatching()` / `destroy()` clears the interval

**Options used:** `url`, `method`, `headers`, `body`, `pollInterval`, `cacheTTL`, `mapping`, `transform`

```mermaid
sequenceDiagram
    participant FE as Fetcher
    participant API as REST API
    participant CC as Cache
    participant OR as ObserverRegistry

    loop every pollInterval ms
        FE->>API: GET request
        API-->>FE: JSON
        FE->>CC: set(key, mapped, ttl)
        FE->>OR: notify(key, mapped)
    end
```

---

## Comparison

| | REST | WebSocket | Poll |
|---|---|---|---|
| **Connection** | Per request | Persistent | Per interval |
| **Starts at** | First `get()` | `registerDefinition()` | `registerDefinition()` |
| **Push support** | No | Yes | No |
| **Auto-reconnect** | N/A | Yes (exp. backoff) | N/A |
| **Best for** | Infrequent, on-demand data | Real-time live data | Periodically changing data without push support |
| **Fetch timeout** | 10s | N/A | 10s per request |
| **Minimum interval** | N/A | N/A | 1000ms |
