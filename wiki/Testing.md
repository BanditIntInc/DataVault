# Testing

## Running tests

```bash
npm test
```

All 59 tests run and exit with code 0 when everything is healthy.

```
Test Suites: 7 passed, 7 total
Tests:       59 passed, 59 total
```

---

## Test suites

### `core/cache/__tests__/MemoryAdapter.test.ts`

Unit tests for the in-memory storage adapter.

| Test | What it verifies |
|---|---|
| Returns null for missing key | `get()` on empty store |
| Stores and retrieves entry | Round-trip set/get |
| Overwrites existing entry | `set()` idempotency |
| Deletes an entry | `delete()` |
| Clears all entries | `clear()` |
| Returns all keys | `keys()` |

---

### `core/cache/__tests__/CacheController.test.ts`

Unit tests for the cache controller including TTL expiry and all event types.

| Test | What it verifies |
|---|---|
| Returns null on miss | Empty cache behaviour |
| Stores and retrieves data | Basic get/set round-trip |
| Respects TTL — returns null for expired | 1ms TTL + 10ms wait |
| Never expires ttl=0 entries | Infinite TTL behaviour |
| isValid false for missing key | Validity check |
| isValid true for live entry | Validity check |
| Delete removes a key | delete() |
| Clear removes all keys | clear() |
| invalidateExpired only removes expired | Selective expiry |
| Emits set event | Observer event |
| Emits hit event | Observer event |
| Emits miss event | Observer event |
| Emits deleted event | Observer event |
| Emits cleared event | Observer event |
| Stops emitting after unsubscribe | Observer cleanup |

---

### `core/cache/__tests__/StorageFactory.test.ts`

Unit tests for the factory.

| Test | What it verifies |
|---|---|
| Creates MemoryAdapter for type 'memory' | Explicit creation |
| createBestAvailable returns MemoryAdapter in Node | Auto-selection in non-browser |
| All adapters satisfy IStorageAdapter contract | Interface compliance |

---

### `core/__tests__/Mapper.test.ts`

Unit tests for dot-notation path resolution and field remapping.

| Test | What it verifies |
|---|---|
| Resolves top-level key | `'humidity'` → `55` |
| Resolves nested path | `'current.temp_f'` → `72` |
| Resolves deeply nested path | `'current.condition.text'` → `'Sunny'` |
| Returns undefined for missing path | `'current.wind.speed'` |
| Returns undefined traversing null | `'a.b'` on `{ a: null }` |
| Remaps fields | `apply()` with full mapping |
| Sets undefined for unmappable paths | Missing source path |
| Returns empty object for empty mapping | `apply({}, raw)` |

---

### `core/__tests__/DefinitionRegistry.test.ts`

Unit tests for definition storage and lookup.

| Test | What it verifies |
|---|---|
| Returns null for unregistered key | Empty registry |
| Registers and looks up definition | Round-trip |
| has() false before registration | Negative lookup |
| has() true after registration | Positive lookup |
| Overwrites definition with same key | Re-registration |
| all() returns every definition | Bulk retrieval |

---

### `core/__tests__/ObserverRegistry.test.ts`

Unit tests for observer subscription and notification.

| Test | What it verifies |
|---|---|
| Notifying key with no subscribers | No-op safety |
| Calls onUpdate for subscribed observer | Basic notification |
| Notifies all subscribers for key | Multiple observers |
| Does not notify a different key | Key isolation |
| Does not register same observer id twice | Deduplication |
| Unsubscribes an observer | Observer removal |
| has() returns correct state | Presence check |
| clear() removes all observers for key | Bulk removal |

---

### `core/__tests__/DataVault.test.ts`

Integration tests using **live requests to `https://jsonplaceholder.typicode.com`**.

| Test | Endpoint | What it verifies |
|---|---|---|
| Fetches a single post and maps fields | `/posts/1` | Mapping works against real JSON |
| Fetches users list (no mapping) | `/users` | Raw response, array of 10 |
| Fetches a todo and maps fields | `/todos/1` | Field extraction, boolean type |
| Returns cached data without re-fetching | `/posts/1` | `fetch` spy confirms 1 network call for 2 `get()` calls |
| Re-fetches after TTL expires | `/posts/1` | 1ms TTL + 20ms wait forces re-fetch |
| Notifies observer with mapped data | `/posts/1` | Callback receives correct shape |
| Notifies observer again after refresh | `/posts/1` | Second notification on `refresh()` |
| Does not notify after unsubscribe | `/posts/1` | Unsubscribe stops callbacks |
| once:true returns data, no observer | `/posts/1` | No callback on subsequent refresh |
| Applies transform after mapping | `/posts/1` | Title uppercased by transform fn |
| Throws for unregistered key | — | Error message format |
| Throws for 404 endpoint | `/posts/99999` | HTTP 404 propagated as error |
| Fetches multiple keys concurrently | `/posts/1`, `/users`, `/todos/1` | No cross-key contamination |

All integration tests have a 15-second timeout to accommodate network latency.

---

## Test configuration

Jest is configured in `package.json`:

```json
{
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "testMatch": ["**/__tests__/**/*.test.ts"],
    "moduleFileExtensions": ["ts", "js"]
  }
}
```

---

## Running a single suite

```bash
npx jest core/__tests__/DataVault.test.ts --verbose
npx jest core/cache/__tests__/CacheController.test.ts --verbose
```

## Run with coverage

```bash
npx jest --coverage
```
