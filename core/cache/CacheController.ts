import { IStorageAdapter } from './interfaces/IStorageAdapter';
import { ICacheEntry } from './interfaces/ICacheEntry';
import { ICacheObserver } from './interfaces/ICacheObserver';
import { GetCommand } from './commands/GetCommand';
import { SetCommand } from './commands/SetCommand';
import { DeleteCommand } from './commands/DeleteCommand';
import { ClearCommand } from './commands/ClearCommand';
import { InvalidateCommand } from './commands/InvalidateCommand';
import { CacheEventEmitter } from './observers/CacheEventEmitter';

export class CacheController {
  private emitter = new CacheEventEmitter();

  constructor(private adapter: IStorageAdapter) {}

  subscribe(observer: ICacheObserver): void {
    this.emitter.subscribe(observer);
  }

  unsubscribe(observer: ICacheObserver): void {
    this.emitter.unsubscribe(observer);
  }

  async get(key: string): Promise<ICacheEntry | null> {
    const entry = await new GetCommand(this.adapter, key).execute();

    if (!entry) {
      this.emitter.emit({ type: 'miss', key });
      return null;
    }

    if (this.isEntryExpired(entry)) {
      await new DeleteCommand(this.adapter, key).execute();
      this.emitter.emit({ type: 'miss', key });
      return null;
    }

    this.emitter.emit({ type: 'hit', key, entry });
    return entry;
  }

  async set(key: string, data: unknown, ttl = 0): Promise<void> {
    const entry: ICacheEntry = { key, data, fetchedAt: Date.now(), ttl };
    await new SetCommand(this.adapter, key, entry).execute();
    this.emitter.emit({ type: 'set', key, entry });
  }

  async delete(key: string): Promise<void> {
    await new DeleteCommand(this.adapter, key).execute();
    this.emitter.emit({ type: 'deleted', key });
  }

  async clear(): Promise<void> {
    await new ClearCommand(this.adapter).execute();
    this.emitter.emit({ type: 'cleared' });
  }

  async invalidateExpired(): Promise<void> {
    const removed = await new InvalidateCommand(this.adapter).execute();
    for (const key of removed) {
      this.emitter.emit({ type: 'invalidated', key });
    }
  }

  async isValid(key: string): Promise<boolean> {
    const entry = await new GetCommand(this.adapter, key).execute();
    if (!entry) return false;
    return !this.isEntryExpired(entry);
  }

  private isEntryExpired(entry: ICacheEntry): boolean {
    if (entry.ttl === 0) return false;
    return Date.now() - entry.fetchedAt > entry.ttl;
  }
}
