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
