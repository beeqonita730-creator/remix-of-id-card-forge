import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, ShieldX, ShieldAlert, IdCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/verify/$token")({
  head: () => ({
    meta: [
      { title: "Verify ID card — ID Card Studio" },
      { name: "description", content: "Check whether an ID card is genuine, active, expired or blocked." },
      { property: "og:title", content: "Verify ID card — ID Card Studio" },
      { property: "og:description", content: "Scan-to-verify page for ID cards issued with ID Card Studio." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Verify,
});

function Verify() {
  const { token } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["verify", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("verify_card", { _token: token });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const state = data?.card_state;
  const ok = state === "active";
  const Icon = !data ? ShieldX : ok ? ShieldCheck : ShieldAlert;

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-sidebar-foreground">
          <div className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <IdCard className="size-4" />
          </div>
          <span className="text-sm font-bold tracking-tight">ID CARD STUDIO</span>
        </div>

        <div className="panel p-6 text-center">
          {isLoading ? (
            <p className="py-8 text-sm text-muted-foreground">Checking card…</p>
          ) : (
            <>
              <Icon
                className={`mx-auto size-10 ${ok ? "text-primary" : "text-destructive"}`}
                strokeWidth={1.6}
              />
              <h1 className="mt-4 text-lg font-semibold tracking-tight">
                {!data ? "Card not found" : ok ? "Valid card" : `Card ${state}`}
              </h1>
              {data ? (
                <dl className="mt-5 space-y-2 text-left text-sm">
                  {[
                    ["Name", data.full_name],
                    ["Card number", data.card_number],
                    ["Position", data.job_position],
                    ["Organisation", data.org_name],
                    ["Expires", data.expiry ? new Date(data.expiry).toLocaleDateString() : "No expiry"],
                  ].map(([k, v]) => (
                    <div key={k as string} className="flex justify-between gap-4 border-b border-border pb-2">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="text-right font-medium">{(v as string) || "—"}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  This verification code does not match any issued card.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
