-- Migration 001: Extensions
-- Installs required PostgreSQL extensions.

CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public;


-- Migration 002: Enumerated Types
-- Enums must match src/integrations/supabase/types.ts exactly.

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'designer', 'operator', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.card_status AS ENUM ('draft', 'active', 'expired', 'blocked', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


-- Migration 003: Organizations

CREATE TABLE IF NOT EXISTS public.organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text,
    card_prefix text NOT NULL DEFAULT 'ORG'::text,
    address text,
    contact text,
    logo_url text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);


-- Migration 004: Profiles and User Roles

CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
    full_name text,
    email text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.app_role NOT NULL,
    UNIQUE (user_id, role)
);
CREATE INDEX IF NOT EXISTS user_roles_user_id_idx ON public.user_roles (user_id);


-- Migration 005: Card Sizes

CREATE TABLE IF NOT EXISTS public.card_sizes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
    name text NOT NULL,
    code text NOT NULL,
    width_mm numeric NOT NULL,
    height_mm numeric NOT NULL,
    orientation text NOT NULL DEFAULT 'portrait'::text,
    category text,
    description text,
    is_system_default boolean NOT NULL DEFAULT false,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT card_sizes_dims_positive CHECK (width_mm > 0 AND height_mm > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS card_sizes_org_code_uniq
    ON public.card_sizes (organization_id, code)
    WHERE organization_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS card_sizes_system_code_uniq
    ON public.card_sizes (code)
    WHERE organization_id IS NULL AND is_system_default = true;

CREATE INDEX IF NOT EXISTS card_sizes_default_idx ON public.card_sizes (is_system_default DESC, width_mm);


-- Migration 006: Card Templates, Versions and Assets

CREATE TABLE IF NOT EXISTS public.card_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    card_size_id uuid REFERENCES public.card_sizes(id) ON DELETE SET NULL,
    name text NOT NULL,
    description text,
    orientation text NOT NULL DEFAULT 'portrait'::text,
    version integer NOT NULL DEFAULT 1,
    front_design jsonb NOT NULL DEFAULT '{}'::jsonb,
    back_design jsonb NOT NULL DEFAULT '{}'::jsonb,
    background_url text,
    thumbnail_url text,
    bleed_mm numeric NOT NULL DEFAULT 0,
    width_mm numeric,
    height_mm numeric,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS card_templates_org_idx ON public.card_templates (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS card_templates_size_idx ON public.card_templates (card_size_id);

CREATE TABLE IF NOT EXISTS public.template_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id uuid NOT NULL REFERENCES public.card_templates(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    version integer NOT NULL,
    snapshot jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (template_id, version)
);
CREATE INDEX IF NOT EXISTS template_versions_org_idx ON public.template_versions (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.template_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id uuid REFERENCES public.card_templates(id) ON DELETE SET NULL,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    card_size_id uuid REFERENCES public.card_sizes(id) ON DELETE SET NULL,
    side text NOT NULL DEFAULT 'FRONT'::text,
    asset_type text NOT NULL DEFAULT 'OTHER'::text,
    name text,
    storage_path text NOT NULL,
    file_name text,
    mime_type text,
    width_px integer,
    height_px integer,
    size_bytes bigint,
    orientation text,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS template_assets_org_idx ON public.template_assets (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS template_assets_template_idx ON public.template_assets (template_id);
CREATE INDEX IF NOT EXISTS template_assets_type_idx ON public.template_assets (asset_type);


-- Migration 007: ID Cards

CREATE TABLE IF NOT EXISTS public.id_cards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    card_size_id uuid REFERENCES public.card_sizes(id) ON DELETE SET NULL,
    template_id uuid REFERENCES public.card_templates(id) ON DELETE SET NULL,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    template_version integer,
    card_number text NOT NULL,
    qr_token text NOT NULL DEFAULT encode(gen_random_bytes(12), 'hex'),
    full_name text NOT NULL,
    identification_number text,
    nik text,
    birth_place text,
    birth_date date,
    gender text,
    address text,
    phone text,
    email text,
    organization text,
    department text,
    position text,
    membership_number text,
    issue_date date NOT NULL DEFAULT CURRENT_DATE,
    expiry_date date,
    photo_url text,
    status public.card_status NOT NULL DEFAULT 'draft'::public.card_status,
    orientation text NOT NULL DEFAULT 'portrait'::text,
    snapshot jsonb,
    custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS id_cards_org_number_uniq
    ON public.id_cards (organization_id, card_number);

CREATE UNIQUE INDEX IF NOT EXISTS id_cards_qr_token_uniq
    ON public.id_cards (qr_token);

CREATE INDEX IF NOT EXISTS id_cards_org_idx ON public.id_cards (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS id_cards_template_idx ON public.id_cards (template_id);
CREATE INDEX IF NOT EXISTS id_cards_size_idx ON public.id_cards (card_size_id);
CREATE INDEX IF NOT EXISTS id_cards_status_idx ON public.id_cards (status);
CREATE INDEX IF NOT EXISTS id_cards_full_name_idx ON public.id_cards (full_name);
CREATE INDEX IF NOT EXISTS id_cards_department_idx ON public.id_cards (department);
CREATE INDEX IF NOT EXISTS id_cards_holder_search_idx
    ON public.id_cards (organization_id, lower(full_name), lower(coalesce(department, '')));


-- Migration 008: Print History / Audit Log

CREATE TABLE IF NOT EXISTS public.print_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    card_id uuid REFERENCES public.id_cards(id) ON DELETE SET NULL,
    print_type text NOT NULL DEFAULT 'single_card'::text,
    template_version integer,
    card_size_code text,
    paper text,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS print_history_org_idx ON public.print_history (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS print_history_card_idx ON public.print_history (card_id);
CREATE INDEX IF NOT EXISTS print_history_user_idx ON public.print_history (user_id);


-- Migration 009: Helper Functions and RPCs
-- Order matters: utility helpers first, then business RPCs.

-- 1. Resolve the current user's organization id.
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT p.organization_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
    LIMIT 1;
$$;

-- 2. Role check helper (used by RLS and hooks).
CREATE OR REPLACE FUNCTION public.has_role(_role public.app_role, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles r
        WHERE r.user_id = _user_id AND r.role = _role
    );
$$;

-- 3. Next card number generator.
-- Pattern: <prefix>-<YYYY>-<NNNNNN>
CREATE OR REPLACE FUNCTION public.next_card_number(_org uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _prefix text := 'ORG';
    _year text := to_char(now(), 'YYYY');
    _n integer;
    _padded text;
BEGIN
    SELECT COALESCE(NULLIF(o.card_prefix, ''), 'ORG')
    INTO _prefix
    FROM public.organizations o
    WHERE o.id = _org;

    IF _prefix IS NULL THEN _prefix := 'ORG'; END IF;

    SELECT COALESCE(
        max(substring(c.card_number from '(' || _year || '-)([0-9]+)$')::integer),
        0
    ) + 1
    INTO _n
    FROM public.id_cards c
    WHERE c.organization_id = _org
      AND c.card_number LIKE (regexp_replace(_prefix, '([^A-Za-z0-9])', '\\\1', 'g') || '-' || _year || '-%');

    _padded := lpad(_n::text, 6, '0');
    RETURN _prefix || '-' || _year || '-' || _padded;
END;
$$;

-- 4. Public card verification RPC.
-- NEVER return sensitive fields (identity_number, nik, address, phone, email, internal ids).
CREATE OR REPLACE FUNCTION public.verify_card(_token text)
RETURNS TABLE (
    card_number text,
    card_state text,
    expiry timestamptz,
    full_name text,
    job_position text,
    org_name text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        c.card_number,
        CASE
            WHEN c.status = 'blocked'::public.card_status THEN 'blocked'
            WHEN c.status = 'cancelled'::public.card_status THEN 'cancelled'
            WHEN c.status = 'draft'::public.card_status THEN 'draft'
            WHEN c.expiry_date IS NOT NULL AND c.expiry_date < CURRENT_DATE THEN 'expired'
            ELSE COALESCE(c.status::text, 'active')
        END AS card_state,
        CASE WHEN c.expiry_date IS NULL THEN NULL::timestamptz
             ELSE (c.expiry_date || ' 23:59:59')::timestamptz
        END AS expiry,
        c.full_name,
        c.position AS job_position,
        COALESCE(c.organization, o.name) AS org_name
    FROM public.id_cards c
    LEFT JOIN public.organizations o ON o.id = c.organization_id
    WHERE c.qr_token = _token
    LIMIT 1;
$$;

-- 5. Trigger to keep updated_at in sync.
CREATE OR REPLACE FUNCTION public.set_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


-- Migration 010: Triggers (updated_at, auth profile sync)

-- 1. Automatic updated_at trigger application
DO $$
DECLARE
    t record;
    tables text[] := ARRAY[
        'organizations', 'profiles', 'card_sizes',
        'card_templates', 'template_assets',
        'id_cards', 'print_history'
    ];
    _tbl text;
BEGIN
    FOREACH _tbl IN ARRAY tables LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = _tbl
              AND column_name = 'updated_at'
        ) THEN
            EXECUTE format(
                'DROP TRIGGER IF EXISTS %I_updated_at_trg ON public.%I;
                 CREATE TRIGGER %I_updated_at_trg
                 BEFORE UPDATE ON public.%I
                 FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_column()',
                _tbl, _tbl, _tbl, _tbl
            );
        END IF;
    END LOOP;
END $$;

-- 2. Profile creation on auth.users insert.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    _org_id uuid;
    _org_name text;
    _full_name text;
    _email text;
BEGIN
    _email := NEW.email;
    _full_name := COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
        NULLIF(NEW.raw_user_meta_data->>'fullName', ''),
        NULLIF(NEW.raw_user_meta_data->>'organization_name', ''),
        _email
    );
    _org_name := COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'organization_name', ''),
        NULLIF(NEW.raw_user_meta_data->>'organization', '')
    );

    IF _org_name IS NOT NULL THEN
        INSERT INTO public.organizations (name) VALUES (_org_name)
        ON CONFLICT DO NOTHING;
        SELECT id INTO _org_id FROM public.organizations WHERE name = _org_name LIMIT 1;
    END IF;

    INSERT INTO public.profiles (id, organization_id, full_name, email)
    VALUES (NEW.id, _org_id, _full_name, _email)
    ON CONFLICT (id) DO UPDATE
      SET organization_id = COALESCE(profiles.organization_id, EXCLUDED.organization_id),
          full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
          email = COALESCE(profiles.email, EXCLUDED.email);

    IF _org_id IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (NEW.id, 'admin')
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- Migration 011: Row Level Security (RLS) Policies
-- All private tables use strict tenant isolation via current_org_id().
-- Anonymous access is only permitted through the verify_card RPC.

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.id_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_history ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper: drop all policies on a table before recreating.
-- ============================================================
DO $$
DECLARE
    tbl record;
    pol record;
BEGIN
    FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
        'organizations','profiles','user_roles','card_sizes','card_templates',
        'template_versions','template_assets','id_cards','print_history'
    ) LOOP
        FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl.tablename LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl.tablename);
        END LOOP;
    END LOOP;
END $$;

-- ---- organizations ----
CREATE POLICY organizations_select ON public.organizations
    FOR SELECT USING (auth.uid() IS NOT NULL AND id = public.current_org_id());

CREATE POLICY organizations_update ON public.organizations
    FOR UPDATE USING (id = public.current_org_id() AND public.has_role('admin'));

-- ---- profiles ----
CREATE POLICY profiles_self_org_access ON public.profiles
    FOR SELECT USING (auth.uid() IS NOT NULL AND (
        id = auth.uid() OR organization_id = public.current_org_id()
    ));

CREATE POLICY profiles_self_insert ON public.profiles
    FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY profiles_self_update ON public.profiles
    FOR UPDATE USING (id = auth.uid())
    WITH CHECK (id = auth.uid() AND organization_id = public.current_org_id());

-- ---- user_roles ----
CREATE POLICY user_roles_org_read ON public.user_roles
    FOR SELECT USING (auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = user_roles.user_id
          AND p.organization_id = public.current_org_id()
    ));

CREATE POLICY user_roles_org_manage ON public.user_roles
    FOR INSERT WITH CHECK (
        public.has_role('admin', auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = user_roles.user_id
              AND p.organization_id = public.current_org_id()
        )
    );

CREATE POLICY user_roles_org_delete ON public.user_roles
    FOR DELETE USING (
        public.has_role('admin', auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = user_roles.user_id
              AND p.organization_id = public.current_org_id()
        )
    );

-- ---- card_sizes (system defaults + org custom) ----
CREATE POLICY card_sizes_read ON public.card_sizes
    FOR SELECT USING (auth.uid() IS NOT NULL AND (
        is_system_default = true OR organization_id = public.current_org_id()
    ));

CREATE POLICY card_sizes_insert ON public.card_sizes
    FOR INSERT WITH CHECK (public.has_role('admin', auth.uid()) AND (
        organization_id = public.current_org_id() OR (organization_id IS NULL AND is_system_default = false)
    ));

CREATE POLICY card_sizes_update ON public.card_sizes
    FOR UPDATE USING (public.has_role('admin', auth.uid()) AND (
        organization_id = public.current_org_id() OR (organization_id IS NULL AND is_system_default = false)
    ));

CREATE POLICY card_sizes_delete ON public.card_sizes
    FOR DELETE USING (public.has_role('admin', auth.uid()) AND (
        organization_id = public.current_org_id()
    ));

-- ---- card_templates ----
CREATE POLICY templates_org_read ON public.card_templates
    FOR SELECT USING (auth.uid() IS NOT NULL AND organization_id = public.current_org_id());

CREATE POLICY templates_org_insert ON public.card_templates
    FOR INSERT WITH CHECK (organization_id = public.current_org_id()
        AND (public.has_role('admin', auth.uid()) OR public.has_role('designer', auth.uid())));

CREATE POLICY templates_org_update ON public.card_templates
    FOR UPDATE USING (organization_id = public.current_org_id()
        AND (public.has_role('admin', auth.uid()) OR public.has_role('designer', auth.uid())));

CREATE POLICY templates_org_delete ON public.card_templates
    FOR DELETE USING (organization_id = public.current_org_id() AND public.has_role('admin', auth.uid()));

-- ---- template_versions ----
CREATE POLICY template_versions_org_access ON public.template_versions
    FOR ALL USING (auth.uid() IS NOT NULL AND organization_id = public.current_org_id());

-- ---- template_assets ----
CREATE POLICY template_assets_org_read ON public.template_assets
    FOR SELECT USING (auth.uid() IS NOT NULL AND (
        organization_id = public.current_org_id() OR (template_id IS NULL AND asset_type = 'BACKGROUND')
    ));

CREATE POLICY template_assets_org_write ON public.template_assets
    FOR INSERT WITH CHECK (
        organization_id = public.current_org_id()
        AND (public.has_role('admin', auth.uid()) OR public.has_role('designer', auth.uid()))
    );

CREATE POLICY template_assets_org_update ON public.template_assets
    FOR UPDATE USING (
        organization_id = public.current_org_id()
        AND (public.has_role('admin', auth.uid()) OR public.has_role('designer', auth.uid()))
    );

CREATE POLICY template_assets_org_delete ON public.template_assets
    FOR DELETE USING (organization_id = public.current_org_id()
        AND (public.has_role('admin', auth.uid()) OR public.has_role('designer', auth.uid())));

-- ---- id_cards ----
CREATE POLICY id_cards_org_read ON public.id_cards
    FOR SELECT USING (auth.uid() IS NOT NULL AND organization_id = public.current_org_id());

CREATE POLICY id_cards_org_insert ON public.id_cards
    FOR INSERT WITH CHECK (organization_id = public.current_org_id()
        AND (public.has_role('admin', auth.uid()) OR public.has_role('operator', auth.uid())));

CREATE POLICY id_cards_org_update ON public.id_cards
    FOR UPDATE USING (organization_id = public.current_org_id()
        AND (public.has_role('admin', auth.uid()) OR public.has_role('operator', auth.uid())));

CREATE POLICY id_cards_org_delete ON public.id_cards
    FOR DELETE USING (organization_id = public.current_org_id() AND public.has_role('admin', auth.uid()));

-- ---- print_history ----
CREATE POLICY print_history_org_read ON public.print_history
    FOR SELECT USING (auth.uid() IS NOT NULL AND organization_id = public.current_org_id());

CREATE POLICY print_history_org_insert ON public.print_history
    FOR INSERT WITH CHECK (organization_id = public.current_org_id());

CREATE POLICY print_history_org_delete ON public.print_history
    FOR DELETE USING (organization_id = public.current_org_id() AND public.has_role('admin', auth.uid()));


-- Migration 012: Storage Buckets and Policies
-- Buckets: card-photos (id card holder photos), template-assets (designer images/artwork)
-- Storage rows live in the private storage schema; policies below control access.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('card-photos', 'card-photos', false, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/jpg'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('template-assets', 'template-assets', false, 20971520, ARRAY['image/jpeg','image/png','image/webp','image/svg+xml','image/jpg'])
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Storage access policies
-- Authenticated users of the org can upload/list/read within
-- their org-scoped prefix: <org_id>/...
-- ============================================================

-- ----- card-photos -----
DROP POLICY IF EXISTS card_photos_select ON storage.objects;
CREATE POLICY card_photos_select ON storage.objects
    FOR SELECT USING (
        bucket_id = 'card-photos'
        AND auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = public.current_org_id()::text
    );

DROP POLICY IF EXISTS card_photos_insert ON storage.objects;
CREATE POLICY card_photos_insert ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'card-photos'
        AND auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = public.current_org_id()::text
    );

DROP POLICY IF EXISTS card_photos_update ON storage.objects;
CREATE POLICY card_photos_update ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'card-photos'
        AND auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = public.current_org_id()::text
    );

DROP POLICY IF EXISTS card_photos_delete ON storage.objects;
CREATE POLICY card_photos_delete ON storage.objects
    FOR DELETE USING (
        bucket_id = 'card-photos'
        AND public.has_role('admin', auth.uid())
        AND (storage.foldername(name))[1] = public.current_org_id()::text
    );

-- ----- template-assets -----
DROP POLICY IF EXISTS template_assets_select ON storage.objects;
CREATE POLICY template_assets_select ON storage.objects
    FOR SELECT USING (
        bucket_id = 'template-assets'
        AND auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = public.current_org_id()::text
    );

DROP POLICY IF EXISTS template_assets_insert ON storage.objects;
CREATE POLICY template_assets_insert ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'template-assets'
        AND auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = public.current_org_id()::text
    );

DROP POLICY IF EXISTS template_assets_update ON storage.objects;
CREATE POLICY template_assets_update ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'template-assets'
        AND auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = public.current_org_id()::text
    );

DROP POLICY IF EXISTS template_assets_delete ON storage.objects;
CREATE POLICY template_assets_delete ON storage.objects
    FOR DELETE USING (
        bucket_id = 'template-assets'
        AND (public.has_role('admin', auth.uid()) OR public.has_role('designer', auth.uid()))
        AND (storage.foldername(name))[1] = public.current_org_id()::text
    );


-- Migration 014: Validation Patches
-- Additive fixes for bugs discovered during schema validation.
-- Safe to apply on existing databases; idempotent where possible.

-- 1. Add missing updated_at column to print_history (trigger was referencing it)
DO $$ BEGIN
  ALTER TABLE public.print_history ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- 2. Re-apply updated_at trigger on print_history to ensure it exists now that column is present
DO $$
DECLARE
    _tbl text := 'print_history';
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = _tbl
          AND column_name = 'updated_at'
    ) THEN
        EXECUTE format(
            'DROP TRIGGER IF EXISTS %I_updated_at_trg ON public.%I;
             CREATE TRIGGER %I_updated_at_trg
             BEFORE UPDATE ON public.%I
             FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_column()',
            _tbl, _tbl, _tbl, _tbl
        );
    END IF;
END $$;

-- 3. RLS: profiles INSERT (recovery path if auth trigger is bypassed)
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies
              WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_self_insert'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
    END LOOP;
END $$;
CREATE POLICY profiles_self_insert ON public.profiles
    FOR INSERT WITH CHECK (id = auth.uid());

-- 4. RLS: user_roles INSERT + DELETE (admin team management)
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies
              WHERE schemaname = 'public' AND tablename = 'user_roles' AND policyname IN ('user_roles_org_manage', 'user_roles_org_delete')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles', pol.policyname);
    END LOOP;
END $$;
CREATE POLICY user_roles_org_manage ON public.user_roles
    FOR INSERT WITH CHECK (
        public.has_role('admin', auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = user_roles.user_id
              AND p.organization_id = public.current_org_id()
        )
    );
CREATE POLICY user_roles_org_delete ON public.user_roles
    FOR DELETE USING (
        public.has_role('admin', auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = user_roles.user_id
              AND p.organization_id = public.current_org_id()
        )
    );

-- 5. RLS: template_assets INSERT role-check + UPDATE policy + background OR parentheses
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies
              WHERE schemaname = 'public' AND tablename = 'template_assets'
                AND policyname IN ('template_assets_org_read', 'template_assets_org_write', 'template_assets_org_update')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.template_assets', pol.policyname);
    END LOOP;
END $$;
CREATE POLICY template_assets_org_read ON public.template_assets
    FOR SELECT USING (auth.uid() IS NOT NULL AND (
        organization_id = public.current_org_id() OR (template_id IS NULL AND asset_type = 'BACKGROUND')
    ));
CREATE POLICY template_assets_org_write ON public.template_assets
    FOR INSERT WITH CHECK (
        organization_id = public.current_org_id()
        AND (public.has_role('admin', auth.uid()) OR public.has_role('designer', auth.uid()))
    );
CREATE POLICY template_assets_org_update ON public.template_assets
    FOR UPDATE USING (
        organization_id = public.current_org_id()
        AND (public.has_role('admin', auth.uid()) OR public.has_role('designer', auth.uid()))
    );
