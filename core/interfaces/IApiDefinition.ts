export type TransportType = 'rest' | 'websocket' | 'poll' | 'minio';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface IMinioConfig {
  endPoint: string;
  port?: number;
  useSSL?: boolean;
  accessKey: string;
  secretKey: string;
  region?: string;
}

export interface IMinioFetcher {
  fetchObject(definition: IApiDefinition, globalConfig?: IMinioConfig): Promise<unknown>;
}

export interface IApiDefinition {
  key: string;
  type: TransportType;
  url?: string;
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  pollInterval?: number;
  cacheTTL?: number;
  mapping?: Record<string, string>;
  transform?: (raw: unknown) => unknown;
  // MinIO-specific
  bucket?: string;
  objectKey?: string;
  minioConfig?: IMinioConfig;
}
