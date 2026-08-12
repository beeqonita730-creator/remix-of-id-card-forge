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
