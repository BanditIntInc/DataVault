import { ICacheEntry } from './ICacheEntry';

export type CacheEventType = 'set' | 'hit' | 'miss' | 'invalidated' | 'deleted' | 'cleared';

export interface CacheEvent {
  type: CacheEventType;
  key?: string;
  entry?: ICacheEntry;
}

export interface ICacheObserver {
  onCacheEvent(event: CacheEvent): void;
}
