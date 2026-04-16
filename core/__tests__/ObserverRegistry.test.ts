import { ObserverRegistry } from '../ObserverRegistry';
import { IObserver } from '../interfaces/IObserver';

const makeObserver = (id: string, fn = jest.fn()): IObserver => ({ id, onUpdate: fn });

describe('ObserverRegistry', () => {
  let registry: ObserverRegistry;

  beforeEach(() => {
    registry = new ObserverRegistry();
  });

  it('notifying a key with no subscribers does nothing', () => {
    expect(() => registry.notify('users', {})).not.toThrow();
  });

  it('calls onUpdate for a subscribed observer', () => {
    const cb = jest.fn();
    registry.subscribe('users', makeObserver('comp-a', cb));
    registry.notify('users', { id: 1 });
    expect(cb).toHaveBeenCalledWith({ id: 1 });
  });

  it('notifies all subscribers for a key', () => {
    const cb1 = jest.fn();
    const cb2 = jest.fn();
    registry.subscribe('users', makeObserver('a', cb1));
    registry.subscribe('users', makeObserver('b', cb2));
    registry.notify('users', 'payload');
    expect(cb1).toHaveBeenCalledWith('payload');
    expect(cb2).toHaveBeenCalledWith('payload');
  });

  it('does not notify a different key', () => {
    const cb = jest.fn();
    registry.subscribe('users', makeObserver('a', cb));
    registry.notify('posts', 'payload');
    expect(cb).not.toHaveBeenCalled();
  });

  it('does not register the same observer id twice', () => {
    const cb = jest.fn();
    const obs = makeObserver('a', cb);
    registry.subscribe('users', obs);
    registry.subscribe('users', obs);
    registry.notify('users', 'x');
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes an observer', () => {
    const cb = jest.fn();
    registry.subscribe('users', makeObserver('a', cb));
    registry.unsubscribe('users', 'a');
    registry.notify('users', 'x');
    expect(cb).not.toHaveBeenCalled();
  });

  it('has() returns correct state', () => {
    registry.subscribe('users', makeObserver('a'));
    expect(registry.has('users', 'a')).toBe(true);
    expect(registry.has('users', 'b')).toBe(false);
    registry.unsubscribe('users', 'a');
    expect(registry.has('users', 'a')).toBe(false);
  });

  it('clear() removes all observers for a key', () => {
    const cb = jest.fn();
    registry.subscribe('users', makeObserver('a', cb));
    registry.clear('users');
    registry.notify('users', 'x');
    expect(cb).not.toHaveBeenCalled();
  });
});
