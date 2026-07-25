import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyResults } from "@/lib/results.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Award, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { EmptyState } from "@/components/portal/EmptyState";
import { TableScroll, TableSkeleton } from "@/components/portal/TableSkeleton";
import { GradeBadge } from "@/components/portal/StatusBadges";

export const Route = createFileRoute("/_authenticated/results")({
  component: MyResults,
});

function MyResults() {
  const fn = useServerFn(getMyResults);
  const { data, isLoading } = useQuery({ queryKey: ["my","results"], queryFn: () => fn() });

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Results"
        description="Only fully-approved, published results are shown here."
      />

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="font-serif">Semester GPA history</CardTitle>
          <CardDescription>Persisted per semester</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><TableSkeleton rows={3} cols={7} /></div>
          ) : (data?.gpa?.length ?? 0) === 0 ? (
            <div className="p-4">
              <EmptyState icon={TrendingUp} title="No GPA records yet" description="Your GPA appears once a semester's results are published." />
            </div>
          ) : (
            <TableScroll>
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Session</TableHead><TableHead>Semester</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead className="text-right">GPA</TableHead>
                    <TableHead className="text-right">CGPA</TableHead>
                    <TableHead>Standing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.gpa?.map((g: any, i: number) => (
                    <TableRow key={i} className="even:bg-muted/30">
                      <TableCell>{g.semester?.session?.name}</TableCell>
                      <TableCell className="capitalize">{g.semester?.type}</TableCell>
                      <TableCell className="text-right tabular-nums">{g.credit_units}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(g.grade_points).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{Number(g.gpa).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-primary">{Number(g.cgpa).toFixed(2)}</TableCell>
                      <TableCell><Badge variant="secondary" className="capitalize">{g.standing}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableScroll>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="font-serif">Course results</CardTitle>
          <CardDescription>Published course-by-course scores</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><TableSkeleton rows={6} cols={9} /></div>
          ) : (data?.results?.length ?? 0) === 0 ? (
            <div className="p-4">
              <EmptyState icon={Award} title="No published results yet" description="Results appear here once Registry publishes them." />
            </div>
          ) : (
            <TableScroll>
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Session</TableHead><TableHead>Semester</TableHead>
                    <TableHead>Code</TableHead><TableHead>Title</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead className="text-right">CA</TableHead>
                    <TableHead className="text-right">Exam</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.results?.map((r: any) => (
                    <TableRow key={r.id} className="even:bg-muted/30">
                      <TableCell>{r.offering?.semester?.session?.name}</TableCell>
                      <TableCell className="capitalize">{r.offering?.semester?.type}</TableCell>
                      <TableCell className="font-mono text-xs">{r.offering?.course?.code}</TableCell>
                      <TableCell className="min-w-0">{r.offering?.course?.title}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.offering?.course?.credit_units}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.ca_score ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.exam_score ?? "—"}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{r.total_score ?? "—"}</TableCell>
                      <TableCell><GradeBadge grade={r.grade} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableScroll>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

