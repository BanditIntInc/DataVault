# Architecture

## Overview

DataService is structured as a layered system. The core logic (fetching, caching, mapping, observing) is completely independent of the deployment target. A thin adapter layer on top exposes it as either an importable library or a running HTTP + WebSocket server.

## Deployment modes

### Library mode

```mermaid
graph TD
    A[Frontend App<br/>React / Vue / Vanilla / Node] -->|import DataService| DS[DataService Core]
    DS --> DR[DefinitionRegistry]
    DS --> CC[CacheController]
    DS --> OR[ObserverRegistry]
    DS --> FE[Fetcher]
    FE -->|REST| R[External REST API]
    FE -->|WebSocket| W[External WebSocket]
    FE -->|Poll| P[Polled Endpoint]
    OR -->|onUpdate callback| A
```

### Microservice mode

```mermaid
graph TD
    A1[React App] -->|WS / HTTP| SRV[Server Layer]
    A2[Vue App] -->|WS / HTTP| SRV
    A3[Any Client] -->|WS / HTTP| SRV

    SRV --> HTTP[HttpAdapter<br/>REST endpoints]
    SRV --> WS[WsAdapter<br/>subscribe / push]

    HTTP --> DS[DataService Core]
    WS --> DS

    DS --> DR[DefinitionRegistry]
    DS --> CC[CacheController]
    DS --> OR[ObserverRegistry]
    DS --> FE[Fetcher]

    FE -->|REST| R[External REST API]
    FE -->|WebSocket| W[External WebSocket]
    FE -->|Poll| P[Polled Endpoint]

    OR -->|push update| WS
```

---

## Request flow

```mermaid
flowchart TD
    START([Consumer requests key]) --> CACHE{Cache hit\nand valid?}

    CACHE -->|Yes| REGISTER
    CACHE -->|No| DEFCHECK{API definition\nexists for key?}

    DEFCHECK -->|No| ERR([Error returned])
    DEFCHECK -->|Yes| FETCH[Fetch upstream\nREST / WebSocket / Poll]

    FETCH --> MAP[Map response fields\nand run transform]
    MAP --> STORE[Store in cache with TTL]
    STORE --> REGISTER

    REGISTER{options.once?}
    REGISTER -->|No| SUB[Register as observer]
    REGISTER -->|Yes| RETURN

    SUB --> RETURN([Return current data])

    STORE -->|Upstream changes| NOTIFY[Notify all observers]
```

---

## Module relationships

```mermaid
graph LR
    DS[DataService] --> DR[DefinitionRegistry]
    DS --> CC[CacheController]
    DS --> OR[ObserverRegistry]
    DS --> FE[Fetcher]
    DS --> MA[Mapper]

    FE -->|raw response| MA
    MA -->|mapped data| CC
    CC -->|cache event| DS
    DS -->|notify| OR
    OR -->|onUpdate| OB[Observer Callbacks]

    CC --> SF[StorageFactory]
    SF --> AD[IStorageAdapter]
```

---

## File structure

```
DataService/
├── core/                          Core logic — mode-agnostic
│   ├── DataService.ts             Main entry point, orchestrates all modules
│   ├── DefinitionRegistry.ts      Stores API definitions by key
│   ├── ObserverRegistry.ts        Manages per-key observer callbacks
│   ├── Fetcher.ts                 REST / WebSocket / polling transports
│   ├── Mapper.ts                  Dot-path field extraction and remapping
│   ├── interfaces/
│   │   ├── IApiDefinition.ts      API definition schema
│   │   └── IObserver.ts           Observer callback interface
│   └── cache/                     Cache subsystem
│       ├── CacheController.ts     Public surface for all cache operations
│       ├── adapters/              Storage backends (Memory/LocalStorage/SessionStorage/IndexedDB)
│       ├── commands/              Command objects (Get/Set/Delete/Clear/Invalidate)
│       ├── factory/               StorageFactory — creates and auto-selects adapters
│       ├── observers/             CacheEventEmitter — lifecycle event pub/sub
│       └── interfaces/            IStorageAdapter, ICacheEntry, ICacheCommand, ICacheObserver
│
├── lib/                           Library mode entry point (npm exports)
│   └── index.ts
│
├── server/                        Microservice mode
│   ├── index.ts                   Server bootstrap (Express + WebSocket)
│   ├── HttpAdapter.ts             REST API routes
│   ├── WsAdapter.ts               WebSocket subscribe/push logic
│   ├── config.ts                  Loads definitions.json
│   └── validateDefinition.ts      URL + schema validation (SSRF prevention)
│
├── definitions.json               Example API definitions for microservice mode
├── package.json
└── tsconfig.json
```

---

## Data flow — REST fetch (detailed)

```mermaid
sequenceDiagram
    participant C as Consumer
    participant DS as DataService
    participant CC as CacheController
    participant FE as Fetcher
    participant MA as Mapper
    participant OR as ObserverRegistry
    participant API as External API

    C->>DS: get("posts", observer)
    DS->>OR: subscribe("posts", observer)
    DS->>CC: get("posts")
    CC-->>DS: null (miss)
    DS->>FE: fetchOnce(definition)
    FE->>API: GET /posts (10s timeout)
    API-->>FE: raw JSON
    FE-->>DS: raw JSON
    DS->>MA: apply(mapping, raw)
    MA-->>DS: mapped data
    DS->>CC: set("posts", mapped, ttl)
    DS->>OR: notify("posts", mapped)
    OR->>C: observer.onUpdate(mapped)
    DS-->>C: mapped data (return value)
```

---

## Cache event chain

```mermaid
sequenceDiagram
    participant DS as DataService
    participant CC as CacheController
    participant EE as CacheEventEmitter
    participant OR as ObserverRegistry

    CC->>EE: emit({ type: 'set', key, entry })
    EE->>DS: onCacheEvent(set)

    Note over CC,EE: On TTL expiry or manual invalidation:
    CC->>EE: emit({ type: 'invalidated', key })
    EE->>DS: onCacheEvent(invalidated)
    DS->>OR: clear(key)
    Note over OR: All observers for key removed
```
