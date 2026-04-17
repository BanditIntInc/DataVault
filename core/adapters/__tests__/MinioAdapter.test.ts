import { Readable } from 'stream';
import { MinioAdapter } from '../MinioAdapter';
import { IApiDefinition, IMinioConfig } from '../../interfaces/IApiDefinition';

jest.mock('minio');

import * as Minio from 'minio';

const BASE_CONFIG: IMinioConfig = {
  endPoint: 'play.min.io',
  port: 9000,
  useSSL: true,
  accessKey: 'minioadmin',
  secretKey: 'minioadmin',
};

const BASE_DEF: IApiDefinition = {
  key: 'test',
  type: 'minio',
  bucket: 'my-bucket',
  objectKey: 'data.json',
};

function makeStream(content: string): Readable {
  return Readable.from([Buffer.from(content)]);
}

let mockGetObject: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetObject = jest.fn();
  (Minio.Client as jest.Mock).mockImplementation(() => ({
    getObject: mockGetObject,
  }));
});

describe('MinioAdapter — fetchObject', () => {

  // ─── JSON parsing ────────────────────────────────────────────────────────

  it('fetches and parses a JSON object', async () => {
    const payload = { name: 'Alice', age: 30 };
    mockGetObject.mockResolvedValue(makeStream(JSON.stringify(payload)));

    const adapter = new MinioAdapter();
    const result = await adapter.fetchObject(BASE_DEF, BASE_CONFIG);

    expect(result).toEqual(payload);
  });

  it('fetches and parses a JSON array', async () => {
    const payload = [{ id: 1 }, { id: 2 }];
    mockGetObject.mockResolvedValue(makeStream(JSON.stringify(payload)));

    const adapter = new MinioAdapter();
    const result = await adapter.fetchObject(BASE_DEF, BASE_CONFIG);

    expect(result).toEqual(payload);
  });

  it('returns raw string when content is not valid JSON', async () => {
    mockGetObject.mockResolvedValue(makeStream('plain text content'));

    const adapter = new MinioAdapter();
    const result = await adapter.fetchObject(BASE_DEF, BASE_CONFIG);

    expect(result).toBe('plain text content');
  });

  it('handles multi-chunk streams correctly', async () => {
    const payload = { chunked: true };
    const json = JSON.stringify(payload);
    const stream = Readable.from([
      Buffer.from(json.slice(0, 5)),
      Buffer.from(json.slice(5)),
    ]);
    mockGetObject.mockResolvedValue(stream);

    const adapter = new MinioAdapter();
    const result = await adapter.fetchObject(BASE_DEF, BASE_CONFIG);

    expect(result).toEqual(payload);
  });

  // ─── Config resolution ───────────────────────────────────────────────────

  it('uses per-definition minioConfig over global config', async () => {
    const defConfig: IMinioConfig = { endPoint: 'custom.min.io', port: 443, useSSL: true, accessKey: 'a', secretKey: 'b' };
    const def = { ...BASE_DEF, minioConfig: defConfig };
    mockGetObject.mockResolvedValue(makeStream('{}'));

    const adapter = new MinioAdapter();
    await adapter.fetchObject(def, BASE_CONFIG);

    expect(Minio.Client).toHaveBeenCalledWith(expect.objectContaining({ endPoint: 'custom.min.io' }));
  });

  it('falls back to global config when definition has no minioConfig', async () => {
    mockGetObject.mockResolvedValue(makeStream('{}'));

    const adapter = new MinioAdapter();
    await adapter.fetchObject(BASE_DEF, BASE_CONFIG);

    expect(Minio.Client).toHaveBeenCalledWith(expect.objectContaining({ endPoint: 'play.min.io' }));
  });

  it('passes correct bucket and objectKey to getObject', async () => {
    mockGetObject.mockResolvedValue(makeStream('{}'));

    const adapter = new MinioAdapter();
    await adapter.fetchObject(BASE_DEF, BASE_CONFIG);

    expect(mockGetObject).toHaveBeenCalledWith('my-bucket', 'data.json');
  });

  it('defaults port to 9000 and useSSL to true when omitted', async () => {
    const minimalConfig: IMinioConfig = { endPoint: 'min.io', accessKey: 'a', secretKey: 'b' };
    mockGetObject.mockResolvedValue(makeStream('{}'));

    const adapter = new MinioAdapter();
    await adapter.fetchObject(BASE_DEF, minimalConfig);

    expect(Minio.Client).toHaveBeenCalledWith(expect.objectContaining({ port: 9000, useSSL: true }));
  });

  // ─── Client caching ──────────────────────────────────────────────────────

  it('reuses the same client for the same endpoint and access key', async () => {
    mockGetObject.mockResolvedValue(makeStream('{}'));

    const adapter = new MinioAdapter();
    await adapter.fetchObject(BASE_DEF, BASE_CONFIG);
    await adapter.fetchObject({ ...BASE_DEF, objectKey: 'other.json' }, BASE_CONFIG);

    expect(Minio.Client).toHaveBeenCalledTimes(1);
  });

  it('creates separate clients for different endpoints', async () => {
    mockGetObject.mockResolvedValue(makeStream('{}'));

    const otherConfig: IMinioConfig = { endPoint: 'other.min.io', port: 9000, useSSL: true, accessKey: 'a', secretKey: 'b' };
    const adapter = new MinioAdapter();
    await adapter.fetchObject(BASE_DEF, BASE_CONFIG);
    await adapter.fetchObject(BASE_DEF, otherConfig);

    expect(Minio.Client).toHaveBeenCalledTimes(2);
  });

  // ─── Validation errors ───────────────────────────────────────────────────

  it('throws when no config is provided', async () => {
    const adapter = new MinioAdapter();
    await expect(adapter.fetchObject(BASE_DEF)).rejects.toThrow('MinIO config required');
  });

  it('throws when bucket is missing', async () => {
    const adapter = new MinioAdapter();
    await expect(
      adapter.fetchObject({ ...BASE_DEF, bucket: undefined }, BASE_CONFIG)
    ).rejects.toThrow('"bucket" and "objectKey"');
  });

  it('throws when objectKey is missing', async () => {
    const adapter = new MinioAdapter();
    await expect(
      adapter.fetchObject({ ...BASE_DEF, objectKey: undefined }, BASE_CONFIG)
    ).rejects.toThrow('"bucket" and "objectKey"');
  });
});
