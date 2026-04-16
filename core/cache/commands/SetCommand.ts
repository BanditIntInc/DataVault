import { ICacheCommand } from '../interfaces/ICacheCommand';
import { ICacheEntry } from '../interfaces/ICacheEntry';
import { IStorageAdapter } from '../interfaces/IStorageAdapter';

export class SetCommand implements ICacheCommand<void> {
  constructor(
    private adapter: IStorageAdapter,
    private key: string,
    private entry: ICacheEntry
  ) {}

  execute(): Promise<void> {
    return this.adapter.set(this.key, this.entry);
  }
}
