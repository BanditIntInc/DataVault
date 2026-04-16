import { IStorageAdapter } from '../interfaces/IStorageAdapter';
import { SessionStorageAdapter } from '../adapters/SessionStorageAdapter';
import { LocalStorageAdapter } from '../adapters/LocalStorageAdapter';
import { IndexedDbAdapter } from '../adapters/IndexedDbAdapter';
import { MemoryAdapter } from '../adapters/MemoryAdapter';

export type StorageType = 'session' | 'local' | 'indexeddb' | 'memory';

export class StorageFactory {
  static create(type: StorageType): IStorageAdapter {
    switch (type) {
      case 'session':    return new SessionStorageAdapter();
      case 'local':      return new LocalStorageAdapter();
      case 'indexeddb':  return new IndexedDbAdapter();
      case 'memory':     return new MemoryAdapter();
    }
  }

  static createBestAvailable(): IStorageAdapter {
    if (typeof indexedDB !== 'undefined') return new IndexedDbAdapter();
    if (typeof localStorage !== 'undefined') return new LocalStorageAdapter();
    if (typeof sessionStorage !== 'undefined') return new SessionStorageAdapter();
    return new MemoryAdapter();
  }
}
