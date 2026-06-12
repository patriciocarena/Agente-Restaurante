// apps/backend/src/scripts/cargar-restaurante.ts
// CLI para cargar o actualizar un restaurante desde un archivo YAML.
// Uso: pnpm cargar-restaurante restaurantes/wonder.yaml [--dry-run]
//
// Requiere: apps/backend/.env con SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//           VAPI_API_KEY, BACKEND_URL, VAPI_WEBHOOK_SECRET.
// NUNCA subir a Railway — usa service role key que bypasa RLS.
// QUICK-M94

import { readFileSync } from 'fs';
import { resolve } from 'path';
import slugify from 'slugify';
import { parseRestaurantYaml, HoursRow, MenuItemInput } from '../lib/restaurant-yaml';
import { supabaseAdmin } from '../lib/supabase';
import { createVapiAssistant, syncAssistantPrompt } from '../lib/vapi';

// ---------------------------------------------------------------------------
// Argumentos de línea de comandos
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const filePath = args.find((a) => !a.startsWith('--'));

if (!filePath) {
  console.error('\n❌ Error: falta la ruta al archivo YAML.');
  console.error(
    '\nUso:  pnpm cargar-restaurante <ruta-al-archivo.yaml> [--dry-run]',
  );
  console.error('Ej:   pnpm cargar-restaurante restaurantes/wonder.yaml');
  console.error('      pnpm cargar-restaurante restaurantes/wonder.yaml --dry-run\n');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Función principal
// ---------------------------------------------------------------------------

async function main() {
  // Paso 1: leer el archivo
  const absolutePath = resolve(process.cwd(), filePath as string);
  let yamlContent: string;
  try {
    yamlContent = readFileSync(absolutePath, 'utf-8');
  } catch (e) {
    console.error(
      `\n❌ No se pudo leer el archivo "${filePath}".\n   Revisá que la ruta sea correcta y que el archivo exista.\n`,
    );
    process.exit(1);
  }

  // Paso 2: parsear y validar
  const parsed = parseRestaurantYaml(yamlContent);
  if (!parsed.ok) {
    console.error('\n❌ El archivo tiene los siguientes errores:\n');
    parsed.errors.forEach((err, i) => {
      console.error(`   ${i + 1}. ${err}`);
    });
    console.error('\nCorregí los errores y volvé a correr el comando.\n');
    process.exit(1);
  }

  const r = parsed.data;

  // Paso 3: resolver slug y buscar el restaurante existente en la DB
  const slug = slugify(r.name, { lower: true, strict: true, locale: 'es' }) || r.slug_base;

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from('restaurants')
    .select('id, name, vapi_assistant_id, slug')
    .eq('slug', slug)
    .maybeSingle();

  if (lookupError) {
    console.error(
      `\n❌ Error al buscar el restaurante en la base de datos: ${lookupError.message}\n`,
    );
    process.exit(1);
  }

  const mode = existing ? 'UPDATE' : 'CREATE';

  // --dry-run: describir qué se haría y salir
  if (dryRun) {
    console.log('\n🔍 (dry-run) — Vista previa de cambios (no se escribe nada)\n');
    console.log(`   Archivo:      ${filePath}`);
    console.log(`   Restaurante:  ${r.name} (slug: ${slug})`);
    console.log(`   Modo:         ${mode === 'UPDATE' ? `UPDATE (id: ${existing!.id})` : 'CREATE (restaurante nuevo)'}`);
    if (mode === 'CREATE') {
      console.log(
        '   ⚠️  CREATE requiere el campo "owner_email" en el YAML para asignar propietario.',
      );
    }
    console.log(`   Dirección:    ${r.address}`);
    console.log(`   WhatsApp:     ${r.whatsapp_number}`);
    console.log(`   Agente:       ${r.agent_name}`);
    console.log(`   Zonas:        ${r.delivery_zones ?? '(sin zonas de delivery)'}`);
    console.log(`\n   Horarios: reemplazar 7 filas para este restaurante.`);
    console.log(
      `   Horarios abiertos: ${r.hours.filter((h) => !h.is_closed).length} días / cerrados: ${r.hours.filter((h) => h.is_closed).length} días`,
    );
    const totalItems = r.menu.reduce((s, c) => s + c.items.length, 0);
    console.log(`\n   Menú: ${r.menu.length} categorías, ${totalItems} items en total:`);
    for (const section of r.menu) {
      console.log(`     - ${section.category}: ${section.items.length} items`);
    }
    console.log('\n   Vapi: sincronización del assistant (no ejecutada en dry-run)');
    console.log('\n(dry-run: no se escribió nada)\n');
    process.exit(0);
  }

  // ---------------------------------------------------------------------------
  // Modo live: ejecutar cambios
  // ---------------------------------------------------------------------------

  let restaurantId: string;

  if (mode === 'UPDATE') {
    // Paso 4a: actualizar campos del restaurante
    console.log(`\n🔄 Actualizando restaurante "${r.name}" (id: ${existing!.id})...`);
    const { error: updateError } = await supabaseAdmin
      .from('restaurants')
      .update({
        name: r.name,
        address: r.address,
        agent_name: r.agent_name,
        delivery_zones: r.delivery_zones,
        whatsapp_number: r.whatsapp_number,
      })
      .eq('id', existing!.id);

    if (updateError) {
      console.error(`\n❌ Error al actualizar el restaurante: ${updateError.message}\n`);
      process.exit(1);
    }
    restaurantId = existing!.id;
    console.log(`   ✓ Datos del restaurante actualizados.`);
  } else {
    // Paso 4b: crear restaurante nuevo
    // Para un restaurante nuevo necesitamos owner_email para resolver el owner_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawYaml: any = (() => {
      try {
        const { parse: yamlParse } = require('yaml');
        return yamlParse(yamlContent);
      } catch {
        return {};
      }
    })();

    const ownerEmail: string | undefined = rawYaml?.owner_email
      ? String(rawYaml.owner_email).trim()
      : undefined;

    if (!ownerEmail) {
      console.error(
        '\n❌ Para crear un restaurante NUEVO necesitás agregar el campo "owner_email"',
      );
      console.error('   con el email de una cuenta ya registrada en Supabase Auth.');
      console.error('   Ej:  owner_email: "dueño@example.com"\n');
      process.exit(1);
    }

    // Buscar el usuario por email
    console.log(`\n🆕 Creando restaurante "${r.name}" (slug: ${slug})...`);
    const { data: usersData, error: usersError } =
      await supabaseAdmin.auth.admin.listUsers();

    if (usersError) {
      console.error(`\n❌ Error al buscar usuarios: ${usersError.message}\n`);
      process.exit(1);
    }

    const owner = usersData.users.find(
      (u) => u.email?.toLowerCase() === ownerEmail.toLowerCase(),
    );

    if (!owner) {
      console.error(
        `\n❌ No se encontró un usuario con email "${ownerEmail}" en Supabase Auth.`,
      );
      console.error('   El dueño debe crear su cuenta primero desde el frontend.\n');
      process.exit(1);
    }

    // Generar slug único (verificar colisiones)
    let uniqueSlug = slug;
    let suffix = 2;
    while (true) {
      const { data: collision } = await supabaseAdmin
        .from('restaurants')
        .select('id')
        .eq('slug', uniqueSlug)
        .maybeSingle();
      if (!collision) break;
      uniqueSlug = `${slug}-${suffix}`;
      suffix++;
    }

    const { data: newRestaurant, error: insertError } = await supabaseAdmin
      .from('restaurants')
      .insert({
        owner_id: owner.id,
        name: r.name,
        slug: uniqueSlug,
        address: r.address,
        agent_name: r.agent_name,
        delivery_zones: r.delivery_zones,
        whatsapp_number: r.whatsapp_number,
      })
      .select('id')
      .single();

    if (insertError || !newRestaurant) {
      console.error(
        `\n❌ Error al crear el restaurante: ${insertError?.message ?? 'respuesta vacía'}\n`,
      );
      process.exit(1);
    }

    restaurantId = newRestaurant.id;

    // Insertar restaurant_counters y subscriptions (trial)
    await supabaseAdmin
      .from('restaurant_counters')
      .insert({ restaurant_id: restaurantId, last_order_number: 0 });
    await supabaseAdmin
      .from('subscriptions')
      .insert({ restaurant_id: restaurantId, status: 'trial' });

    console.log(`   ✓ Restaurante creado (id: ${restaurantId}, slug: ${uniqueSlug}).`);
  }

  // Paso 5: reemplazar horarios
  console.log('   Actualizando horarios...');
  const { error: deleteHoursError } = await supabaseAdmin
    .from('restaurant_hours')
    .delete()
    .eq('restaurant_id', restaurantId);

  if (deleteHoursError) {
    console.error(`\n❌ Error al borrar horarios existentes: ${deleteHoursError.message}\n`);
    process.exit(1);
  }

  const hoursToInsert = r.hours.map((h: HoursRow) => ({
    restaurant_id: restaurantId,
    day_of_week: h.day_of_week,
    open_time: h.open_time,
    close_time: h.close_time,
    is_closed: h.is_closed,
  }));

  const { error: insertHoursError } = await supabaseAdmin
    .from('restaurant_hours')
    .insert(hoursToInsert);

  if (insertHoursError) {
    console.error(`\n❌ Error al insertar horarios: ${insertHoursError.message}\n`);
    process.exit(1);
  }

  const openDays = r.hours.filter((h) => !h.is_closed).length;
  console.log(
    `   ✓ Horarios reemplazados: ${openDays} días abiertos, ${7 - openDays} días cerrados.`,
  );

  // Paso 6: upsert menú
  console.log('   Actualizando menú...');

  let catCreated = 0;
  let catUpdated = 0;
  let itemCreated = 0;
  let itemUpdated = 0;
  let itemUnchanged = 0;

  // Cargar las categorías y los items existentes de una vez para eficiencia
  const { data: existingCats } = await supabaseAdmin
    .from('menu_categories')
    .select('id, name')
    .eq('restaurant_id', restaurantId);

  const catMap = new Map<string, string>((existingCats ?? []).map((c) => [c.name, c.id]));

  const { data: existingItems } = await supabaseAdmin
    .from('menu_items')
    .select('id, name, base_price, description, available')
    .eq('restaurant_id', restaurantId);

  const itemMap = new Map<string, typeof existingItems extends (infer T)[] | null ? T : never>(
    (existingItems ?? []).map((i) => [i.name, i]),
  );

  // Conjunto de nombres de items presentes en el YAML (para marcar ausentes como no disponibles)
  const yamlItemNames = new Set<string>();

  for (let catIdx = 0; catIdx < r.menu.length; catIdx++) {
    const section = r.menu[catIdx];

    // Upsert de categoría
    let categoryId = catMap.get(section.category);
    if (!categoryId) {
      const { data: newCat, error: catError } = await supabaseAdmin
        .from('menu_categories')
        .insert({
          restaurant_id: restaurantId,
          name: section.category,
          sort_order: catIdx,
        })
        .select('id')
        .single();

      if (catError || !newCat) {
        console.error(`\n❌ Error al crear categoría "${section.category}": ${catError?.message}\n`);
        process.exit(1);
      }
      categoryId = newCat.id as string;
      catMap.set(section.category, categoryId as string);
      catCreated++;
    } else {
      // Actualizar sort_order si cambió
      await supabaseAdmin
        .from('menu_categories')
        .update({ sort_order: catIdx })
        .eq('id', categoryId);
      catUpdated++;
    }

    // Upsert de items
    for (let itemIdx = 0; itemIdx < section.items.length; itemIdx++) {
      const item: MenuItemInput = section.items[itemIdx];
      yamlItemNames.add(item.name);

      const existingItem = itemMap.get(item.name);

      if (!existingItem) {
        // Crear item nuevo
        const { error: itemError } = await supabaseAdmin.from('menu_items').insert({
          restaurant_id: restaurantId,
          category_id: categoryId,
          name: item.name,
          description: item.description ?? null,
          base_price: item.base_price,
          available: item.available,
          sort_order: itemIdx,
        });

        if (itemError) {
          console.error(
            `\n❌ Error al crear item "${item.name}": ${itemError.message}\n`,
          );
          process.exit(1);
        }
        itemCreated++;
      } else {
        // Verificar si hay cambios
        const needsUpdate =
          existingItem.base_price !== item.base_price ||
          (existingItem.description ?? undefined) !== item.description ||
          existingItem.available !== item.available;

        if (needsUpdate) {
          const { error: updateItemError } = await supabaseAdmin
            .from('menu_items')
            .update({
              base_price: item.base_price,
              description: item.description ?? null,
              available: item.available,
              sort_order: itemIdx,
              category_id: categoryId,
            })
            .eq('id', existingItem.id);

          if (updateItemError) {
            console.error(
              `\n❌ Error al actualizar item "${item.name}": ${updateItemError.message}\n`,
            );
            process.exit(1);
          }
          itemUpdated++;
        } else {
          itemUnchanged++;
        }
      }
    }
  }

  // Marcar items que ya no están en el YAML como no disponibles (NO delete: preserva FK)
  const itemsToDeactivate = (existingItems ?? []).filter(
    (i) => !yamlItemNames.has(i.name) && i.available,
  );
  if (itemsToDeactivate.length > 0) {
    await supabaseAdmin
      .from('menu_items')
      .update({ available: false })
      .in(
        'id',
        itemsToDeactivate.map((i) => i.id),
      );
    console.log(
      `   ⚠️  ${itemsToDeactivate.length} item(s) que ya no están en el YAML fueron marcados como no disponibles: ${itemsToDeactivate.map((i) => i.name).join(', ')}`,
    );
  }

  console.log(
    `   ✓ Menú actualizado: ${catCreated} categorías creadas, ${catUpdated} actualizadas.`,
  );
  console.log(
    `   ✓ Items: ${itemCreated} creados, ${itemUpdated} actualizados, ${itemUnchanged} sin cambios.`,
  );

  // Paso 7: Vapi — crear assistant si no existe, o sincronizar si ya existe
  console.log('   Sincronizando con Vapi...');

  const { data: currentRest } = await supabaseAdmin
    .from('restaurants')
    .select('id, name, agent_name, vapi_assistant_id')
    .eq('id', restaurantId)
    .single();

  if (!currentRest?.vapi_assistant_id) {
    try {
      const assistantId = await createVapiAssistant({
        id: restaurantId,
        name: r.name,
        agent_name: r.agent_name,
      });
      await supabaseAdmin
        .from('restaurants')
        .update({ vapi_assistant_id: assistantId })
        .eq('id', restaurantId);
      console.log(`   ✓ Assistant de Vapi creado (id: ${assistantId}).`);
    } catch (e) {
      console.error(
        `\n⚠️  No se pudo crear el assistant de Vapi: ${e instanceof Error ? e.message : String(e)}`,
      );
      console.error('   El restaurante quedó cargado en la DB. Revisá la API key de Vapi.\n');
    }
  } else {
    await syncAssistantPrompt(restaurantId);
    console.log('   ✓ Agente resincronizado.');
  }

  // Resumen final
  const totalItems = r.menu.reduce((s, c) => s + c.items.length, 0);
  console.log('\n✅ ¡Listo! Resumen de la carga:');
  console.log(`   Restaurante:  ${r.name} (${mode})`);
  console.log(`   Horarios:     ${r.hours.filter((h) => !h.is_closed).length} días abiertos reemplazados`);
  console.log(
    `   Menú:         ${r.menu.length} categorías, ${totalItems} items procesados`,
  );
  console.log('✓ Agente resincronizado\n');
}

main().catch((e) => {
  console.error('\n❌ Error inesperado:', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
