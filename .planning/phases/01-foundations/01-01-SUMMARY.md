---
phase: 01-foundations
plan: "01"
subsystem: monorepo-scaffold
tags: [monorepo, pnpm, typescript, wave-0, scaffolding, test-infrastructure]
dependency_graph:
  requires: []
  provides:
    - pnpm workspace topology (apps/*, packages/*)
    - "@agente-restaurante/shared TypeScript types (8 interfaces, 3 type aliases)"
    - Wave 0 test scaffolds (AUTH-01..06, SEC-04, SEC-05)
    - SEC-04 bundle leak detector script
  affects:
    - All subsequent plans in Phase 01 (shared types + test harness)
    - Phase 02+ (all plans consume shared types)
tech_stack:
  added:
    - pnpm@9.15.0 (workspace manager, locked via packageManager field)
    - typescript@6.0.3 (root + per-app)
    - vitest@4.1.5 (backend + frontend test runner)
  patterns:
    - pnpm workspace:* protocol for local package linking
    - Strict TypeScript configs (CommonJS for backend, bundler moduleResolution for frontend)
    - Wave 0 TDD scaffolding (it.skip stubs for future test activation)
key_files:
  created:
    - pnpm-workspace.yaml (3 lines)
    - package.json root (14 lines)
    - .gitignore (8 lines)
    - .env.example (8 lines)
    - packages/shared/package.json (12 lines)
    - packages/shared/tsconfig.json (15 lines)
    - packages/shared/src/index.ts (97 lines)
    - apps/backend/package.json (25 lines)
    - apps/backend/tsconfig.json (16 lines)
    - apps/backend/vitest.config.ts (8 lines)
    - apps/backend/src/__tests__/rls.test.ts (13 lines)
    - apps/backend/src/__tests__/auth.test.ts (12 lines)
    - apps/backend/src/__tests__/jwt.test.ts (7 lines)
    - apps/backend/src/__tests__/encryption.test.ts (22 lines)
    - apps/frontend/package.json (29 lines)
    - apps/frontend/tsconfig.json (15 lines)
    - apps/frontend/vitest.config.ts (8 lines)
    - apps/frontend/src/__tests__/sec04.test.ts (22 lines)
    - scripts/check-sec04.sh (23 lines)
    - pnpm-lock.yaml (generated, 2261 lines)
  modified: []
decisions:
  - "Root test script uses pnpm -r --if-present run test (not pnpm -r test --run which is broken in pnpm 9.15.0)"
  - "sec04.test.ts quotes script path to handle spaces in directory names"
  - "Shared tsconfig uses moduleResolution bundler (not node) per ESNext/bundler pattern"
metrics:
  duration: "4m 22s"
  completed_date: "2026-05-08"
  tasks_completed: 2
  tasks_total: 2
  files_created: 20
  files_modified: 0
---

# Phase 01 Plan 01: Monorepo Skeleton + Wave 0 Test Scaffolds Summary

**One-liner:** pnpm@9.15.0 workspace with 8 shared TypeScript interfaces (D-02 menu schema, D-07 PII annotation), vitest test harness, and SEC-04 bundle leak detector — zero runtime code, solid foundation for all Phase 1 plans.

---

## What Was Built

### Task 1: pnpm Monorepo Skeleton

Created the full workspace topology and shared types package:

- **`pnpm-workspace.yaml`** — defines `apps/*` and `packages/*` as workspace roots
- **Root `package.json`** — `packageManager: pnpm@9.15.0` (Corepack-readable, prevents npm/yarn drift on CI/Railway), `test/build/lint/check-sec04` scripts
- **`.gitignore`** — covers `node_modules/`, `dist/`, `.env`, `.env.local`, `*.log`, `.DS_Store`
- **`.env.example`** — backend-only keys (`SUPABASE_SERVICE_ROLE_KEY` without `VITE_` prefix, D-05 enforced at template level); frontend keys (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- **`packages/shared/src/index.ts`** — 8 interfaces + 3 type aliases from Phase 1 schema:
  - `Restaurant`, `MenuCategory`, `MenuItem` (with nullable `base_price`, D-02)
  - `OptionGroup` (min/max cardinalidad), `OptionItem` (price_delta as absolute when base_price null)
  - `Order` with `customer_phone` annotated `// PII (D-07, Ley 25.326 AR): NEVER log this field`
  - `OrderItem`, `Subscription`
  - Type aliases: `OrderStatus`, `FulfillmentType`, `SubscriptionStatus`
- **`apps/backend/package.json`** — `@agente-restaurante/shared: workspace:*`, express@5.2.1, supabase-js@2.105.3, mercadopago@2.12.0
- **`apps/frontend/package.json`** — `@agente-restaurante/shared: workspace:*`, react@19.2.6, vite@8.0.11, tailwindcss@4.2.4
- Both app tsconfigs with strict mode

`pnpm install` resolved 219 packages (165 added) in 4.6s. Lockfile generated.

### Task 2: Wave 0 Test Scaffolds + SEC-04 Script

Created test infrastructure for all Phase 1 requirements:

| File | Tests | Status |
|------|-------|--------|
| `apps/backend/src/__tests__/rls.test.ts` | AUTH-05 (3 stubs) | all skipped — wires in Plan 02 |
| `apps/backend/src/__tests__/auth.test.ts` | AUTH-01, AUTH-02 (2 stubs) | all skipped — wires in Plan 04/05 |
| `apps/backend/src/__tests__/jwt.test.ts` | AUTH-06 (1 stub) | skipped — wires in Plan 02+03 |
| `apps/backend/src/__tests__/encryption.test.ts` | SEC-05 (1 live test) | **passes** — no customer_phone in console.log |
| `apps/frontend/src/__tests__/sec04.test.ts` | SEC-04 (1 live test) | **passes** — script exits 0 on empty dist |
| `scripts/check-sec04.sh` | — | exits 0 clean, exits 1 with service_role leak |

### pnpm install output

```
Packages: +165
Progress: resolved 219, reused 0, downloaded 166, added 165, done
1 deprecated subdependency: uuid@9.0.1 (transitive, not our dep)
Done in 4.6s
```

### pnpm test output (full workspace)

```
packages/shared test: no tests in shared package
apps/backend:  Test Files  1 passed | 3 skipped (4)
apps/backend:       Tests  1 passed | 6 skipped (7)
apps/frontend:  Test Files  1 passed (1)
apps/frontend:       Tests  1 passed (1)
Zero failures.
```

### .env.example verification

- Contains `SUPABASE_SERVICE_ROLE_KEY=` (no VITE_ prefix) — PASS
- Contains `VITE_SUPABASE_ANON_KEY=` — PASS
- Does NOT contain `VITE_SUPABASE_SERVICE_ROLE_KEY` — PASS (D-05 enforced)

### SEC-04 script smoke test

```
# Against empty/nonexistent dist (no build):
$ bash scripts/check-sec04.sh
OK — apps/frontend/dist does not exist yet (no build to scan)
exit: 0

# Against dist/ seeded with "service_role":
$ echo 'service_role content here' > apps/frontend/dist/test.js && bash scripts/check-sec04.sh
ERROR: service role key reference found in apps/frontend/dist
exit: 1
```

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] pnpm -r test --run not valid in pnpm 9.15.0**
- **Found during:** Task 2 verification
- **Issue:** The plan specified `"test": "pnpm -r test --run"` in root package.json. In pnpm 9.15.0, `--run` is not a valid flag at this position — pnpm interprets it as a pnpm CLI flag rather than passing it to vitest. Running `pnpm test` from root exited with `ERROR Unknown option: 'run'`.
- **Fix:** Changed to `"test": "pnpm -r --if-present run test"` — runs each workspace's `test` script if present, skips workspaces without one. Semantically equivalent for our use case.
- **Files modified:** `package.json` (root)
- **Commit:** 6222539

**2. [Rule 1 - Bug] sec04.test.ts path not quoted — fails on spaces in directory names**
- **Found during:** Task 2 verification (running frontend test suite)
- **Issue:** The plan's verbatim `sec04.test.ts` used `` execSync(`bash ${root}/../../scripts/check-sec04.sh`) `` without quoting the path. The project directory is `/Users/mauriciocarenanew/Desktop/Repositorios/Agente restaurante` (note the space). Node's `execSync` shell-splits the command, causing `bash` to receive `restaurante/apps/frontend/../../scripts/check-sec04.sh` as two separate arguments. Exit code 127 (command not found).
- **Fix:** Changed to `` execSync(`bash "${root}/../../scripts/check-sec04.sh"`) `` — quotes the path.
- **Files modified:** `apps/frontend/src/__tests__/sec04.test.ts`
- **Commit:** 6222539

**3. [Rule 1 - Bug] encryption.test.ts path replacement uses Windows-style separator**
- **Found during:** Task 2 code review before running
- **Issue:** The plan's verbatim test used `process.cwd().replace(/apps\\/backend$/, '')` — the `\\/` inside a regex literal is invalid (the slash does not need escaping inside regex). On macOS paths use `/` as separator.
- **Fix:** Changed to `process.cwd().replace(/apps\/backend$/, '')` — standard regex with forward slash.
- **Files modified:** `apps/backend/src/__tests__/encryption.test.ts`
- **Commit:** 6222539

---

## Known Stubs

The following test stubs are intentional Wave 0 placeholders (not missing functionality):

| Stub | File | Reason |
|------|------|--------|
| `it.skip` AUTH-05 (3 tests) | `rls.test.ts` | Requires live Supabase schema from Plan 02 |
| `it.skip` AUTH-01, AUTH-02 (2 tests) | `auth.test.ts` | Requires Supabase project + auth config from Plan 04/05 |
| `it.skip` AUTH-06 (1 test) | `jwt.test.ts` | Requires Custom Access Token Hook from Plan 02 |

These are by design. Plans 02-05 will activate them.

---

## Threat Flags

None. Plan 01 writes only config + types + test scaffolds. No network endpoints, auth paths, file access patterns, or schema changes introduced. Threat model items T-01-01-01 through T-01-01-03 are all mitigated:

- T-01-01-01: `.env` excluded from git via `.gitignore`; `.env.example` has no real values
- T-01-01-02: `packageManager: pnpm@9.15.0` pinned in root package.json
- T-01-01-03: `customer_phone` annotated with `// PII (D-07, Ley 25.326 AR): NEVER log this field`

---

## Self-Check: PASSED

Files verified:

- pnpm-workspace.yaml: FOUND
- package.json: FOUND
- packages/shared/src/index.ts: FOUND (8 interfaces, 3 type aliases)
- apps/backend/vitest.config.ts: FOUND
- apps/frontend/vitest.config.ts: FOUND
- scripts/check-sec04.sh: FOUND (executable)
- apps/backend/src/__tests__/rls.test.ts: FOUND
- apps/backend/src/__tests__/auth.test.ts: FOUND
- apps/backend/src/__tests__/jwt.test.ts: FOUND
- apps/backend/src/__tests__/encryption.test.ts: FOUND
- apps/frontend/src/__tests__/sec04.test.ts: FOUND

Commits verified:

- 7870b59: feat(01-01): create pnpm monorepo skeleton + shared TypeScript types — FOUND
- 6222539: feat(01-01): add Wave 0 test scaffolds + SEC-04 grep script — FOUND
