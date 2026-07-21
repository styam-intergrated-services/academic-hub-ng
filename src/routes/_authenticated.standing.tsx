import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listProbationStudents, getStandingHistory } from "@/lib/graduation.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/standing")({
  component: StandingPage,
  head: () => ({
    meta: [
      { title: "Academic Standing — AKCOE" },
      { name: "description", content: "Students on probation or withdrawn, with full standing history." },
    ],
  }),
});

function StandingPage() {
  const loadProbation = useServerFn(listProbationStudents);
  const loadHistory = useServerFn(getStandingHistory);
  const q = useQuery({ queryKey: ["standing", "probation"], queryFn: () => loadProbation() });
  const [selected, setSelected] = useState<string>("");
  const hist = useQuery({
    queryKey: ["standing", "history", selected],
    queryFn: () => loadHistory({ data: { student_id: selected } }),
    enabled: !!selected,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl text-primary flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Academic Standing</h2>
        <p className="text-sm text-muted-foreground">Students currently on probation or withdrawn, per the Academic Brief §4.16–4.17.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">Probation & withdrawn students</CardTitle>
            <CardDescription>Click a row to see the standing history.</CardDescription>
          </CardHeader>
          <CardContent>
            {q.isLoading ? <Skeleton className="h-40" /> : (
              <div className="rounded border overflow-x-auto max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Matric</TableHead><TableHead>Name</TableHead><TableHead>Dept</TableHead><TableHead>CGPA</TableHead><TableHead>Standing</TableHead><TableHead></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(q.data ?? []).length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">No students on probation.</TableCell></TableRow>
                    ) : (q.data ?? []).map((s: any) => (
                      <TableRow key={s.id} className={selected === s.id ? "bg-muted" : ""}>
                        <TableCell className="font-mono text-xs">{s.matric_number}</TableCell>
                        <TableCell>{s.profile?.full_name}</TableCell>
                        <TableCell>{s.department?.code}</TableCell>
                        <TableCell>{Number(s.cgpa).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={s.standing === "withdrawn" ? "destructive" : "secondary"} className="capitalize">{s.standing}</Badge>
                        </TableCell>
                        <TableCell><Button size="sm" variant="ghost" onClick={() => setSelected(s.id)}>History</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">Standing history</CardTitle>
            <CardDescription>Every recorded standing decision for the selected student.</CardDescription>
          </CardHeader>
          <CardContent>
            {!selected ? <p className="text-sm text-muted-foreground">Select a student on the left.</p> : hist.isLoading ? <Skeleton className="h-40" /> : (
              <ul className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {(hist.data ?? []).length === 0 ? (
                  <li className="text-sm text-muted-foreground">No history yet.</li>
                ) : (hist.data ?? []).map((h: any) => (
                  <li key={h.id} className="border rounded p-3">
                    <div className="flex items-center justify-between">
                      <Badge variant={h.standing === "withdrawn" ? "destructive" : h.standing === "probation" ? "secondary" : "default"} className="capitalize">{h.standing}</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</span>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {h.semester?.session?.name ? `${h.semester.session.name} · ${h.semester.type}` : "—"} · GPA {Number(h.gpa_at_time ?? 0).toFixed(2)} · CGPA {Number(h.cgpa_at_time ?? 0).toFixed(2)}
                    </div>
                    <div className="mt-1 text-sm">{h.reason}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
