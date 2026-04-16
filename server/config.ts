import fs from 'fs';
import path from 'path';
import { IApiDefinition } from '../core/interfaces/IApiDefinition';
import { validateDefinition } from './validateDefinition';

export function loadDefinitions(configPath: string): IApiDefinition[] {
  const resolved = path.resolve(configPath);

  if (!fs.existsSync(resolved)) {
    console.warn(`[Config] No definitions file found at ${resolved}. Starting with no definitions.`);
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
  } catch (err) {
    console.error(`[Config] Failed to parse definitions file: ${(err as Error).message}`);
    return [];
  }

  if (!Array.isArray(parsed)) {
    console.error('[Config] Definitions file must be a JSON array.');
    return [];
  }

  const valid: IApiDefinition[] = [];
  for (const item of parsed) {
    const error = validateDefinition(item);
    if (error) {
      console.warn(`[Config] Skipping invalid definition: ${error}`);
    } else {
      valid.push(item as IApiDefinition);
    }
  }

  console.log(`[Config] Loaded ${valid.length}/${parsed.length} definition(s) from ${resolved}`);
  return valid;
}
