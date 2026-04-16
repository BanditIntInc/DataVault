import { IApiDefinition } from './interfaces/IApiDefinition';

export class DefinitionRegistry {
  private definitions = new Map<string, IApiDefinition>();

  register(definition: IApiDefinition): void {
    this.definitions.set(definition.key, definition);
  }

  lookup(key: string): IApiDefinition | null {
    return this.definitions.get(key) ?? null;
  }

  has(key: string): boolean {
    return this.definitions.has(key);
  }

  all(): IApiDefinition[] {
    return Array.from(this.definitions.values());
  }
}
