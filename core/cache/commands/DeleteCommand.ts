import { ICacheCommand } from '../interfaces/ICacheCommand';
import { IStorageAdapter } from '../interfaces/IStorageAdapter';

export class DeleteCommand implements ICacheCommand<void> {
  constructor(private adapter: IStorageAdapter, private key: string) {}

  execute(): Promise<void> {
    return this.adapter.delete(this.key);
  }
}
