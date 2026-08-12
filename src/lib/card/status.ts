export const CARD_STATUSES = ["active", "expired", "blocked", "draft"] as const;
export type CardStatus = (typeof CARD_STATUSES)[number];

export const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  expired: "Expired",
  blocked: "Blocked",
  draft: "Draft",
};

export function statusTone(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active") return "default";
  if (status === "blocked") return "destructive";
  if (status === "expired") return "secondary";
  return "outline";
}

/** Effective status taking the expiry date into account. */
export function effectiveStatus(status: string, expiryDate?: string | null): string {
  if (status === "blocked" || status === "draft") return status;
  if (expiryDate && new Date(expiryDate) < new Date()) return "expired";
  return status;
}
