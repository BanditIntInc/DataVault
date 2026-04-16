# DataService — Architecture Diagrams

## Deployment Modes

### Library Mode

```mermaid
graph TD
    A[Frontend App<br/>React / Vue / Vanilla] -->|import DataService| B[DataService Core]
    B --> C[DefinitionRegistry]
    B --> D[Cache]
    B --> E[ObserverRegistry]
    B --> F[Fetcher]
    F -->|REST| G[External REST API]
    F -->|WebSocket| H[External WebSocket]
    F -->|Poll| I[Polled Endpoint]
    E -->|onUpdate callback| A
```

---

### Microservice Mode

```mermaid
graph TD
    A1[React App] -->|WS / HTTP| SRV[Server Layer]
    A2[Vue App] -->|WS / HTTP| SRV
    A3[Mobile App] -->|WS / HTTP| SRV

    SRV --> HTTP[HttpAdapter<br/>GET /data/:key<br/>POST /definitions]
    SRV --> WS[WsAdapter<br/>subscribe / push]

    HTTP --> CORE[DataService Core]
    WS --> CORE

    CORE --> C[DefinitionRegistry]
    CORE --> D[Cache]
    CORE --> E[ObserverRegistry]
    CORE --> F[Fetcher]

    F -->|REST| G[External REST API]
    F -->|WebSocket| H[External WebSocket]
    F -->|Poll| I[Polled Endpoint]

    E -->|push update| WS
```

---

## Request Flow

```mermaid
flowchart TD
    START([Consumer requests key]) --> CACHE{Cache hit\nand valid?}

    CACHE -->|Yes| REGISTER
    CACHE -->|No| DEFCHECK{API definition\nexists for key?}

    DEFCHECK -->|No| ERR([Error: no definition found])
    DEFCHECK -->|Yes| FETCH[Fetch upstream\nREST / WebSocket / Poll]

    FETCH --> MAP[Auto-map response\nto internal shape]
    MAP --> STORE[Store in Cache]
    STORE --> REGISTER

    REGISTER{options.once?}
    REGISTER -->|No| SUB[Register as observer]
    REGISTER -->|Yes| RETURN

    SUB --> RETURN([Return current data to caller])

    STORE -->|Upstream data changes| NOTIFY[Notify all observers for key]
```

---

## Module Relationships

```mermaid
graph LR
    DS[DataService] --> DR[DefinitionRegistry]
    DS --> CA[Cache]
    DS --> OR[ObserverRegistry]
    DS --> FE[Fetcher]
    DS --> MA[Mapper]

    FE -->|raw response| MA
    MA -->|mapped data| CA
    CA -->|stored data| OR
    OR -->|onUpdate| OB[Observer Callbacks]

    DR -->|IApiDefinition| FE
```

---

## WebSocket Protocol (Microservice Mode)

```mermaid
sequenceDiagram
    participant C as Client
    participant WS as WsAdapter
    participant DS as DataService Core
    participant API as External API

    C->>WS: subscribe { key: "weather.current" }
    WS->>DS: get(key, wsObserver)
    DS->>DS: Check cache

    alt Cache miss
        DS->>API: Fetch upstream
        API-->>DS: Raw response
        DS->>DS: Map + store
    end

    DS-->>WS: Current data
    WS-->>C: push { type: "data", key, data }

    Note over API,DS: Upstream data changes (poll / WS push)
    API-->>DS: New data
    DS->>DS: Map + store
    DS->>WS: Notify observers
    WS-->>C: push { type: "data", key, data }

    C->>WS: unsubscribe { key: "weather.current" }
    WS->>DS: unsubscribe(key, clientId)
```

---

## Data Mapping

```mermaid
flowchart LR
    RAW["Raw API Response\n{ current: { temp_f: 72,\n  condition: { text: 'Sunny' } } }"]
    MAP["Mapping Definition\n{ temperature: 'current.temp_f',\n  condition: 'current.condition.text' }"]
    OUT["Stored Shape\n{ temperature: 72,\n  condition: 'Sunny' }"]
    TX["transform fn\n(optional)"]

    RAW --> MAPPER[Mapper]
    MAP --> MAPPER
    MAPPER --> TX
    TX --> OUT
```
