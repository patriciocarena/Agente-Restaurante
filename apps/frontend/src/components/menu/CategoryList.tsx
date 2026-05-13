import { useState } from 'react';
import { GripVertical, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Category {
  id: string;
  name: string;
  sort_order: number;
}

interface CategoryListProps {
  categories: Category[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onRequestDelete: (id: string) => void;
}

export function CategoryList({
  categories,
  activeId,
  onSelect,
  onCreate,
  onRequestDelete,
}: CategoryListProps) {
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState('');

  function handleCreate() {
    if (newName.trim()) {
      onCreate(newName);
      setNewName('');
      setCreatingNew(false);
    }
  }

  return (
    <aside className="w-[280px] bg-card border-r border-border flex flex-col">
      <div className="p-md text-xs font-semibold text-muted-foreground">Categorías</div>
      <ul className="flex-1 overflow-y-auto">
        {creatingNew && (
          <li className="px-md py-2 border-b border-border">
            <Input
              autoFocus
              placeholder="Ej: Hamburguesas"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') setCreatingNew(false);
              }}
              onBlur={handleCreate}
              className="h-8"
            />
          </li>
        )}
        {categories.map((c) => (
          <li key={c.id}>
            <button
              onClick={() => onSelect(c.id)}
              className={cn(
                'group w-full flex items-center gap-sm px-md py-2 text-left text-sm font-semibold hover:bg-white/5 min-h-[40px]',
                c.id === activeId && 'border-l-[3px] border-l-primary'
              )}
            >
              <GripVertical
                size={14}
                className="text-muted-foreground opacity-0 group-hover:opacity-100"
                aria-label="Reordenar categoría"
              />
              <span className="flex-1 truncate">{c.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRequestDelete(c.id);
                }}
                aria-label={`Borrar categoría ${c.name}`}
              >
                <Trash2 size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100" />
              </button>
            </button>
          </li>
        ))}
      </ul>
      <button
        onClick={() => setCreatingNew(true)}
        className="w-full border border-dashed border-border text-sm px-md py-2 hover:bg-white/5"
      >
        + Nueva categoría
      </button>
    </aside>
  );
}
