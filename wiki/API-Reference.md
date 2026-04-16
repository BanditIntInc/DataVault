# API Reference

## DataService

The main class. All consumers interact through this.

```typescript
import { DataService } from './lib';

const ds = new DataService(options?: DataServiceOptions);
```

### Constructor options

```typescript
interface DataServiceOptions {
  storage?: 'session' | 'local' | 'indexeddb' | 'memory' | 'auto';
}
```

| Option | Default | Description |
|---|---|---|
| `storage` | `'auto'` | Storage backend. `'auto'` selects the best available: IndexedDB → LocalStorage → SessionStorage → Memory |

---

### `registerDefinition(definition)`

Registers an API definition. Must be called before `get()` for that key.

For `websocket` and `poll` types, the upstream connection or polling interval starts immediately at registration.

```typescript
ds.registerDefinition(definition: IApiDefinition): void
```

See [[Definitions]] for the full `IApiDefinition` schema.

---

### `get(key, observer?, options?)`

Requests data for a key. If cached and valid, returns immediately. On a cache miss, fetches upstream, stores, and notifies observers.

```typescript
ds.get(
  key: string,
  observer?: IObserver,
  options?: { once?: boolean }
): Promise<unknown>
```

| Parameter | Description |
|---|---|
| `key` | Data key matching a registered definition |
| `observer` | Optional. Registered as a subscriber for future updates unless `once: true` |
| `options.once` | If `true`, observer is not registered. Data is fetched and returned but no subscription is created |

**Returns**: The current data value (mapped + transformed).

**Throws**: If no definition is registered for the key.

```typescript
// Subscribe and receive future updates
const data = await ds.get('users', {
  id: 'UserList',
  onUpdate: (fresh) => render(fresh),
});

// One-time fetch
const snapshot = await ds.get('users', undefined, { once: true });
```

---

### `refresh(key)`

Clears the cached value for a key and re-fetches from upstream. All registered observers are notified with the new data.

```typescript
ds.refresh(key: string): Promise<void>
```

**Throws**: If no definition is registered for the key.

```typescript
await ds.refresh('users');
```

---

### `unsubscribe(key, observerId)`

Removes a specific observer from a key. The observer's `onUpdate` will no longer be called.

```typescript
ds.unsubscribe(key: string, observerId: string): void
```

```typescript
ds.unsubscribe('users', 'UserList');
```

---

### `getDefinitions()`

Returns the internal `DefinitionRegistry`. Primarily used by the server layer.

```typescript
ds.getDefinitions(): DefinitionRegistry
```

---

### `destroy()`

Tears down all WebSocket connections, polling intervals, and the internal cache observer. Call this when the service is no longer needed to prevent memory leaks.

```typescript
ds.destroy(): void
```

---

## IObserver

```typescript
interface IObserver {
  id: string;                          // Unique identifier for this observer
  onUpdate: (data: unknown) => void;  // Called whenever data for the subscribed key changes
}
```

The `id` is used to deduplicate registrations and to target `unsubscribe()` calls. Use a stable, descriptive identifier like a component name.

---

## StorageFactory

Direct access to storage backend creation if you need to manage the adapter yourself.

```typescript
import { StorageFactory } from './lib';

// Explicit type
const adapter = StorageFactory.create('indexeddb');

// Auto-select best available
const adapter = StorageFactory.createBestAvailable();
```

```typescript
type StorageType = 'session' | 'local' | 'indexeddb' | 'memory';

class StorageFactory {
  static create(type: StorageType): IStorageAdapter;
  static createBestAvailable(): IStorageAdapter;
}
```

Auto-selection priority: `indexedDB` → `localStorage` → `sessionStorage` → `MemoryAdapter`

---

## DefinitionRegistry

Internal registry. Exposed via `ds.getDefinitions()`.

```typescript
class DefinitionRegistry {
  register(definition: IApiDefinition): void;
  lookup(key: string): IApiDefinition | null;
  has(key: string): boolean;
  all(): IApiDefinition[];
}
```

---

## CacheController

Internal cache surface. Exposed if you need direct cache access.

```typescript
class CacheController {
  constructor(adapter: IStorageAdapter)

  subscribe(observer: ICacheObserver): void
  unsubscribe(observer: ICacheObserver): void

  get(key: string): Promise<ICacheEntry | null>
  set(key: string, data: unknown, ttl?: number): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>
  invalidateExpired(): Promise<void>
  isValid(key: string): Promise<boolean>
}
```

---

## Mapper

Static utility for dot-notation field extraction.

```typescript
class Mapper {
  // Extract a value at a dot-notation path
  static resolve(path: string, data: unknown): unknown;

  // Remap multiple fields at once
  static apply(mapping: Record<string, string>, raw: unknown): Record<string, unknown>;
}
```

```typescript
const raw = { user: { profile: { name: 'Alice' } } };

Mapper.resolve('user.profile.name', raw); // → 'Alice'

Mapper.apply({ displayName: 'user.profile.name' }, raw);
// → { displayName: 'Alice' }
```

See [[Data-Mapping]] for full documentation.
