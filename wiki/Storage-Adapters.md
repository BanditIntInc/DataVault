# Storage Adapters

All four adapters implement `IStorageAdapter` identically. The rest of the system never knows which one is active.

```typescript
interface IStorageAdapter {
  get(key: string): Promise<ICacheEntry | null>;
  set(key: string, entry: ICacheEntry): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}
```

---

## Comparison

| | MemoryAdapter | LocalStorageAdapter | SessionStorageAdapter | IndexedDbAdapter |
|---|---|---|---|---|
| **Environment** | Any | Browser | Browser | Browser |
| **Persistence** | No | Yes (cross-session) | No (tab lifetime) | Yes (cross-session) |
| **Size limit** | Process memory | ~5–10 MB | ~5–10 MB | 50 MB+ |
| **Data type** | Any JS value | JSON strings | JSON strings | Structured objects |
| **Async native** | No (wrapped) | No (wrapped) | No (wrapped) | Yes |
| **Best for** | Testing, Node/server | Small browser caches | Temporary browser caches | Large or complex browser caches |

---

## MemoryAdapter

Backed by a `Map<string, ICacheEntry>`. All operations are synchronous internally but wrapped in `Promise` to satisfy `IStorageAdapter`.

```typescript
const adapter = StorageFactory.create('memory');
// or
const adapter = new MemoryAdapter();
```

**Key points:**
- All data is lost when the process/tab closes
- No serialization — stores raw JS objects
- O(1) get/set/delete; O(n) clear/keys

**Use when:** Running in Node (microservice mode), unit testing, or when persistence is not needed.

---

## LocalStorageAdapter

Backed by `window.localStorage`. Entries are namespaced with a `ds:` prefix to avoid collisions with other code on the same origin.

```typescript
const adapter = StorageFactory.create('local');
```

**Serialization:** Each `ICacheEntry` is `JSON.stringify`-ed on write and `JSON.parse`-d on read. Parse errors silently return `null`.

**Key points:**
- Data survives browser restarts
- 5–10 MB limit (browser-dependent)
- Synchronous API; every read/write blocks the main thread briefly
- Shared across all tabs on the same origin

**Use when:** You need lightweight cross-session persistence without the complexity of IndexedDB.

---

## SessionStorageAdapter

Backed by `window.sessionStorage`. Same implementation as `LocalStorageAdapter` except data is scoped to the current browser tab and cleared when the tab closes.

```typescript
const adapter = StorageFactory.create('session');
```

**Key points:**
- Isolated per tab — two tabs on the same origin do not share entries
- Cleared automatically on tab/window close
- Same 5–10 MB limit and main-thread blocking as LocalStorage

**Use when:** You need per-session caching that is automatically cleaned up when the user closes the tab.

---

## IndexedDbAdapter

Backed by `window.indexedDB`. Opens (or creates) a database named `DataVaultCache` with a single object store named `entries`.

```typescript
const adapter = StorageFactory.create('indexeddb');
```

**Database schema:**
- Database name: `DataVaultCache`
- Schema version: `1`
- Object store: `entries` with `keyPath: 'key'`

**Key points:**
- Stores structured objects — no JSON serialization needed
- Async-native — no main thread blocking
- Much larger quota (50 MB+ or quota-based depending on browser)
- Survives browser restarts
- Database is created automatically on first access via `onupgradeneeded`

**Use when:** Caching large datasets, complex objects, or in any production browser scenario where storage size or performance matters.

---

## Selecting a backend

### Explicit selection

```typescript
const ds = new DataVault({ storage: 'indexeddb' });
const ds = new DataVault({ storage: 'local' });
const ds = new DataVault({ storage: 'session' });
const ds = new DataVault({ storage: 'memory' });
```

### Auto-selection (`'auto'` or omit)

```typescript
const ds = new DataVault(); // defaults to auto
const ds = new DataVault({ storage: 'auto' });
```

Priority: `IndexedDB` → `LocalStorage` → `SessionStorage` → `MemoryAdapter`

### Using StorageFactory directly

```typescript
import { StorageFactory } from '@banditintinc/datavault';

const adapter = StorageFactory.createBestAvailable();
const cache = new CacheController(adapter);
```

---

## Adding a custom adapter

Implement `IStorageAdapter` and register it manually:

```typescript
import { IStorageAdapter, ICacheEntry, CacheController } from '@banditintinc/datavault';

class RedisAdapter implements IStorageAdapter {
  async get(key: string): Promise<ICacheEntry | null> { /* ... */ }
  async set(key: string, entry: ICacheEntry): Promise<void> { /* ... */ }
  async delete(key: string): Promise<void> { /* ... */ }
  async clear(): Promise<void> { /* ... */ }
  async keys(): Promise<string[]> { /* ... */ }
}

const cache = new CacheController(new RedisAdapter());
```

No other code changes are needed.
