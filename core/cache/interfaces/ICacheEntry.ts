export interface ICacheEntry {
  key: string;
  data: unknown;
  fetchedAt: number;
  ttl: number;
}
