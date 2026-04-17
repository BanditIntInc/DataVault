import * as Minio from 'minio';
import { IApiDefinition, IMinioConfig } from '../interfaces/IApiDefinition';

export class MinioAdapter {
  private clients = new Map<string, Minio.Client>();

  private getClient(config: IMinioConfig): Minio.Client {
    const clientKey = `${config.endPoint}:${config.port ?? 9000}:${config.accessKey}`;
    let client = this.clients.get(clientKey);
    if (!client) {
      client = new Minio.Client({
        endPoint: config.endPoint,
        port: config.port ?? 9000,
        useSSL: config.useSSL ?? true,
        accessKey: config.accessKey,
        secretKey: config.secretKey,
        region: config.region,
      });
      this.clients.set(clientKey, client);
    }
    return client;
  }

  async fetchObject(definition: IApiDefinition, globalConfig?: IMinioConfig): Promise<unknown> {
    const config = definition.minioConfig ?? globalConfig;
    if (!config) {
      throw new Error(
        `[datavault] MinIO config required for key "${definition.key}". ` +
        `Provide it in DataVaultOptions.minio or in the definition's minioConfig.`
      );
    }
    if (!definition.bucket || !definition.objectKey) {
      throw new Error(
        `[datavault] MinIO definitions require "bucket" and "objectKey" for key "${definition.key}".`
      );
    }

    const client = this.getClient(config);
    const stream = await client.getObject(definition.bucket, definition.objectKey);

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
    }

    const raw = Buffer.concat(chunks).toString('utf-8');

    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
}
