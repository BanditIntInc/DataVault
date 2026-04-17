# Library Mode

In library mode DataVault runs entirely inside your app's process. No server, no network hop — just import and use.

## Install

```bash
npm install   # from the DataVault directory
```

## Import

```typescript
import { DataVault } from '@banditintinc/datavault';
// or directly:
import { DataVault } from '@banditintinc/datavault';
```

## Setup

```typescript
const ds = new DataVault({ storage: 'auto' });
```

`'auto'` selects the best available backend for the current environment. See [[Storage-Adapters]] for details.

---

## React example

```typescript
import { useEffect, useState } from 'react';
import { DataVault } from '@banditintinc/datavault';

const ds = new DataVault({ storage: 'indexeddb' });

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
import { DataVault } from '@banditintinc/datavault';

const ds = new DataVault({ storage: 'local' });

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

## Angular example

```typescript
// data.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { DataVault } from '@banditintinc/datavault';

@Injectable({ providedIn: 'root' })
export class AppDataVault implements OnDestroy {
  private ds = new DataVault({ storage: 'indexeddb' });

  readonly users$ = new BehaviorSubject<any[]>([]);

  constructor() {
    this.ds.registerDefinition({
      key: 'users',
      url: 'https://jsonplaceholder.typicode.com/users',
      type: 'rest',
      cacheTTL: 60_000,
    });

    this.ds.get('users', {
      id: 'AppDataVault',
      onUpdate: (data) => this.users$.next(data as any[]),
    });
  }

  ngOnDestroy() {
    this.ds.unsubscribe('users', 'AppDataVault');
    this.ds.destroy();
  }
}
```

```typescript
// user-list.component.ts
import { Component } from '@angular/core';
import { AppDataVault } from './data.service';

@Component({
  selector: 'app-user-list',
  template: `
    <ul>
      <li *ngFor="let user of appData.users$ | async">{{ user.name }}</li>
    </ul>
  `,
})
export class UserListComponent {
  constructor(public appData: AppDataVault) {}
}
```

---

## Vanilla JS example

```typescript
import { DataVault } from '@banditintinc/datavault';

const ds = new DataVault();

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

Create the `DataVault` once and share it across your app. Avoid creating multiple instances with the same storage backend — they won't share cache state.

```typescript
// services/dataService.ts
import { DataVault } from '@banditintinc/datavault';

export const ds = new DataVault({ storage: 'indexeddb' });

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
