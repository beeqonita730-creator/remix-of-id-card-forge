import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  Printer,
  Download,
  Ban,
  CheckCircle,
  RotateCcw,
  MoreHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CardPreviewDialog } from "@/components/cards/CardPreviewDialog";
import { BatchSheetDialog } from "@/components/cards/BatchSheetDialog";
import { useRoles } from "@/hooks/useRoles";
import { listCards, getCard, updateCardStatus, reissueCard, logPrint } from "@/services/db";
import { effectiveStatus, STATUS_LABEL, statusTone, CARD_STATUSES, type CardStatus } from "@/lib/card/status";
import { buildCardJob, cardFileName, type CardRow } from "@/lib/card/job";
import { exportCardPdf } from "@/lib/card/pdf";

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

const ALL_STATUSES = "all" as const;
const ALL_TEMPLATES = "all" as const;

type ConfirmAction = {
  type: "block" | "unblock" | "reissue";
  cardId: string;
  cardName: string;
  cardNumber: string;
} | null;

function IdCardsPage() {
  const { highlight } = Route.useSearch();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<CardStatus | typeof ALL_STATUSES>(ALL_STATUSES);
  const [templateFilter, setTemplateFilter] = useState<string | typeof ALL_TEMPLATES>(ALL_TEMPLATES);
  const [selected, setSelected] = useState<string[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [previewCardId, setPreviewCardId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [autoPrint, setAutoPrint] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmAction>(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const { canPrint, canManageCards } = useRoles();

  const { data, isLoading } = useQuery({ queryKey: ["id-cards"], queryFn: listCards });

  const templates = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of data ?? []) {
      const t = c.card_templates as { id: string; name: string } | null;
      if (t?.id && t?.name) map.set(t.id, t.name);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const rows = useMemo(() => {
    let list = data ?? [];
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter((c) =>
        [c.card_number, c.full_name, c.department, c.position]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle)),
      );
    }
    if (statusFilter !== ALL_STATUSES) {
      list = list.filter((c) => effectiveStatus(c.status ?? "draft", c.expiry_date) === statusFilter);
    }
    if (templateFilter !== ALL_TEMPLATES) {
      list = list.filter((c) => (c.card_templates as { id: string } | null)?.id === templateFilter);
    }
    return list;
  }, [data, q, statusFilter, templateFilter]);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allSelected = rows.length > 0 && rows.every((r) => selected.includes(r.id));

  const openPreview = (id: string, auto = false) => {
    setAutoPrint(auto);
    setPreviewCardId(id);
    setPreviewOpen(true);
  };

  const exportOnePdf = async (id: string) => {
    setBusyId(id);
    try {
      const card = (await getCard(id)) as CardRow | null;
      if (!card) throw new Error("Card not found");
      const job = buildCardJob(card);
      await exportCardPdf(job, true, cardFileName(card));
      await logPrint({
        organization_id: String(card["organization_id"]),
        card_id: card.id,
        print_type: "pdf",
        template_version: (card["template_version"] as number) ?? null,
        card_size_code: (card["card_sizes"] as { code?: string } | null)?.code ?? null,
      });
      toast.success("PDF exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusyId(null);
    }
  };

  const runStatusChange = async () => {
    if (!confirm) return;
    const nextStatus = confirm.type === "block" ? "blocked" : "active";
    try {
      await updateCardStatus(confirm.cardId, nextStatus, reason.trim() || undefined);
      toast.success(
        confirm.type === "block" ? `Card ${confirm.cardNumber} blocked` : `Card ${confirm.cardNumber} unblocked`,
      );
      queryClient.invalidateQueries({ queryKey: ["id-cards"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Status update failed");
    } finally {
      setConfirm(null);
      setReason("");
    }
  };

  const runReissue = async () => {
    if (!confirm) return;
    try {
      const newId = await reissueCard(confirm.cardId);
      toast.success(`Reissued ${confirm.cardNumber} as a new card`);
      queryClient.invalidateQueries({ queryKey: ["id-cards"] });
      openPreview(newId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reissue failed");
    } finally {
      setConfirm(null);
      setReason("");
    }
  };

  const clearSelection = () => setSelected([]);

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
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as CardStatus | typeof ALL_STATUSES)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
              {CARD_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={templateFilter} onValueChange={(v) => setTemplateFilter(v)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All templates" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TEMPLATES}>All templates</SelectItem>
              {templates.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="secondary"
            disabled={selected.length === 0}
            onClick={() => setSheetOpen(true)}
          >
            Sheet export{selected.length ? ` (${selected.length})` : ""}
          </Button>
          <Button asChild>
            <Link to="/id-cards/create">New card</Link>
          </Button>
        </>
      }
    >
      {selected.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-accent/40 px-4 py-3">
          <div className="text-sm font-medium">
            {selected.length} selected
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setSheetOpen(true)}>
              <Printer className="size-4" /> Sheet export
            </Button>
            <Button variant="outline" size="sm" onClick={clearSelection}>
              <X className="size-4" /> Clear
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(v) =>
                    setSelected(v === true ? rows.map((r) => r.id) : [])
                  }
                  aria-label="Select all cards"
                />
              </th>
              <th className="px-4 py-3">Card number</th>
              <th className="px-4 py-3">Holder</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Issued</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={8}>
                  Loading cards…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={8}>
                  No cards match the current filters.
                </td>
              </tr>
            ) : (
              rows.map((c) => {
                const status = effectiveStatus(c.status ?? "draft", c.expiry_date);
                const isBusy = busyId === c.id;
                return (
                  <tr
                    key={c.id}
                    className={`border-t ${highlight === c.id ? "bg-accent/40" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selected.includes(c.id)}
                        onCheckedChange={() => toggle(c.id)}
                        aria-label={`Select ${c.card_number}`}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{c.card_number}</td>
                    <td className="px-4 py-3 font-medium">{c.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.department ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.issue_date ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.expiry_date ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusTone(status)}>{STATUS_LABEL[status] ?? status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={isBusy} aria-label={`Actions for ${c.card_number}`}>
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openPreview(c.id)}>
                            <Eye className="size-4" /> Preview
                          </DropdownMenuItem>
                          {canPrint && (
                            <DropdownMenuItem onClick={() => openPreview(c.id, true)}>
                              <Printer className="size-4" /> Print
                            </DropdownMenuItem>
                          )}
                          {canPrint && (
                            <DropdownMenuItem onClick={() => exportOnePdf(c.id)}>
                              <Download className="size-4" /> Export PDF
                            </DropdownMenuItem>
                          )}
                          {canManageCards && (
                            <>
                              <DropdownMenuSeparator />
                              {status === "blocked" ? (
                                <DropdownMenuItem
                                  onClick={() =>
                                    setConfirm({
                                      type: "unblock",
                                      cardId: c.id,
                                      cardName: c.full_name,
                                      cardNumber: c.card_number,
                                    })
                                  }
                                >
                                  <CheckCircle className="size-4" /> Unblock
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() =>
                                    setConfirm({
                                      type: "block",
                                      cardId: c.id,
                                      cardName: c.full_name,
                                      cardNumber: c.card_number,
                                    })
                                  }
                                >
                                  <Ban className="size-4" /> Block
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() =>
                                  setConfirm({
                                    type: "reissue",
                                    cardId: c.id,
                                    cardName: c.full_name,
                                    cardNumber: c.card_number,
                                  })
                                }
                              >
                                <RotateCcw className="size-4" /> Reissue
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <CardPreviewDialog
        cardId={previewCardId}
        open={previewOpen}
        onOpenChange={(v) => {
          setPreviewOpen(v);
          if (!v) setAutoPrint(false);
        }}
        canPrint={canPrint}
        autoPrint={autoPrint}
      />

      <BatchSheetDialog
        cardIds={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        canPrint={canPrint}
      />

      <AlertDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.type === "block" && "Block this card?"}
              {confirm?.type === "unblock" && "Unblock this card?"}
              {confirm?.type === "reissue" && "Reissue this card?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.type === "reissue"
                ? `A new card will be created for ${confirm.cardName} (${confirm.cardNumber}) and the original will be cancelled.`
                : `You are changing the status of ${confirm?.cardName} (${confirm?.cardNumber}).`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {confirm?.type !== "reissue" && (
            <div className="space-y-2 py-2">
              <label htmlFor="reason" className="text-sm font-medium">
                Reason (optional)
              </label>
              <Textarea
                id="reason"
                placeholder="Why are you changing this card status?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReason("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirm?.type === "reissue" ? runReissue : runStatusChange}
              className={confirm?.type === "block" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
            >
              {confirm?.type === "block" && "Block card"}
              {confirm?.type === "unblock" && "Unblock card"}
              {confirm?.type === "reissue" && "Reissue card"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
