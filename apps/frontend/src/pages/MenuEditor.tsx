import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRestaurantId, signOut } from '@/lib/auth';
import { useMenu } from '@/hooks/useMenu';
import { useMenuRealtime } from '@/hooks/useMenuRealtime';
import { Button } from '@/components/ui/button';
import { CategoryList } from '@/components/menu/CategoryList';
import { ItemList } from '@/components/menu/ItemList';
import { EmptyState } from '@/components/menu/EmptyState';
import { DeleteCategoryDialog } from '@/components/menu/DeleteCategoryDialog';

export default function MenuEditor() {
  const restaurantId = useRestaurantId();
  const navigate = useNavigate();
  const menu = useMenu(restaurantId);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (restaurantId === null) {
      navigate('/onboarding', { replace: true });
    }
  }, [restaurantId, navigate]);

  // MENU-04: realtime flash on remote UPDATE
  const handleRemote = useCallback(
    (row: any) => {
      menu.applyRemoteItemUpdate(row);
      setFlashIds((s) => new Set(s).add(row.id));
      setTimeout(() => {
        setFlashIds((s) => {
          const n = new Set(s);
          n.delete(row.id);
          return n;
        });
      }, 400);
    },
    [menu]
  );
  useMenuRealtime(restaurantId ?? undefined, handleRemote);

  // toast bridge for AvailabilityToggle (revert path)
  useEffect(() => {
    const fn = (e: any) => {
      setToast(e.detail.msg);
      setTimeout(() => setToast(null), 3000);
    };
    window.addEventListener('menu:toast', fn);
    return () => window.removeEventListener('menu:toast', fn);
  }, []);

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  // Delete category logic
  async function handleConfirmDelete(categoryId: string) {
    await menu.deleteCategory(categoryId);
    setDeletingCategoryId(null);
  }

  const deletingCategory = menu.categories?.find((c) => c.id === deletingCategoryId);
  const itemCountForDelete = deletingCategory
    ? menu.items.filter((i) => i.category_id === deletingCategoryId).length
    : 0;

  // Three-state rendering (undefined=loading, null=no restaurant, string=ready)
  if (restaurantId === undefined) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="h-14 bg-card border-b border-border flex items-center justify-between px-6">
          <span className="text-sm font-semibold">Tu menú</span>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            Cerrar sesión
          </Button>
        </header>
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="flex flex-col gap-3 w-full max-w-sm animate-pulse">
            <div className="h-7 bg-card rounded" />
            <div className="h-4 bg-card rounded w-3/4" />
            <div className="h-10 bg-card rounded" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-14 bg-card border-b border-border flex items-center justify-between px-6">
        <span className="text-sm font-semibold">Tu menú</span>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          Cerrar sesión
        </Button>
      </header>

      {/* Empty state */}
      {!menu.loading && menu.categories && menu.categories.length === 0 ? (
        <main className="flex-1 flex items-center justify-center px-4">
          <EmptyState
            onLoadTemplate={() => menu.loadTemplate()}
            onCreateFirst={() => {
              // The input in CategoryList will be auto-focused
            }}
            loading={menu.loading}
          />
        </main>
      ) : (
        /* Sidebar + main layout */
        <div className="flex flex-1 overflow-hidden">
          <CategoryList
            categories={menu.categories ?? []}
            activeId={menu.activeCategoryId}
            onSelect={(id) => menu.setActiveCategoryId(id)}
            onCreate={(name) => menu.createCategory(name)}
            onRequestDelete={(id) => setDeletingCategoryId(id)}
          />
          <main className="flex-1 flex flex-col overflow-y-auto">
            {menu.activeCategoryId && (
              <>
                <div className="px-lg py-md flex items-center justify-between">
                  <h2 className="text-xl font-semibold">
                    {menu.categories?.find((c) => c.id === menu.activeCategoryId)?.name}
                  </h2>
                  <Button className="text-sm">+ Nuevo item</Button>
                </div>
                <ItemList
                  items={menu.items}
                  onEdit={() => {
                    // Task 3 will wire the item modal here
                  }}
                  flashIds={flashIds}
                />
              </>
            )}
          </main>
        </div>
      )}

      {/* Delete category dialog */}
      <DeleteCategoryDialog
        open={deletingCategoryId !== null}
        onOpenChange={(open) => !open && setDeletingCategoryId(null)}
        itemCount={itemCountForDelete}
        onConfirm={() => handleConfirmDelete(deletingCategoryId!)}
      />

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-md right-md bg-card border border-border px-md py-sm rounded text-sm"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
