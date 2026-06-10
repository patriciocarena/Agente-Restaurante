import { describe, it, expect, vi } from 'vitest';

// Set env vars BEFORE importing anything that uses them
process.env.SUPABASE_URL ??= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'fake_for_test';
process.env.SUPABASE_ANON_KEY ??= 'fake_for_test';
process.env.TWILIO_ACCOUNT_SID ??= 'fake_for_test';
process.env.TWILIO_AUTH_TOKEN ??= 'fake_for_test';
process.env.TWILIO_DEFAULT_AREA_CODE ??= '415';
process.env.MERCADO_PAGO_ACCESS_TOKEN ??= 'fake_for_test';
process.env.VAPI_API_KEY ??= 'fake_for_test';
process.env.VAPI_WEBHOOK_SECRET ??= 'test_secret';
process.env.NODE_ENV = 'test';

// Stub supabaseAdmin so the module doesn't try to connect to a real DB
vi.mock('../lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

import { buildSystemPrompt } from '../lib/system-prompt';

describe('buildSystemPrompt (ONB-05, MENU-05, VOICE-13)', () => {
  const baseRestaurant = {
    id: 'rest-uuid-001',
    name: 'Wonder Hamburguesería',
    agent_name: 'Sofía',
    delivery_zones: 'Villa Allende, Argüello',
  };

  const availableItem = {
    id: 'item-001',
    name: 'Hamburguesa Clásica',
    base_price: 5000,
    available: true,
    description: 'Con lechuga, tomate y cebolla',
  };

  const unavailableItem = {
    id: 'item-002',
    name: 'Combo Secreto Oculto',
    base_price: 9999,
    available: false,
    description: 'No debería aparecer en el prompt',
  };

  it('returns a string containing the restaurant name', () => {
    const prompt = buildSystemPrompt(baseRestaurant, [availableItem, unavailableItem]);
    expect(typeof prompt).toBe('string');
    expect(prompt).toContain('Wonder Hamburguesería');
  });

  it('includes the agent_name and the literal greeting text "¿Qué te traemos hoy?"', () => {
    const prompt = buildSystemPrompt(baseRestaurant, [availableItem]);
    expect(prompt).toContain('Sofía');
    expect(prompt).toContain('¿Qué te traemos hoy?');
  });

  it('includes ONLY available=true items (unavailable item name NOT in output)', () => {
    const prompt = buildSystemPrompt(baseRestaurant, [availableItem, unavailableItem]);
    expect(prompt).toContain('Hamburguesa Clásica');
    expect(prompt).not.toContain('Combo Secreto Oculto');
  });

  it('includes item prices in the menu section', () => {
    const prompt = buildSystemPrompt(baseRestaurant, [availableItem]);
    // price should appear somewhere (5000, $5000, etc.)
    expect(prompt).toMatch(/5000|5\.000/);
  });

  it('includes a prompt-injection-resistance instruction (VOICE-13)', () => {
    const prompt = buildSystemPrompt(baseRestaurant, [availableItem]);
    // Must contain either "no inventés precios" or a redirect instruction
    const hasInjectionGuard =
      prompt.includes('no inventés precios') || prompt.toLowerCase().includes('redirig');
    expect(hasInjectionGuard).toBe(true);
  });
});
