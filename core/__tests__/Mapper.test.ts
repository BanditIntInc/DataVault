import { Mapper } from '../Mapper';

describe('Mapper.resolve', () => {
  const data = {
    current: {
      temp_f: 72,
      condition: { text: 'Sunny' },
    },
    humidity: 55,
  };

  it('resolves a top-level key', () => {
    expect(Mapper.resolve('humidity', data)).toBe(55);
  });

  it('resolves a nested path', () => {
    expect(Mapper.resolve('current.temp_f', data)).toBe(72);
  });

  it('resolves a deeply nested path', () => {
    expect(Mapper.resolve('current.condition.text', data)).toBe('Sunny');
  });

  it('returns undefined for a missing path', () => {
    expect(Mapper.resolve('current.wind.speed', data)).toBeUndefined();
  });

  it('returns undefined when traversing null', () => {
    expect(Mapper.resolve('a.b', { a: null })).toBeUndefined();
  });
});

describe('Mapper.apply', () => {
  const raw = {
    current: { temp_f: 72, condition: { text: 'Sunny' } },
    humidity: 55,
  };

  it('remaps fields according to the mapping', () => {
    const result = Mapper.apply(
      { temperature: 'current.temp_f', condition: 'current.condition.text' },
      raw
    );
    expect(result).toEqual({ temperature: 72, condition: 'Sunny' });
  });

  it('sets undefined for unmappable paths', () => {
    const result = Mapper.apply({ wind: 'current.wind.speed' }, raw);
    expect(result.wind).toBeUndefined();
  });

  it('returns an empty object for an empty mapping', () => {
    expect(Mapper.apply({}, raw)).toEqual({});
  });
});
