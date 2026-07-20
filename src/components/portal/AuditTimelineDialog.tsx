import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOfferingAuditTrail } from "@/lib/results.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Send, PenLine, Rocket, Clock } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  offeringId: string | null;
  offeringLabel?: string;
};

const ACTION_ICON: Record<string, any> = {
  created: PenLine,
  updated: PenLine,
  submitted: Send,
  approved: CheckCircle2,
  rejected: XCircle,
  published: Rocket,
};

function fmt(ts: string) {
  return new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function transitionLabel(from: string | null, to: string | null) {
  if (!from && !to) return null;
  const norm = (s: string | null) => (s ?? "—").replace(/_/g, " ");
  return `${norm(from)} → ${norm(to)}`;
}

export function AuditTimelineDialog({ open, onOpenChange, offeringId, offeringLabel }: Props) {
  const fn = useServerFn(getOfferingAuditTrail);
  const { data, isLoading } = useQuery({
    queryKey: ["audit","offering", offeringId],
    queryFn: () => fn({ data: { offering_id: offeringId! } }),
    enabled: !!offeringId && open,
  });

  const items = data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif">Approval audit trail</DialogTitle>
          <DialogDescription>
            {offeringLabel ?? "Every score edit, submission, approval, rejection, and publication for this offering."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? <Skeleton className="h-40" /> : items.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No audit entries yet.</div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            <ol className="relative border-l ml-3 space-y-4">
              {items.map((h: any) => {
                const Icon = ACTION_ICON[h.action] ?? Clock;
                const rejected = h.action === "rejected" || (h.to_status ?? "").includes("rejected");
                const transitions = transitionLabel(h.from_status, h.to_status);
                return (
                  <li key={h.id} className="ml-4">
                    <span className={`absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full ring-4 ring-background ${rejected ? "bg-rose-500 text-white" : "bg-primary text-primary-foreground"}`}>
                      <Icon className="h-3 w-3" />
                    </span>
                    <div className="rounded-md border p-3 bg-card">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium capitalize">{h.action}</span>
                        {transitions && <Badge variant="outline" className="capitalize text-[10px]">{transitions}</Badge>}
                        <span className="ml-auto text-[11px] text-muted-foreground">{fmt(h.changed_at)}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        <span className="font-mono">{h.matric_number}</span> · {h.student_name}
                      </div>
                      <div className="mt-1 text-xs">
                        By <span className="font-medium">{h.actor_name}</span>
                        {(h.ca_score !== null || h.exam_score !== null) && (
                          <> · CA {h.ca_score ?? "—"} · Exam {h.exam_score ?? "—"}</>
                        )}
                      </div>
                      {h.note && <div className="mt-1 text-xs text-rose-600">Note: {h.note}</div>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
