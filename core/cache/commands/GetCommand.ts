import { ICacheCommand } from '../interfaces/ICacheCommand';
import { ICacheEntry } from '../interfaces/ICacheEntry';
import { IStorageAdapter } from '../interfaces/IStorageAdapter';

export class GetCommand implements ICacheCommand<ICacheEntry | null> {
  constructor(private adapter: IStorageAdapter, private key: string) {}

  execute(): Promise<ICacheEntry | null> {
    return this.adapter.get(this.key);
  }
}
