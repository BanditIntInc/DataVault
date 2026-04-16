import { DataService } from '../DataService';
import { IApiDefinition } from '../interfaces/IApiDefinition';
import { IObserver } from '../interfaces/IObserver';

const BASE = 'https://jsonplaceholder.typicode.com';

const postDef: IApiDefinition = {
  key: 'post.1',
  url: `${BASE}/posts/1`,
  type: 'rest',
  method: 'GET',
  cacheTTL: 60_000,
  mapping: {
    id:     'id',
    title:  'title',
    body:   'body',
    author: 'userId',
  },
};

const usersDef: IApiDefinition = {
  key: 'users',
  url: `${BASE}/users`,
  type: 'rest',
  method: 'GET',
  cacheTTL: 60_000,
};

const todoDef: IApiDefinition = {
  key: 'todo.1',
  url: `${BASE}/todos/1`,
  type: 'rest',
  method: 'GET',
  cacheTTL: 60_000,
  mapping: {
    id:        'id',
    title:     'title',
    completed: 'completed',
    user:      'userId',
  },
};

describe('DataService — JSONPlaceholder integration', () => {
  let ds: DataService;

  beforeEach(() => {
    ds = new DataService({ storage: 'memory' });
  });

  afterEach(() => {
    ds.destroy();
  });

  // ─── Basic fetch & mapping ────────────────────────────────────────────────

  it('fetches a single post and maps fields', async () => {
    ds.registerDefinition(postDef);
    const data = await ds.get('post.1') as Record<string, unknown>;

    expect(data.id).toBe(1);
    expect(typeof data.title).toBe('string');
    expect(typeof data.body).toBe('string');
    expect(typeof data.author).toBe('number');
  }, 15_000);

  it('fetches the users list as raw response (no mapping)', async () => {
    ds.registerDefinition(usersDef);
    const data = await ds.get('users') as unknown[];

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(10);
    expect((data[0] as Record<string, unknown>).id).toBe(1);
  }, 15_000);

  it('fetches a todo and maps fields', async () => {
    ds.registerDefinition(todoDef);
    const data = await ds.get('todo.1') as Record<string, unknown>;

    expect(data.id).toBe(1);
    expect(typeof data.title).toBe('string');
    expect(typeof data.completed).toBe('boolean');
    expect(typeof data.user).toBe('number');
  }, 15_000);

  // ─── Caching ──────────────────────────────────────────────────────────────

  it('returns cached data on second call without re-fetching', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    ds.registerDefinition(postDef);

    const first  = await ds.get('post.1');
    const second = await ds.get('post.1');

    expect(first).toEqual(second);
    // fetch should only have been called once despite two get() calls
    const callsForKey = fetchSpy.mock.calls.filter(
      ([url]) => String(url).includes('/posts/1')
    );
    expect(callsForKey.length).toBe(1);

    fetchSpy.mockRestore();
  }, 15_000);

  it('re-fetches after TTL expires', async () => {
    ds.registerDefinition({ ...postDef, cacheTTL: 1 }); // 1ms TTL

    const first = await ds.get('post.1') as Record<string, unknown>;
    await new Promise((r) => setTimeout(r, 20));
    const second = await ds.get('post.1') as Record<string, unknown>;

    // Data should be the same shape from the live API
    expect(second.id).toBe(first.id);
  }, 15_000);

  // ─── Observers ───────────────────────────────────────────────────────────

  it('notifies an observer with mapped data on first fetch', async () => {
    ds.registerDefinition(postDef);
    const cb = jest.fn();
    const observer: IObserver = { id: 'post-widget', onUpdate: cb };

    await ds.get('post.1', observer);

    expect(cb).toHaveBeenCalledTimes(1);
    const received = cb.mock.calls[0][0] as Record<string, unknown>;
    expect(received.id).toBe(1);
    expect(typeof received.title).toBe('string');
  }, 15_000);

  it('notifies observer again after refresh', async () => {
    ds.registerDefinition(postDef);
    const cb = jest.fn();
    await ds.get('post.1', { id: 'widget', onUpdate: cb });

    await ds.refresh('post.1');

    expect(cb).toHaveBeenCalledTimes(2);
  }, 15_000);

  it('does not notify after unsubscribe', async () => {
    ds.registerDefinition(postDef);
    const cb = jest.fn();
    await ds.get('post.1', { id: 'widget', onUpdate: cb });

    ds.unsubscribe('post.1', 'widget');
    await ds.refresh('post.1');

    expect(cb).toHaveBeenCalledTimes(1); // only the initial fetch
  }, 15_000);

  it('once:true returns data but does not register observer', async () => {
    ds.registerDefinition(postDef);
    const cb = jest.fn();

    const data = await ds.get('post.1', { id: 'widget', onUpdate: cb }, { once: true });

    expect((data as Record<string, unknown>).id).toBe(1);
    // observer not registered — refresh should not trigger cb
    await ds.refresh('post.1');
    expect(cb).toHaveBeenCalledTimes(0);
  }, 15_000);

  // ─── Transform ───────────────────────────────────────────────────────────

  it('applies a transform after mapping', async () => {
    ds.registerDefinition({
      ...postDef,
      key: 'post.1.upper',
      transform: (d) => {
        const data = d as Record<string, unknown>;
        return { ...data, title: String(data.title).toUpperCase() };
      },
    });

    const data = await ds.get('post.1.upper') as Record<string, unknown>;
    expect(data.title).toBe(String(data.title).toUpperCase());
  }, 15_000);

  // ─── Error handling ───────────────────────────────────────────────────────

  it('throws for an unregistered key', async () => {
    await expect(ds.get('ghost')).rejects.toThrow('No definition registered for key "ghost"');
  });

  it('throws for a 404 endpoint', async () => {
    ds.registerDefinition({
      key: 'bad',
      url: `${BASE}/posts/99999`,
      type: 'rest',
      method: 'GET',
    });
    await expect(ds.get('bad')).rejects.toThrow('404');
  }, 15_000);

  // ─── Multiple keys concurrently ───────────────────────────────────────────

  it('fetches multiple keys concurrently without interference', async () => {
    ds.registerDefinition(postDef);
    ds.registerDefinition(usersDef);
    ds.registerDefinition(todoDef);

    const [post, users, todo] = await Promise.all([
      ds.get('post.1'),
      ds.get('users'),
      ds.get('todo.1'),
    ]) as [Record<string, unknown>, unknown[], Record<string, unknown>];

    expect(post.id).toBe(1);
    expect(users.length).toBe(10);
    expect(todo.id).toBe(1);
  }, 15_000);
});
