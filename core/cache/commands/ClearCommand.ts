import { ICacheCommand } from '../interfaces/ICacheCommand';
import { IStorageAdapter } from '../interfaces/IStorageAdapter';

export class ClearCommand implements ICacheCommand<void> {
  constructor(private adapter: IStorageAdapter) {}

  execute(): Promise<void> {
    return this.adapter.clear();
  }
}
