// apps/backend/src/lib/forwarding-instructions.ts
// D-08: USSD codes para activar desvío de llamadas por operador AR.
// Activación: cliente apreta el código en su celular ANTES de la primera llamada.
// Desactivación: '#21#' (universal en AR).
// Doc canónico vive fuera del repo — ver getForwardingDocsUrl().

export const forwardingInstructions = {
  movistar: '*21*<numero>#',
  claro: '**21*<numero>#',
  personal: '*21*<numero>#',
  desactivar: '#21#',
} as const;

export function getForwardingDocsUrl(): string {
  return process.env.FORWARDING_DOCS_URL ?? 'https://example.com/forwarding';
}

export function getSupportContactUrl(): string {
  return process.env.SUPPORT_CONTACT_URL ?? 'mailto:soporte@example.com';
}
