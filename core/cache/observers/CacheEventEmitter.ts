import { ICacheObserver, CacheEvent } from '../interfaces/ICacheObserver';

export class CacheEventEmitter {
  private observers: ICacheObserver[] = [];

  subscribe(observer: ICacheObserver): void {
    if (!this.observers.includes(observer)) {
      this.observers.push(observer);
    }
  }

  unsubscribe(observer: ICacheObserver): void {
    const index = this.observers.indexOf(observer);
    if (index >= 0) this.observers.splice(index, 1);
  }

  emit(event: CacheEvent): void {
    for (const observer of this.observers) {
      observer.onCacheEvent(event);
    }
  }
}
