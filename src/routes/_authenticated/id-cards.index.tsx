import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { BatchSheetDialog } from "@/components/cards/BatchSheetDialog";
import { useRoles } from "@/hooks/useRoles";
import { listCards } from "@/services/db";
import { effectiveStatus, STATUS_LABEL, statusTone } from "@/lib/card/status";


export const Route = createFileRoute("/_authenticated/id-cards/")({
  validateSearch: (search: Record<string, unknown>) => {
    const highlight = typeof search["highlight"] === "string" ? search["highlight"] : undefined;
    return highlight ? { highlight } : {};
  },
  component: IdCardsPage,
  head: () => ({
    meta: [
      { title: "ID Cards — ID Card Studio" },
      { name: "description", content: "Browse, search and manage every issued ID card in your organisation." },
      { property: "og:title", content: "ID Cards — ID Card Studio" },
      { property: "og:description", content: "Browse, search and manage every issued ID card in your organisation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function IdCardsPage() {
  const { highlight } = Route.useSearch();
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["id-cards"], queryFn: listCards });

  const rows = useMemo(() => {
    const list = data ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((c) =>
      [c.card_number, c.full_name, c.department, c.position]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle)),
    );
  }, [data, q]);

  return (
    <AppShell
      title="ID Cards"
      description="Every card issued by your organisation."
      actions={
        <>
          <Input
            placeholder="Search name or number…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-56"
          />
          <Button asChild>
            <Link to="/id-cards/create">New card</Link>
          </Button>
        </>
      }
    >
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Card number</th>
              <th className="px-4 py-3">Holder</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Issued</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                  Loading cards…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                  No cards yet.
                </td>
              </tr>
            ) : (
              rows.map((c) => {
                const status = effectiveStatus(c.status ?? "draft", c.expiry_date);
                return (
                  <tr
                    key={c.id}
                    className={`border-t ${highlight === c.id ? "bg-accent/40" : ""}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{c.card_number}</td>
                    <td className="px-4 py-3 font-medium">{c.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.department ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.issue_date ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.expiry_date ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusTone(status)}>{STATUS_LABEL[status] ?? status}</Badge>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
