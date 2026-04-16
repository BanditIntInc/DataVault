import { MemoryAdapter } from '../adapters/MemoryAdapter';
import { ICacheEntry } from '../interfaces/ICacheEntry';

const makeEntry = (key: string, ttl = 0): ICacheEntry => ({
  key,
  data: { value: 42 },
  fetchedAt: Date.now(),
  ttl,
});

describe('MemoryAdapter', () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = new MemoryAdapter();
  });

  it('returns null for a key that does not exist', async () => {
    expect(await adapter.get('missing')).toBeNull();
  });

  it('stores and retrieves an entry', async () => {
    const entry = makeEntry('users');
    await adapter.set('users', entry);
    expect(await adapter.get('users')).toEqual(entry);
  });

  it('overwrites an existing entry on set', async () => {
    await adapter.set('users', makeEntry('users'));
    const updated = { ...makeEntry('users'), data: { value: 99 } };
    await adapter.set('users', updated);
    expect(await adapter.get('users')).toEqual(updated);
  });

  it('deletes an entry', async () => {
    await adapter.set('users', makeEntry('users'));
    await adapter.delete('users');
    expect(await adapter.get('users')).toBeNull();
  });

  it('clears all entries', async () => {
    await adapter.set('a', makeEntry('a'));
    await adapter.set('b', makeEntry('b'));
    await adapter.clear();
    expect(await adapter.get('a')).toBeNull();
    expect(await adapter.get('b')).toBeNull();
  });

  it('returns all keys', async () => {
    await adapter.set('a', makeEntry('a'));
    await adapter.set('b', makeEntry('b'));
    const keys = await adapter.keys();
    expect(keys.sort()).toEqual(['a', 'b']);
  });
});
