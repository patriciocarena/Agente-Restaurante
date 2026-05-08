// packages/shared/src/index.ts
// Tipos TypeScript que reflejan el schema SQL de 0001_initial_schema.sql
// Consumidos por backend y frontend — mantenerlos en sync con el schema

export interface Restaurant {
  id: string;
  owner_id: string;
  name: string;
  slug: string | null;
  address: string | null;
  phone: string | null;
  agent_name: string;
  vapi_assistant_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MenuCategory {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  base_price: number | null; // null = price determined by option_items (D-02)
  available: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface OptionGroup {
  id: string;
  menu_item_id: string;
  name: string;
  min_selections: number;
  max_selections: number;
  sort_order: number;
}

export interface OptionItem {
  id: string;
  option_group_id: string;
  name: string;
  price_delta: number;
  is_default: boolean;
  sort_order: number;
}

export type OrderStatus = 'NUEVO' | 'EN_PREPARACION' | 'LISTO' | 'ENTREGADO';
export type FulfillmentType = 'retiro' | 'delivery';
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled';

export interface Order {
  id: string;
  restaurant_id: string;
  order_number: number;
  status: OrderStatus;
  customer_name: string | null;
  // PII (D-07, Ley 25.326 AR): NEVER log this field
  customer_phone: string | null;
  fulfillment_type: FulfillmentType;
  delivery_address: string | null;
  call_id: string | null;
  transcript: string | null;
  total: number | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  restaurant_id: string;
  menu_item_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  modifiers: unknown[];
  note: string | null;
}

export interface Subscription {
  id: string;
  restaurant_id: string;
  mp_preapproval_id: string | null;
  status: SubscriptionStatus;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}
