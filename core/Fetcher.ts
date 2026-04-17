import { IApiDefinition, IMinioConfig } from './interfaces/IApiDefinition';
import { MinioAdapter } from './adapters/MinioAdapter';

export type FetchCallback = (data: unknown) => void;

const FETCH_TIMEOUT_MS = 10_000;
const MIN_POLL_INTERVAL_MS = 1_000;
const WS_RECONNECT_BASE_MS = 1_000;
const WS_RECONNECT_MAX_MS = 30_000;

export class Fetcher {
  private sockets = new Map<string, WebSocket>();
  private polls = new Map<string, ReturnType<typeof setInterval>>();
  private reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private destroyed = false;
  private minioAdapter = new MinioAdapter();

  constructor(private minioConfig?: IMinioConfig) {}

  async fetchOnce(definition: IApiDefinition): Promise<unknown> {
    if (definition.type === 'rest' || definition.type === 'poll') {
      return this.fetchRest(definition);
    }
    if (definition.type === 'minio') {
      return this.minioAdapter.fetchObject(definition, this.minioConfig);
    }
    throw new Error(`fetchOnce is not supported for transport type "${definition.type}". Use watch() instead.`);
  }

  watch(definition: IApiDefinition, onData: FetchCallback, onError?: (err: Error) => void): void {
    if (definition.type === 'websocket') {
      this.openSocket(definition, onData, onError, WS_RECONNECT_BASE_MS);
    } else if (definition.type === 'poll') {
      this.startPoll(definition, onData, onError);
    }
  }

  stopWatching(key: string): void {
    const socket = this.sockets.get(key);
    if (socket) {
      socket.onclose = null;
      socket.close();
      this.sockets.delete(key);
    }

    const poll = this.polls.get(key);
    if (poll) {
      clearInterval(poll);
      this.polls.delete(key);
    }

    const reconnect = this.reconnectTimers.get(key);
    if (reconnect) {
      clearTimeout(reconnect);
      this.reconnectTimers.delete(key);
    }
  }

  destroy(): void {
    this.destroyed = true;
    for (const key of [...this.sockets.keys()]) this.stopWatching(key);
    for (const key of [...this.polls.keys()]) this.stopWatching(key);
    for (const key of [...this.reconnectTimers.keys()]) this.stopWatching(key);
  }

  private async fetchRest(definition: IApiDefinition): Promise<unknown> {
    if (!definition.url) {
      throw new Error(`[datavault] "url" is required for transport type "${definition.type}" on key "${definition.key}".`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(definition.url, {
        method: definition.method ?? 'GET',
        headers: definition.headers,
        body: definition.body ? JSON.stringify(definition.body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Fetch failed for key "${definition.key}": ${response.status} ${response.statusText}`);
      }

      return response.json();
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new Error(`Fetch timed out for key "${definition.key}" after ${FETCH_TIMEOUT_MS}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  private openSocket(
    definition: IApiDefinition,
    onData: FetchCallback,
    onError?: (err: Error) => void,
    reconnectDelay: number = WS_RECONNECT_BASE_MS
  ): void {
    if (this.destroyed) return;
    if (!definition.url) {
      onError?.(new Error(`[datavault] "url" is required for websocket transport on key "${definition.key}".`));
      return;
    }
    this.sockets.delete(definition.key);

    const socket = new WebSocket(definition.url);

    socket.onmessage = (event: MessageEvent) => {
      try {
        onData(JSON.parse(event.data as string));
      } catch {
        onData(event.data);
      }
    };

    socket.onerror = () => {
      onError?.(new Error(`WebSocket error for key "${definition.key}"`));
    };

    socket.onclose = () => {
      this.sockets.delete(definition.key);
      if (this.destroyed) return;

      const nextDelay = Math.min(reconnectDelay * 2, WS_RECONNECT_MAX_MS);
      const timer = setTimeout(() => {
        this.reconnectTimers.delete(definition.key);
        this.openSocket(definition, onData, onError, nextDelay);
      }, reconnectDelay);
      this.reconnectTimers.set(definition.key, timer);
    };

    this.sockets.set(definition.key, socket);
  }

  private startPoll(
    definition: IApiDefinition,
    onData: FetchCallback,
    onError?: (err: Error) => void
  ): void {
    this.stopWatching(definition.key);

    const interval = Math.max(definition.pollInterval ?? 30_000, MIN_POLL_INTERVAL_MS);

    const handle = setInterval(async () => {
      try {
        const data = await this.fetchRest(definition);
        onData(data);
      } catch (err) {
        onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    }, interval);

    this.polls.set(definition.key, handle);
  }
}
