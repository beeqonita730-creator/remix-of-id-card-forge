# RELATIONSHIP MODEL

## 1. Entity-Relationship Diagram (Mermaid)

```mermaid
erDiagram
    auth_users {
        uuid id PK
    }

    organizations {
        uuid id PK
        text name
        text card_prefix
        text address
        text contact
        text logo_url
        timestamptz created_at
        timestamptz updated_at
    }

    profiles {
        uuid id PK "FK auth.users"
        uuid organization_id FK
        text full_name
        text email
        timestamptz created_at
        timestamptz updated_at
    }

    user_roles {
        uuid id PK
        uuid user_id FK "auth.users"
        app_role role
    }

    card_sizes {
        uuid id PK
        uuid organization_id FK "nullable; NULL == global"
        text name
        text code
        numeric width_mm
        numeric height_mm
        text orientation
        text category
        boolean is_system_default
        boolean active
    }

    card_templates {
        uuid id PK
        uuid organization_id FK
        uuid card_size_id FK
        text name
        integer version
        text orientation
        jsonb front_design
        jsonb back_design
        numeric width_mm
        numeric height_mm
        boolean active
        timestamptz created_at
        timestamptz updated_at
    }

    template_versions {
        uuid id PK
        uuid template_id FK
        uuid organization_id FK
        integer version
        jsonb snapshot
        timestamptz created_at
    }

    template_assets {
        uuid id PK
        uuid template_id FK
        uuid organization_id FK
        uuid card_size_id FK
        text asset_type
        text side
        text storage_path
    }

    id_cards {
        uuid id PK
        uuid organization_id FK
        uuid card_size_id FK
        uuid template_id FK
        uuid created_by FK "auth.users"
        integer template_version
        text card_number UK "(org, card_number) UNIQUE"
        text qr_token UK "GLOBALLY UNIQUE"
        text full_name
        card_status status
        date issue_date
        date expiry_date
        text photo_url
        jsonb snapshot
        jsonb custom_fields
        timestamptz created_at
        timestamptz updated_at
    }

    print_history {
        uuid id PK
        uuid organization_id FK
        uuid user_id FK "auth.users"
        uuid card_id FK "nullable for batch"
        text print_type
        text card_size_code
        text paper
        text notes
        timestamptz created_at
    }

    auth_users ||--o| profiles : "1:1 id match"
    auth_users ||--o{ user_roles : "has roles"
    auth_users ||--o{ id_cards : "creates"
    auth_users ||--o{ print_history : "audits"
    auth_users ||--o{ template_assets : "uploads"

    organizations ||--o{ profiles : "contains"
    organizations ||--o{ card_sizes : "owns (NULL org = global)"
    organizations ||--o{ card_templates : "owns"
    organizations ||--o{ template_versions : "owns (denorm)"
    organizations ||--o{ template_assets : "owns"
    organizations ||--o{ id_cards : "owns"
    organizations ||--o{ print_history : "audits"

    card_sizes ||--o{ card_templates : "reference"
    card_sizes ||--o{ id_cards : "reference"
    card_sizes ||--o{ template_assets : "reference"

    card_templates ||--o{ template_versions : "versions"
    card_templates ||--o{ template_assets : "references"
    card_templates ||--o{ id_cards : "issued from"

    id_cards ||--o{ print_history : "referenced (nullable)"
```

## 2. Cardinality Summary

| Parent | → | Child | Rel | Notes |
|--------|---|-------|-----|-------|
| `auth.users` | → | `profiles` | **1:1** | Same primary key value; auto synced trigger |
| `auth.users` | → | `user_roles` | **1:N** | Multiple roles allowed |
| `auth.users` | → | `id_cards.created_by` | **1:N** | SET NULL on user deletion |
| `auth.users` | → | `print_history.user_id` | **1:N** | SET NULL |
| `auth.users` | → | `template_assets.created_by` | **1:N** | SET NULL |
| `organizations` | → | `profiles` | **1:N** | N members per workspace |
| `organizations` | → | `card_sizes` | **1:N (nullable)** | NULL org ⇒ global system size |
| `organizations` | → | `card_templates` | **1:N** | Strict tenant isolation |
| `organizations` | → | `template_versions` | **1:N** | Denormalised tenant key for RLS shortcut |
| `organizations` | → | `template_assets` | **1:N** | |
| `organizations` | → | `id_cards` | **1:N** | |
| `organizations` | → | `print_history` | **1:N** | |
| `card_sizes` | → | `card_templates` | **1:N** | |
| `card_sizes` | → | `id_cards` | **1:N** | |
| `card_sizes` | → | `template_assets` | **1:N** | |
| `card_templates` | → | `template_versions` | **1:N** | Unique(template_id, version) |
| `card_templates` | → | `template_assets` | **1:N (nullable)** | NULL ⇒ shared org background gallery |
| `card_templates` | → | `id_cards` | **1:N** | SET NULL delete, blocks physical delete if UI catches FK |
| `id_cards` | → | `print_history` | **1:N (nullable)** | NULL = batch sheet (multiple cards printed together) |

## 3. Tenant Isolation Edges

Every N-child relation that is not globally shared flows through exactly one `organization_id` predicate applied in:
- `current_org_id()` resolver (STABLE SECURITY DEFINER)
- Each RLS USING / WITH CHECK clause (see `011_rls.sql`)

Global exceptions:
- `card_sizes` rows where `organization_id IS NULL AND is_system_default = TRUE` are readable by every org because the templates/cards picker needs the 5 seeded ISO sizes. Custom sizes remain org-gated.
- `template_assets` rows where `template_id IS NULL AND asset_type='BACKGROUND'` form a shared background gallery (predicate in template_assets RLS). Still limited by organization_id.

## 4. Deletion Behaviour

| FK | `ON DELETE` | Rationale |
|----|-------------|-----------|
| `profiles.id → auth.users` | CASCADE | If user is deleted, wipe their profile row |
| `user_roles.user_id → auth.users` | CASCADE | Same user — drop roles |
| `profiles.organization_id → orgs` | SET NULL | Preserve profile row; UI handles orphan gracefully |
| `card_templates.organization_id → orgs` | CASCADE | Tenant wipe |
| `id_cards.organization_id → orgs` | CASCADE | Tenant wipe |
| `template_versions.organization_id → orgs` | CASCADE | Tenant wipe |
| `template_assets.organization_id → orgs` | CASCADE | Tenant wipe |
| `print_history.organization_id → orgs` | CASCADE | Tenant wipe |
| `id_cards.card_size_id → sizes` | SET NULL | If a size is deleted, existing cards keep working (size code denormalised onto cards/history already) |
| `id_cards.template_id → templates` | SET NULL | UI `templates.tsx:200` already catches the error and warns "Cards were issued from this template, so it can't be deleted."; DB SET NULL provides a safe fallback if delete somehow happens |
| `id_cards.created_by → auth.users` | SET NULL | Retain historical records |
| `print_history.card_id → id_cards` | SET NULL | Retain audit even if card is deleted |
| `print_history.user_id → auth.users` | SET NULL | |
| `template_assets.created_by → auth.users` | SET NULL | |
