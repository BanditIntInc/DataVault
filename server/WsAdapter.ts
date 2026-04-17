import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { DataVault } from '../core/DataVault';

interface ClientMessage {
  action: 'subscribe' | 'unsubscribe' | 'get' | 'refresh';
  key: string;
  once?: boolean;
}

interface RateState {
  count: number;
  resetAt: number;
}

const RATE_LIMIT = 30;          // max messages per window
const RATE_WINDOW_MS = 1_000;   // window size in ms
const MAX_KEY_LENGTH = 128;
const VALID_KEY = /^[a-zA-Z0-9._\-:]+$/;

function send(socket: WebSocket, payload: unknown): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function sanitizeError(err: unknown): string {
  if (err instanceof Error) {
    // Strip URLs and file paths from error messages before sending to clients
    return err.message
      .replace(/https?:\/\/[^\s]*/g, '[url]')
      .replace(/wss?:\/\/[^\s]*/g, '[url]')
      .replace(/\/[a-zA-Z0-9/_\-.]+/g, '[path]');
  }
  return 'An unexpected error occurred.';
}

export class WsAdapter {
  private wss: WebSocketServer;
  private clientKeys = new Map<WebSocket, Set<string>>();
  private clientIds = new WeakMap<WebSocket, string>();
  private rateLimits = new Map<WebSocket, RateState>();

  constructor(private dataService: DataVault) {
    this.wss = new WebSocketServer({ noServer: true });
    this.wss.on('connection', (socket) => this.handleConnection(socket));
  }

  handleUpgrade(req: IncomingMessage, socket: import('net').Socket, head: Buffer): void {
    this.wss.handleUpgrade(req, socket, head, (ws) => {
      this.wss.emit('connection', ws, req);
    });
  }

  private handleConnection(socket: WebSocket): void {
    this.clientKeys.set(socket, new Set());

    socket.on('message', async (raw) => {
      if (this.isRateLimited(socket)) {
        send(socket, { type: 'error', message: 'Rate limit exceeded. Slow down.' });
        return;
      }

      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString()) as ClientMessage;
      } catch {
        send(socket, { type: 'error', message: 'Invalid JSON message.' });
        return;
      }

      await this.handleMessage(socket, msg);
    });

    socket.on('close', () => {
      const keys = this.clientKeys.get(socket);
      if (keys) {
        for (const key of keys) {
          this.dataService.unsubscribe(key, this.clientId(socket));
        }
      }
      this.clientKeys.delete(socket);
      this.rateLimits.delete(socket);
    });
  }

  private async handleMessage(socket: WebSocket, msg: ClientMessage): Promise<void> {
    const { action, key, once } = msg;

    const keyError = this.validateKey(key);
    if (keyError) {
      send(socket, { type: 'error', message: keyError });
      return;
    }

    try {
      switch (action) {
        case 'subscribe':
        case 'get': {
          const isOnce = once ?? action === 'get';
          const observer = {
            id: this.clientId(socket),
            onUpdate: (data: unknown) => send(socket, { type: 'data', key, data }),
          };
          const data = await this.dataService.get(key, observer, { once: isOnce });
          if (data !== null && data !== undefined) {
            send(socket, { type: 'data', key, data });
          }
          if (!isOnce) {
            this.clientKeys.get(socket)?.add(key);
          }
          break;
        }

        case 'unsubscribe': {
          this.dataService.unsubscribe(key, this.clientId(socket));
          this.clientKeys.get(socket)?.delete(key);
          send(socket, { type: 'unsubscribed', key });
          break;
        }

        case 'refresh': {
          await this.dataService.refresh(key);
          break;
        }

        default:
          send(socket, { type: 'error', message: `Unknown action.` });
      }
    } catch (err) {
      send(socket, { type: 'error', key, message: sanitizeError(err) });
    }
  }

  private clientId(socket: WebSocket): string {
    let id = this.clientIds.get(socket);
    if (!id) {
      id = `ws-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      this.clientIds.set(socket, id);
    }
    return id;
  }

  private isRateLimited(socket: WebSocket): boolean {
    const now = Date.now();
    let state = this.rateLimits.get(socket);

    if (!state || now > state.resetAt) {
      state = { count: 0, resetAt: now + RATE_WINDOW_MS };
    }

    state.count++;
    this.rateLimits.set(socket, state);
    return state.count > RATE_LIMIT;
  }

  private validateKey(key: unknown): string | null {
    if (!key || typeof key !== 'string') return 'Missing required field: key.';
    if (key.length > MAX_KEY_LENGTH) return `Key exceeds maximum length of ${MAX_KEY_LENGTH}.`;
    if (!VALID_KEY.test(key)) return 'Key contains invalid characters. Use letters, numbers, dots, hyphens, underscores, and colons.';
    return null;
  }
}
