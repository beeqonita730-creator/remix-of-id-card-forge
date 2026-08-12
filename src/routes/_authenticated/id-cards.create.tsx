import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Upload, Save, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CardRenderer } from "@/components/card/CardRenderer";
import { supabase } from "@/integrations/supabase/client";
import { getProfile, getOrganization, listTemplates, nextCardNumber, insertCardWithNumber } from "@/services/db";
import { uploadAndSign } from "@/services/storage";
import { emptyDesign, type CardDesign } from "@/lib/card/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/id-cards/create")({
  head: () => ({
    meta: [
      { title: "Create ID card — ID Card Studio" },
      {
        name: "description",
        content: "Pick a template, enter biodata, upload a photo and preview the finished ID card before printing.",
      },
      { property: "og:title", content: "Create ID card — ID Card Studio" },
      { property: "og:description", content: "Issue a new ID card with automatic numbering and QR verification." },
    ],
  }),
  component: CreateCard,
});

const BLANK = {
  full_name: "",
  identification_number: "",
  nik: "",
  birth_place: "",
  birth_date: "",
  gender: "",
  address: "",
  phone: "",
  email: "",
  department: "",
  position: "",
  membership_number: "",
  issue_date: new Date().toISOString().slice(0, 10),
  expiry_date: "",
};

function CreateCard() {
  const navigate = useNavigate();
  const { data: templates } = useQuery({ queryKey: ["templates"], queryFn: listTemplates });
  const { data: org } = useQuery({ queryKey: ["organization"], queryFn: getOrganization });

  const [templateId, setTemplateId] = useState("");
  const [form, setForm] = useState(BLANK);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [cardNumber, setCardNumber] = useState("");
  const [side, setSide] = useState<"front" | "back">("front");
  const [saving, setSaving] = useState(false);

  const template = useMemo(() => (templates ?? []).find((t) => t.id === templateId), [templates, templateId]);
  const size = template?.card_sizes;

  useEffect(() => {
    if (!templateId && templates?.length) setTemplateId(templates[0]!.id);
  }, [templates, templateId]);

  useEffect(() => {
    let alive = true;
    getProfile().then(async (p) => {
      if (!p?.organization_id) return;
      const n = await nextCardNumber(p.organization_id);
      if (alive) setCardNumber(n);
    });
    return () => {
      alive = false;
    };
  }, []);

  const data = {
    ...form,
    organization: org?.name ?? "",
    card_number: cardNumber,
    photo_url: photoUrl,
    status: "active",
    qr_token: "preview",
  };

  const upload = async (file: File) => {
    try {
      const url = await uploadAndSign("card-photos", file);
      setPhotoUrl(url);
      toast.success("Photo uploaded");
    } catch {
      toast.error("Photo upload failed");
    }
  };

  const save = async () => {
    if (!template || !size) {
      toast.error("Choose a template");
      return;
    }
    if (!form.full_name) {
      toast.error("Full name is required");
      return;
    }
    setSaving(true);
    try {
      const profile = await getProfile();
      if (!profile?.organization_id) throw new Error("No workspace");
      const inserted = await insertCardWithNumber(profile.organization_id, {
        created_by: profile.id,
        template_id: template.id,
        template_version: template.version,
        card_size_id: size.id,
        full_name: form.full_name,
        identification_number: form.identification_number || null,
        nik: form.nik || null,
        birth_place: form.birth_place || null,
        birth_date: form.birth_date || null,
        gender: form.gender || null,
        address: form.address || null,
        phone: form.phone || null,
        email: form.email || null,
        organization: org?.name ?? null,
        department: form.department || null,
        position: form.position || null,
        membership_number: form.membership_number || null,
        issue_date: form.issue_date,
        expiry_date: form.expiry_date || null,
        photo_url: photoUrl,
        status: "active",
        snapshot: {
          front_design: template.front_design,
          back_design: template.back_design,
        },
      });
      setCardNumber(inserted.card_number);
      toast.success(`ID card ${inserted.card_number} created`);
      navigate({ to: "/id-cards", search: { highlight: inserted.id } });

    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the card");
    } finally {
      setSaving(false);
    }
  };

  const text = (key: keyof typeof BLANK, label: string, type = "text") => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type={type}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </div>
  );

  const design = (side === "front" ? template?.front_design : template?.back_design) as unknown as
    | CardDesign
    | undefined;

  return (
    <AppShell
      title="Create ID card"
      description="Template → size → biodata → photo → preview → issue."
      actions={
        <Button size="sm" onClick={save} disabled={saving}>
          <Save className="size-4" /> {saving ? "Saving…" : "Issue card"}
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div className="panel p-4">
            <p className="text-sm font-semibold">1 · Template</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Design template</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {(templates ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} (v{t.version})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Card size</Label>
                <Input readOnly value={size ? `${size.name} — ${size.width_mm} × ${size.height_mm} mm` : ""} />
              </div>
              <div className="space-y-1.5">
                <Label>Card number (automatic)</Label>
                <Input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="photo">Photo</Label>
                <Input
                  id="photo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload(f);
                  }}
                />
              </div>
            </div>
          </div>

          <div className="panel p-4">
            <p className="text-sm font-semibold">2 · Person data</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {text("full_name", "Full name")}
              {text("identification_number", "ID number")}
              {text("nik", "National ID / NIK")}
              <div className="space-y-1.5">
                <Label>Gender</Label>
                <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {["Male", "Female", "Other"].map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {text("birth_place", "Birth place")}
              {text("birth_date", "Birth date", "date")}
              {text("phone", "Phone")}
              {text("email", "Email", "email")}
              {text("department", "Department")}
              {text("position", "Position")}
              {text("membership_number", "Membership number")}
              {text("issue_date", "Issue date", "date")}
              {text("expiry_date", "Expiry date", "date")}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  rows={2}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="panel sticky top-4 overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">Live preview</p>
              <div className="flex gap-1">
                {(["front", "back"] as const).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={side === s ? "default" : "ghost"}
                    onClick={() => setSide(s)}
                    className="capitalize"
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
            <div className="canvas-surface flex justify-center p-5">
              {size && design ? (
                <div style={{ boxShadow: "var(--shadow-card)" }}>
                  <CardRenderer
                    design={design ?? emptyDesign()}
                    widthMm={size.width_mm}
                    heightMm={size.height_mm}
                    scale={Math.min(4, 320 / size.width_mm)}
                    data={data}
                  />
                </div>
              ) : (
                <p className="py-10 text-sm text-muted-foreground">Choose a template to preview.</p>
              )}
            </div>
            <div className="flex items-center gap-2 border-t border-border p-3 text-xs text-muted-foreground">
              <Upload className="size-3.5" />
              Photo and data update the card instantly.
              <ArrowRight className="ml-auto size-3.5" />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
