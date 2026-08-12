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
