// apps/frontend/src/components/onboarding/TwilioErrorScreen.tsx
// Error pane for Twilio provisioning failures with 3-retry counter.
// D-07, D-16: pre-3 shows "Reintentar" (ghost), post-3 shows "Escribir a soporte" (primary).

import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface TwilioErrorScreenProps {
  retryCount: number;
  onRetry: () => Promise<void>;
  supportUrl?: string;
  isRetrying?: boolean;
}

export function TwilioErrorScreen({
  retryCount,
  onRetry,
  supportUrl = 'mailto:soporte@agente-restaurante.com',
  isRetrying = false,
}: TwilioErrorScreenProps) {
  const hasExhaustedRetries = retryCount >= 3;

  return (
    <div className="flex items-center justify-center">
      <Card className="max-w-md p-8 text-center">
        <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-4 opacity-10" />

        {hasExhaustedRetries ? (
          <>
            <h2 className="text-lg font-semibold mb-2">
              Hay un problema con la asignación
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Escribinos a soporte y te ayudamos a configurarlo. Mientras tanto tu
              cuenta queda guardada.
            </p>
            <Button
              asChild
              onClick={() => window.location.href = supportUrl}
            >
              <a href={supportUrl}>Escribir a soporte</a>
            </Button>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold mb-2">
              No pudimos asignar tu número todavía
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Hubo un problema al conectar tu línea con el sistema. Probá de nuevo
              en unos segundos.
            </p>
            <Button
              variant="ghost"
              onClick={onRetry}
              disabled={isRetrying}
            >
              {isRetrying ? 'Reintentando…' : 'Reintentar'}
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
