import { Readable } from 'stream';
import { DataVault } from '../DataVault';
import { IMinioConfig } from '../interfaces/IApiDefinition';

jest.mock('minio');

import * as Minio from 'minio';

const MINIO_CONFIG: IMinioConfig = {
  endPoint: 'play.min.io',
  port: 9000,
  useSSL: true,
  accessKey: 'minioadmin',
  secretKey: 'minioadmin',
};

function makeStream(content: string): Readable {
  return Readable.from([Buffer.from(content)]);
}

let mockGetObject: jest.Mock;
let ds: DataVault;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetObject = jest.fn();
  (Minio.Client as jest.Mock).mockImplementation(() => ({
    getObject: mockGetObject,
  }));
  ds = new DataVault({ storage: 'memory', minio: MINIO_CONFIG });
});

afterEach(() => {
  ds.destroy();
});

describe('DataVault — minio transport', () => {

  // ─── Basic fetch ─────────────────────────────────────────────────────────

  it('fetches and returns parsed JSON from a bucket', async () => {
    const payload = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
    mockGetObject.mockResolvedValue(makeStream(JSON.stringify(payload)));

    ds.registerDefinition({ key: 'profiles', type: 'minio', bucket: 'users', objectKey: 'profiles.json' });
    const result = await ds.get('profiles');

    expect(result).toEqual(payload);
  });

  // ─── Caching ─────────────────────────────────────────────────────────────

  it('returns cached data on second call without re-fetching', async () => {
    const payload = { cached: true };
    mockGetObject.mockResolvedValue(makeStream(JSON.stringify(payload)));

    ds.registerDefinition({ key: 'obj', type: 'minio', bucket: 'b', objectKey: 'o.json', cacheTTL: 60_000 });

    const first = await ds.get('obj');
    const second = await ds.get('obj');

    expect(first).toEqual(payload);
    expect(second).toEqual(payload);
    expect(mockGetObject).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after TTL expires', async () => {
    const payload = { v: 1 };
    mockGetObject.mockResolvedValue(makeStream(JSON.stringify(payload)));

    ds.registerDefinition({ key: 'obj', type: 'minio', bucket: 'b', objectKey: 'o.json', cacheTTL: 1 });

    await ds.get('obj');
    await new Promise((r) => setTimeout(r, 20));

    mockGetObject.mockResolvedValue(makeStream(JSON.stringify({ v: 2 })));
    const result = await ds.get('obj') as { v: number };

    expect(result.v).toBe(2);
    expect(mockGetObject).toHaveBeenCalledTimes(2);
  });

  // ─── Observers ───────────────────────────────────────────────────────────

  it('notifies an observer on first fetch', async () => {
    const payload = { name: 'Alice' };
    mockGetObject.mockResolvedValue(makeStream(JSON.stringify(payload)));

    ds.registerDefinition({ key: 'obj', type: 'minio', bucket: 'b', objectKey: 'o.json' });

    const cb = jest.fn();
    await ds.get('obj', { id: 'widget', onUpdate: cb });

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(payload);
  });

  it('notifies observer again after refresh', async () => {
    mockGetObject.mockResolvedValue(makeStream('{"v":1}'));
    ds.registerDefinition({ key: 'obj', type: 'minio', bucket: 'b', objectKey: 'o.json' });

    const cb = jest.fn();
    await ds.get('obj', { id: 'widget', onUpdate: cb });

    mockGetObject.mockResolvedValue(makeStream('{"v":2}'));
    await ds.refresh('obj');

    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('does not notify after unsubscribe', async () => {
    mockGetObject.mockResolvedValue(makeStream('{}'));
    ds.registerDefinition({ key: 'obj', type: 'minio', bucket: 'b', objectKey: 'o.json' });

    const cb = jest.fn();
    await ds.get('obj', { id: 'widget', onUpdate: cb });
    ds.unsubscribe('obj', 'widget');

    mockGetObject.mockResolvedValue(makeStream('{"updated":true}'));
    await ds.refresh('obj');

    expect(cb).toHaveBeenCalledTimes(1);
  });

  // ─── Mapping & transform ─────────────────────────────────────────────────

  it('applies mapping to fetched object', async () => {
    mockGetObject.mockResolvedValue(makeStream(JSON.stringify({ user: { name: 'Alice' } })));

    ds.registerDefinition({
      key: 'obj',
      type: 'minio',
      bucket: 'b',
      objectKey: 'o.json',
      mapping: { name: 'user.name' },
    });

    const result = await ds.get('obj') as Record<string, unknown>;
    expect(result.name).toBe('Alice');
  });

  it('applies transform after fetch', async () => {
    mockGetObject.mockResolvedValue(makeStream(JSON.stringify({ count: 5 })));

    ds.registerDefinition({
      key: 'obj',
      type: 'minio',
      bucket: 'b',
      objectKey: 'o.json',
      transform: (d) => ({ ...(d as object), doubled: (d as { count: number }).count * 2 }),
    });

    const result = await ds.get('obj') as { count: number; doubled: number };
    expect(result.doubled).toBe(10);
  });

  // ─── Per-definition config ────────────────────────────────────────────────

  it('uses per-definition minioConfig when provided', async () => {
    mockGetObject.mockResolvedValue(makeStream('{}'));

    const customConfig: IMinioConfig = { endPoint: 'custom.min.io', port: 443, useSSL: true, accessKey: 'x', secretKey: 'y' };
    ds.registerDefinition({ key: 'obj', type: 'minio', bucket: 'b', objectKey: 'o.json', minioConfig: customConfig });
    await ds.get('obj');

    expect(Minio.Client).toHaveBeenCalledWith(expect.objectContaining({ endPoint: 'custom.min.io' }));
  });

  // ─── Error handling ───────────────────────────────────────────────────────

  it('throws for missing bucket', async () => {
    ds.registerDefinition({ key: 'obj', type: 'minio', objectKey: 'o.json' } as any);
    await expect(ds.get('obj')).rejects.toThrow('"bucket" and "objectKey"');
  });

  it('throws when no MinIO config anywhere', async () => {
    const noCfgDs = new DataVault({ storage: 'memory' });
    noCfgDs.registerDefinition({ key: 'obj', type: 'minio', bucket: 'b', objectKey: 'o.json' });
    await expect(noCfgDs.get('obj')).rejects.toThrow('MinIO config required');
    noCfgDs.destroy();
  });

  it('propagates MinIO client errors', async () => {
    mockGetObject.mockRejectedValue(new Error('NoSuchKey'));
    ds.registerDefinition({ key: 'obj', type: 'minio', bucket: 'b', objectKey: 'missing.json' });
    await expect(ds.get('obj')).rejects.toThrow('NoSuchKey');
  });
});
