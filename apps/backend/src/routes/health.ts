import { Router } from 'express';

export const healthRouter = Router();

// Railway probes GET /health. Must return 2xx or the deploy is marked failed.
healthRouter.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok', ts: new Date().toISOString() });
});
