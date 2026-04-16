export class Mapper {
  static resolve(path: string, data: unknown): unknown {
    return path.split('.').reduce((current: unknown, segment: string) => {
      if (current === null || current === undefined) return undefined;
      return (current as Record<string, unknown>)[segment];
    }, data);
  }

  static apply(mapping: Record<string, string>, raw: unknown): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [targetKey, sourcePath] of Object.entries(mapping)) {
      result[targetKey] = Mapper.resolve(sourcePath, raw);
    }
    return result;
  }
}
