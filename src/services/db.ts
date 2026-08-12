import { supabase } from "@/integrations/supabase/client";
import type { CardDesign, CardSize } from "@/lib/card/types";

export async function getProfile() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, organization_id, full_name, email")
    .eq("id", auth.user.id)
    .maybeSingle();
  return data;
}

export async function getOrganization() {
  const { data } = await supabase
    .from("organizations")
    .select("id, name, card_prefix, address, contact, logo_url")
    .limit(1)
    .maybeSingle();
  return data;
}

export async function listCardSizes(): Promise<CardSize[]> {
  const { data, error } = await supabase
    .from("card_sizes")
    .select("*")
    .order("is_system_default", { ascending: false })
    .order("width_mm");
  if (error) throw error;
  return (data ?? []) as unknown as CardSize[];
}

export async function listTemplates() {
  const { data, error } = await supabase
    .from("card_templates")
    .select("*, card_sizes(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getTemplate(id: string) {
  const { data, error } = await supabase
    .from("card_templates")
    .select("*, card_sizes(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveTemplateDesign(
  id: string,
  front: CardDesign,
  back: CardDesign,
  extra: Record<string, unknown> = {},
) {
  const current = await getTemplate(id);
  if (!current) throw new Error("Template not found");
  const nextVersion = (current.version ?? 1) + 1;
  const { error } = await supabase
    .from("card_templates")
    .update({
      front_design: front as never,
      back_design: back as never,
      version: nextVersion,
      ...extra,
    })
    .eq("id", id);
  if (error) throw error;
  await supabase.from("template_versions").insert({
    template_id: id,
    organization_id: current.organization_id,
    version: nextVersion,
    snapshot: { front_design: front, back_design: back } as never,
  });
  return nextVersion;
}

export async function listCards() {
  const { data, error } = await supabase
    .from("id_cards")
    .select("*, card_sizes(*), card_templates(id, name, version)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data ?? [];
}

export async function getCard(id: string) {
  const { data, error } = await supabase
    .from("id_cards")
    .select("*, card_sizes(*), card_templates(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function nextCardNumber(orgId: string): Promise<string> {
  const { data, error } = await supabase.rpc("next_card_number", { _org: orgId });
  if (error) throw error;
  return data as unknown as string;
}

export async function logPrint(input: {
  organization_id: string;
  card_id?: string | null;
  print_type: string;
  template_version?: number | null;
  card_size_code?: string | null;
  paper?: string | null;
  notes?: string | null;
}) {
  const { data: auth } = await supabase.auth.getUser();
  await supabase.from("print_history").insert({ ...input, user_id: auth.user?.id ?? null });
}

export async function listPrintHistory() {
  const { data, error } = await supabase
    .from("print_history")
    .select("*, id_cards(card_number, full_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

/* ------------------------------------------------------------------ */
/* Roles                                                               */
/* ------------------------------------------------------------------ */

export type AppRole = "admin" | "designer" | "operator" | "viewer";

export async function listMyRoles(): Promise<AppRole[]> {
  const { data, error } = await supabase.from("user_roles").select("role");
  if (error) throw error;
  return (data ?? []).map((r) => r.role as AppRole);
}

/* ------------------------------------------------------------------ */
/* Card lifecycle                                                      */
/* ------------------------------------------------------------------ */

export type CardStatusValue = "draft" | "active" | "expired" | "blocked" | "cancelled";

export async function updateCardStatus(cardId: string, status: CardStatusValue, reason?: string) {
  const { data, error } = await supabase
    .from("id_cards")
    .update({ status })
    .eq("id", cardId)
    .select("id, organization_id, card_number, template_version")
    .single();
  if (error) throw error;
  await logPrint({
    organization_id: data.organization_id,
    card_id: data.id,
    print_type: `status:${status}`,
    template_version: data.template_version,
    notes: reason ?? null,
  });
  return data;
}

/** Cancel a card and issue an identical replacement with a fresh number. */
export async function reissueCard(cardId: string) {
  const card = await getCard(cardId);
  if (!card) throw new Error("Card not found");
  const number = await nextCardNumber(card.organization_id);
  const { data: auth } = await supabase.auth.getUser();
  const {
    id: _id,
    created_at: _c,
    updated_at: _u,
    qr_token: _q,
    card_sizes: _s,
    card_templates: _t,
    ...rest
  } = card as Record<string, unknown> as never;
  const payload = {
    ...(rest as Record<string, unknown>),
    card_number: number,
    status: "active",
    issue_date: new Date().toISOString().slice(0, 10),
    created_by: auth.user?.id ?? null,
  };
  const { data: inserted, error } = await supabase
    .from("id_cards")
    .insert(payload as never)
    .select("id")
    .single();
  if (error) throw error;
  await updateCardStatus(cardId, "cancelled", `Reissued as ${number}`);
  return inserted.id as string;
}

export interface BulkCardRow {
  full_name: string;
  identification_number?: string | null;
  nik?: string | null;
  birth_place?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  department?: string | null;
  position?: string | null;
  membership_number?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  photo_url?: string | null;
}

export async function createCardsBulk(
  rows: BulkCardRow[],
  opts: {
    templateId: string;
    templateVersion: number;
    cardSizeId: string | null;
    orientation: "portrait" | "landscape";
    frontDesign: unknown;
    backDesign: unknown;
    status?: CardStatusValue;
  },
  onProgress?: (done: number, total: number) => void,
): Promise<{ created: number; errors: { row: number; message: string }[] }> {
  const profile = await getProfile();
  if (!profile?.organization_id) throw new Error("No workspace found for this account");
  const org = await getOrganization();
  const errors: { row: number; message: string }[] = [];
  let created = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    try {
      const number = await nextCardNumber(profile.organization_id);
      const { error } = await supabase.from("id_cards").insert({
        organization_id: profile.organization_id,
        created_by: profile.id,
        template_id: opts.templateId,
        template_version: opts.templateVersion,
        card_size_id: opts.cardSizeId,
        orientation: opts.orientation,
        card_number: number,
        full_name: r.full_name,
        identification_number: r.identification_number || null,
        nik: r.nik || null,
        birth_place: r.birth_place || null,
        birth_date: r.birth_date || null,
        gender: r.gender || null,
        address: r.address || null,
        phone: r.phone || null,
        email: r.email || null,
        organization: org?.name ?? null,
        department: r.department || null,
        position: r.position || null,
        membership_number: r.membership_number || null,
        issue_date: r.issue_date || new Date().toISOString().slice(0, 10),
        expiry_date: r.expiry_date || null,
        photo_url: r.photo_url || null,
        status: opts.status ?? "active",
        snapshot: { front_design: opts.frontDesign, back_design: opts.backDesign } as never,
      });
      if (error) throw error;
      created++;
    } catch (e) {
      errors.push({ row: i + 1, message: e instanceof Error ? e.message : "Insert failed" });
    }
    onProgress?.(i + 1, rows.length);
  }
  return { created, errors };
}

/* ------------------------------------------------------------------ */
/* Template assets (uploaded backgrounds and artwork)                  */
/* ------------------------------------------------------------------ */

export interface TemplateAssetInput {
  template_id?: string | null;
  side?: "FRONT" | "BACK";
  asset_type?: "BACKGROUND" | "LOGO" | "IMAGE" | "PHOTO_PLACEHOLDER" | "OTHER";
  name?: string | null;
  storage_path: string;
  file_name?: string | null;
  mime_type?: string | null;
  width_px?: number | null;
  height_px?: number | null;
  size_bytes?: number | null;
  orientation?: "portrait" | "landscape" | null;
  card_size_id?: string | null;
}

export async function createTemplateAsset(input: TemplateAssetInput) {
  const profile = await getProfile();
  if (!profile?.organization_id) throw new Error("No organisation found for this account");
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("template_assets")
    .insert({
      ...input,
      organization_id: profile.organization_id,
      created_by: auth.user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listTemplateAssets(templateId?: string) {
  let query = supabase
    .from("template_assets")
    .select("*")
    .eq("asset_type", "BACKGROUND")
    .order("created_at", { ascending: false })
    .limit(100);
  if (templateId) query = query.or(`template_id.eq.${templateId},template_id.is.null`);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function deleteTemplateAsset(id: string) {
  const { error } = await supabase.from("template_assets").delete().eq("id", id);
  if (error) throw error;
}
