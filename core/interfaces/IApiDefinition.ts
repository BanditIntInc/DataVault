export type TransportType = 'rest' | 'websocket' | 'poll';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface IApiDefinition {
  key: string;
  url: string;
  type: TransportType;
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  pollInterval?: number;
  cacheTTL?: number;
  mapping?: Record<string, string>;
  transform?: (raw: unknown) => unknown;
}
