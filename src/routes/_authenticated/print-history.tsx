import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listPrintHistory } from "@/services/db";

export const Route = createFileRoute("/_authenticated/print-history")({
  head: () => ({
    meta: [
      { title: "Print history — ID Card Studio" },
      { name: "description", content: "Audit trail of every ID card print, reprint, PDF export and batch sheet." },
      { property: "og:title", content: "Print history — ID Card Studio" },
      { property: "og:description", content: "Audit trail of ID card prints, reprints and PDF exports." },
    ],
  }),
  component: PrintHistory,
});

function PrintHistory() {
  const { data } = useQuery({ queryKey: ["print-history"], queryFn: listPrintHistory });

  return (
    <AppShell title="Print history" description="Every print and export is recorded for auditing.">
      <div className="panel overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Card</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Paper</TableHead>
              <TableHead>Template v.</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {new Date(row.created_at).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {row.print_type.replace(/_/g, " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  {row.id_cards ? (
                    <span>
                      {row.id_cards.full_name}
                      <span className="ml-2 text-xs text-muted-foreground">{row.id_cards.card_number}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Batch</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{row.card_size_code ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{row.paper ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{row.template_version ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{row.notes ?? "—"}</TableCell>
              </TableRow>
            ))}
            {(data ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Nothing printed yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
