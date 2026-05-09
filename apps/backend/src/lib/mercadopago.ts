// apps/backend/src/lib/mercadopago.ts
// D-10: Lazy singleton — no requiere MERCADO_PAGO_ACCESS_TOKEN hasta Phase 5.
// Usar getMpClient() en lugar de importar mpClient directamente.
import { MercadoPagoConfig } from 'mercadopago';

let _mpClient: MercadoPagoConfig | null = null;

export function getMpClient(): MercadoPagoConfig {
  if (!_mpClient) {
    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!token) {
      throw new Error('Missing required env var: MERCADO_PAGO_ACCESS_TOKEN (se activa en Phase 5)');
    }
    _mpClient = new MercadoPagoConfig({ accessToken: token, options: { timeout: 5000 } });
  }
  return _mpClient;
}
