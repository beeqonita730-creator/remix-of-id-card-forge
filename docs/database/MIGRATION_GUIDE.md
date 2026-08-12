# MIGRATION GUIDE

## 1. Files

```
supabase/
├── config.toml                 (existing project config; do not edit)
├── schema.sql                  (consolidated schema — 001..012 + 014 concatenated)
├── seed.sql                    (copy of 013_seed.sql — standard Supabase seed location)
└── migrations/
    ├── 20260812213400_001_extensions.sql
    ├── 20260812213500_002_types.sql
    ├── 20260812213600_003_organizations.sql
    ├── 20260812213700_004_profiles.sql
    ├── 20260812213800_005_card_sizes.sql
    ├── 20260812213900_006_card_templates.sql
    ├── 20260812214000_007_id_cards.sql
    ├── 20260812214100_008_print_history.sql
    ├── 20260812214200_009_functions.sql
    ├── 20260812214300_010_triggers.sql
    ├── 20260812214400_011_rls.sql
    ├── 20260812214500_012_storage.sql
    ├── 20260812214600_013_seed.sql
    └── 20260812220000_014_validation_patches.sql  (additive only — safe to re-run on existing DBs)
```

Every migration:
- Idempotent: `CREATE EXTENSION IF NOT EXISTS`, `CREATE TYPE … DO $$ BEGIN … EXCEPTION WHEN duplicate_object`, `ON CONFLICT DO NOTHING`, `DROP POLICY IF EXISTS` loops.
- Re-runnable.
- Strictly additive: no DROP TABLE/COLUMN/TRUNCATE (per Master Prompt rule 42).

## 2. Prerequisites

1. Supabase project created & linked. The project ID is currently `wcwhinzcwdfxgdgbuudr` (see `.env`).
2. `SUPABASE_URL` + service-role key set in environment (when using CLI).
3. Supabase CLI version ≥ 1.200 (check: `supabase --version`).

## 3. Apply against a LIVE Supabase project

### Option A: Via Supabase CLI `db push` / `migration up`
```powershell
# Verify CLI project link
supabase link --project-ref wcwhinzcwdfxgdgbuudr

# Apply all pending migrations in order
supabase db push
```
CLI reads `supabase/migrations/` automatically. Each file has a `YYYYMMDDHHMMSS_` prefix which CLI orders lexicographically.

### Option B: Apply manually via SQL Editor
Open Supabase dashboard SQL Editor. Run each file in order, top to bottom:
1. `001_extensions.sql`
2. `002_types.sql`
3. `003_organizations.sql`
4. `004_profiles.sql`
5. `005_card_sizes.sql`
6. `006_card_templates.sql`
7. `007_id_cards.sql`
8. `008_print_history.sql`
9. `009_functions.sql`
10. `010_triggers.sql`
11. `011_rls.sql`
12. `012_storage.sql`
13. `013_seed.sql`
14. `014_validation_patches.sql`  (patch — safe on fresh OR pre-existing deployments)

Wait for "Success. No rows returned" before moving to next. **Do not skip steps.** Functions and triggers depend on tables created earlier.

### Option C: Via the MCP `supabase_apply_migration` tool in this IDE
One call per migration file, in order, e.g.:
```
supabase_apply_migration(file_path="d:/.../migrations/20260812213400_001_extensions.sql")
supabase_apply_migration(file_path="d:/.../migrations/20260812213500_002_types.sql")
...
```

## 4. Apply locally (Supabase local stack)

```powershell
supabase init        # if not already
supabase start       # boots Postgres, Auth, Storage, REST etc
supabase db reset    # drops local DB; applies migrations/ + seed.sql
supabase status      # print URLs + keys
```

## 5. Regenerate TypeScript Database Types

The types at `src/integrations/supabase/types.ts` are a pre-existing hand-crafted copy that exactly matches the schema. After future migrations you can regenerate via CLI:
```powershell
supabase gen types typescript --project-id wcwhinzcwdfxgdgbuudr --schema public > src/integrations/supabase/types.ts
```
**DO NOT overwrite the existing types.ts blindly — compare output first.** The existing file already includes the non-standard `__InternalSupabase.PostgrestVersion` key required by `client.ts` (auto-generated types don't include it; keep it).

## 6. Rollback Plan

Migrations are additive and idempotent. If a step fails:
1. Fix error (column conflict, typo, missing privilege)
2. Re-run the same migration file — it uses IF NOT EXISTS/EXCEPTS clauses.
3. Continue.

If something is fundamentally wrong and you need a clean slate (LOCAL DEV ONLY — NEVER production):
```powershell
supabase db reset
```

**Never** run destructive SQL on the production db. If cleanup is needed in prod, craft a NEW migration with the minimal ALTER statements and apply via CLI.

## 7. Post-migration Validation Checklist

After applying to a live/linked project:

- [ ] Extensions installed: `SELECT * FROM pg_extension WHERE extname IN ('pgcrypto','uuid-ossp');` → 2 rows
- [ ] Enums exist: `SELECT enumlabel FROM pg_enum WHERE enumtypid = 'public.app_role'::regtype ORDER BY 1` → `admin, designer, operator, viewer`
- [ ] All 9 tables present in `information_schema.tables WHERE table_schema = 'public'`
- [ ] RLS enabled on all 9: `SELECT relname, relrowsecurity FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r';`
- [ ] `verify_card` RPC return type has exactly 6 columns (`card_number,card_state,expiry,full_name,job_position,org_name`)
- [ ] Storage buckets `card-photos` and `template-assets` exist and `public = false`
- [ ] Seeded card sizes: `SELECT code FROM card_sizes WHERE is_system_default = true` → CR80, CR80-V, ID2, B1, B2

## 8. Common Pitfalls

| Pitfall | Fix |
|---------|-----|
| `permission denied for schema public` / `must be owner` | You are executing as anon/authenticated role in SQL Editor. Switch to postgres/sa role or use `SECURITY DEFINER` only in functions (already done). |
| `on_auth_user_created trigger cannot be created on auth.users: permission denied` | On some Supabase tiers you can't create triggers on auth.users directly. Workaround: use an Edge Function or enable the `auth.users` trigger privilege via Supabase Dashboard → Authentication → Hooks (or ask support for "Trigger on auth.users" grant). |
| Upload failing after migration | Storage policies now require `bucket/<org_uuid>/…` paths; See **STORAGE_MODEL.md §2.1** for the scoped upload wrapper. |
| Signup via email creates no profile | Always check that the trigger `on_auth_user_created` actually fired. If the above auth.users trigger privilege is missing, signup creates an auth.users row but never runs `handle_new_user()`. Fix by granting or migrate to hook-based profile creation. |
| `next_card_number` returns null | Trigger didn't create organization for the user → org_id lookup fails. Fix: manually insert the organization (Dashboard) and then UPDATE profiles.organization_id. |

## 9. Validation Results (2026-08-12 Audit)

### Migration Command
```powershell
# Local dev validation (requires Docker Desktop running):
supabase start       # boots Postgres/Auth/Storage
supabase db reset    # applies migrations/ + seed.sql

# Manual CLI deploy to Supabase project:
supabase link --project-ref wcwhinzcwdfxgdgbuudr
supabase db push
```

### Database Reset Result
**NOT EXECUTED** — Docker Desktop daemon reported 500 API error at audit time (`docker ps` → 500). Validation of migration application to a live Postgres instance was not performed. See `DATABASE_VALIDATION_REPORT.md` §1 for status.

### RLS Tests
| Test | Code-level Verdict | Live-SQL |
|------|--------------------|----------|
| `current_org_id()` returns org for authenticated, NULL for anon | PASS by inspection | NOT EXECUTED |
| `has_role()` admin/designer/operator/viewer/anon cases | PASS by inspection | NOT EXECUTED |
| Cross-tenant SELECT blocked on all 9 tables | PASS by inspection | NOT EXECUTED |
| Cross-tenant INSERT blocked (org_id override attack) | PASS by inspection | NOT EXECUTED |
| Cross-tenant UPDATE/DELETE blocked | PASS by inspection | NOT EXECUTED |
| Anonymous user cannot SELECT `id_cards`, `profiles`, `organizations`, `user_roles` directly | PASS by inspection | NOT EXECUTED |

### Storage Tests
| Test | Code-level Verdict | Live-SQL |
|------|--------------------|----------|
| `card-photos` bucket upload requires `{org_id}/…` folder prefix | PASS by inspection | NOT EXECUTED |
| `template-assets` bucket upload requires `{org_id}/…` folder prefix | PASS by inspection | NOT EXECUTED |
| Application code (`uploadCardholderPhoto`, `uploadTemplateAsset`) produces org-scoped paths | PASS — `services/storage.ts` rewritten | NOT EXECUTED |
| Flat UUID paths rejected by RLS (original bug) | CONFIRMED FIXED — application now prefixes | NOT EXECUTED |

### Public Verification Test
| Test | Verdict (code-inspection) | Live-SQL |
|------|----------------------------|----------|
| Valid token → returns only `card_number,card_state,expiry,full_name,job_position,org_name` | PASS | NOT EXECUTED |
| Invalid token → NULL / no sensitive leak | PASS — RPC returns NULL for invalid, does not SELECT from secret columns | NOT EXECUTED |
| Anonymous can call `verify_card` RPC only | PASS — SECURITY DEFINER + EXECUTE granted to public | NOT EXECUTED |

### Application Integration Result
| Item | Verdict |
|------|---------|
| `TypeScript strict: true` type-check (`npx tsc --noEmit`) | PASS — 0 errors |
| Vite production build (`npm run build`) Client / SSR / Nitro | PASS — 0 errors, exit code 0 |
| All `.from(…)` / `.rpc(…)` / `.storage.from(…)` calls reference valid DB objects (tables: `organizations,profiles,user_roles,card_sizes,card_templates,template_versions,template_assets,id_cards,print_history`; RPCs: `next_card_number,verify_card`; buckets: `card-photos,template-assets`) | PASS |
| Frontend role gating: `listMyRoles()` → `has_role()` → UI buttons disable correctly | PASS — `getRoleLabels()` + `ProtectedAction` component pattern |

### Known Limitations
1. **Docker Desktop was not running** at audit time → no live SQL executed. Re-run `supabase start` + `supabase db reset` once Docker is healthy to complete runtime tests.
2. **Auth trigger on `auth.users`**: Some Supabase tiers prohibit custom triggers on `auth.users` directly without a support grant. If signup creates no organization/profile, deploy an Edge Function equivalent of `handle_new_user()` on `auth.users` insert webhook.
3. **Card number concurrency**: 8-retry collision loop exists in `insertCardWithNumber()`; Postgres advisory lock variant available on request for high-write tenants.
4. **QR token**: 24 hex chars (96 bits of entropy) from `gen_random_bytes()` is collision-resistant up to ~2^48 cards. Sufficient for 10-billion-card installations before birthday bound risk.
5. **Storage MIME enforcement**: Done at Supabase bucket-policy + policy RLS level. For defense-in-depth, a 10 MB cap on both buckets is enforced. Validate MIME at upload edge (browser helper already filters).
6. **Template asset `template_id IS NULL` backgrounds**: shared across tenant boundary by design. If per-tenant backgrounds are required later, drop the OR-branch in `template_assets_org_read` and seed backgrounds under org ownership.
