import { ICacheEntry } from './ICacheEntry';

export interface IStorageAdapter {
  get(key: string): Promise<ICacheEntry | null>;
  set(key: string, entry: ICacheEntry): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}
