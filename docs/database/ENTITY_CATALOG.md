# ENTITY CATALOG

Per-table inventory: purpose, columns, PK, FKs, indexes, RLS posture, code consumers.

---

## 1. organizations

**Purpose:** Top-level tenant. Everything private belongs to exactly one organization.

| Column | Type | Nullable? | Default | Notes |
|--------|------|-----------|---------|-------|
| `id` | uuid | ❌ | `gen_random_uuid()` | PRIMARY KEY |
| `name` | text | ❌ | - | Display name shown in AppShell sidebar / header |
| `slug` | text | ✅ | NULL | Reserved (unused in current UI) |
| `card_prefix` | text | ❌ | `'ORG'` | First segment of `next_card_number()` |
| `address` | text | ✅ | NULL | Selected in `getOrganization()` |
| `contact` | text | ✅ | NULL | Selected in `getOrganization()` |
| `logo_url` | text | ✅ | NULL | Selected in `getOrganization()` |
| `created_at` | timestamptz | ❌ | `now()` | |
| `updated_at` | timestamptz | ❌ | `now()` | Trigger maintained |

**Primary Key:** `id`
**Foreign Keys:** None.
**Indexes:** None explicit (PK handles equality).
**RLS:** Strict tenant — `id = current_org_id()`. Only `admin` may UPDATE. No INSERT RLS (triggers create orgs).
**Used By:**
- [db.ts `getOrganization`](file:///d:/PROYEK%20WEB%20MASTER/remix-of-id-card-forge/src/services/db.ts#L15-L22)
- [AppShell.tsx](file:///d:/PROYEK%20WEB%20MASTER/remix-of-id-card-forge/src/components/app/AppShell.tsx#L41-L42) (sidebar header)
- [CreateCard (`org?.name`)](file:///d:/PROYEK%20WEB%20MASTER/remix-of-id-card-forge/src/routes/_authenticated/id-cards.create.tsx#L53-L54)

---

## 2. profiles

**Purpose:** User ↔ Organization linkage. `id === auth.users.id` exactly.

| Column | Type | Nullable? | Default | Notes |
|--------|------|-----------|---------|-------|
| `id` | uuid | ❌ | (from trigger) | PK + FK to `auth.users(id) ON DELETE CASCADE` |
| `organization_id` | uuid | ✅ | NULL | FK → organizations(id) ON DELETE SET NULL |
| `full_name` | text | ✅ | NULL | Pulled from signup metadata |
| `email` | text | ✅ | NULL | Pulled from auth.users.email |
| `created_at` | timestamptz | ❌ | `now()` | |
| `updated_at` | timestamptz | ❌ | `now()` | Trigger maintained |

**Primary Key:** `id`
**Foreign Keys:** `id → auth.users`, `organization_id → organizations`
**Indexes:** None extra (PK + FK columns automatically covered).
**RLS:** Self + same-org. User can UPDATE self only.
**Used By:**
- [db.ts `getProfile()`](file:///d:/PROYEK%20WEB%20MASTER/remix-of-id-card-forge/src/services/db.ts#L4-L13)

---

## 3. user_roles

**Purpose:** Simple RBAC assignments (multiple roles per user allowed, currently enforced per action).

| Column | Type | Nullable? | Default | Notes |
|--------|------|-----------|---------|-------|
| `id` | uuid | ❌ | `gen_random_uuid()` | PK |
| `user_id` | uuid | ❌ | - | FK → `auth.users(id)` CASCADE |
| `role` | `app_role` enum | ❌ | - | `admin\|designer\|operator\|viewer` |

**Constraints:** `UNIQUE (user_id, role)`
**Indexes:** `user_roles_user_id_idx` on `user_id`.
**RLS:** Same-org read only (exists-clause through profiles).
**Used By:**
- [db.ts `listMyRoles()`](file:///d:/PROYEK%20WEB%20MASTER/remix-of-id-card-forge/src/services/db.ts#L167-L173)
- [useRoles hook](file:///d:/PROYEK%20WEB%20MASTER/remix-of-id-card-forge/src/hooks/useRoles.ts#L1-L19)

---

## 4. card_sizes

**Purpose:** Physical millimetre dimensions used by templates + designer.
Dual-identity rows (see §5.4 in ARCHITECTURE.md):
- `organization_id IS NULL AND is_system_default = true` → global system sizes (5 seeded)
- `organization_id = <org>` → tenant custom size

| Column | Type | Nullable? | Default | Notes |
|--------|------|-----------|---------|-------|
| `id` | uuid | ❌ | gen_random_uuid | PK |
| `organization_id` | uuid | ✅ | NULL | FK → organizations |
| `name` | text | ❌ | - | Display name |
| `code` | text | ❌ | - | Short code (CR80, CR80-V, …) |
| `width_mm` | numeric | ❌ | - | |
| `height_mm` | numeric | ❌ | - | |
| `orientation` | text | ❌ | `'portrait'` | `'portrait'\|'landscape'` (UI toggle) |
| `category` | text | ✅ | NULL | `'standard'\|'custom'` |
| `description` | text | ✅ | NULL | |
| `is_system_default` | boolean | ❌ | false | Global vs custom |
| `active` | boolean | ❌ | true | Soft-disable |
| `created_at` | timestamptz | ❌ | now() | |
| `updated_at` | timestamptz | ❌ | now() | Trigger |

**Constraints:** `card_sizes_dims_positive CHECK (width_mm > 0 AND height_mm > 0)`
**Uniqueness:**
- `card_sizes_org_code_uniq` (organization_id, code) for org-owned
- `card_sizes_system_code_uniq` (code) WHERE NULL org AND system_default
**Indexes:** `card_sizes_default_idx` (is_system_default DESC, width_mm) — drives `listCardSizes() ORDER BY`.
**RLS:** Reads see system rows OR same-org rows. Insert/Update: admin only; Delete: org-owned, admin only.
**Used By:**
- [db.ts `listCardSizes()`](file:///d:/PROYEK%20WEB%20MASTER/remix-of-id-card-forge/src/services/db.ts#L24-L32)
- [card-sizes.tsx](file:///d:/PROYEK%20WEB%20MASTER/remix-of-id-card-forge/src/routes/_authenticated/card-sizes.tsx) (CRUD UI)
- [templates.tsx](file:///d:/PROYEK%20WEB%20MASTER/remix-of-id-card-forge/src/routes/_authenticated/templates.tsx) (size picker)
- [CardSize interface](file:///d:/PROYEK%20WEB%20MASTER/remix-of-id-card-forge/src/lib/card/types.ts#L84-L96) (TS match)

---

## 5. card_templates

**Purpose:** Named design with versioned front/back JSONB layouts.

| Column | Type | Nullable? | Default | Notes |
|--------|------|-----------|---------|-------|
| `id` | uuid | ❌ | gen_random_uuid | PK |
| `organization_id` | uuid | ❌ | - | FK → organizations CASCADE |
| `card_size_id` | uuid | ✅ | NULL | FK → card_sizes SET NULL |
| `name` | text | ❌ | - | Display in templates grid + designer header |
| `description` | text | ✅ | NULL | |
| `orientation` | text | ❌ | `'portrait'` | designer layout mode |
| `version` | integer | ❌ | 1 | bumped by `saveTemplateDesign()` |
| `front_design` | jsonb | ❌ | `'{}'` | CardDesign JSON (background+elements) |
| `back_design` | jsonb | ❌ | `'{}'` | CardDesign JSON |
| `background_url` | text | ✅ | NULL | Reserved (UI uses design.background.imageUrl) |
| `thumbnail_url` | text | ✅ | NULL | Reserved |
| `bleed_mm` | numeric | ❌ | 0 | designer toggle |
| `width_mm` | numeric | ✅ | NULL | denormalised resolved dims for the chosen orientation |
| `height_mm` | numeric | ✅ | NULL | denormalised resolved dims |
| `active` | boolean | ❌ | true | |
| `created_at` | timestamptz | ❌ | now() | |
| `updated_at` | timestamptz | ❌ | now() | Trigger |

**Indexes:** `card_templates_org_idx (org_id, created_at DESC)` + `card_templates_size_idx (card_size_id)`.
**RLS:** Strict org-gated; Insert/Update = admin OR designer; Delete = admin only.
**Used By:**
- [listTemplates()](file:///d:/PROYEK%20WEB%20MASTER/remix-of-id-card-forge/src/services/db.ts#L34-L41) (join `card_sizes(*)`)
- [getTemplate()](file:///d:/PROYEK%20WEB%20MASTER/remix-of-id-card-forge/src/services/db.ts#L43-L51) + [saveTemplateDesign()](file:///d:/PROYEK%20WEB%20MASTER/remix-of-id-card-forge/src/services/db.ts#L53-L79)
- [templates.tsx](file:///d:/PROYEK%20WEB%20MASTER/remix-of-id-card-forge/src/routes/_authenticated/templates.tsx) (CRUD grid, duplicate, delete, create)
- [designer.$templateId.tsx](file:///d:/PROYEK%20WEB%20MASTER/remix-of-id-card-forge/src/routes/_authenticated/designer.$templateId.tsx) (loads, saves versions)
- [types.ts DB.CardTemplates](file:///d:/PROYEK%20WEB%20MASTER/remix-of-id-card-forge/src/integrations/supabase/types.ts#L73-L147) (exact field match)

---

## 6. template_versions

**Purpose:** Immutable per-save snapshots. Created on every `saveTemplateDesign()` call.

| Column | Type | Nullable? | Default | Notes |
|--------|------|-----------|---------|-------|
| `id` | uuid | ❌ | gen_random_uuid | PK |
| `template_id` | uuid | ❌ | - | FK → card_templates CASCADE |
| `organization_id` | uuid | ❌ | - | FK → organizations CASCADE |
| `version` | integer | ❌ | - | |
| `snapshot` | jsonb | ❌ | - | `{front_design, back_design}` |
| `created_at` | timestamptz | ❌ | now() | |

**Constraints:** `UNIQUE (template_id, version)`
**Indexes:** `template_versions_org_idx (org_id, created_at DESC)`
**RLS:** FOR ALL — same-org only.
**Used By:**
- [saveTemplateDesign()](file:///d:/PROYEK%20WEB%20MASTER/remix-of-id-card-forge/src/services/db.ts#L72-L78)

---

## 7. template_assets

**Purpose:** Metadata about designer-uploaded images (backgrounds, logos) that live in storage bucket `template-assets`.

| Column | Type | Nullable? | Default | Notes |
|--------|------|-----------|---------|-------|
| `id` | uuid | ❌ | gen_random_uuid | PK |
| `template_id` | uuid | ✅ | NULL | FK → card_templates SET NULL |
| `organization_id` | uuid | ❌ | - | FK → orgs CASCADE |
| `card_size_id` | uuid | ✅ | NULL | FK → card_sizes SET NULL |
| `side` | text | ❌ | `'FRONT'` | `'FRONT'\|'BACK'` — per `TemplateAssetInput.side` |
| `asset_type` | text | ❌ | `'OTHER'` | BACKGROUND/LOGO/IMAGE/PHOTO_PLACEHOLDER/OTHER |
| `name` | text | ✅ | NULL | Display name in BackgroundPanel |
| `storage_path` | text | ❌ | - | `bucket/path` form (signedUrl in storage.ts) |
| `file_name` | text | ✅ | NULL | |
| `mime_type` | text | ✅ | NULL | |
| `width_px` | integer | ✅ | NULL | |
| `height_px` | integer | ✅ | NULL | |
| `size_bytes` | bigint | ✅ | NULL | |
| `orientation` | text | ✅ | NULL | |
| `created_by` | uuid | ✅ | NULL | FK → auth.users SET NULL |
| `created_at` | timestamptz | ❌ | now() | |
| `updated_at` | timestamptz | ❌ | now() | Trigger |

**Indexes:** org, template, asset_type.
**RLS:** Read = org-owned OR (NULL template_id AND BACKGROUND asset — global gallery). Insert org-only. Delete admin/designer only.
**Used By:**
- [TemplateAssetInput & CRUD fns](file:///d:/PROYEK%20WEB%20MASTER/remix-of-id-card-forge/src/services/db.ts#L305-L353)
- [BackgroundPanel in designer](file:///d:/PROYEK%20WEB%20MASTER/remix-of-id-card-forge/src/components/designer/BackgroundPanel.tsx)

---

## 8. id_cards

**Purpose:** Every issued card. This is the core PII table.
**NOTE ON PRIVACY:** `identity_number`, `nik`, `address`, `phone`, `email`, `birth_*`, `membership_number` are **not** returned by `verify_card` RPC. They are only readable by the org that owns the card (RLS).

| Column | Type | Nullable? | Default | Notes |
|--------|------|-----------|---------|-------|
| `id` | uuid | ❌ | gen_random_uuid | PK (internal) |
| `organization_id` | uuid | ❌ | - | FK → orgs CASCADE |
| `card_size_id` | uuid | ✅ | NULL | FK → card_sizes |
| `template_id` | uuid | ✅ | NULL | FK → card_templates |
| `created_by` | uuid | ✅ | NULL | FK → auth.users SET NULL |
| `template_version` | integer | ✅ | NULL | Denormalised version at issue-time |
| `card_number` | text | ❌ | - | Unique per org |
| `qr_token` | text | ❌ | `encode(gen_random_bytes(12),'hex')` | 24-char hex, globally unique |
| `full_name` | text | ❌ | - | Required |
| `identification_number` | text | ✅ | NULL | Generic ID (national etc.) |
| `nik` | text | ✅ | NULL | Indonesia NIK-style |
| `birth_place` | text | ✅ | NULL | |
| `birth_date` | date | ✅ | NULL | |
| `gender` | text | ✅ | NULL | Free text Male/Female/Other (matches UI enum) |
| `address` | text | ✅ | NULL | Textarea (multi-line) |
| `phone` | text | ✅ | NULL | |
| `email` | text | ✅ | NULL | |
| `organization` | text | ✅ | NULL | Org name denormalised onto card (from `getOrganization()`) |
| `department` | text | ✅ | NULL | Listed in id-cards table |
| `position` | text | ✅ | NULL | Listed in id-cards + returned as `job_position` by verify RPC |
| `membership_number` | text | ✅ | NULL | |
| `issue_date` | date | ❌ | `CURRENT_DATE` | |
| `expiry_date` | date | ✅ | NULL | effectiveStatus() uses this on client and RPC |
| `photo_url` | text | ✅ | NULL | Signed URL or storage ref from card-photos bucket |
| `status` | `card_status` enum | ❌ | `'draft'` | draft/active/expired/blocked/cancelled |
| `orientation` | text | ❌ | `'portrait'` | |
| `snapshot` | jsonb | ✅ | NULL | `{front_design,back_design}` frozen at issue time (for PDF reprint) |
| `custom_fields` | jsonb | ❌ | `'{}'` | Catch-all (pre-existing column in types.ts) |
| `created_at` | timestamptz | ❌ | now() | |
| `updated_at` | timestamptz | ❌ | now() | Trigger |

**Constraints/Indexes:**
- Unique: `(organization_id, card_number)`, `qr_token` (global)
- Indexes: org+created-at (primary list order), template_id, size_id, status, full_name, department, composite `(org, lower(full_name), lower(coalesce(department,'')))` for search-pushdown later
- Status values exactly match DB type enum in [types.ts](file:///d:/PROYEK%20WEB%20MASTER/remix-of-id-card-forge/src/integrations/supabase/types.ts#L663-L664) (`draft\|active\|expired\|blocked\|cancelled`)

**RLS:** Org-gated read; Insert/Update = admin OR operator; Delete = admin only.
**Used By:**
- [id-cards.index.tsx list/search/select/batch](file:///d:/PROYEK%20WEB%20MASTER/remix-of-id-card-forge/src/routes/_authenticated/id-cards.index.tsx)
- [id-cards.create.tsx (form + upload)](file:///d:/PROYEK%20WEB%20MASTER/remix-of-id-card-forge/src/routes/_authenticated/id-cards.create.tsx)
- [dashboard.tsx (status count + recent 6)](file:///d:/PROYEK%20WEB%20MASTER/remix-of-id-card-forge/src/routes/_authenticated/dashboard.tsx)
- [db.ts (listCards/getCard/insertCardWithNumber/reissue/updateStatus/bulk create)](file:///d:/PROYEK%20WEB%20MASTER/remix-of-id-card-forge/src/services/db.ts#L81-L299)
- [DB.types.id_cards](file:///d:/PROYEK%20WEB%20MASTER/remix-of-id-card-forge/src/integrations/supabase/types.ts#L148-L268)

---

## 9. print_history

**Purpose:** Audit trail of printing, PDF export, batch sheets, and card status transitions (which are logged via `logPrint(..., print_type='status:<x>')` in `updateCardStatus`).

| Column | Type | Nullable? | Default | Notes |
|--------|------|-----------|---------|-------|
| `id` | uuid | ❌ | gen_random_uuid | PK |
| `organization_id` | uuid | ❌ | - | FK → orgs CASCADE |
| `user_id` | uuid | ✅ | NULL | FK → auth.users SET NULL (who printed / changed status) |
| `card_id` | uuid | ✅ | NULL | FK → id_cards SET NULL (NULL for batch sheets) |
| `print_type` | text | ❌ | `'single_card'` | single_card / batch_sheet / pdf / status:active / status:blocked … |
| `template_version` | integer | ✅ | NULL | |
| `card_size_code` | text | ✅ | NULL | Denormalised for display (print-history table) |
| `paper` | text | ✅ | NULL | E.g. "A4 sheet 10-up" |
| `notes` | text | ✅ | NULL | free text |
| `created_at` | timestamptz | ❌ | now() | |

**Indexes:** `(org_id, created_at DESC)`, `card_id`, `user_id`.
**RLS:** Org read; any org member can append (INSERT); delete = admin only.
**Used By:**
- [db.ts logPrint / listPrintHistory()](file:///d:/PROYEK%20WEB%20MASTER/remix-of-id-card-forge/src/services/db.ts#L140-L161)
- [print-history.tsx table](file:///d:/PROYEK%20WEB%20MASTER/remix-of-id-card-forge/src/routes/_authenticated/print-history.tsx#L20-L77) (joins id_cards(card_number,full_name))

---

## 10. Functions (RPC & helpers)

| Function | Access | Returns | Source |
|----------|--------|---------|--------|
| `current_org_id()` | internal STABLE SECURITY DEFINER | uuid | [009_functions.sql](file:///d:/PROYEK%20WEB%20MASTER/remix-of-id-card-forge/supabase/migrations/20260812214200_009_functions.sql#L4-L14) |
| `has_role(_role, _user_id)` | internal STABLE SECURITY DEFINER | boolean | 009 |
| `next_card_number(_org)` | callable by authenticated | text | 009 (used by db.ts:102) |
| `verify_card(_token)` | callable by anon/public → whitelist in Supabase API | table of 6 columns | 009 (used by verify.$token.tsx:24) |
| `set_updated_at_column()` | trigger function | trigger | 009 |
| `handle_new_user()` | trigger function | trigger | [010_triggers.sql](file:///d:/PROYEK%20WEB%20MASTER/remix-of-id-card-forge/supabase/migrations/20260812214300_010_triggers.sql) |
