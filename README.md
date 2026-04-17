# DataVault

A framework-agnostic TypeScript data service that acts as a smart cache and observer hub. Fetch, cache, map, and broadcast any data source to any consumer — as an embedded library or a standalone microservice.

## Install

```bash
npm install @banditintinc/datavault
```

## Quick start

```typescript
import { DataVault } from '@banditintinc/datavault';

const ds = new DataVault({ storage: 'indexeddb' });

ds.registerDefinition({
  key: 'users',
  url: 'https://api.example.com/users',
  type: 'rest',
  cacheTTL: 60_000,
});

ds.get('users', {
  id: 'UserList',
  onUpdate: (data) => renderTable(data),
});
```

## Modes

| Mode | Description |
|---|---|
| **Library** | Import directly into any frontend or Node app — runs in-process |
| **Microservice** | Run as a standalone HTTP + WebSocket server — any client connects over the network |

## Documentation

Full documentation is available in the [Wiki](https://github.com/BanditIntInc/DataVault/wiki).

| Topic | |
|---|---|
| Getting started | [Getting-Started](https://github.com/BanditIntInc/DataVault/wiki/Getting-Started) |
| Library mode | [Library-Mode](https://github.com/BanditIntInc/DataVault/wiki/Library-Mode) |
| Microservice mode | [Microservice-Mode](https://github.com/BanditIntInc/DataVault/wiki/Microservice-Mode) |
| API reference | [API-Reference](https://github.com/BanditIntInc/DataVault/wiki/API-Reference) |
| Storage adapters | [Storage-Adapters](https://github.com/BanditIntInc/DataVault/wiki/Storage-Adapters) |

## License

MIT © David Pardini
