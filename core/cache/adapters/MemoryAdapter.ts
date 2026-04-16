import { IStorageAdapter } from '../interfaces/IStorageAdapter';
import { ICacheEntry } from '../interfaces/ICacheEntry';

export class MemoryAdapter implements IStorageAdapter {
  private store = new Map<string, ICacheEntry>();

  async get(key: string): Promise<ICacheEntry | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, entry: ICacheEntry): Promise<void> {
    this.store.set(key, entry);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async keys(): Promise<string[]> {
    return Array.from(this.store.keys());
  }
}
