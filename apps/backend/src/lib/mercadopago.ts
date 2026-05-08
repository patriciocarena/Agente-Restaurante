// apps/backend/src/lib/mercadopago.ts
// D-10: Singleton initialized in Phase 1; first real API call in Phase 5.
import { MercadoPagoConfig } from 'mercadopago';

export const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
  options: { timeout: 5000 },
});
