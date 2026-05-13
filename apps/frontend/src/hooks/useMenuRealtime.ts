import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// MENU-04: subscripción Supabase Realtime para que el toggle de disponibilidad
// se propague a otras pestañas/dispositivos en <2s. RLS se respeta automáticamente
// porque la publicación supabase_realtime es RLS-aware (RESEARCH Pattern 3).
export function useMenuRealtime(
  restaurantId: string | null | undefined,
  onItemUpdate: (item: any) => void
) {
  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel(`menu-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'menu_items',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => onItemUpdate(payload.new)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, onItemUpdate]);
}
