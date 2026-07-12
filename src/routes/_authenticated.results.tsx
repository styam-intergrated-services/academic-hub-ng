import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyResults } from "@/lib/results.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/results")({
  component: MyResults,
});

function MyResults() {
  const fn = useServerFn(getMyResults);
  const { data, isLoading } = useQuery({ queryKey: ["my","results"], queryFn: () => fn() });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl text-primary">My Results</h2>
        <p className="text-sm text-muted-foreground">Only fully-approved, published results are shown here.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="font-serif">Semester GPA history</CardTitle><CardDescription>Persisted per semester</CardDescription></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-24" /> : (data?.gpa?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No GPA records yet.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Session</TableHead><TableHead>Semester</TableHead>
                <TableHead>Units</TableHead><TableHead>Points</TableHead>
                <TableHead>GPA</TableHead><TableHead>CGPA</TableHead><TableHead>Standing</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data?.gpa?.map((g: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell>{g.semester?.session?.name}</TableCell>
                    <TableCell className="capitalize">{g.semester?.type}</TableCell>
                    <TableCell>{g.credit_units}</TableCell>
                    <TableCell>{Number(g.grade_points).toFixed(2)}</TableCell>
                    <TableCell className="font-semibold">{Number(g.gpa).toFixed(2)}</TableCell>
                    <TableCell className="font-semibold text-primary">{Number(g.cgpa).toFixed(2)}</TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize">{g.standing}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-serif">Course results</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-40" /> : (data?.results?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No published results yet.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Session</TableHead><TableHead>Semester</TableHead>
                <TableHead>Code</TableHead><TableHead>Title</TableHead>
                <TableHead>Units</TableHead><TableHead>CA</TableHead><TableHead>Exam</TableHead>
                <TableHead>Total</TableHead><TableHead>Grade</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data?.results?.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.offering?.semester?.session?.name}</TableCell>
                    <TableCell className="capitalize">{r.offering?.semester?.type}</TableCell>
                    <TableCell className="font-mono">{r.offering?.course?.code}</TableCell>
                    <TableCell>{r.offering?.course?.title}</TableCell>
                    <TableCell>{r.offering?.course?.credit_units}</TableCell>
                    <TableCell>{r.ca_score ?? "—"}</TableCell>
                    <TableCell>{r.exam_score ?? "—"}</TableCell>
                    <TableCell>{r.total_score ?? "—"}</TableCell>
                    <TableCell><Badge>{r.grade}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
