# Library Mode

In library mode DataService runs entirely inside your app's process. No server, no network hop — just import and use.

## Install

```bash
npm install   # from the DataService directory
```

## Import

```typescript
import { DataService } from './lib';
// or directly:
import { DataService } from './core/DataService';
```

## Setup

```typescript
const ds = new DataService({ storage: 'auto' });
```

`'auto'` selects the best available backend for the current environment. See [[Storage-Adapters]] for details.

---

## React example

```typescript
import { useEffect, useState } from 'react';
import { DataService } from './lib';

const ds = new DataService({ storage: 'indexeddb' });

ds.registerDefinition({
  key: 'users',
  url: 'https://jsonplaceholder.typicode.com/users',
  type: 'rest',
  cacheTTL: 60_000,
});

export function UserList() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    ds.get('users', {
      id: 'UserList',
      onUpdate: (data) => setUsers(data as typeof users),
    });

    return () => ds.unsubscribe('users', 'UserList');
  }, []);

  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

---

## Vue example

```typescript
import { ref, onMounted, onUnmounted } from 'vue';
import { DataService } from './lib';

const ds = new DataService({ storage: 'local' });

ds.registerDefinition({
  key: 'posts',
  url: 'https://jsonplaceholder.typicode.com/posts',
  type: 'rest',
  cacheTTL: 30_000,
});

export function usePosts() {
  const posts = ref([]);

  onMounted(() => {
    ds.get('posts', {
      id: 'usePosts',
      onUpdate: (data) => { posts.value = data as typeof posts.value; },
    });
  });

  onUnmounted(() => ds.unsubscribe('posts', 'usePosts'));

  return { posts };
}
```

---

## Vanilla JS example

```typescript
import { DataService } from './lib';

const ds = new DataService();

ds.registerDefinition({
  key: 'todo.1',
  url: 'https://jsonplaceholder.typicode.com/todos/1',
  type: 'rest',
  mapping: { title: 'title', done: 'completed' },
});

ds.get('todo.1', {
  id: 'todo-widget',
  onUpdate: (data) => {
    const d = data as { title: string; done: boolean };
    document.getElementById('todo-title').textContent = d.title;
    document.getElementById('todo-status').textContent = d.done ? '✓' : '○';
  },
});
```

---

## Singleton pattern (recommended)

Create the `DataService` once and share it across your app. Avoid creating multiple instances with the same storage backend — they won't share cache state.

```typescript
// services/dataService.ts
import { DataService } from '../lib';

export const ds = new DataService({ storage: 'indexeddb' });

// Register all definitions at startup
ds.registerDefinition({ key: 'users', url: '...', type: 'rest', cacheTTL: 60_000 });
ds.registerDefinition({ key: 'posts', url: '...', type: 'rest', cacheTTL: 30_000 });
```

```typescript
// anywhere in your app
import { ds } from './services/dataService';

const data = await ds.get('users', observer);
```

---

## Cleanup

Always call `ds.destroy()` when the service is no longer needed (e.g., app unmount, test teardown). This closes WebSocket connections and clears polling intervals.

```typescript
window.addEventListener('beforeunload', () => ds.destroy());
```

---

## Storage selection guide

| Scenario | Recommended |
|---|---|
| Node.js / server-side | `'memory'` |
| Browser, large data | `'indexeddb'` |
| Browser, small data, needs persistence | `'local'` |
| Browser, session-only, tab-isolated | `'session'` |
| Testing | `'memory'` |
| Unknown environment | `'auto'` |
