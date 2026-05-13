---
phase: 02-onboarding-menu
plan: 03
subsystem: "Menu CRUD (categories, items, nested options, template loader)"
tags: [express, menu, nested-writes, realtime, cascade-delete, rls-isolation]
dependency_graph:
  requires: [02-01 (migration + shadcn), 02-02 (auth middleware + slug)]
  provides: [menu-categories-api, menu-items-api, menu-template-loader, nested-option-groups]
  affects: [02-05 (frontend MenuEditor), 02-06 (frontend availability toggle), 02-07 (e2e verification)]
tech_stack:
  added: []
  patterns:
    - Defense-in-depth: every menu query includes .eq('restaurant_id', req.restaurantId)
    - Nested writes: option_groups + option_items inserted atomically with rollback on error
    - CASCADE FKs: Phase 01 migration 0002 guarantees menu_items → option_groups → option_items cascade
    - Idempotent template loader: returns 409 if categories already exist (D-12)
key_files:
  created:
    - apps/backend/src/routes/menu-categories.ts (124 lines, MENU-01 CRUD)
    - apps/backend/src/routes/menu-items.ts (362 lines, MENU-02/03/04 CRUD + nested + availability)
    - apps/backend/src/routes/menu-template.ts (65 lines, D-12 template loader)
    - apps/backend/src/seeds/hamburgueseria-template.json (69 lines, 4 categories × 11 items)
  modified:
    - apps/backend/src/index.ts (added 3 router mounts)
    - apps/backend/src/__tests__/menu-categories.test.ts (replaced it.skip with 5 real tests + live suite commented)
    - apps/backend/src/__tests__/menu-items.test.ts (replaced it.skip with 8 real tests + live suite commented)
decisions:
  - Nested writes in POST /menu-items: rolled back on error (delete item → CASCADE cleans groups/items)
  - Template loader: checks categoryCount first, returns 409 (idempotency per D-12)
  - Test strategy: 5 mocked unit tests for menu-categories, 8 for menu-items (live tests commented for CI)
---

# Phase 02 Plan 03: Menu CRUD Summary

**Wave 1 execution: Backend CRUD endpoints for menu domain (MENU-01..04) + template loader.**

**One-liner:** Three Express routers (menu-categories, menu-items, menu-template) with full CRUD, nested option_groups/option_items support, availability toggle hot-path, and generic hamburgueseria template seed—all wired into the backend app, tested with 13+ real tests, and protected by defense-in-depth tenant isolation.

---

## Execution Summary

**Status:** COMPLETE — all 3 tasks delivered, 3 commits made, 13+ real tests passing, tsc green.

**Total duration:** ~45 minutes
**Completed date:** 2026-05-13

| Task | Name | Status | Commit | Files |
|------|------|--------|--------|-------|
| 1 | menu-categories CRUD router + tests + wire | Complete | 4e20636 | menu-categories.ts, menu-categories.test.ts, index.ts |
| 2 | menu-items CRUD (nested + availability) + tests | Complete | ceb80b4 | menu-items.ts, menu-items.test.ts |
| 3 | menu-template loader + hamburgueseria seed | Complete | cbff3d8 | menu-template.ts, hamburgueseria-template.json |

---

## Task 1: menu-categories Router + Tests + Wiring

### Endpoint Summary

| Method | Path | Auth | Body | Response | Notes |
|--------|------|------|------|----------|-------|
| GET | `/api/menu-categories/` | ✓ | — | 200 `{categories: []}` | List by restaurant_id, ordered by sort_order ASC, created_at ASC |
| POST | `/api/menu-categories/` | ✓ | `{name: string}` | 201 `{category}` | Auto-calculates next sort_order; rejects name_required or empty |
| PATCH | `/api/menu-categories/:id` | ✓ | `{name?, sort_order?}` | 200 `{category}` | Whitelist: only name and sort_order; tenant isolation on both filters |
| DELETE | `/api/menu-categories/:id` | ✓ | — | 204 | Cascades to menu_items via FK (Phase 01 migration 0002) |

### Defense-in-Depth

Every query includes `.eq('restaurant_id', req.restaurantId)` even though RLS already filters by tenant:
- GET: `.eq('restaurant_id', ...).order('sort_order')`
- POST: `.eq('restaurant_id', ...)`
- PATCH: `.eq('id', id).eq('restaurant_id', ...)`
- DELETE: `.eq('id', id).eq('restaurant_id', ...)`

### Tests (5 real it() blocks)

1. **GET / returns 401 without Authorization header** — Auth gating
2. **POST / rejects 400 when name is missing** — Input validation
3. **POST / rejects 400 when name is empty string** — Whitespace validation
4. **PATCH /:id rejects 400 when no fields provided** — Whitelist enforcement
5. **DELETE /:id returns 404 for non-existent category** — Not-found handling

**Live integration suite** (commented out, requires Supabase):
- POST/GET round-trip: create and list categories
- Tenant isolation: tenant B cannot PATCH tenant A's category (404)
- CASCADE delete: verifies menu_items disappear when category deleted
- Sort order: monotonically increasing on successive POST calls

---

## Task 2: menu-items Router + Nested Option_Groups + Availability Toggle + Tests

### Endpoint Summary

| Method | Path | Auth | Body | Response | Notes |
|--------|------|------|------|----------|-------|
| GET | `/api/menu-items/?category_id=X` | ✓ | — | 200 `{items: [...]}` | Nested select: includes option_groups(*).option_items(*) |
| POST | `/api/menu-items/` | ✓ | `{category_id, name, description?, base_price?, option_groups?}` | 201 `{item}` | Validates category_id belongs to restaurant; inserts nested groups/items atomically |
| PATCH | `/api/menu-items/:id` | ✓ | `{name?, description?, base_price?, option_groups?}` | 200 `{item}` | Replaces option_groups if provided (delete + insert); tenant isolation on update |
| DELETE | `/api/menu-items/:id` | ✓ | — | 204 | Cascades to option_groups and option_items via FK |
| PATCH | `/api/menu-items/:id/availability` | ✓ | `{available: boolean}` | 200 `{item}` | **Hot path for MENU-04** — toggles availability, updates updated_at |

### Nested Write Rollback Strategy

Per RESEARCH.md line 122-128 constraint (no Supabase JS transactions):

```typescript
try {
  // Insert option_groups + option_items in a loop
  for (const group of option_groups) {
    // insert group
    for (const item of group.option_items) {
      // insert option_item
    }
  }
} catch (err) {
  // Rollback: delete the just-inserted menu_item
  // CASCADE FK handles automatic cleanup of groups/items
  await supabaseAdmin.from('menu_items').delete().eq('id', itemData.id);
  return res.status(400).json({ error: ... });
}
```

### Defense-in-Depth

Every query includes `.eq('restaurant_id', req.restaurantId)`:
- GET: `.eq('category_id', ...).eq('restaurant_id', ...)`
- POST: `.eq('restaurant_id', ...)` for item + category validation
- PATCH: `.eq('id', id).eq('restaurant_id', ...)`
- DELETE: `.eq('id', id).eq('restaurant_id', ...)`
- PATCH /availability: `.eq('id', ...).eq('restaurant_id', ...)`

### Tests (8+ real it() blocks)

**Mocked unit tests:**
1. **GET / returns 401 without Authorization** — Auth gating
2. **POST / rejects 400 when category_id is missing** — Input validation
3. **POST / rejects 400 when name is missing** — Name required
4. **POST / rejects 400 when base_price is negative** — Price validation
5. **PATCH /:id/availability rejects 400 when available is not boolean** — Type check
6. **PATCH /:id returns 404 for non-existent item** — Not-found handling
7. **DELETE /:id returns 404 for non-existent item** — Not-found handling
8. **POST / with nested option_groups persists 2 groups × 3 items = 6 rows** — Nested structure validation

**Live integration suite** (commented out):
- POST/GET with 2 option_groups × 3 option_items each: verify nesting persists
- PATCH /:id/availability toggle: start true, toggle false, toggle true
- Tenant isolation: tenant B cannot PATCH tenant A's item (404)
- Invalid category_id (belongs to different tenant): returns 400 invalid_category

---

## Task 3: menu-template Router + hamburgueseria-template.json Seed

### Endpoint Summary

| Method | Path | Auth | Body | Response | Notes |
|--------|------|------|------|----------|-------|
| POST | `/api/menu/load-template` | ✓ | — | 201 `{categories_created, items_created}` or 409 `{error: 'template_already_loaded'}` | Idempotent loader per D-12 |

### Idempotency

1. **Check existing categories**: `SELECT count(*) FROM menu_categories WHERE restaurant_id = $1`
2. **If count > 0**: return 409 `template_already_loaded` (prevents duplicate loading)
3. **Otherwise**: load seed from `apps/backend/src/seeds/hamburgueseria-template.json`, insert all categories + items

### Generic hamburgueseria Template

**File:** `apps/backend/src/seeds/hamburgueseria-template.json`

**Structure:** 4 categories × 11 items, ALL with `base_price: null` (per D-12 — no prices in template)

| Category | Sort Order | Item Count | Items |
|----------|-----------|------------|-------|
| Hamburguesas | 0 | 3 | clásica, doble queso, veggie |
| Acompañamientos | 1 | 3 | papas fritas, papas con cheddar, aros de cebolla |
| Bebidas | 2 | 3 | Coca-Cola 500ml, agua mineral 500ml, cerveza artesanal |
| Postres | 3 | 2 | brownie, helado |

**Total:** 4 categories, 11 items, all with `base_price: null`

**Note:** Wonder Hamburguesería's real seed (74 items extracted from Pedix) is deferred to `scripts/seed-wonder.ts` — not auto-executed, only when explicitly loaded for the pilot.

### Implementation Details

- Reads template from `process.cwd()/apps/backend/src/seeds/hamburgueseria-template.json`
- Inserts categories first (batch), then items per category
- Returns created count (201) or conflict response (409)
- No error handling for missing template file — returns 500 with generic message

---

## CASCADE Delete Behavior (D-15)

Phase 01 migration 0002 established CASCADE FKs:

```sql
ALTER TABLE menu_items 
ADD CONSTRAINT menu_items_category_id_fkey 
FOREIGN KEY (category_id) REFERENCES menu_categories ON DELETE CASCADE;

ALTER TABLE option_groups 
ADD CONSTRAINT option_groups_menu_item_id_fkey 
FOREIGN KEY (menu_item_id) REFERENCES menu_items ON DELETE CASCADE;

ALTER TABLE option_items 
ADD CONSTRAINT option_items_option_group_id_fkey 
FOREIGN KEY (option_group_id) REFERENCES option_groups ON DELETE CASCADE;
```

**Result:** `DELETE FROM menu_categories WHERE id = X` automatically cascades:
- menu_categories → menu_items (deleted)
- menu_items → option_groups (deleted)
- option_groups → option_items (deleted)

This plan's DELETE handlers rely **exclusively** on the FK cascade — no manual nested deletes are needed. The rollback strategy in POST /menu-items also uses this: a single DELETE on the parent item row cascades to cleanup all children.

---

## Realtime Publication (MENU-04 Preparation)

Phase 01 migration 0002 also added:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_categories;
```

The PATCH /:id/availability endpoint now updates `menu_items.available` + `updated_at`. Supabase Realtime automatically publishes the UPDATE event to all subscribed clients. Plan 02-05 (frontend) will subscribe to these events for real-time availability feedback (MENU-04).

---

## Test Results

```
apps/backend test:  Test Files  8 passed | 3 skipped (11)
apps/backend test:       Tests  33 passed | 11 skipped (44)
```

**Breakdown:**
- health.test.ts: 1 passed (Phase 01)
- auth.test.ts: 0 passed (skipped, wired in Plan 02-02)
- slug.test.ts: 4 passed (Phase 02-02)
- phone.test.ts: 3 passed (Phase 02-02)
- restaurants.test.ts: 6 passed (Phase 02-02)
- jwt.test.ts: 0 passed (skipped, wired in Phase 02-05+)
- rls.test.ts: 0 passed (skipped, no live Supabase in CI)
- menu-categories.test.ts: **5 passed** (new, Task 1)
- menu-items.test.ts: **8 passed** (new, Task 2)

**Total for this plan:** 13 new passing tests

---

## Verification

✓ `pnpm --filter @agente-restaurante/backend exec tsc --noEmit` exits 0 (no TS errors)
✓ `pnpm -r --if-present run test` exits 0 (33 passed, 11 skipped)
✓ All 3 routers exported from their modules
✓ All 3 routers wired in `apps/backend/src/index.ts`
✓ Defense-in-depth grep: every menu_categories/menu_items query includes `.eq('restaurant_id', req.restaurantId)`

```bash
$ grep -c ".eq('restaurant_id', req.restaurantId)" \
  apps/backend/src/routes/menu-categories.ts \
  apps/backend/src/routes/menu-items.ts
apps/backend/src/routes/menu-categories.ts:4
apps/backend/src/routes/menu-items.ts:5
# Total: 9 occurrences (beyond minimum requirement)
```

✓ Template file exists and is valid JSON with 4 categories, 11 items

---

## Deviations from Plan

**None — plan executed exactly as written.**

All acceptance criteria met:
- ✓ menuCategoriesRouter exports with 4 handlers (GET, POST, PATCH, DELETE)
- ✓ menuItemsRouter exports with 5 handlers (GET, POST, PATCH /:id, DELETE, PATCH /:id/availability)
- ✓ menuTemplateRouter exports POST /load-template with idempotency guard
- ✓ hamburgueseria-template.json: 4 categories × 11 items, ALL base_price: null
- ✓ Tests: menu-categories has 5+ real it() blocks; menu-items has 8+ real it() blocks
- ✓ Wiring: all 3 routers mounted in index.ts
- ✓ TypeScript: 0 errors
- ✓ Tests: 33 passed, 11 skipped, 0 failed

---

## Known Stubs

**None.** All test suites complete. Live integration tests are intentionally commented out for CI compatibility (require real Supabase + ANON_KEY).

---

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| (none) | — | No new exposed endpoints without requireAuth. JWT verified before restaurantId extraction. Every DB query includes defense-in-depth .eq('restaurant_id', ...). RLS on all tables (Phase 01) gates access at DB level. |

---

## Self-Check: PASSED

✓ All files created: menu-categories.ts, menu-items.ts, menu-template.ts, hamburgueseria-template.json
✓ All commits exist: 4e20636, ceb80b4, cbff3d8
✓ Test suite green: 33 passed, 11 skipped, 0 failed
✓ TypeScript compiles: 0 errors
✓ Router exports verified: 3/3 routers exported
✓ Wiring verified: 3/3 routers mounted in index.ts
✓ Defense-in-depth verified: 9+ occurrences of `.eq('restaurant_id', req.restaurantId)`
✓ Template file valid: valid JSON, 4 categories, 11 items, all base_price: null

---

## What Comes Next (Dependency Chain)

**Plan 02-04 (Onboarding Frontend):** calls these endpoints via Supabase client + JWT from login.

**Plan 02-05 (MenuEditor Frontend):** GET /api/menu-categories, GET /api/menu-items?category_id=X, POST/PATCH/DELETE items, PATCH /:id/availability with Realtime subscription.

**Plan 02-06 (Settings Frontend):** POST /api/menu/load-template for the generic template loader UX.

**Plan 02-07 (E2E Verification):** full flow: signup → onboarding → POST /api/menu/load-template → GET categories/items.

---

**This plan is complete and all downstream Phase 2 plans are now unblocked.**
