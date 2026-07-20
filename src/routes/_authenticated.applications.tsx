import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, GraduationCap, Check, X, Eye } from "lucide-react";
import {
  listApplications, updateApplicationStatus, matriculateApplication,
} from "@/lib/admissions.functions";

export const Route = createFileRoute("/_authenticated/applications")({
  component: ApplicationsPage,
});

function ApplicationsPage() {
  const list = useServerFn(listApplications);
  const upd = useServerFn(updateApplicationStatus);
  const mat = useServerFn(matriculateApplication);
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("all");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["applications", status],
    queryFn: () => list({ data: status === "all" ? {} : { status } }),
  });

  const updMut = useMutation({
    mutationFn: (v: { id: string; status: any }) => upd({ data: v }),
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["applications"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const matMut = useMutation({
    mutationFn: (id: string) => mat({ data: { id } }),
    onSuccess: (r) => { toast.success(`Matriculated as ${r.matric_number}`); qc.invalidateQueries({ queryKey: ["applications"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-serif text-2xl text-primary flex items-center gap-2"><GraduationCap className="h-6 w-6" /> Admissions</h2>
          <p className="text-sm text-muted-foreground">Review applications and matriculate approved candidates.</p>
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="under_review">Under review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="matriculated">Matriculated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle className="font-serif text-lg">Applications</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Loader2 className="animate-spin" /> : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Programme</TableHead>
                    <TableHead>Session</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Matric</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(rows ?? []).map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">{r.full_name}</div>
                        <div className="text-xs text-muted-foreground">{r.email}</div>
                      </TableCell>
                      <TableCell className="text-sm">{r.programme?.code} — {r.programme?.name}</TableCell>
                      <TableCell className="text-sm">{r.session?.name ?? "—"}</TableCell>
                      <TableCell><Badge variant="secondary" className="uppercase text-[10px]">{r.status.replace("_", " ")}</Badge></TableCell>
                      <TableCell className="text-sm font-mono">{r.matric_number ?? "—"}</TableCell>
                      <TableCell className="text-right space-x-1">
                        {r.status !== "matriculated" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => updMut.mutate({ id: r.id, status: "under_review" })}>
                              <Eye className="h-3 w-3 mr-1" />Review
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => updMut.mutate({ id: r.id, status: "approved" })}>
                              <Check className="h-3 w-3 mr-1" />Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => updMut.mutate({ id: r.id, status: "rejected" })}>
                              <X className="h-3 w-3 mr-1" />Reject
                            </Button>
                            {r.status === "approved" && (
                              <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => matMut.mutate(r.id)} disabled={matMut.isPending}>
                                <GraduationCap className="h-3 w-3 mr-1" />Matriculate
                              </Button>
                            )}
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(rows?.length ?? 0) === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No applications.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
