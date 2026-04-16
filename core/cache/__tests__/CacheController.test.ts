import { CacheController } from '../CacheController';
import { MemoryAdapter } from '../adapters/MemoryAdapter';
import { ICacheObserver, CacheEvent } from '../interfaces/ICacheObserver';

const makeController = () => new CacheController(new MemoryAdapter());

describe('CacheController', () => {
  it('returns null on miss', async () => {
    const cache = makeController();
    expect(await cache.get('nope')).toBeNull();
  });

  it('stores and retrieves data', async () => {
    const cache = makeController();
    await cache.set('users', [1, 2, 3]);
    const entry = await cache.get('users');
    expect(entry?.data).toEqual([1, 2, 3]);
  });

  it('respects TTL — returns null for expired entries', async () => {
    const cache = makeController();
    await cache.set('temp', 'value', 1); // 1ms TTL
    await new Promise((r) => setTimeout(r, 10));
    expect(await cache.get('temp')).toBeNull();
  });

  it('never expires entries with ttl = 0', async () => {
    const cache = makeController();
    await cache.set('forever', 'value', 0);
    await new Promise((r) => setTimeout(r, 10));
    expect(await cache.get('forever')).not.toBeNull();
  });

  it('isValid returns false for missing key', async () => {
    const cache = makeController();
    expect(await cache.isValid('ghost')).toBe(false);
  });

  it('isValid returns true for a live entry', async () => {
    const cache = makeController();
    await cache.set('live', 'data', 60_000);
    expect(await cache.isValid('live')).toBe(true);
  });

  it('delete removes a key', async () => {
    const cache = makeController();
    await cache.set('gone', 'data');
    await cache.delete('gone');
    expect(await cache.get('gone')).toBeNull();
  });

  it('clear removes all keys', async () => {
    const cache = makeController();
    await cache.set('a', 1);
    await cache.set('b', 2);
    await cache.clear();
    expect(await cache.get('a')).toBeNull();
    expect(await cache.get('b')).toBeNull();
  });

  it('invalidateExpired only removes expired entries', async () => {
    const cache = makeController();
    await cache.set('stale', 'old', 1);
    await cache.set('fresh', 'new', 60_000);
    await new Promise((r) => setTimeout(r, 10));
    await cache.invalidateExpired();
    expect(await cache.get('stale')).toBeNull();
    expect(await cache.get('fresh')).not.toBeNull();
  });

  describe('events', () => {
    const collectEvents = (cache: CacheController): CacheEvent[] => {
      const events: CacheEvent[] = [];
      const observer: ICacheObserver = { onCacheEvent: (e) => events.push(e) };
      cache.subscribe(observer);
      return events;
    };

    it('emits set event', async () => {
      const cache = makeController();
      const events = collectEvents(cache);
      await cache.set('x', 1);
      expect(events).toContainEqual(expect.objectContaining({ type: 'set', key: 'x' }));
    });

    it('emits hit event on valid get', async () => {
      const cache = makeController();
      await cache.set('x', 1);
      const events = collectEvents(cache);
      await cache.get('x');
      expect(events).toContainEqual(expect.objectContaining({ type: 'hit', key: 'x' }));
    });

    it('emits miss event on empty get', async () => {
      const cache = makeController();
      const events = collectEvents(cache);
      await cache.get('ghost');
      expect(events).toContainEqual(expect.objectContaining({ type: 'miss', key: 'ghost' }));
    });

    it('emits deleted event', async () => {
      const cache = makeController();
      await cache.set('x', 1);
      const events = collectEvents(cache);
      await cache.delete('x');
      expect(events).toContainEqual(expect.objectContaining({ type: 'deleted', key: 'x' }));
    });

    it('emits cleared event', async () => {
      const cache = makeController();
      const events = collectEvents(cache);
      await cache.clear();
      expect(events).toContainEqual(expect.objectContaining({ type: 'cleared' }));
    });

    it('stops emitting after unsubscribe', async () => {
      const cache = makeController();
      const events: CacheEvent[] = [];
      const observer: ICacheObserver = { onCacheEvent: (e) => events.push(e) };
      cache.subscribe(observer);
      cache.unsubscribe(observer);
      await cache.set('x', 1);
      expect(events).toHaveLength(0);
    });
  });
});
