import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { IdCard, LayoutTemplate, Ruler, Printer, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listCards, listTemplates, listCardSizes, listPrintHistory } from "@/services/db";
import { STATUS_LABEL, statusTone } from "@/lib/card/status";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — ID Card Studio" },
      { name: "description", content: "Overview of issued ID cards, templates, card sizes and print activity." },
      { property: "og:title", content: "Dashboard — ID Card Studio" },
      { property: "og:description", content: "Overview of issued ID cards, templates and print activity." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const cards = useQuery({ queryKey: ["cards"], queryFn: listCards });
  const templates = useQuery({ queryKey: ["templates"], queryFn: listTemplates });
  const sizes = useQuery({ queryKey: ["card-sizes"], queryFn: listCardSizes });
  const prints = useQuery({ queryKey: ["print-history"], queryFn: listPrintHistory });

  const rows = cards.data ?? [];
  const active = rows.filter((c) => c.status === "active").length;
  const expired = rows.filter((c) => c.status === "expired").length;
  const blocked = rows.filter((c) => c.status === "blocked").length;

  const stats = [
    { label: "ID cards", value: rows.length, icon: IdCard, to: "/id-cards" as const },
    { label: "Templates", value: templates.data?.length ?? 0, icon: LayoutTemplate, to: "/templates" as const },
    { label: "Card sizes", value: sizes.data?.length ?? 0, icon: Ruler, to: "/card-sizes" as const },
    { label: "Print jobs", value: prints.data?.length ?? 0, icon: Printer, to: "/print-history" as const },
  ];

  return (
    <AppShell
      title="Dashboard"
      description="Your ID card production at a glance."
      actions={
        <Link to="/id-cards/create">
          <Button size="sm">Create ID card</Button>
        </Link>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} to={s.to} className="panel p-4 transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between">
              <s.icon className="size-4 text-muted-foreground" />
              <ArrowRight className="size-3.5 text-muted-foreground" />
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-tight">{s.value}</p>
            <p className="text-sm text-muted-foreground">{s.label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="panel p-4">
          <p className="text-sm font-semibold">Card status</p>
          <div className="mt-3 space-y-2 text-sm">
            {[
              ["active", active],
              ["expired", expired],
              ["blocked", blocked],
            ].map(([key, value]) => (
              <div key={key as string} className="flex items-center justify-between">
                <Badge variant={statusTone(key as string)}>{STATUS_LABEL[key as string]}</Badge>
                <span className="font-medium">{value as number}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Recent cards</p>
            <Link to="/id-cards" className="text-xs text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </div>
          <div className="mt-3 divide-y divide-border">
            {rows.slice(0, 6).map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.full_name}</p>
                  <p className="text-xs text-muted-foreground">{c.card_number}</p>
                </div>
                <Badge variant={statusTone(c.status)}>{STATUS_LABEL[c.status] ?? c.status}</Badge>
              </div>
            ))}
            {rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No cards yet. Create a template, then issue your first card.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
