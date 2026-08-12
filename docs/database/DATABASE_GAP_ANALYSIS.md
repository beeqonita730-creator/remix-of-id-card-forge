# DATABASE GAP ANALYSIS

This document captures **what was expected vs what actually existed** at the start of the audit.

## 1. Input Evidence Sources

| Source | Path | Evidence |
|--------|------|----------|
| TS DB types (pre-existing partial blueprint) | `src/integrations/supabase/types.ts` | Defined 9 public tables, 2 enums, 4 RPCs with column signatures — excellent reverse-engineering spec. **Not a guarantee the DB was actually created.** |
| Service layer (actual queries) | `src/services/db.ts` | Every Supabase `from(…).select/insert/update/delete` + `rpc(…)` calls. |
| Routes (consumer behavior) | `src/routes/**/*.tsx` | Expected columns per view/action. |
| Storage layer | `src/services/storage.ts` | Bucket names `card-photos`, `template-assets`. |
| Designer & hooks | `src/components/**`, `src/hooks/useRoles.ts`, `src/lib/card/**` | Role expectations (`admin/designer/operator/viewer`), statuses, field lists in design. |
| `.env` | `project_root/.env` | Supabase project-id `wcwhinzcwdfxgdgbuudr`, URLs, publishable key. |
| `supabase/` pre-existing | Only `config.toml` present | **No migrations/ folder, no schema.sql, no seed.sql existed before this task.** |

## 2. Gap Classifications

| Entity | Status | Notes |
|--------|--------|-------|
| **Extensions (pgcrypto, uuid-ossp)** | **Missing** | No migration; required for `gen_random_uuid()` in default clauses + `encode(gen_random_bytes(12),'hex')` for qr_token. |
| **Enum: `app_role`** | **Missing** | Referenced by `types.ts`, `has_role()`, `useRoles`; no DB type. Needed for user_roles insert. |
| **Enum: `card_status`** | **Missing** | Same; `draft/active/expired/blocked/cancelled` literal enum required as column type on `id_cards.status`, not a text check constraint. |
| **`organizations` table** | **Missing** | No rows, no schema. Needed FK target for literally everything. |
| **`profiles` table** | **Missing** | No 1:1 auth.users linkage; no signup-trigger; `getProfile()` always returned null pre-migration. |
| **`user_roles` table** | **Missing** | Role assignments — `listMyRoles()` returned empty array pre-migration; thus `canPrint`, `canDesign`, `canManageCards` all false (blocking print, edit, issue even after login). |
| **`card_sizes` table** | **Missing** + no seed data | `listCardSizes()` empty → templates can't be created, designer canvas dimension broken. 5 seeded ISO sizes also missing. |
| **`card_templates` table** | **Missing** | Main designer table; nothing to `select *.card_sizes(*)` from. |
| **`template_versions` table** | **Missing** | `saveTemplateDesign()` line 72 always threw → no version history. |
| **`template_assets` table** | **Missing** | BackgroundPanel empty; `createTemplateAsset()` line 324 failed → designer image upload broken. |
| **`id_cards` table** | **Missing** | Core PII table; `listCards()`, `insertCardWithNumber()`, `getCard()` → dashboard all zeros, create-card flow broken. |
| **`print_history` table** | **Missing** | `logPrint()` + `listPrintHistory()` failed silently; print-history page empty. |
| **RLS on all tables** | **Missing** (and RLS DISABLED default) | Huge security hole pre-migration: any authenticated user could read every table (including other orgs!) since Supabase default is RLS disabled when table created without explicit enable. Now ENABLE ROW LEVEL SECURITY + org predicate on every policy. |
| **`current_org_id()` helper** | **Missing** | Listed in types.ts Functions. Chicken/egg resolver required for RLS. |
| **`has_role()` helper** | **Missing** | Listed in types.ts. RLS role gating impossible without it. |
| **`next_card_number(_org)` RPC** | **Missing** | `create.tsx` line 73 always threw → no auto-numbering. |
| **`verify_card(_token)` RPC** | **Missing** | `verify.$token.tsx` line 24 always threw → public QR verification 404. |
| **`set_updated_at_column()` + triggers** | **Missing** | `updated_at` timestamps stuck at INSERT time. Added for every table that carries the column. |
| **`handle_new_user()` trigger** | **Missing** | Signup only created `auth.users`; profile + organization + first-admin role were never created. |
| **Storage buckets** | **Missing** | `card-photos`, `template-assets` buckets didn't exist in `storage.buckets` → every upload failed. |
| **Storage.objects policies** | **Missing** | Even if buckets existed, no folder-based org isolation was present → cross-tenant photo access. |
| **Unique constraints on (org,card_number) & qr_token** | **Missing** | Concurrent card issue could produce duplicate numbers. Added now. |
| **Performance indexes** | **Missing** | Added per §7 INDEX STRATEGY in architecture doc. |

### Summary counts
| Classification | Count |
|----------------|-------|
| **Missing — tables** | 9 |
| **Missing — enums** | 2 |
| **Missing — extensions** | 2 |
| **Missing — RPC / helper functions** | 5 (incl. trigger helper) |
| **Missing — triggers** | 2 families (updated_at × 7 tables + auth.users signup sync) |
| **Missing — RLS (enable + policies)** | 9 tables + storage.objects for 2 buckets = large gap |
| **Missing — storage buckets** | 2 |
| **Missing — seed data** | 5 system card sizes |
| **Missing — constraints / indexes** | 3 uniques / ~12 indexes |
| **Inconsistent / partial** | 0 (types.ts columns matched cleanly — no contradictions found) |
| **Potentially obsolete** | `organizations.slug`, `card_templates.thumbnail_url/background_url/bleed_mm`, `id_cards.custom_fields`: all already present in existing types.ts, keep them for future use. |

## 3. Why this gap existed

Per the master prompt: "The project was moved to Trae and the Supabase migration files are missing." The existing TS types file is a blueprint of a schema that had been designed conceptually (likely by a former codegen pass from `supabase gen types`) but the actual SQL that created those objects was never committed to git / Supabase migrations folder. The actual live Supabase project may or may not contain partial tables — if it does, the idempotent migrations in this repository will not error (IF NOT EXISTS, EXCEPTION blocks).

## 4. Coverage of expected entities (Master Prompt list §6)

| Entity from §6 | Justified by code? | Table created? | Notes |
|----------------|--------------------|----------------|-------|
| Organization | ✅ (`organizations` everywhere) | ✅ | |
| Profile | ✅ (`getProfile`) | ✅ | |
| User (auth) | ✅ (Supabase Auth) | ✅ via auth.users FKs | Not a public table. |
| Cardholder | ➖ merged | ➖ | Cardholder data is stored inline on id_cards (1:1 with card). No separate cardholders table because frontend never joins, never lists "people", never has "one person many cards" UI — create-card is issue-once. Future entity if HRM module added. |
| ID Card | ✅ (core entity) | ✅ as `id_cards` | |
| Card Template | ✅ | ✅ as `card_templates` + `template_versions` + `template_assets` | |
| Print Job | ✅ (print history, status changes) | ✅ as `print_history` | Renamed: print_history (what existing code calls it). Table covers single-card prints, batch sheet prints, PDF exports, and status transitions. |
| Print Job Item | ❌ (not justified) | ❌ | Batch sheet is handled client-side (BatchSheetDialog) but never persisted as line items. print_history.card_id is NULL for batch events. No UI currently lists "items of a print job" → skip additive table to keep schema minimal. |
| Audit Log | ✅ (status transitions + print log) | ✅ (covered by print_history, see above) | |
| Verification | ✅ | ✅ via `verify_card` RPC + `qr_token` UNIQUE on id_cards | Public route `/verify/:token`. |
| Photo | ✅ | ✅ via `card-photos` bucket + id_cards.photo_url + signed URLs | |
| Import Job | ❌ (no persistence) | ❌ | `createCardsBulk()` in db.ts is in-process only, no UI for past imports, no retry records. Do not create import_jobs unless UI actually needs it. |
| Bulk Generation | ✅ in code / ❌ persistent | Covered inline by re-using `insertCardWithNumber()` in a loop. | Same rationale as Import Job. |

**Final table count: 9 public tables (plus 2 enum types, 1 storage schema, 5 RPCs, 2 trigger families).** Minimal and justified.
