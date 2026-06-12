// apps/backend/src/lib/restaurant-yaml.ts
// Módulo PURO de parsing y validación de archivos YAML de restaurante.
// NO toca DB ni Vapi — solo transforma texto YAML a estructuras tipadas + valida.
// QUICK-M94

import { parse } from 'yaml';
import slugify from 'slugify';
import { normalizeArWhatsApp } from './whatsapp';

// ---------------------------------------------------------------------------
// Interfaces públicas
// ---------------------------------------------------------------------------

export interface HoursRow {
  day_of_week: number; // 0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

export interface MenuItemInput {
  name: string;
  base_price: number;
  description?: string;
  available: boolean;
}

export interface ParsedRestaurant {
  name: string;
  slug_base: string;
  agent_name: string;
  address: string;
  whatsapp_number: string;
  delivery_zones: string | null;
  hours: HoursRow[];
  menu: Array<{ category: string; items: MenuItemInput[] }>;
}

export type ParseResult =
  | { ok: true; data: ParsedRestaurant }
  | { ok: false; errors: string[] };

// ---------------------------------------------------------------------------
// Mapeo de nombres de días en español → day_of_week (0=Dom..6=Sáb)
// ---------------------------------------------------------------------------

const DAY_MAP: Record<string, number> = {
  dom: 0,
  lun: 1,
  mar: 2,
  mie: 3,
  mié: 3,
  jue: 4,
  vie: 5,
  sab: 6,
  sáb: 6,
};

// Normaliza un nombre de día quitando acentos y convirtiendo a minúsculas
function normalizeDay(d: string): string {
  return d
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// Devuelve los índices day_of_week para una clave de horario (ej: "lun-jue" → [1,2,3,4])
function parseDayKey(key: string): number[] {
  const lower = key.toLowerCase().trim();

  // Atajo especial "todos" → los 7 días
  if (lower === 'todos') return [0, 1, 2, 3, 4, 5, 6];

  // Rango "lun-jue"
  if (lower.includes('-')) {
    const parts = lower.split('-');
    if (parts.length === 2) {
      const from = DAY_MAP[normalizeDay(parts[0])];
      const to = DAY_MAP[normalizeDay(parts[1])];
      if (from !== undefined && to !== undefined) {
        if (from <= to) {
          return Array.from({ length: to - from + 1 }, (_, i) => from + i);
        }
        // rango que cruza semana (ej: sab-lun) — expandir circular
        const result: number[] = [];
        let cur = from;
        while (cur !== to) {
          result.push(cur);
          cur = (cur + 1) % 7;
        }
        result.push(to);
        return result;
      }
    }
  }

  // Día simple
  const norm = normalizeDay(lower);
  const idx = DAY_MAP[norm];
  if (idx !== undefined) return [idx];

  return [];
}

// Normaliza "HH:MM" → si es "24:00" lo convierte a "23:59:59" (Postgres time válido).
// Rangos que cruzan medianoche (close < open en string) se almacenan tal cual — NO se valida
// close > open para este caso (ej: "20:00"-"01:00"). El backend que los consume debe
// tenerlo en cuenta.
function normalizeTime(t: string): string {
  const trimmed = t.trim();
  if (trimmed === '24:00') return '23:59:59';
  return trimmed;
}

// Parsea un valor de horario como "20:00-24:00" → { open_time, close_time }
// o "cerrado" → is_closed=true
function parseHorarioValue(value: string): { open: string; close: string } | null {
  const trimmed = String(value).trim().toLowerCase();
  if (trimmed === 'cerrado') return null;

  const idx = trimmed.lastIndexOf('-');
  if (idx <= 0) return null; // formato inválido

  const open = trimmed.slice(0, idx).trim();
  const close = trimmed.slice(idx + 1).trim();
  return { open: normalizeTime(open), close: normalizeTime(close) };
}

// ---------------------------------------------------------------------------
// parseHorarios — función pura exportada
// ---------------------------------------------------------------------------

export function parseHorarios(horariosRaw: Record<string, unknown>): HoursRow[] {
  // Inicializar los 7 días como cerrados por defecto
  const rows: HoursRow[] = Array.from({ length: 7 }, (_, i) => ({
    day_of_week: i,
    open_time: null,
    close_time: null,
    is_closed: true,
  }));

  for (const [key, value] of Object.entries(horariosRaw)) {
    const dayIndices = parseDayKey(key);
    if (dayIndices.length === 0) continue; // clave desconocida — ignorar

    const parsed = parseHorarioValue(String(value));

    for (const dayIdx of dayIndices) {
      if (parsed === null) {
        rows[dayIdx] = { day_of_week: dayIdx, open_time: null, close_time: null, is_closed: true };
      } else {
        rows[dayIdx] = {
          day_of_week: dayIdx,
          open_time: parsed.open,
          close_time: parsed.close,
          is_closed: false,
        };
      }
    }
  }

  return rows;
}

// ---------------------------------------------------------------------------
// parseRestaurantYaml — validación completa del archivo YAML
// ---------------------------------------------------------------------------

export function parseRestaurantYaml(yamlString: string): ParseResult {
  const errors: string[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let raw: any;
  try {
    raw = parse(yamlString);
  } catch (e) {
    return { ok: false, errors: [`El archivo YAML tiene un error de sintaxis: ${String(e)}`] };
  }

  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: ['El archivo YAML está vacío o no es un objeto válido.'] };
  }

  // -- nombre (requerido)
  if (!raw.nombre || typeof raw.nombre !== 'string' || !raw.nombre.trim()) {
    errors.push('Falta el campo "nombre" (nombre del restaurante, ej: nombre: wonder).');
  }

  // -- direccion (requerido)
  if (!raw.direccion || typeof raw.direccion !== 'string' || !raw.direccion.trim()) {
    errors.push('Falta el campo "direccion" (dirección física del restaurante).');
  }

  // -- whatsapp (requerido, debe normalizar a E.164 AR)
  let normalizedWhatsapp: string | null = null;
  if (!raw.whatsapp) {
    errors.push('Falta el campo "whatsapp" (número de celular del restaurante, ej: "+5493516184593").');
  } else {
    normalizedWhatsapp = normalizeArWhatsApp(String(raw.whatsapp));
    if (!normalizedWhatsapp) {
      errors.push(
        `El campo "whatsapp" ("${raw.whatsapp}") no es un celular argentino válido. ` +
          'Formato esperado: "+5493516184593" o "3516184593".',
      );
    }
  }

  // -- horarios (requerido)
  let hours: HoursRow[] = [];
  if (!raw.horarios || typeof raw.horarios !== 'object' || Array.isArray(raw.horarios)) {
    errors.push(
      'Falta el campo "horarios" (horarios de atención por día, ej: "lun-vie: 20:00-24:00").',
    );
  } else {
    hours = parseHorarios(raw.horarios as Record<string, unknown>);
  }

  // -- menú (requerido, objeto categoría → array de items)
  const menuSections: Array<{ category: string; items: MenuItemInput[] }> = [];
  if (!raw.menu || typeof raw.menu !== 'object' || Array.isArray(raw.menu)) {
    errors.push(
      'Falta el campo "menu" (objeto con categorías como claves, ej: Hamburguesas: [{nombre: ..., precio: ...}]).',
    );
  } else {
    const menuRaw = raw.menu as Record<string, unknown>;
    for (const [category, itemsRaw] of Object.entries(menuRaw)) {
      if (!Array.isArray(itemsRaw)) {
        errors.push(`La categoría "${category}" debe ser una lista de items.`);
        continue;
      }
      const parsedItems: MenuItemInput[] = [];
      for (let i = 0; i < itemsRaw.length; i++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const item: any = itemsRaw[i];
        if (!item || typeof item !== 'object') {
          errors.push(`Item ${i + 1} de la categoría "${category}" no es un objeto válido.`);
          continue;
        }

        // nombre del item (requerido)
        if (!item.nombre || typeof item.nombre !== 'string' || !item.nombre.trim()) {
          errors.push(
            `Item ${i + 1} de la categoría "${category}" falta el campo "nombre".`,
          );
        }

        // precio (requerido, entero ≥ 0)
        if (item.precio === undefined || item.precio === null) {
          errors.push(
            `Item "${item.nombre ?? `#${i + 1}`}" de la categoría "${category}" falta el campo "precio".`,
          );
        } else if (typeof item.precio !== 'number' || !Number.isInteger(item.precio)) {
          errors.push(
            `El "precio" de "${item.nombre ?? `#${i + 1}`}" en "${category}" debe ser un número entero (ej: 9500), no "${item.precio}".`,
          );
        } else if (item.precio < 0) {
          errors.push(
            `El "precio" de "${item.nombre ?? `#${i + 1}`}" en "${category}" no puede ser negativo (es ${item.precio}).`,
          );
        }

        // Solo agregar si nombre y precio son válidos para no generar datos basura
        if (
          item.nombre &&
          typeof item.nombre === 'string' &&
          typeof item.precio === 'number' &&
          Number.isInteger(item.precio) &&
          item.precio >= 0
        ) {
          parsedItems.push({
            name: String(item.nombre).trim(),
            base_price: item.precio as number,
            description: item.descripcion ? String(item.descripcion).trim() : undefined,
            available: item.disponible !== false, // default true
          });
        }
      }
      menuSections.push({ category, items: parsedItems });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // Construir slug base desde el nombre
  const name = String(raw.nombre).trim();
  const slugBase = slugify(name, { lower: true, strict: true, locale: 'es' });

  const data: ParsedRestaurant = {
    name,
    slug_base: slugBase || name.toLowerCase(),
    agent_name: raw.agente ? String(raw.agente).trim() : 'Sofía',
    address: String(raw.direccion).trim(),
    whatsapp_number: normalizedWhatsapp!,
    delivery_zones: raw.zonas_delivery ? String(raw.zonas_delivery).trim() : null,
    hours,
    menu: menuSections,
  };

  return { ok: true, data };
}
