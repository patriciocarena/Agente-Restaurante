// apps/frontend/src/lib/api.ts
// Wrappers tipados sobre fetch hacia el backend Express. Cada request inyecta el
// Bearer token desde supabase.auth.getSession().
//
// NUNCA agregar VITE_SUPABASE_SERVICE_ROLE_KEY al bundle del browser (viola SEC-04 / D-05 de Phase 1).

import { supabase } from './supabase';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(public code: string, public status: number, public details?: unknown) {
    super(code);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? 'unknown', res.status, body.details);
  return body as T;
}

export const api = {
  // Onboarding
  resumeOnboarding: () => call<{ onboarding_step: number; has_restaurant: boolean }>('/api/onboarding/resume'),
  finishOnboarding: () => call<{ twilio_number: string; mode: 'us-forwarding'; forwarding_docs_url: string; forwarding_instructions: Record<string,string> }>('/api/onboarding/finish', { method: 'POST' }),
  retryProvision: () => call<{ twilio_number: string; mode: 'us-forwarding'; forwarding_docs_url: string; forwarding_instructions: Record<string,string> }>('/api/phone/retry-provision', { method: 'POST' }),
  // Restaurants
  createRestaurant: (body: { name: string; address: string }) => call<{ restaurant: { id: string; slug: string; name: string; agent_name: string } }>('/api/restaurants', { method: 'POST', body: JSON.stringify(body) }),
  getMe: () => call<{ restaurant: any; hours: any[]; delivery_zones: string|null }>('/api/restaurants/me'),
  patchMe: (body: Partial<{ name: string; address: string; agent_name: string; delivery_zones: string; onboarding_step: number }>) => call<{ restaurant: any }>('/api/restaurants/me', { method: 'PATCH', body: JSON.stringify(body) }),
  putHours: (body: { hours: Array<{ day_of_week: number; open_time: string|null; close_time: string|null; is_closed: boolean }> }) => call<{ ok: true }>('/api/restaurants/me/hours', { method: 'PUT', body: JSON.stringify(body) }),

  // Menu Categories (MENU-01)
  listCategories: () => call<{ categories: Array<{ id:string; name:string; sort_order:number }> }>('/api/menu-categories'),
  createCategory: (body: { name: string }) => call<{ category: { id:string; name:string; sort_order:number } }>('/api/menu-categories', { method: 'POST', body: JSON.stringify(body) }),
  renameCategory: (id: string, body: { name?: string; sort_order?: number }) => call<{ category: any }>(`/api/menu-categories/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteCategory: (id: string) => call<void>(`/api/menu-categories/${id}`, { method: 'DELETE' }),

  // Menu Items (MENU-02, MENU-03)
  listItems: (categoryId: string) => call<{ items: any[] }>(`/api/menu-items?category_id=${encodeURIComponent(categoryId)}`),
  createItem: (body: any) => call<{ item: any }>('/api/menu-items', { method: 'POST', body: JSON.stringify(body) }),
  updateItem: (id: string, body: any) => call<{ item: any }>(`/api/menu-items/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteItem: (id: string) => call<void>(`/api/menu-items/${id}`, { method: 'DELETE' }),

  // Availability hot path (MENU-04)
  toggleAvailability: (id: string, available: boolean) => call<{ item: any }>(`/api/menu-items/${id}/availability`, { method: 'PATCH', body: JSON.stringify({ available }) }),

  // Template (D-12)
  loadTemplate: () => call<{ categories_created: number; items_created: number }>('/api/menu/load-template', { method: 'POST' }),
};
