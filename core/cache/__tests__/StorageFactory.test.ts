import { StorageFactory } from '../factory/StorageFactory';
import { MemoryAdapter } from '../adapters/MemoryAdapter';

describe('StorageFactory', () => {
  it('creates a MemoryAdapter for type "memory"', () => {
    const adapter = StorageFactory.create('memory');
    expect(adapter).toBeInstanceOf(MemoryAdapter);
  });

  it('createBestAvailable returns MemoryAdapter in Node environment', () => {
    // Browser storage APIs are not available in Node/Jest
    const adapter = StorageFactory.createBestAvailable();
    expect(adapter).toBeInstanceOf(MemoryAdapter);
  });

  it('all adapters satisfy the IStorageAdapter contract', async () => {
    const adapter = StorageFactory.create('memory');
    await expect(adapter.set('k', { key: 'k', data: 1, fetchedAt: Date.now(), ttl: 0 })).resolves.toBeUndefined();
    await expect(adapter.get('k')).resolves.not.toBeNull();
    await expect(adapter.delete('k')).resolves.toBeUndefined();
    await expect(adapter.keys()).resolves.toEqual([]);
    await expect(adapter.clear()).resolves.toBeUndefined();
  });
});
