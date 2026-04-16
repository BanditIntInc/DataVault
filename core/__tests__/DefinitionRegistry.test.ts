import { DefinitionRegistry } from '../DefinitionRegistry';
import { IApiDefinition } from '../interfaces/IApiDefinition';

const def: IApiDefinition = {
  key: 'users',
  url: 'https://api.example.com/users',
  type: 'rest',
  method: 'GET',
};

describe('DefinitionRegistry', () => {
  let registry: DefinitionRegistry;

  beforeEach(() => {
    registry = new DefinitionRegistry();
  });

  it('returns null for an unregistered key', () => {
    expect(registry.lookup('unknown')).toBeNull();
  });

  it('registers and looks up a definition', () => {
    registry.register(def);
    expect(registry.lookup('users')).toEqual(def);
  });

  it('has() returns false before registration', () => {
    expect(registry.has('users')).toBe(false);
  });

  it('has() returns true after registration', () => {
    registry.register(def);
    expect(registry.has('users')).toBe(true);
  });

  it('overwrites a definition with the same key', () => {
    registry.register(def);
    const updated = { ...def, url: 'https://api.example.com/v2/users' };
    registry.register(updated);
    expect(registry.lookup('users')?.url).toBe('https://api.example.com/v2/users');
  });

  it('all() returns every registered definition', () => {
    const def2: IApiDefinition = { key: 'posts', url: 'https://api.example.com/posts', type: 'rest' };
    registry.register(def);
    registry.register(def2);
    expect(registry.all()).toHaveLength(2);
  });
});
