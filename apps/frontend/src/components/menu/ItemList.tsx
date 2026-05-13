import { Pencil, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AvailabilityToggle } from './AvailabilityToggle';

interface ItemListProps {
  items: any[];
  onEdit: (item: any) => void;
  flashIds?: Set<string>;
}

// Per-category empty state when there are categories but this one is empty
function PerCategoryEmpty({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-lg py-2xl text-center">
      <UtensilsCrossed size={32} className="text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Esta categoría no tiene items todavía.</p>
      <Button onClick={onNew} className="mt-sm">
        + Nuevo item
      </Button>
    </div>
  );
}

export function ItemList({
  items,
  onEdit,
  flashIds = new Set(),
}: ItemListProps) {
  if (items.length === 0) {
    return <PerCategoryEmpty onNew={() => {}} />;
  }

  return (
    <div className="flex flex-col">
      {items.map((it) => (
        <div
          key={it.id}
          className={cn(
            'flex items-center gap-md px-md min-h-16 border-b border-border',
            !it.available && 'opacity-60',
            flashIds.has(it.id) && 'animate-flash-primary'
          )}
          aria-label={`Item ${it.name}`}
        >
          <div className="flex-1">
            <div className="text-sm font-semibold">{it.name}</div>
            {!it.available && (
              <span className="text-xs text-muted-foreground">Sin stock</span>
            )}
          </div>
          <div className="text-sm text-right tabular-nums">
            {it.base_price == null ? (
              <span className="text-muted-foreground">Variable</span>
            ) : (
              `$${it.base_price.toLocaleString('es-AR')}`
            )}
          </div>
          <AvailabilityToggle itemId={it.id} initialValue={it.available} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(it)}
            aria-label={`Editar ${it.name}`}
          >
            <Pencil size={14} />
            Editar
          </Button>
        </div>
      ))}
    </div>
  );
}
