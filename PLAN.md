# DataService — Architecture Plan

## Vision

A framework-agnostic TypeScript data service that acts as a smart cache + observer hub for any frontend. A consumer asks for a piece of data by key. The service either returns it instantly from cache (and registers the caller as an ongoing observer) or fetches it automatically using a pre-registered API definition, makes the upstream call, stores the result, and pushes it to all observers.

**Deployable in two modes:**
- **Library mode** — imported directly into a frontend or Node app; runs in-process
- **Microservice mode** — runs as a standalone HTTP + WebSocket server; any client communicates over the network

The core logic (`DataService`, `Cache`, `Fetcher`, etc.) is **identical in both modes**. Only the transport adapter differs.

---

## Deployment Modes

### Library Mode
```
┌─────────────────────────────────┐
│  Frontend App (React/Vue/Vanilla)│
│                                 │
│  import { DataService } from    │
│    '@your-org/data-service'     │
│                                 │
│  ds.get("users", observer)      │
└────────────┬────────────────────┘
             │ in-process call
             ▼
     ┌───────────────┐
     │  DataService  │
     │  (core logic) │
     └───────┬───────┘
             │ outbound fetch
             ▼
       External APIs
```

### Microservice Mode
```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  React App   │    │  Vue App     │    │  Mobile App  │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │  WS/HTTP           │  WS/HTTP           │  WS/HTTP
       └──────────┬─────────┘──────────┬─────────┘
                  ▼                    │
         ┌────────────────┐            │
         │  Server Layer  │◀───────────┘
         │  (HTTP + WS)   │
         └───────┬────────┘
                 │ in-process call
                 ▼
         ┌───────────────┐
         │  DataService  │
         │  (core logic) │
         └───────┬───────┘
                 │ outbound fetch
                 ▼
           External APIs
```

In microservice mode, **observers are the connected WebSocket clients**. When data updates, the server pushes to all subscribed sockets instead of calling a local callback.

---

## Core Concepts

### 1. Data Key
A string identifier for a piece of data (e.g. `"users"`, `"weather.current"`, `"stock.AAPL"`). The single reference point for consumers and for matching API definitions.

### 2. API Definition
A registered descriptor telling the service **how** to get data for a given key. Registered once at startup (or loaded from a config file in microservice mode).

```ts
interface IApiDefinition {
  key: string;                           // matches the data key consumers request
  url: string;                           // REST endpoint or WebSocket URL
  type: "rest" | "websocket" | "poll";  // upstream transport type
  method?: "GET" | "POST" | "PUT";      // REST only
  headers?: Record<string, string>;
  body?: unknown;                        // POST/PUT payload
  pollInterval?: number;                // ms — used when type = "poll"
  cacheTTL?: number;                    // ms — how long cached data is valid (0 = forever)
  mapping?: Record<string, string>;     // { "internalKey": "response.path.field" }
  transform?: (raw: unknown) => unknown; // optional post-fetch transform fn
}
```

### 3. Observer
**Library mode:** a callback interface — any code that wants to be notified when data changes.
**Microservice mode:** a connected WebSocket client (handled transparently by the server layer).

```ts
interface IObserver {
  id: string;                          // unique id (e.g. component name + key)
  onUpdate: (data: unknown) => void;  // called on data change (library mode)
}
```

### 4. Cache Entry
```ts
interface ICacheEntry {
  key: string;
  data: unknown;
  fetchedAt: number;  // timestamp ms
  ttl: number;        // 0 = never expires
}
```

---

## Request Flow (same in both modes)

```
Consumer requests key  (library: ds.get() │ microservice: WS subscribe / HTTP GET)
         │
         ▼
  Cache hit + still valid?
         │
    YES  │  NO
    │    └──────────────────────────────────────────────┐
    │                                                   ▼
    │                                   API definition found for key?
    │                                        │              │
    │                                       YES              NO → error
    │                                        ▼
    │                             Fetch upstream (REST / WS / poll)
    │                                        │
    │                                        ▼
    │                             Auto-map response → internal shape
    │                                        │
    │                                        ▼
    │                             Store in cache
    │                                        │
    ▼                                        ▼
Register observer (unless options.once = true)
    │
    ▼
Return / push current data to caller
    │
    ▼  (on future upstream data changes)
Notify all registered observers for key
```

---

## Auto-Mapping

When no `mapping` is provided, the raw parsed response is stored. When mapping is provided, dot-notation path resolution extracts and renames fields:

```ts
// API returns: { current: { temp_f: 72, condition: { text: "Sunny" } } }
// mapping: { "temperature": "current.temp_f", "condition": "current.condition.text" }
// Stored as: { temperature: 72, condition: "Sunny" }
```

If a `transform` function is provided it runs **after** mapping and its return value is what gets stored and broadcast.

---

## File Structure (Target)

```
DataService/
├── PLAN.md
├── package.json
├── tsconfig.json
├── readme/
│   ├── architecture.md              ← deployment and flow diagrams
│   └── cache-design.md              ← cache subsystem deep-dive
│
├── core/                            ← shared logic, mode-agnostic
│   ├── DataService.ts               ← main class (singleton)
│   ├── Fetcher.ts                   ← upstream REST / WebSocket / poll transports
│   ├── Mapper.ts                    ← dot-path resolution + field remapping
│   ├── DefinitionRegistry.ts        ← stores/looks up IApiDefinition by key
│   ├── ObserverRegistry.ts          ← subscribe, unsubscribe, notify (callbacks)
│   ├── interfaces/
│   │   ├── IApiDefinition.ts
│   │   ├── IObserver.ts
│   │   └── index.ts
│   └── cache/                       ← cache subsystem (see cache-design.md)
│       ├── CacheController.ts       ← single public surface; dispatches commands
│       ├── interfaces/
│       │   ├── IStorageAdapter.ts
│       │   ├── ICacheCommand.ts
│       │   ├── ICacheEntry.ts
│       │   ├── ICacheObserver.ts
│       │   └── index.ts
│       ├── adapters/
│       │   ├── SessionStorageAdapter.ts
│       │   ├── LocalStorageAdapter.ts
│       │   ├── IndexedDbAdapter.ts
│       │   ├── MemoryAdapter.ts     ← fallback for Node / microservice mode
│       │   └── index.ts
│       ├── commands/
│       │   ├── GetCommand.ts
│       │   ├── SetCommand.ts
│       │   ├── DeleteCommand.ts
│       │   ├── ClearCommand.ts
│       │   ├── InvalidateCommand.ts
│       │   └── index.ts
│       ├── factory/
│       │   └── StorageFactory.ts    ← creates adapter; auto-detects best available
│       └── observers/
│           └── CacheEventEmitter.ts ← broadcasts hit/miss/set/cleared events
│
├── lib/                             ← library mode entry point
│   └── index.ts                     ← re-exports DataService for npm/import use
│
└── server/                          ← microservice mode entry point
    ├── index.ts                     ← bootstraps HTTP + WS server
    ├── HttpAdapter.ts               ← GET /data/:key, POST /definitions
    ├── WsAdapter.ts                 ← subscribe/unsubscribe messages, push updates
    └── config.ts                    ← loads definitions from JSON/YAML config file
```

---

## Microservice Protocol (WS)

Client messages (JSON):
```jsonc
{ "action": "subscribe",   "key": "weather.current" }
{ "action": "unsubscribe", "key": "weather.current" }
{ "action": "get",         "key": "weather.current", "once": true }
{ "action": "refresh",     "key": "weather.current" }
```

Server push messages (JSON):
```jsonc
{ "type": "data",  "key": "weather.current", "data": { ... } }
{ "type": "error", "key": "weather.current", "message": "No definition found" }
```

HTTP endpoints (microservice mode only):
```
GET  /data/:key            → one-time fetch (no observer)
POST /definitions          → register a new API definition at runtime
GET  /definitions          → list all registered definitions
GET  /health               → uptime + cache stats
```

---

## Public API (DataService core — both modes)

```ts
class DataService {
  registerDefinition(definition: IApiDefinition): void

  // options.once = true → fetch + return, no observer registered
  get(key: string, observer?: IObserver, options?: { once?: boolean }): Promise<unknown>

  refresh(key: string): Promise<void>

  unsubscribe(key: string, observerId: string): void

  destroy(): void  // tears down WS connections and polling intervals
}
```

---

## What Changes from Current Code

| Current | Replacement | Reason |
|---|---|---|
| `iObserver.htmlTarget: HTMLElement` | `IObserver.onUpdate: callback` | Framework-agnostic; DOM binding is the consumer's job |
| `iStateObserver` / `StateObserver` | `ObserverRegistry` | Single registry for all keys; removes duplicate `.add()` bug |
| `State.Notify("SOMETHING")` | `ObserverRegistry.notify(key, data)` | Pass real data through |
| `DataService.SetObserver()` stub | `DataService.get()` + `registerDefinition()` | Full implementation |
| `state.ts` hard-coded data field | `Cache.ts` generic key/value store | Supports any data shape |
| _(nothing)_ | `server/` layer | New: enables microservice deployment |

---

## Build Phases

### Phase 1 — Foundation
- [ ] Add `package.json` and `tsconfig.json`
- [ ] Define all interfaces (`IApiDefinition`, `IObserver`, `ICacheEntry`)
- [ ] Implement `Cache` (get, set, isValid, TTL check)
- [ ] Implement `DefinitionRegistry` (register, lookup)
- [ ] Implement `ObserverRegistry` (subscribe, unsubscribe, notify)

### Phase 2 — Fetching
- [ ] Implement `Fetcher` for REST (GET/POST)
- [ ] Implement `Fetcher` for WebSocket (connect, listen, auto-reconnect)
- [ ] Implement `Fetcher` for polling (setInterval wrapper)

### Phase 3 — Mapping
- [ ] Implement `Mapper.resolve(path, data)` — dot-notation extractor
- [ ] Implement `Mapper.apply(mapping, raw)` — full field remap
- [ ] Apply `transform` fn after mapping

### Phase 4 — DataService Core Integration
- [ ] Wire all modules into `DataService`
- [ ] Implement full `get()` flow
- [ ] Implement `refresh()`, `unsubscribe()`, `destroy()`

### Phase 5 — Library Mode
- [ ] `lib/index.ts` entry point
- [ ] Build to ESM + CJS with `tsup` or `tsc`
- [ ] Library usage example

### Phase 6 — Microservice Mode
- [ ] `server/HttpAdapter.ts` — REST endpoints
- [ ] `server/WsAdapter.ts` — WebSocket subscribe/push
- [ ] `server/config.ts` — load definitions from JSON/YAML file at startup
- [ ] `server/index.ts` — server bootstrap (e.g. using Fastify or plain `http`)

### Phase 7 — Polish
- [ ] Error handling throughout (missing definition, fetch failure, mapping failure)
- [ ] TTL expiry + auto-refresh on stale reads
- [ ] Unit tests per module
- [ ] README with library and microservice usage examples

---

## Example Usage

### Library Mode
```ts
import { DataService } from '@your-org/data-service';

const ds = new DataService();

ds.registerDefinition({
  key: "weather.current",
  url: "https://api.weather.example.com/current?city=NYC",
  type: "rest",
  method: "GET",
  cacheTTL: 60_000,
  mapping: {
    temperature: "current.temp_f",
    condition:   "current.condition.text"
  }
});

ds.get("weather.current", {
  id: "WeatherWidget",
  onUpdate: (data) => {
    document.getElementById("temp").textContent = data.temperature;
  }
});
```

### Microservice Mode (client side)
```ts
const ws = new WebSocket("ws://localhost:3000");

ws.send(JSON.stringify({ action: "subscribe", key: "weather.current" }));

ws.onmessage = (event) => {
  const { type, key, data } = JSON.parse(event.data);
  if (type === "data" && key === "weather.current") {
    document.getElementById("temp").textContent = data.temperature;
  }
};
```

### Microservice Mode (server startup)
```ts
// definitions.json loaded at startup — no code changes needed to add new data sources
[
  {
    "key": "weather.current",
    "url": "https://api.weather.example.com/current?city=NYC",
    "type": "rest",
    "method": "GET",
    "cacheTTL": 60000,
    "mapping": {
      "temperature": "current.temp_f",
      "condition": "current.condition.text"
    }
  }
]
```
