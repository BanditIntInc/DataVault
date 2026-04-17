# Cache Design

The cache is a fully self-contained subsystem. It is built around five design patterns (Command, Factory, Adapter, Controller, Observer) and SOLID principles, so adding a new backend requires writing one class and one line in the factory — nothing else changes.

## Class diagram

```mermaid
classDiagram
    class IStorageAdapter {
        <<interface>>
        +get(key) Promise~ICacheEntry~
        +set(key, entry) Promise~void~
        +delete(key) Promise~void~
        +clear() Promise~void~
        +keys() Promise~string[]~
    }

    class ICacheCommand {
        <<interface>>
        +execute() Promise~T~
    }

    class ICacheObserver {
        <<interface>>
        +onCacheEvent(event) void
    }

    class MemoryAdapter
    class LocalStorageAdapter
    class SessionStorageAdapter
    class IndexedDbAdapter

    class GetCommand
    class SetCommand
    class DeleteCommand
    class ClearCommand
    class InvalidateCommand

    class StorageFactory {
        +create(type) IStorageAdapter
        +createBestAvailable() IStorageAdapter
    }

    class CacheEventEmitter {
        -observers ICacheObserver[]
        +subscribe(observer) void
        +unsubscribe(observer) void
        +emit(event) void
    }

    class CacheController {
        -adapter IStorageAdapter
        -emitter CacheEventEmitter
        +get(key) Promise~ICacheEntry~
        +set(key, data, ttl) Promise~void~
        +delete(key) Promise~void~
        +clear() Promise~void~
        +invalidateExpired() Promise~void~
        +isValid(key) Promise~bool~
    }

    IStorageAdapter <|.. MemoryAdapter
    IStorageAdapter <|.. LocalStorageAdapter
    IStorageAdapter <|.. SessionStorageAdapter
    IStorageAdapter <|.. IndexedDbAdapter

    ICacheCommand <|.. GetCommand
    ICacheCommand <|.. SetCommand
    ICacheCommand <|.. DeleteCommand
    ICacheCommand <|.. ClearCommand
    ICacheCommand <|.. InvalidateCommand

    StorageFactory ..> IStorageAdapter : creates

    CacheController --> IStorageAdapter
    CacheController --> CacheEventEmitter
    CacheController ..> GetCommand : dispatches
    CacheController ..> SetCommand : dispatches
    CacheController ..> DeleteCommand : dispatches
    CacheController ..> ClearCommand : dispatches
    CacheController ..> InvalidateCommand : dispatches

    CacheEventEmitter --> ICacheObserver : notifies
```

---

## SOLID mapping

| Principle | Application |
|---|---|
| **Single Responsibility** | Each class does one job: adapters handle I/O, commands encapsulate one operation each, the controller orchestrates, the factory creates |
| **Open / Closed** | Add a new backend by writing a new adapter class — zero changes to existing code |
| **Liskov Substitution** | Any `IStorageAdapter` can be swapped in without changing any call site |
| **Interface Segregation** | `IStorageAdapter` is lean — adapters are not forced to implement operations they don't support |
| **Dependency Inversion** | `CacheController` depends on `IStorageAdapter` (abstraction), never on concrete adapter classes |

---

## Pattern roles

| Pattern | Applied To | Purpose |
|---|---|---|
| **Adapter** | `*StorageAdapter` classes | Wrap browser/Node storage APIs behind a uniform interface |
| **Command** | `Get/Set/Delete/Clear/InvalidateCommand` | Encapsulate each operation as an executable object |
| **Factory** | `StorageFactory` | Create the right adapter; auto-detect environment capabilities |
| **Controller** | `CacheController` | Single public surface; dispatch commands, enforce TTL, emit events |
| **Observer** | `CacheEventEmitter` + `ICacheObserver` | Broadcast cache lifecycle events to any subscriber |

---

## Cache entry structure

```typescript
interface ICacheEntry {
  key: string;
  data: unknown;
  fetchedAt: number;   // Unix ms timestamp of when data was stored
  ttl: number;         // ms; 0 = never expires
}
```

TTL check: `Date.now() - fetchedAt > ttl`

---

## get() flow

```mermaid
sequenceDiagram
    participant DS as DataVault
    participant CC as CacheController
    participant CMD as GetCommand
    participant AD as IStorageAdapter
    participant EE as CacheEventEmitter

    DS->>CC: get("users")
    CC->>CMD: new GetCommand(adapter, "users")
    CMD->>AD: get("users")
    AD-->>CMD: ICacheEntry | null

    alt Entry exists and TTL valid
        CMD-->>CC: ICacheEntry
        CC->>EE: emit({ type: "hit", key, entry })
        CC-->>DS: ICacheEntry
    else Entry missing or expired
        CMD-->>CC: null (or entry deleted if expired)
        CC->>EE: emit({ type: "miss", key })
        CC-->>DS: null
    end
```

---

## set() flow

```mermaid
sequenceDiagram
    participant DS as DataVault
    participant CC as CacheController
    participant CMD as SetCommand
    participant AD as IStorageAdapter
    participant EE as CacheEventEmitter
    participant OR as ObserverRegistry

    DS->>CC: set("users", mappedData, 60000)
    CC->>CMD: new SetCommand(adapter, key, entry)
    CMD->>AD: set("users", ICacheEntry)
    AD-->>CMD: void
    CC->>EE: emit({ type: "set", key, entry })
    EE->>DS: onCacheEvent({ type: "invalidated" }) — on expiry
    DS->>OR: clear(key) — removes stale observers
```

---

## Factory decision tree

```mermaid
flowchart TD
    START([StorageFactory.createBestAvailable]) --> IDB{indexedDB available?}
    IDB -->|Yes| AIDB[IndexedDbAdapter]
    IDB -->|No| LS{localStorage available?}
    LS -->|Yes| ALS[LocalStorageAdapter]
    LS -->|No| SS{sessionStorage available?}
    SS -->|Yes| ASS[SessionStorageAdapter]
    SS -->|No| MEM[MemoryAdapter fallback]

    AIDB --> OUT([IStorageAdapter])
    ALS --> OUT
    ASS --> OUT
    MEM --> OUT
```

---

## Cache events

| Event | When emitted | Includes |
|---|---|---|
| `set` | Entry stored | `key`, `entry` |
| `hit` | Valid entry returned on get | `key`, `entry` |
| `miss` | Entry not found or expired | `key` |
| `deleted` | Entry explicitly deleted | `key` |
| `cleared` | All entries removed | — |
| `invalidated` | Expired entry removed by `invalidateExpired()` | `key` |

`DataVault` subscribes to the `invalidated` event and clears all data observers for that key, preventing stale callbacks.

---

## TTL behaviour

| `cacheTTL` | Behaviour |
|---|---|
| `0` | Entry never expires (fetched once, cached indefinitely) |
| `> 0` | Entry expires `cacheTTL` ms after it was stored |

Expiry is **lazy**: checked on `get()`. An expired entry is deleted at that point and a `miss` event is emitted. `invalidateExpired()` does a full scan to delete all expired entries at once.
