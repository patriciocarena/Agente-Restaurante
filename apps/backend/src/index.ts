import express from 'express';
import { healthRouter } from './routes/health';
import { logger } from './lib/logger';

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

// Fail-fast env validation. Missing any required var = crash before listen().
// MERCADO_PAGO_ACCESS_TOKEN se agrega en Phase 5 (billing). No es requerido en Phase 1.
const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    // Use plain console here — logger may itself depend on env later.
    // eslint-disable-next-line no-console
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

app.use(express.json());
app.use('/health', healthRouter);

// Only listen if not under test runner.
// Bind explicitly to 0.0.0.0 so Railway healthcheck (and any reverse proxy)
// can reach the server. Default `app.listen(PORT)` may bind only to localhost
// in some Node versions, breaking external probes.
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    logger.info('backend up', { port: PORT });
  });
}

export default app;
