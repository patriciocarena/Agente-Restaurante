import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api';

interface AvailabilityToggleProps {
  itemId: string;
  initialValue: boolean;
  onResult?: (val: boolean) => void;
}

export function AvailabilityToggle({
  itemId,
  initialValue,
  onResult,
}: AvailabilityToggleProps) {
  const [val, setVal] = useState(initialValue);
  const [busy, setBusy] = useState(false);

  async function handleChange(next: boolean) {
    setVal(next); // optimistic
    setBusy(true);
    try {
      await api.toggleAvailability(itemId, next);
      onResult?.(next);
    } catch {
      setVal(!next); // revert
      // Toast surfaced by the page via CustomEvent
      window.dispatchEvent(
        new CustomEvent('menu:toast', {
          detail: { msg: 'El cambio no se guardó. Probá de nuevo.' },
        })
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Switch
      checked={val}
      disabled={busy}
      onCheckedChange={handleChange}
      aria-label="Disponibilidad del item"
    />
  );
}
