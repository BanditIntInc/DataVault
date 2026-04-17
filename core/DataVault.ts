import { IApiDefinition, IMinioConfig } from './interfaces/IApiDefinition';
import { IObserver } from './interfaces/IObserver';
import { CacheController } from './cache/CacheController';
import { ICacheObserver } from './cache/interfaces/ICacheObserver';
import { DefinitionRegistry } from './DefinitionRegistry';
import { ObserverRegistry } from './ObserverRegistry';
import { Fetcher } from './Fetcher';
import { Mapper } from './Mapper';
import { StorageFactory, StorageType } from './cache/factory/StorageFactory';

export interface DataVaultOptions {
  storage?: StorageType | 'auto';
  minio?: IMinioConfig;
}

export class DataVault {
  private cache: CacheController;
  private definitions = new DefinitionRegistry();
  private observers = new ObserverRegistry();
  private fetcher: Fetcher;
  private cacheObserver: ICacheObserver;

  constructor(options: DataVaultOptions = {}) {
    const adapter =
      !options.storage || options.storage === 'auto'
        ? StorageFactory.createBestAvailable()
        : StorageFactory.create(options.storage);

    this.cache = new CacheController(adapter);
    this.fetcher = new Fetcher(options.minio);

    // Held so it can be unsubscribed in destroy()
    this.cacheObserver = {
      onCacheEvent: (event) => {
        if (event.type === 'invalidated' && event.key) {
          this.observers.clear(event.key);
        }
      },
    };
    this.cache.subscribe(this.cacheObserver);
  }

  getDefinitions(): DefinitionRegistry {
    return this.definitions;
  }

  registerDefinition(definition: IApiDefinition): void {
    this.definitions.register(definition);

    // For persistent transports, start watching immediately upon registration
    if (definition.type === 'websocket' || definition.type === 'poll') {
      this.fetcher.watch(
        definition,
        async (raw) => {
          const mapped = this.mapData(definition, raw);
          await this.cache.set(definition.key, mapped, definition.cacheTTL ?? 0);
          this.observers.notify(definition.key, mapped);
        },
        (err) => console.error(`[datavault] ${err.message}`)
      );
    }
  }

  async get(
    key: string,
    observer?: IObserver,
    options: { once?: boolean } = {}
  ): Promise<unknown> {
    const definition = this.definitions.lookup(key);
    if (!definition) {
      throw new Error(`[datavault] No definition registered for key "${key}"`);
    }

    if (observer && !options.once) {
      this.observers.subscribe(key, observer);
    }

    const cached = await this.cache.get(key);
    if (cached) {
      return cached.data;
    }

    // Cache miss — fetch once for rest/minio; websocket/poll already watching
    if (definition.type === 'rest' || definition.type === 'poll' || definition.type === 'minio') {
      const raw = await this.fetcher.fetchOnce(definition);
      const mapped = this.mapData(definition, raw);
      await this.cache.set(definition.key, mapped, definition.cacheTTL ?? 0);
      this.observers.notify(key, mapped);
      return mapped;
    }

    // WebSocket: data will arrive async via watch(); return null for now
    return null;
  }

  async refresh(key: string): Promise<void> {
    const definition = this.definitions.lookup(key);
    if (!definition) {
      throw new Error(`[datavault] No definition registered for key "${key}"`);
    }

    await this.cache.delete(key);

    if (definition.type === 'rest' || definition.type === 'poll' || definition.type === 'minio') {
      const raw = await this.fetcher.fetchOnce(definition);
      const mapped = this.mapData(definition, raw);
      await this.cache.set(key, mapped, definition.cacheTTL ?? 0);
      this.observers.notify(key, mapped);
    }
  }

  unsubscribe(key: string, observerId: string): void {
    this.observers.unsubscribe(key, observerId);
  }

  destroy(): void {
    this.fetcher.destroy();
    this.cache.unsubscribe(this.cacheObserver);
  }

  private mapData(definition: IApiDefinition, raw: unknown): unknown {
    let result: unknown = definition.mapping
      ? Mapper.apply(definition.mapping, raw)
      : raw;

    if (definition.transform) {
      result = definition.transform(result);
    }

    return result;
  }
}
