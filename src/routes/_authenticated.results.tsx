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

  const totals = data?.totals;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Results"
        description="Only fully-approved, published results are shown here."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Cumulative GPA" value={Number(totals?.cgpa ?? 0).toFixed(2)} isLoading={isLoading} highlight />
        <StatTile label="Total credit units" value={String(totals?.credit_units ?? 0)} isLoading={isLoading} />
        <StatTile label="Total grade points" value={Number(totals?.grade_points ?? 0).toFixed(2)} isLoading={isLoading} />
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="font-serif">Semester GPA history</CardTitle>
          <CardDescription>Computed live from your published results</CardDescription>
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

      <SemesterSection
        title="First Semester"
        type="first"
        blocks={data?.semesters ?? []}
        isLoading={isLoading}
      />
      <SemesterSection
        title="Second Semester"
        type="second"
        blocks={data?.semesters ?? []}
        isLoading={isLoading}
      />
    </div>
  );
}

function SemesterSection({
  title, type, blocks, isLoading,
}: { title: string; type: "first" | "second"; blocks: any[]; isLoading: boolean }) {
  const mine = (blocks ?? []).filter((b: any) => b.semester_type === type);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/30">
        <CardTitle className="font-serif">{title}</CardTitle>
        <CardDescription>Published course-by-course scores, grouped by academic session</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4"><TableSkeleton rows={5} cols={7} /></div>
        ) : mine.length === 0 ? (
          <div className="p-4">
            <EmptyState icon={Award} title={`No published ${type} semester results`} description="Results appear here once Registry publishes them." />
          </div>
        ) : (
          <div className="divide-y">
            {mine.map((b: any) => (
              <div key={b.semester_id}>
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-muted/20">
                  <h3 className="font-serif text-sm font-semibold text-primary">
                    {b.session_name} Academic Session
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="tabular-nums">Units {b.tcu}</Badge>
                    <Badge variant="secondary" className="tabular-nums">GPA {Number(b.gpa).toFixed(2)}</Badge>
                  </div>
                </div>
                <TableScroll>
                  <Table>
                    <TableHeader className="bg-background">
                      <TableRow>
                        <TableHead>Code</TableHead><TableHead>Title</TableHead>
                        <TableHead className="text-right">Units</TableHead>
                        <TableHead className="text-right">CA</TableHead>
                        <TableHead className="text-right">Exam</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Grade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {b.rows?.map((r: any, i: number) => (
                        <TableRow key={`${b.semester_id}-${i}`} className="even:bg-muted/30">
                          <TableCell className="font-mono text-xs">{r.code}</TableCell>
                          <TableCell className="min-w-0">{r.title}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.units}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.ca ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.exam ?? "—"}</TableCell>
                          <TableCell className="text-right font-medium tabular-nums">{r.total ?? "—"}</TableCell>
                          <TableCell><GradeBadge grade={r.grade} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableScroll>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


