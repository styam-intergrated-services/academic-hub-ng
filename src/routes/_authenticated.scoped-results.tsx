import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyExamScope, getScopedOfferings, getScopedResults } from "@/lib/exams.functions";
import { listAcademicStructure } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/scoped-results")({
  component: ScopedResultsPage,
});

function ScopedResultsPage() {
  const scopeFn = useServerFn(getMyExamScope);
  const offFn = useServerFn(getScopedOfferings);
  const resFn = useServerFn(getScopedResults);
  const structFn = useServerFn(listAcademicStructure);

  const { data: scope } = useQuery({ queryKey: ["my-exam-scope"], queryFn: () => scopeFn() });
  const { data: struct } = useQuery({ queryKey: ["academic-structure"], queryFn: () => structFn(), staleTime: 60_000 });

  const [semesterId, setSemesterId] = useState<string>("");
  const [offeringId, setOfferingId] = useState<string>("");

  const semesters = useMemo(
    () =>
      (struct?.semesters ?? []).map((s: any) => ({
        id: s.id,
        label: `${struct?.sessions.find((x: any) => x.id === s.session_id)?.name ?? ""} — ${s.type}`,
      })),
    [struct]
  );

  const { data: offerings } = useQuery({
    queryKey: ["scoped-offerings", semesterId],
    queryFn: () => offFn({ data: semesterId ? { semester_id: semesterId } : {} }),
  });

  const { data: results, isLoading } = useQuery({
    queryKey: ["scoped-results", semesterId, offeringId],
    queryFn: () => resFn({ data: {
      ...(semesterId ? { semester_id: semesterId } : {}),
      ...(offeringId ? { offering_id: offeringId } : {}),
    } }),
  });

  if (!scope || scope.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">No examination scope</CardTitle>
          <CardDescription>An administrator has not yet assigned a scope to your examination_officer role.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl text-primary">Scoped Results</h2>
        <p className="text-sm text-muted-foreground">
          Read-only view of results for offerings within your assigned examination scope. You cannot edit or approve.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="font-serif text-lg">Filter</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Select value={semesterId} onValueChange={(v) => { setSemesterId(v === "__all__" ? "" : v); setOfferingId(""); }}>
            <SelectTrigger><SelectValue placeholder="All semesters" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All semesters</SelectItem>
              {semesters.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={offeringId} onValueChange={(v) => setOfferingId(v === "__all__" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="All offerings in scope" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All offerings in scope</SelectItem>
              {(offerings ?? []).map((o: any) => (
                <SelectItem key={o.id} value={o.id}>{o.course?.code} — {o.course?.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Offerings in scope</CardTitle>
          <CardDescription>Open a broadsheet for any offering in your scope.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Semester</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Broadsheet</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(offerings ?? []).length === 0
                  ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No offerings in scope for this filter.</TableCell></TableRow>
                  : (offerings ?? []).map((o: any) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{o.course?.code} — {o.course?.title}</TableCell>
                      <TableCell>{o.semester?.session?.name} · {o.semester?.type}</TableCell>
                      <TableCell>{o.course?.department?.name ?? "—"}</TableCell>
                      <TableCell>
                        <Button asChild size="sm" variant="outline">
                          <Link to="/broadsheet/$offeringId" params={{ offeringId: o.id }}>
                            <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Results</CardTitle>
          <CardDescription>
            {isLoading ? "Loading…" : `${(results ?? []).length} record(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-40" /> : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>CA</TableHead>
                  <TableHead>Exam</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(results ?? []).length === 0
                    ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No results.</TableCell></TableRow>
                    : (results ?? []).map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.offering?.course?.code}</TableCell>
                        <TableCell>{r.student?.matric_number} — {r.student?.profile?.full_name}</TableCell>
                        <TableCell>{r.ca_score ?? "—"}</TableCell>
                        <TableCell>{r.exam_score ?? "—"}</TableCell>
                        <TableCell>{r.total_score ?? "—"}</TableCell>
                        <TableCell><Badge variant="secondary">{r.grade ?? "—"}</Badge></TableCell>
                        <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
