import http from 'http';
import express from 'express';
import { DataService } from '../core/DataService';
import { createHttpRouter } from './HttpAdapter';
import { WsAdapter } from './WsAdapter';
import { loadDefinitions } from './config';
import { VERSION, LICENSE, AUTHOR } from '../core/version';

const PORT = Number(process.env.PORT ?? 3000);
const DEFINITIONS_FILE = process.env.DEFINITIONS_FILE ?? './definitions.json';
const STORAGE = (process.env.STORAGE ?? 'memory') as 'memory' | 'local' | 'session' | 'indexeddb';

// Bootstrap
const dataService = new DataService({ storage: STORAGE });

// Load definitions from file and register
const defs = loadDefinitions(DEFINITIONS_FILE);
for (const def of defs) {
  dataService.registerDefinition(def);
}

// HTTP server
const app = express();
app.use(express.json());
app.use('/api', createHttpRouter(dataService));

const server = http.createServer(app);

// WebSocket upgrade
const wsAdapter = new WsAdapter(dataService);

server.on('upgrade', (req, socket, head) => {
  if (req.url === '/ws') {
    wsAdapter.handleUpgrade(req, socket as import('net').Socket, head);
  } else {
    socket.destroy();
  }
});

server.listen(PORT, () => {
  console.log(`datavault v${VERSION} — ${LICENSE} — © ${AUTHOR}`);
  console.log(`[datavault] HTTP  → http://localhost:${PORT}/api`);
  console.log(`[datavault] WS    → ws://localhost:${PORT}/ws`);
  console.log(`[datavault] Storage mode: ${STORAGE}`);
});

process.on('SIGTERM', () => {
  dataService.destroy();
  server.close();
});
