import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPendingApprovals, decideApproval, getPortalUser } from "@/lib/results.functions";
import { getPortalUser as getPortalUserFn } from "@/lib/portal.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Check, X, Rocket } from "lucide-react";

export const Route = createFileRoute("/_authenticated/approvals")({
  component: Approvals,
});

function Approvals() {
  const qc = useQueryClient();
  const fn = useServerFn(getPendingApprovals);
  const decide = useServerFn(decideApproval);
  const userFn = useServerFn(getPortalUserFn);
  const { data: user } = useQuery({ queryKey: ["portal","user"], queryFn: () => userFn(), staleTime: 60_000 });
  const { data, isLoading } = useQuery({ queryKey: ["approvals"], queryFn: () => fn() });

  const levels = user?.roles ?? [];
  const decideMut = useMutation({
    mutationFn: (v: any) => decide({ data: v }),
    onSuccess: (_r, v: any) => { toast.success(`${v.action} → ${v.level}`); qc.invalidateQueries({ queryKey: ["approvals"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Action failed"),
  });

  function levelFor(status: string): "hod"|"dean"|"registry"|null {
    if (status === "submitted" && levels.includes("hod")) return "hod";
    if (status === "hod_approved" && levels.includes("dean")) return "dean";
    if (status === "dean_approved" && levels.some((r: string) => ["registry","super_admin","ict_admin"].includes(r))) return "registry";
    if (status === "registry_approved" && levels.some((r: string) => ["registry","super_admin","ict_admin"].includes(r))) return "registry";
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl text-primary">Result Approvals</h2>
        <p className="text-sm text-muted-foreground">Approve, reject, or publish result batches at your level.</p>
      </div>

      {isLoading ? <Skeleton className="h-40" /> : (data?.groups?.length ?? 0) === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Nothing awaiting your action.</CardContent></Card>
      ) : data?.groups?.map((g: any) => {
        const first = g.results[0];
        const level = levelFor(first.status);
        const canPublish = first.status === "registry_approved" && levels.some((r: string) => ["registry","super_admin","ict_admin"].includes(r));
        return (
          <Card key={g.offering.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-serif">{g.offering.course.code} — {g.offering.course.title}</CardTitle>
                <CardDescription>{g.offering.semester.session?.name} · <span className="capitalize">{g.offering.semester.type}</span> · {g.results.length} students · <Badge variant="secondary" className="capitalize ml-1">{first.status.replace("_"," ")}</Badge></CardDescription>
              </div>
              <div className="flex gap-2">
                {canPublish ? (
                  <Button onClick={() => decideMut.mutate({ offering_id: g.offering.id, level: "registry", action: "publish" })} className="bg-primary text-primary-foreground"><Rocket className="h-4 w-4 mr-2" />Publish</Button>
                ) : level && (
                  <>
                    <Button variant="outline" onClick={() => {
                      const reason = window.prompt("Rejection reason (optional):") ?? undefined;
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
    </div>
  );
}
