import { ICacheCommand } from '../interfaces/ICacheCommand';
import { IStorageAdapter } from '../interfaces/IStorageAdapter';

export class InvalidateCommand implements ICacheCommand<string[]> {
  constructor(private adapter: IStorageAdapter) {}

  async execute(): Promise<string[]> {
    const keys = await this.adapter.keys();
    const now = Date.now();

    const checks = await Promise.all(
      keys.map(async (key) => {
        const entry = await this.adapter.get(key);
        return entry && entry.ttl > 0 && now - entry.fetchedAt > entry.ttl ? key : null;
      })
    );

    const expired = checks.filter((k): k is string => k !== null);
    await Promise.all(expired.map((key) => this.adapter.delete(key)));
    return expired;
  }
}
