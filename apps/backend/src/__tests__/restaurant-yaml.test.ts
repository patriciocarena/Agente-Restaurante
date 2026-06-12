// Tests para lib/restaurant-yaml: parsing puro de YAML de restaurante.
// QUICK-M94
import { describe, it, expect } from 'vitest';

import {
  parseHorarios,
  parseRestaurantYaml,
  HoursRow,
} from '../lib/restaurant-yaml';

// ---------------------------------------------------------------------------
// parseHorarios
// ---------------------------------------------------------------------------
describe('parseHorarios', () => {
  it('parses day ranges (lun-jue, vie-sab) + dom cerrado → 7 filas correctas', () => {
    const input = {
      'lun-jue': '20:00-24:00',
      'vie-sab': '20:00-01:00',
      dom: 'cerrado',
    };
    const rows = parseHorarios(input);
    expect(rows).toHaveLength(7);

    const dom = rows.find((r) => r.day_of_week === 0);
    expect(dom?.is_closed).toBe(true);

    const lun = rows.find((r) => r.day_of_week === 1);
    expect(lun?.is_closed).toBe(false);
    expect(lun?.open_time).toBe('20:00');
    // 24:00 normalizado a 23:59:59
    expect(lun?.close_time).toBe('23:59:59');

    const jue = rows.find((r) => r.day_of_week === 4);
    expect(jue?.is_closed).toBe(false);
    expect(jue?.open_time).toBe('20:00');
    expect(jue?.close_time).toBe('23:59:59');

    const vie = rows.find((r) => r.day_of_week === 5);
    expect(vie?.is_closed).toBe(false);
    expect(vie?.open_time).toBe('20:00');
    // crosses midnight — stored as-is (see comment in lib)
    expect(vie?.close_time).toBe('01:00');

    const sab = rows.find((r) => r.day_of_week === 6);
    expect(sab?.is_closed).toBe(false);
  });

  it('missing day defaults to is_closed=true', () => {
    // Only lunes specified
    const input = { lun: '10:00-18:00' };
    const rows = parseHorarios(input);
    expect(rows).toHaveLength(7);
    const dom = rows.find((r) => r.day_of_week === 0);
    expect(dom?.is_closed).toBe(true);
    const mar = rows.find((r) => r.day_of_week === 2);
    expect(mar?.is_closed).toBe(true);
  });

  it('"todos: 00:00-23:59" → 7 filas abiertas idénticas', () => {
    const input = { todos: '00:00-23:59' };
    const rows = parseHorarios(input);
    expect(rows).toHaveLength(7);
    rows.forEach((r) => {
      expect(r.is_closed).toBe(false);
      expect(r.open_time).toBe('00:00');
      expect(r.close_time).toBe('23:59');
    });
  });

  it('accepts accented day names (mié, sáb)', () => {
    const input = { 'mié': '20:00-23:00', 'sáb': '20:00-23:00' };
    const rows = parseHorarios(input);
    const mie = rows.find((r) => r.day_of_week === 3);
    expect(mie?.is_closed).toBe(false);
    const sab = rows.find((r) => r.day_of_week === 6);
    expect(sab?.is_closed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseRestaurantYaml
// ---------------------------------------------------------------------------

const VALID_YAML = `
nombre: wonder
agente: Alex
direccion: Av. Sáenz Peña 112 Villa Allende
whatsapp: "+5493516184593"
horarios:
  todos: "00:00-23:59"
menu:
  Hamburguesas:
    - nombre: Clásica
      precio: 9500
      descripcion: Carne, lechuga, tomate, cebolla.
  Bebidas:
    - nombre: Agua mineral 500ml
      precio: 2200
`;

describe('parseRestaurantYaml', () => {
  it('valid YAML → ok:true with correct shape', () => {
    const result = parseRestaurantYaml(VALID_YAML);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const d = result.data;
    expect(d.name).toBe('wonder');
    expect(d.slug_base).toBe('wonder');
    expect(d.agent_name).toBe('Alex');
    expect(d.address).toBe('Av. Sáenz Peña 112 Villa Allende');
    expect(d.whatsapp_number).toBe('+5493516184593');
    expect(d.hours).toHaveLength(7);
    expect(d.menu).toHaveLength(2);
    expect(d.menu[0].category).toBe('Hamburguesas');
    expect(d.menu[0].items[0].name).toBe('Clásica');
    expect(d.menu[0].items[0].base_price).toBe(9500);
    expect(d.menu[0].items[0].available).toBe(true);
    expect(d.menu[1].items[0].name).toBe('Agua mineral 500ml');
  });

  it('default agent_name is Sofía when agente is not provided', () => {
    const yaml = `
nombre: test
direccion: Calle 123
whatsapp: "+5493511234567"
horarios:
  todos: "10:00-20:00"
menu:
  Cat:
    - nombre: Item
      precio: 1000
`;
    const result = parseRestaurantYaml(yaml);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.agent_name).toBe('Sofía');
  });

  it('missing nombre AND item sin precio → ok:false with BOTH errors', () => {
    const yaml = `
direccion: Calle 123
whatsapp: "+5493511234567"
horarios:
  todos: "10:00-20:00"
menu:
  Cat:
    - nombre: Item sin precio
`;
    const result = parseRestaurantYaml(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Must contain both errors
    const combined = result.errors.join(' ');
    expect(combined).toMatch(/nombre/i);
    expect(combined).toMatch(/precio/i);
  });

  it('invalid whatsapp → ok:false with error mentioning whatsapp', () => {
    const yaml = `
nombre: test
direccion: Calle 123
whatsapp: "123"
horarios:
  todos: "10:00-20:00"
menu:
  Cat:
    - nombre: Item
      precio: 1000
`;
    const result = parseRestaurantYaml(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const combined = result.errors.join(' ').toLowerCase();
    expect(combined).toMatch(/whatsapp/);
  });

  it('negative price → ok:false', () => {
    const yaml = `
nombre: test
direccion: Calle 123
whatsapp: "+5493511234567"
horarios:
  todos: "10:00-20:00"
menu:
  Cat:
    - nombre: Item
      precio: -500
`;
    const result = parseRestaurantYaml(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const combined = result.errors.join(' ');
    expect(combined).toMatch(/precio/i);
  });

  it('non-integer price (float) → ok:false', () => {
    const yaml = `
nombre: test
direccion: Calle 123
whatsapp: "+5493511234567"
horarios:
  todos: "10:00-20:00"
menu:
  Cat:
    - nombre: Item
      precio: 9.99
`;
    const result = parseRestaurantYaml(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const combined = result.errors.join(' ');
    expect(combined).toMatch(/precio/i);
  });
});
