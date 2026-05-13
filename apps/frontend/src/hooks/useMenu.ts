import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

type Category = { id: string; name: string; sort_order: number };
type Item = any; // shape from backend; nested option_groups

export function useMenu(restaurantId: string | null | undefined) {
  const [categories, setCategories] = useState<Category[] | undefined>(undefined);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [items, setItems] = useState<Record<string, Item[]>>({}); // keyed by category_id
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetchCategories = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError(null);
    try {
      const { categories } = await api.listCategories();
      setCategories(categories);
      if (!activeCategoryId && categories.length > 0) setActiveCategoryId(categories[0].id);
    } catch (e) {
      setError(e instanceof ApiError ? e.code : 'load_failed');
    } finally {
      setLoading(false);
    }
  }, [restaurantId, activeCategoryId]);

  const refetchItems = useCallback(async (categoryId: string) => {
    try {
      const { items: rows } = await api.listItems(categoryId);
      setItems((m) => ({ ...m, [categoryId]: rows }));
    } catch (e) {
      setError(e instanceof ApiError ? e.code : 'load_failed');
    }
  }, []);

  useEffect(() => {
    if (restaurantId) refetchCategories();
  }, [restaurantId, refetchCategories]);

  useEffect(() => {
    if (activeCategoryId) refetchItems(activeCategoryId);
  }, [activeCategoryId, refetchItems]);

  // Realtime patch (called by useMenuRealtime subscription handler in MenuEditor)
  const applyRemoteItemUpdate = useCallback((updated: Item) => {
    setItems((m) => {
      const list = m[updated.category_id];
      if (!list) return m;
      return {
        ...m,
        [updated.category_id]: list.map((i) =>
          i.id === updated.id ? { ...i, ...updated } : i
        ),
      };
    });
  }, []);

  return {
    categories,
    activeCategoryId,
    setActiveCategoryId,
    items: activeCategoryId ? items[activeCategoryId] ?? [] : [],
    loading,
    error,
    refetchCategories,
    refetchItems,
    applyRemoteItemUpdate,
    // CRUD passthroughs (the page composes with these + refetch)
    createCategory: async (name: string) => {
      await api.createCategory({ name });
      await refetchCategories();
    },
    renameCategory: async (id: string, name: string) => {
      await api.renameCategory(id, { name });
      await refetchCategories();
    },
    deleteCategory: async (id: string) => {
      await api.deleteCategory(id);
      setActiveCategoryId(null);
      await refetchCategories();
    },
    createItem: async (body: any) => {
      await api.createItem(body);
      if (activeCategoryId) await refetchItems(activeCategoryId);
    },
    updateItem: async (id: string, body: any) => {
      await api.updateItem(id, body);
      if (activeCategoryId) await refetchItems(activeCategoryId);
    },
    deleteItem: async (id: string) => {
      await api.deleteItem(id);
      if (activeCategoryId) await refetchItems(activeCategoryId);
    },
    toggleAvailability: api.toggleAvailability,
    loadTemplate: async () => {
      await api.loadTemplate();
      await refetchCategories();
    },
  };
}
