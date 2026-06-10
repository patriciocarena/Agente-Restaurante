// system-prompt.ts — STUB (Phase 3 Plan 03-02 implements this)
// This stub exists only to satisfy TypeScript in the RED test scaffold (03-01).
// The real implementation is written in Plan 03-02.

export interface RestaurantInfo {
  id: string;
  name: string;
  agent_name?: string | null;
  delivery_zones?: string | null;
  [key: string]: unknown;
}

export interface MenuItem {
  id: string;
  name: string;
  base_price?: number | null;
  available: boolean;
  description?: string | null;
  [key: string]: unknown;
}

/**
 * Builds the Vapi system prompt for the restaurant voice agent.
 * @param restaurant - Restaurant row from Supabase
 * @param menuItems  - All menu items for the restaurant
 * @returns System prompt string injected into the Vapi assistant
 */
export function buildSystemPrompt(restaurant: RestaurantInfo, menuItems: MenuItem[]): string {
  throw new Error(
    'buildSystemPrompt not implemented — Plan 03-02 implements this (ONB-05, MENU-05, VOICE-13)',
  );
}
