import { Pizza } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  onLoadTemplate: () => void;
  onCreateFirst: () => void;
  loading?: boolean;
}

export function EmptyState({ onLoadTemplate, onCreateFirst, loading }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-lg max-w-md mx-auto py-2xl text-center">
      <Pizza size={40} className="text-muted-foreground" />
      <h1 className="text-[28px] font-semibold leading-[1.1] text-foreground">
        Tu menú está vacío
      </h1>
      <p className="text-sm text-muted-foreground">
        Podés arrancar con un menú base de hamburguesería o crearlo desde cero.
      </p>
      <div className="flex gap-md w-full">
        <Button
          onClick={onLoadTemplate}
          disabled={loading}
          className="flex-1"
        >
          Cargar template hamburguesera
        </Button>
        <Button
          variant="ghost"
          onClick={onCreateFirst}
          disabled={loading}
          className="flex-1"
        >
          Crear primera categoría
        </Button>
      </div>
    </div>
  );
}
