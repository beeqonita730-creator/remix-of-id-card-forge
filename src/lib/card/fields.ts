export interface CardData {
  card_number?: string | null;
  full_name?: string | null;
  identification_number?: string | null;
  nik?: string | null;
  birth_place?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  organization?: string | null;
  department?: string | null;
  position?: string | null;
  membership_number?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  status?: string | null;
  qr_token?: string | null;
  photo_url?: string | null;
  custom_fields?: Record<string, string> | null;
}

export const FIELD_GROUPS: { group: string; fields: { key: string; label: string }[] }[] = [
  {
    group: "Person",
    fields: [
      { key: "full_name", label: "Full Name" },
      { key: "id_number", label: "ID Number" },
      { key: "nik", label: "NIK" },
      { key: "birth_place", label: "Birth Place" },
      { key: "birth_date", label: "Birth Date" },
      { key: "birth_info", label: "Birth Place, Date" },
      { key: "gender", label: "Gender" },
      { key: "address", label: "Address" },
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
    ],
  },
  {
    group: "Organization",
    fields: [
      { key: "organization", label: "Organization" },
      { key: "department", label: "Department" },
      { key: "position", label: "Position" },
      { key: "membership_number", label: "Membership No." },
    ],
  },
  {
    group: "Card",
    fields: [
      { key: "card_number", label: "Card Number" },
      { key: "issue_date", label: "Issue Date" },
      { key: "expiry_date", label: "Expiry Date" },
      { key: "status", label: "Status" },
    ],
  },
  {
    group: "System",
    fields: [
      { key: "qr_token", label: "QR Token" },
      { key: "verification_url", label: "Verification URL" },
      { key: "generated_date", label: "Generated Date" },
    ],
  },
];

const fmtDate = (v?: string | null) => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export function buildContext(data: CardData, origin: string): Record<string, string> {
  const token = data.qr_token ?? "";
  const ctx: Record<string, string> = {
    full_name: data.full_name ?? "",
    id_number: data.identification_number ?? "",
    identification_number: data.identification_number ?? "",
    nik: data.nik ?? "",
    birth_place: data.birth_place ?? "",
    birth_date: fmtDate(data.birth_date),
    birth_info: [data.birth_place, fmtDate(data.birth_date)].filter(Boolean).join(", "),
    gender: data.gender ?? "",
    address: data.address ?? "",
    phone: data.phone ?? "",
    email: data.email ?? "",
    organization: data.organization ?? "",
    department: data.department ?? "",
    position: data.position ?? "",
    membership_number: data.membership_number ?? "",
    card_number: data.card_number ?? "",
    issue_date: fmtDate(data.issue_date),
    expiry_date: fmtDate(data.expiry_date),
    status: (data.status ?? "").toUpperCase(),
    qr_token: token,
    verification_url: token ? `${origin}/verify/${token}` : `${origin}/verify/preview`,
    generated_date: fmtDate(new Date().toISOString()),
  };
  for (const [k, v] of Object.entries(data.custom_fields ?? {})) ctx[k] = String(v ?? "");
  return ctx;
}

export function resolveTokens(input: string, ctx: Record<string, string>): string {
  return (input ?? "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => ctx[key] ?? "");
}
