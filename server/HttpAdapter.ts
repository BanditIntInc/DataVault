import { Router, Request, Response } from 'express';
import { DataVault } from '../core/DataVault';
import { IApiDefinition } from '../core/interfaces/IApiDefinition';
import { validateDefinition } from './validateDefinition';
import { VERSION, LICENSE, AUTHOR } from '../core/version';

export function createHttpRouter(dataService: DataVault): Router {
  const definitions = dataService.getDefinitions();
  const router = Router();

  // GET /health
  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      name: 'datavault',
      version: VERSION,
      license: LICENSE,
      author: AUTHOR,
      uptime: process.uptime(),
    });
  });

  // GET /definitions — list all registered definitions
  router.get('/definitions', (_req: Request, res: Response) => {
    // Return definitions without transform fn (not serialisable)
    const safe = definitions.all().map(({ transform: _t, ...rest }) => rest);
    res.json(safe);
  });

  // POST /definitions — register a new definition at runtime
  router.post('/definitions', (req: Request, res: Response) => {
    const validationError = validateDefinition(req.body);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    try {
      dataService.registerDefinition(req.body as IApiDefinition);
      res.status(201).json({ registered: (req.body as IApiDefinition).key });
    } catch {
      res.status(500).json({ error: 'Failed to register definition.' });
    }
  });

  // GET /data/:key — one-time fetch, no observer registered
  router.get('/data/:key', async (req: Request, res: Response) => {
    const { key } = req.params;

    try {
      const data = await dataService.get(key, undefined, { once: true });
      res.json({ key, data });
    } catch (err) {
      res.status(404).json({ error: (err as Error).message });
    }
  });

  // DELETE /data/:key — clear a specific key from cache
  router.delete('/data/:key', async (req: Request, res: Response) => {
    const { key } = req.params;

    try {
      await dataService.refresh(key);
      res.json({ refreshed: key });
    } catch (err) {
      res.status(404).json({ error: (err as Error).message });
    }
  });

  return router;
}
