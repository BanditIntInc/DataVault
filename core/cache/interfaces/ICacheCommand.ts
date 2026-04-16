export interface ICacheCommand<T = unknown> {
  execute(): Promise<T>;
}
