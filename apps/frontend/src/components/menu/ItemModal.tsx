import { useState } from 'react';
import { Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';

interface ItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  item?: any;
  onSaved?: () => void;
}

export function ItemModal({
  open,
  onOpenChange,
  // categoryId,
  item,
  onSaved,
}: ItemModalProps) {
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaveError(null);
    setSaving(true);
    try {
      // API call would happen here in Task 3 wiring
      // For now, just close and save
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      setSaveError('No pudimos guardar. Revisá tu conexión e intentá de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{item ? 'Editar item' : 'Nuevo item'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-lg px-xl py-md">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nombre del item</Label>
            <Input id="name" placeholder="Hamburguesa clásica" />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              placeholder="Carne de res, lechuga, tomate..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Lo que la agente le cuenta al cliente si pregunta.
            </p>
          </div>

          {/* Base Price */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="base_price">Precio base</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">$</span>
              <Input id="base_price" type="number" placeholder="0" />
              <span className="text-xs text-muted-foreground">ARS</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Dejalo vacío si el precio depende de la opción elegida.
            </p>
          </div>

          {/* Options Section */}
          <div className="border-t border-border pt-md">
            <div className="flex items-center gap-2 mb-md">
              <h3 className="font-semibold">Opciones (modificadores)</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-md">
              Por ejemplo: punto de cocción, extras, sin algo.
            </p>

            {/* Option group placeholder */}
            <div className="bg-background rounded p-md border border-border space-y-md">
              <div className="flex flex-col gap-1.5">
                <Label>Nombre del grupo</Label>
                <Input placeholder="Punto de cocción" />
              </div>

              <div className="grid grid-cols-2 gap-md">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1">
                    <Label>Mínimo a elegir</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info size={14} className="text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Mín 1 / Máx 1 = obligatorio, elegir uno. Mín 0 / Máx N = opcional, hasta N. Mín 0 / Máx 1 = opcional, uno solo.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input type="number" placeholder="0" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Máximo a elegir</Label>
                  <Input type="number" placeholder="1" />
                </div>
              </div>

              <Button variant="ghost" size="sm" className="w-full">
                + Agregar opción
              </Button>
            </div>

            <Button variant="ghost" size="sm" className="mt-md">
              + Agregar grupo
            </Button>
          </div>

          {saveError && (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={saving} onClick={handleSave}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
