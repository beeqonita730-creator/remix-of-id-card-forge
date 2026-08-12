import { Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Ruler,
  LayoutTemplate,
  IdCard,
  Plus,
  Printer,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getOrganization } from "@/services/db";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/id-cards", label: "ID Cards", icon: IdCard },
  { to: "/id-cards/create", label: "Create Card", icon: Plus },
  { to: "/templates", label: "Templates", icon: LayoutTemplate },
  { to: "/card-sizes", label: "Card Sizes", icon: Ruler },
  { to: "/print-history", label: "Print History", icon: Printer },
] as const;

export function AppShell({
  title,
  description,
  actions,
  children,
  wide,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const router = useRouter();
  const { data: org } = useQuery({ queryKey: ["organization"], queryFn: getOrganization });

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <IdCard className="size-4" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight">ID CARD STUDIO</p>
            <p className="text-[11px] text-sidebar-foreground/60">{org?.name ?? "Workspace"}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium" }}
              activeOptions={{ exact: item.to === "/id-cards" }}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-2 px-3 pb-4">
          <div className="rounded-md bg-sidebar-accent/60 px-3 py-2 text-[11px] text-sidebar-foreground/70">
            <ShieldCheck className="mb-1 size-3.5" />
            Prefix <span className="font-semibold">{org?.card_prefix ?? "ORG"}</span> · sizes in mm
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.navigate({ to: "/auth" });
            }}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
        <div className="lg:hidden">
          <nav className="flex gap-1 overflow-x-auto border-b border-border bg-card px-3 py-2">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs text-muted-foreground"
                activeProps={{ className: "bg-accent text-accent-foreground font-medium" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <main className={wide ? "flex-1" : "flex-1 p-6"}>
          {wide ? children : <div className="mx-auto max-w-7xl">{children}</div>}
        </main>
      </div>
    </div>
  );
}

export { Button };
