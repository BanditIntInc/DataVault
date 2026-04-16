# DataService

A framework-agnostic TypeScript data service that acts as a smart cache and observer hub. Any frontend or backend consumer can ask for a piece of data by key. The service fetches it, caches it, and pushes updates to every registered observer automatically.

## What it does

1. A consumer requests data by key
2. If the data is cached and still valid, it is returned immediately
3. If not, the service looks up the registered API definition for that key, makes the upstream call, maps the response, stores it, and notifies observers
4. On every future change, all observers are notified automatically

## Deployment modes

| Mode | Description |
|---|---|
| **[[Library Mode\|Library-Mode]]** | Import directly into any frontend or Node app — runs in-process |
| **[[Microservice Mode\|Microservice-Mode]]** | Run as a standalone HTTP + WebSocket server — any client connects over the network |

The core logic is identical in both modes. Only the transport layer differs.

## Quick navigation

| Topic | Page |
|---|---|
| System overview and diagrams | [[Architecture]] |
| Getting up and running fast | [[Getting-Started]] |
| Full DataService public API | [[API-Reference]] |
| Defining data sources | [[Definitions]] |
| Cache internals | [[Cache-Design]] |
| Storage backends | [[Storage-Adapters]] |
| REST, WebSocket, and polling | [[Transport-Types]] |
| Field mapping and transforms | [[Data-Mapping]] |
| HTTP and WebSocket protocol | [[Microservice-Mode]] |
| Design patterns used | [[Design-Patterns]] |
| Security features | [[Security]] |
| Running the test suite | [[Testing]] |

## At a glance

```typescript
import { DataService } from '@dataservice/core';

const ds = new DataService({ storage: 'indexeddb' });

ds.registerDefinition({
  key: 'users',
  url: 'https://api.example.com/users',
  type: 'rest',
  method: 'GET',
  cacheTTL: 60_000,
  mapping: { name: 'profile.displayName', email: 'contact.email' }
});

ds.get('users', {
  id: 'UserList',
  onUpdate: (data) => renderTable(data)
});
```

## Tech stack

- TypeScript 5.4
- Node 20
- Express 4 (microservice HTTP layer)
- `ws` (microservice WebSocket layer)
- Jest + ts-jest (tests)
