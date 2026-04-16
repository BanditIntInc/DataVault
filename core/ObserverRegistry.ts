import { IObserver } from './interfaces/IObserver';

export class ObserverRegistry {
  // Map<key, Map<observerId, observer>> — O(1) subscribe/unsubscribe/dedup
  private registry = new Map<string, Map<string, IObserver>>();

  subscribe(key: string, observer: IObserver): void {
    let observers = this.registry.get(key);
    if (!observers) {
      observers = new Map();
      this.registry.set(key, observers);
    }
    observers.set(observer.id, observer);
  }

  unsubscribe(key: string, observerId: string): void {
    const observers = this.registry.get(key);
    if (!observers) return;
    observers.delete(observerId);
    if (observers.size === 0) this.registry.delete(key);
  }

  notify(key: string, data: unknown): void {
    const observers = this.registry.get(key);
    if (!observers) return;
    for (const observer of observers.values()) {
      try {
        observer.onUpdate(data);
      } catch (err) {
        console.error(`[ObserverRegistry] Observer "${observer.id}" threw on key "${key}":`, err);
      }
    }
  }

  has(key: string, observerId: string): boolean {
    return !!this.registry.get(key)?.has(observerId);
  }

  clear(key: string): void {
    this.registry.delete(key);
  }
}
