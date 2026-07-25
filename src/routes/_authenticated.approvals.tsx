import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getPendingApprovals, decideApproval } from "@/lib/results.functions";
import { getPortalUser as getPortalUserFn } from "@/lib/portal.functions";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, Rocket, FileText, ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { EmptyState } from "@/components/portal/EmptyState";
import { TableScroll, TableSkeleton } from "@/components/portal/TableSkeleton";
import { GradeBadge, StatusBadge } from "@/components/portal/StatusBadges";


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
      <PageHeader
        title="Result Approvals"
        description="Approve, reject, or publish result batches at your level."
        actions={
          statusFilter ? (
            <Button size="sm" variant="outline" onClick={() => navigate({ search: {} })}>
              Clear filter: <span className="ml-1 capitalize">{statusFilter.replace("_", " ")}</span> ✕
            </Button>
          ) : null
        }
      />

      {isLoading ? (
        <Card><CardContent className="pt-6"><TableSkeleton rows={6} cols={6} /></CardContent></Card>
      ) : groups.length === 0 ? (
        <Card><CardContent className="pt-6">
          <EmptyState
            icon={ClipboardCheck}
            title={statusFilter ? "No matching batches" : "Nothing awaiting your action"}
            description={statusFilter
              ? `No offerings currently sit at "${statusFilter.replace("_", " ")}".`
              : "Result batches will appear here once they reach your approval level."}
          />
        </CardContent></Card>
      ) : groups.map((g: any) => {
        const first = g.results[0];
        const level = levelFor(first.status);
        const canPublish = first.status === "registry_approved" && levels.some((r: string) => ["registry","super_admin","ict_admin"].includes(r));
        return (
          <Card key={g.offering.id} className="overflow-hidden">
            <CardHeader className="grid grid-cols-1 items-start gap-3 border-b bg-muted/30 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <CardTitle className="font-serif text-base sm:text-lg">
                  <span className="font-mono text-primary">{g.offering.course.code}</span> — {g.offering.course.title}
                </CardTitle>
                <CardDescription className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>{g.offering.semester.session?.name}</span>
                  <span>·</span>
                  <span className="capitalize">{g.offering.semester.type}</span>
                  <span>·</span>
                  <span>{g.results.length} students</span>
                  <StatusBadge status={first.status} />
                </CardDescription>
                <ApprovalTrail r={first} />
              </div>
              <div className="flex flex-wrap gap-2">
                {first.status === "published" && (
                  <Link to="/broadsheet/$offeringId" params={{ offeringId: g.offering.id }}>
                    <Button variant="outline" size="sm"><FileText className="mr-2 size-4" />Broadsheet</Button>
                  </Link>
                )}
                {canPublish ? (
                  <Button size="sm" onClick={() => decideMut.mutate({ offering_id: g.offering.id, level: "registry", action: "publish" })} className="bg-primary text-primary-foreground"><Rocket className="mr-2 size-4" />Publish</Button>
                ) : level && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => {
                      const reason = window.prompt("Rejection reason (shown to the lecturer):") ?? undefined;
                      if (reason === undefined) return;
                      decideMut.mutate({ offering_id: g.offering.id, level, action: "reject", reason });
                    }}><X className="mr-2 size-4" />Reject</Button>
                    <Button size="sm" onClick={() => decideMut.mutate({ offering_id: g.offering.id, level, action: "approve" })} className="bg-primary text-primary-foreground"><Check className="mr-2 size-4" />Approve</Button>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <TableScroll>
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead>Matric</TableHead><TableHead>Name</TableHead>
                      <TableHead className="text-right">CA</TableHead>
                      <TableHead className="text-right">Exam</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Grade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.results.map((r: any) => (
                      <TableRow key={r.id} className="even:bg-muted/30">
                        <TableCell className="font-mono text-xs">{r.student.matric_number}</TableCell>
                        <TableCell className="min-w-0">{r.student.profile?.full_name}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.ca_score ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.exam_score ?? "—"}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{r.total_score ?? "—"}</TableCell>
                        <TableCell><GradeBadge grade={r.grade} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableScroll>
            </CardContent>
          </Card>

        );
      })}
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
