# DATABASE ARCHITECTURE

## 1. Scope

This document describes the database architecture for the **ID Card Studio** (formerly `id-card-forge`) application as reverse-engineered from the current TypeScript/React/TanStack source code under `src/`. The design is strictly additive — no destructive operations — and intended to be applied to an existing Supabase project via the ordered migrations under `supabase/migrations/`.

## 2. Layered Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ PUBLIC (anonymous)                                                │
│  └─ verify_card(token) RPC only                                   │
├──────────────────────────────────────────────────────────────────┤
│ AUTHENTICATED (Supabase Auth users)                               │
│  └─ Strict tenant isolation: users only see rows where            │
│     organization_id = current_org_id() (derived from profiles)    │
├──────────────────────────────────────────────────────────────────┤
│ STORAGE                                                           │
│  ├─ card-photos: <org_id>/...  (10 MB, image mime types)         │
│  └─ template-assets: <org_id>/... (20 MB, image + svg)            │
├──────────────────────────────────────────────────────────────────┤
│ PRIVATE FUNCTIONS / TRIGGERS                                      │
│  ├─ handle_new_user() — auth.users → profile + org + admin role   │
│  ├─ current_org_id() — stable tenant lookup                       │
│  ├─ has_role() — role gating for RLS                              │
│  ├─ next_card_number() — count-based sequential generator        │
│  └─ set_updated_at_column() — per-row timestamp maint             │
└──────────────────────────────────────────────────────────────────┘
```

## 3. Entity / Tenant Model

### 3.1 Organization
Top-level tenant container. Every row in every private table must carry an `organization_id` that points at this table (except globally shared system card sizes which carry `NULL` organization_id and are flagged `is_system_default`).

### 3.2 Profile
1:1 linkage between `auth.users` and `public.profiles`. Created automatically by the `on_auth_user_created` trigger so that every signup produces (in order):

1. `auth.users` row (Supabase)
2. `public.organizations` row IF the signup payload contained `organization_name`
3. `public.profiles` row (id = auth.uid)
4. `public.user_roles` with `admin` role for the first user of the organization

### 3.3 Roles (RBAC)
Only four discrete roles exist — as enforced by the `app_role` enum — because `useRoles` hook at `src/hooks/useRoles.ts` only references them:

| Role | Capabilities |
|------|-------------|
| `admin` | Everything: manage cards, design, print, users + delete |
| `designer` | Edit templates / template assets; print |
| `operator` | Issue, block, reissue, import cards; print |
| `viewer` | (Currently not gating read-only; RLS read uses org membership only) |

Role enforcement is done via the `has_role(app_role, user_id)` SECURITY DEFINER helper inside RLS `WITH CHECK` / `USING` clauses.

## 4. Table Inventory

See [ENTITY_CATALOG.md](./ENTITY_CATALOG.md) for column-level detail and [RELATIONSHIP_MODEL.md](./RELATIONSHIP_MODEL.md) for the Mermaid ERD.

### 4.1 Core tables (8)

| # | Table | Purpose | Primary Key | Tenant Key |
|---|-------|---------|-------------|------------|
| 1 | `organizations` | Tenant/workspace | `id` uuid | self |
| 2 | `profiles` | User-to-org link | `id` (= `auth.uid`) FK | `organization_id` |
| 3 | `user_roles` | RBAC assignments | synthetic uuid | via `profiles` |
| 4 | `card_sizes` | Physical dimensions (mm) with 5 global system defaults | `id` | `organization_id` (nullable; NULL = global) |
| 5 | `card_templates` | Named design (front/back JSONB + version counter) | `id` | `organization_id` |
| 6 | `template_versions` | Immutable snapshot per save (`version` is unique per template) | `id` | `organization_id` |
| 7 | `template_assets` | Designer-uploaded images (backgrounds, logos) — references storage path | `id` | `organization_id` |
| 8 | `id_cards` | Issued card — every PII field, snapshot of design, QR token | `id` | `organization_id` |
| 9 | `print_history` | Audit trail of prints / reprints / status changes | `id` | `organization_id` |

### 4.2 Supabase-owned tables (referenced only)
- `auth.users` — FK target for `profiles.id`, `user_roles.user_id`, `id_cards.created_by`, etc.
- `storage.objects` — policies live in `012_storage.sql`

## 5. Key Design Decisions & Rationale

### 5.1 `card_number` uniqueness
UNIQUE per organization (`id_cards_org_number_uniq`) because `bumpCardNumber()` + `next_card_number()` at `src/services/db.ts:107` must be safe under concurrent issue. Client-level retry (8 attempts) is preserved as an application-level mitigation — DB uniqueness is the real guard.

Pattern: `<PREFIX>-<YYYY>-<NNNNNN>` with 6-digit padding.

### 5.2 `qr_token` as public verification key
UNIQUE globally (`id_cards_qr_token_uniq`). Random 96-bit → 24-char hex (same entropy as UUID but fits easily in QR). The `verify_card(token)` RPC **never** returns private fields — see §6.

### 5.3 JSONB only where justified
- `front_design`, `back_design`: heterogeneous element list (text/qr/photo/shapes) — JSONB is the correct model because elements are opaque to queries.
- `snapshot` on `id_cards` / `template_versions`: immutable design checkpoint — never queried by fields.
- `custom_fields` on `id_cards`: explicit catch-all for schema-less extensions — already referenced in existing `types.ts`.

**No denormalisation of relational data into JSONB.**

### 5.4 `card_sizes` dual identity
- Global system defaults: `organization_id = NULL AND is_system_default = true` (CR80, ID-2, B1, B2, CR80-V seeded via 013)
- Org custom: `organization_id = <tenant>` with `is_system_default = false`
- RLS on SELECT lets authenticated users see **both** (required because `templates.tsx` creates from size picker)

### 5.5 Storage is strictly scoped per-organization
Storage path format: `bucket/<org_id>/<rest>`. All four storage policies (SELECT/INSERT/UPDATE/DELETE) first validate `(storage.foldername(name))[1] = current_org_id()::text`. A user of org A cannot touch org B's photos even with a tampered UUID.

## 6. Security / Privacy Boundaries

### 6.1 Public verification (strict least-privilege)
Route at `src/routes/verify.$token.tsx` calls only:
```
supabase.rpc('verify_card', { _token: token })
```

This SECURITY DEFINER RPC **only** returns:
- `card_number`, `card_state` (computed effective status incl. expiry)
- `expiry` (timestamptz)
- `full_name`, `job_position`, `org_name`

**Never returned:** identification_number, nik, birth_place, birth_date, gender, address, phone, email, department, membership_number, photo_url, internal `id` / `organization_id`.

### 6.2 RLS enforcement summary
Every private table has RLS **enabled** (`ALTER TABLE … ENABLE ROW LEVEL SECURITY`). Tables default to `default deny` — no policies means no access. All RLS clauses are explicitly tagged with their tenant predicate (`organization_id = current_org_id()` or equivalent). For the explicit policy list see [RLS_SECURITY_MODEL.md](./RLS_SECURITY_MODEL.md).

### 6.3 Cross-tenant reads
Impossible by construction:
- `current_org_id()` = `profiles.organization_id` for `auth.uid()` — cannot be forged by the client because it reads server-side from `auth.uid()` inside Postgres (SECURITY DEFINER).

### 6.4 File upload boundary
See [STORAGE_MODEL.md](./STORAGE_MODEL.md).

## 7. Index Strategy
See `007_id_cards.sql`, `006_card_templates.sql`, `008_print_history.sql`. Indexes only for predicates actually present in the frontend code (see Supabase query inventory in final report):

- Organization-scoped sort: `(organization_id, created_at DESC)` applied to templates, cards, template_assets, print_history, template_versions.
- Search in id-cards page (`listCards` then JS filter on `card_number`, `full_name`, `department`) → GIN-less btree on `full_name` + `department`; org-aware composite index `(organization_id, lower(full_name), lower(coalesce(department,'')))`.
- Join FK columns: `template_id`, `card_size_id` on `id_cards`; `user_id`, `card_id` on `print_history`.

No heavy indexes on JSONB — the app never queries into design JSONB from SQL.

## 8. Trigger Inventory

| Trigger | Table | Event | Purpose |
|---------|-------|-------|---------|
| `<table>_updated_at_trg` | organizations, profiles, card_sizes, card_templates, template_assets, id_cards, print_history | BEFORE UPDATE | Maintain `updated_at = now()` |
| `on_auth_user_created` | auth.users | AFTER INSERT | profile → organization → role bootstrap (§3.2) |

## 9. Migration Order Contract

Migrations under `supabase/migrations/` are numbered and **must** be applied in strict lexical order:

```
001_extensions     → pgcrypto / uuid-ossp
002_types          → app_role, card_status enums
003_organizations  → tenant table (FK target first)
004_profiles       → profiles + user_roles (FK to auth.users & orgs)
005_card_sizes     → physical dims (FK target for templates)
006_card_templates → templates / template_versions / template_assets
007_id_cards       → PII + card numbers (FKs to templates/sizes/orgs)
008_print_history  → audit trail (FK to cards/orgs)
009_functions      → current_org_id / has_role / next_card_number / verify_card / set_updated_at
010_triggers       → attach updated_at triggers + handle_new_user() trigger on auth.users
011_rls            → ENABLE ROW LEVEL SECURITY + explicit policies
012_storage        → buckets + storage.objects policies
013_seed           → 5 global ISO system card sizes (idempotent)
```

See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for Supabase CLI commands.

## 10. Compatibility With Existing Frontend Code

Zero changes required to React code — every column name, enum member, RPC name and storage bucket name exactly matches the existing call sites:

| Frontend artifact | Database side | Match? |
|-------------------|---------------|--------|
| `getProfile()` → `profiles(id, organization_id, full_name, email)` | `004_profiles.sql` | ✅ exact columns |
| `getOrganization()` → `organizations(id, name, card_prefix, address, contact, logo_url)` | `003_organizations.sql` | ✅ exact columns |
| `listTemplates()` → `card_templates(*, card_sizes(*))` with join on FK | `006_card_templates.sql` + `card_sizes(*) ` | ✅ supabase-js joins work |
| `listCards()` → `id_cards(*, card_sizes(*), card_templates(id,name,version))` | `007_id_cards.sql` + FK indexes | ✅ joins satisfied |
| `next_card_number({ _org })` → RPC | `009_functions.sql` | ✅ signature match |
| `verify_card({ _token })` → returns `{card_number,card_state,expiry,full_name,job_position,org_name}` | `009_functions.sql` | ✅ signature and field names match |
| `uploadAndSign('card-photos', file)` | bucket `card-photos` (012_storage) | ✅ name match |
| `uploadAndSign('template-assets', file)` | bucket `template-assets` (012_storage) | ✅ name match |
| `src/integrations/supabase/types.ts` enums `app_role` & `card_status` | `002_types.sql` | ✅ exact same members and ordering |

## 11. Non-goals / Out of scope

- **No CSV `import_jobs` table** — `createCardsBulk()` at `src/services/db.ts:244` is in-process only; no persistent import jobs are queried/listed.
- **No `audit_logs` table beyond `print_history`** — print_history already acts as the audit trail (the UI labels column `print_type` "Type" and includes `status:…` events).
- **No denormalised dashboard materialised views** — dashboard metrics are aggregates computed client-side (see `dashboard.tsx`). If the dashboard becomes slow at scale, a separate additive migration for `mv_org_dashboard_stats` is appropriate later.
