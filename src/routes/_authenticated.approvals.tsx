import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { getPendingApprovals, decideApproval } from "@/lib/results.functions";
import { getPortalUser as getPortalUserFn } from "@/lib/portal.functions";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Check, X, Rocket, History } from "lucide-react";
import { AuditTimelineDialog } from "@/components/portal/AuditTimelineDialog";

const searchSchema = z.object({ status: z.string().optional() });

export const Route = createFileRoute("/_authenticated/approvals")({
  validateSearch: (s: unknown) => searchSchema.parse(s ?? {}),
  component: Approvals,
});

function Approvals() {
  const qc = useQueryClient();
  const fn = useServerFn(getPendingApprovals);
  const decide = useServerFn(decideApproval);
  const userFn = useServerFn(getPortalUserFn);
  const { status: statusFilter } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: user } = useQuery({ queryKey: ["portal","user"], queryFn: () => userFn(), staleTime: 60_000 });
  const { data, isLoading } = useQuery({ queryKey: ["approvals"], queryFn: () => fn() });
  const [audit, setAudit] = useState<{ id: string; label: string } | null>(null);

  const levels = user?.roles ?? [];
  const decideMut = useMutation({
    mutationFn: (v: any) => decide({ data: v }),
    onSuccess: (_r, v: any) => { toast.success(`${v.action} → ${v.level}`); qc.invalidateQueries({ queryKey: ["approvals"] }); qc.invalidateQueries({ queryKey: ["management","stats"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Action failed"),
  });

  function levelFor(status: string): "hod"|"dean"|"registry"|null {
    if (status === "submitted" && levels.includes("hod")) return "hod";
    if (status === "hod_approved" && levels.includes("dean")) return "dean";
    if (status === "dean_approved" && levels.some((r: string) => ["registry","super_admin","ict_admin"].includes(r))) return "registry";
    if (status === "registry_approved" && levels.some((r: string) => ["registry","super_admin","ict_admin"].includes(r))) return "registry";
    return null;
  }

  const allGroups = data?.groups ?? [];
  const groups = statusFilter
    ? allGroups.filter((g: any) => g.results[0]?.status === statusFilter)
    : allGroups;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-serif text-2xl text-primary">Result Approvals</h2>
          <p className="text-sm text-muted-foreground">Approve, reject, or publish result batches at your level.</p>
        </div>
        {statusFilter && (
          <Button size="sm" variant="outline" onClick={() => navigate({ search: {} })}>
            Clear filter: <span className="ml-1 capitalize">{statusFilter.replace("_"," ")}</span> ✕
          </Button>
        )}
      </div>

      {isLoading ? <Skeleton className="h-40" /> : groups.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          {statusFilter ? `No offerings with status "${statusFilter.replace("_"," ")}".` : "Nothing awaiting your action."}
        </CardContent></Card>
      ) : groups.map((g: any) => {
        const first = g.results[0];
        const level = levelFor(first.status);
        const canPublish = first.status === "registry_approved" && levels.some((r: string) => ["registry","super_admin","ict_admin"].includes(r));
        return (
          <Card key={g.offering.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <CardTitle className="font-serif">{g.offering.course.code} — {g.offering.course.title}</CardTitle>
                <CardDescription>
                  {g.offering.semester.session?.name} · <span className="capitalize">{g.offering.semester.type}</span> · {g.results.length} students
                  <Badge variant="secondary" className="capitalize ml-2">{first.status.replace("_"," ")}</Badge>
                </CardDescription>
                <ApprovalTrail r={first} />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="ghost" size="sm" onClick={() => setAudit({ id: g.offering.id, label: `${g.offering.course.code} — ${g.offering.course.title}` })}>
                  <History className="h-4 w-4 mr-2" />Audit trail
                </Button>
                {canPublish ? (
                  <Button onClick={() => decideMut.mutate({ offering_id: g.offering.id, level: "registry", action: "publish" })} className="bg-primary text-primary-foreground"><Rocket className="h-4 w-4 mr-2" />Publish</Button>
                ) : level && (
                  <>
                    <Button variant="outline" onClick={() => {
                      const reason = window.prompt("Rejection reason (shown to the lecturer):") ?? undefined;
                      if (reason === undefined) return;
                      decideMut.mutate({ offering_id: g.offering.id, level, action: "reject", reason });
                    }}><X className="h-4 w-4 mr-2" />Reject</Button>
                    <Button onClick={() => decideMut.mutate({ offering_id: g.offering.id, level, action: "approve" })} className="bg-primary text-primary-foreground"><Check className="h-4 w-4 mr-2" />Approve</Button>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Matric</TableHead><TableHead>Name</TableHead>
                  <TableHead>CA</TableHead><TableHead>Exam</TableHead><TableHead>Total</TableHead><TableHead>Grade</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {g.results.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono">{r.student.matric_number}</TableCell>
                      <TableCell>{r.student.profile?.full_name}</TableCell>
                      <TableCell>{r.ca_score ?? "—"}</TableCell>
                      <TableCell>{r.exam_score ?? "—"}</TableCell>
                      <TableCell>{r.total_score ?? "—"}</TableCell>
                      <TableCell><Badge>{r.grade}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}

      <AuditTimelineDialog
        open={!!audit}
        onOpenChange={(v) => !v && setAudit(null)}
        offeringId={audit?.id ?? null}
        offeringLabel={audit?.label}
      />
    </div>
  );
}

function ApprovalTrail({ r }: { r: any }) {
  const fmt = (ts: string | null) => ts ? new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : null;
  const items: { label: string; at: string | null }[] = [
    { label: "HOD", at: fmt(r.hod_approved_at) },
    { label: "Dean", at: fmt(r.dean_approved_at) },
    { label: "Registry", at: fmt(r.registry_approved_at) },
  ].filter((x) => x.at);
  if (items.length === 0) return null;
  return (
    <div className="mt-1 text-[11px] text-muted-foreground flex flex-wrap gap-x-3">
      {items.map((i) => <span key={i.label}>✓ {i.label} · {i.at}</span>)}
    </div>
  );
}
