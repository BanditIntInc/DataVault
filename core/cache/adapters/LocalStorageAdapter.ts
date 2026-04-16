import { IStorageAdapter } from '../interfaces/IStorageAdapter';
import { ICacheEntry } from '../interfaces/ICacheEntry';

const PREFIX = 'ds:';

export class LocalStorageAdapter implements IStorageAdapter {
  async get(key: string): Promise<ICacheEntry | null> {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ICacheEntry;
    } catch {
      return null;
    }
  }

  async set(key: string, entry: ICacheEntry): Promise<void> {
    localStorage.setItem(PREFIX + key, JSON.stringify(entry));
  }

  async delete(key: string): Promise<void> {
    localStorage.removeItem(PREFIX + key);
  }

  async clear(): Promise<void> {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  }

  async keys(): Promise<string[]> {
    const result: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) result.push(k.slice(PREFIX.length));
    }
    return result;
  }
}
