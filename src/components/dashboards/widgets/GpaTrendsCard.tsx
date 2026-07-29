import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getGpaTrends } from "@/lib/analytics.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toCsv, downloadCsv } from "@/lib/csv";
import { Download, TrendingUp } from "lucide-react";
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const ALL = "all";
const PALETTE = [
  "hsl(210 80% 55%)", "hsl(38 92% 50%)", "hsl(160 70% 40%)", "hsl(280 65% 60%)",
  "hsl(0 72% 55%)", "hsl(200 60% 35%)", "hsl(20 85% 55%)", "hsl(120 40% 45%)",
];

export function GpaTrendsCard() {
  const trendsFn = useServerFn(getGpaTrends);

  const [groupBy, setGroupBy] = useState<"department" | "programme">("department");
  const [metric, setMetric] = useState<"gpa" | "cgpa">("cgpa");
  const [session, setSession] = useState(ALL);
  const [semester, setSemester] = useState(ALL);
  const [level, setLevel] = useState(ALL);
  const [department, setDepartment] = useState(ALL);

  const params = {
    groupBy,
    session_id: session !== ALL ? session : undefined,
    semester_id: semester !== ALL ? semester : undefined,
    level_id: level !== ALL ? level : undefined,
    department_id: department !== ALL ? department : undefined,
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "gpa-trends", params],
    queryFn: () => trendsFn({ data: params }),
    staleTime: 120_000,
  });

  const topSeries = useMemo(() => (data?.series ?? []).slice(0, 8), [data]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.points.map((p, i) => {
      const row: Record<string, string | number | null> = { label: p.label };
      for (const s of topSeries) row[s.name] = s.values[i]?.[metric] ?? null;
      return row;
    });
  }, [data, topSeries, metric]);

  const semesterOptions = (data?.options.semesters ?? []).filter(
    (s) => session === ALL || s.session_id === session,
  );

  function exportCsv() {
    if (!data) return;
    const header = [groupBy === "programme" ? "Programme" : "Department", "Students", ...data.points.map((p) => `${p.label} GPA`), ...data.points.map((p) => `${p.label} CGPA`)];
    const body = data.series.map((s) => [
      s.name, s.students,
      ...s.values.map((v) => v.gpa ?? ""),
      ...s.values.map((v) => v.cgpa ?? ""),
    ]);
    downloadCsv(`akcoe-gpa-trends-${groupBy}.csv`, toCsv([header, ...body]));
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 font-serif">
              <TrendingUp className="size-5 text-primary" /> GPA &amp; CGPA trends
            </CardTitle>
            <CardDescription>
              Published results aggregated per semester, {groupBy === "programme" ? "by programme" : "by department"}.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={metric} onValueChange={(v) => setMetric(v as "gpa" | "cgpa")}>
              <TabsList className="h-9">
                <TabsTrigger value="gpa">GPA</TabsTrigger>
                <TabsTrigger value="cgpa">CGPA</TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as "department" | "programme")}>
              <TabsList className="h-9">
                <TabsTrigger value="department">Departments</TabsTrigger>
                <TabsTrigger value="programme">Programmes</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data?.series.length}>
              <Download className="mr-2 size-4" /> CSV
            </Button>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Picker
            value={session}
            onChange={(v) => { setSession(v); setSemester(ALL); }}
            placeholder="All sessions"
            items={(data?.options.sessions ?? []).map((s) => ({ id: s.id, label: s.name }))}
          />
          <Picker
            value={semester}
            onChange={setSemester}
            placeholder="All semesters"
            items={semesterOptions.map((s) => ({ id: s.id, label: s.label }))}
          />
          <Picker
            value={level}
            onChange={setLevel}
            placeholder="All levels"
            items={(data?.options.levels ?? []).map((l) => ({ id: l.id, label: l.name }))}
          />
          <Picker
            value={department}
            onChange={setDepartment}
            placeholder="All departments"
            items={(data?.options.departments ?? []).map((d) => ({ id: d.id, label: d.name }))}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error ? (
          <p className="text-sm text-destructive">{(error as Error).message}</p>
        ) : isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : !data || data.points.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No published results match these filters yet.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <Mini label="Students" value={data.totals.students.toLocaleString()} />
              <Mini label="Results" value={data.totals.results.toLocaleString()} />
              <Mini label="Mean GPA" value={data.totals.avg_gpa?.toFixed(2) ?? "—"} />
              <Mini label="Mean CGPA" value={data.totals.avg_cgpa?.toFixed(2) ?? "—"} />
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v: number | string) => (typeof v === "number" ? v.toFixed(2) : v)}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {topSeries.map((s, i) => (
                    <Line
                      key={s.id}
                      type="monotone"
                      dataKey={s.name}
                      stroke={PALETTE[i % PALETTE.length]}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{groupBy === "programme" ? "Programme" : "Department"}</TableHead>
                    <TableHead className="text-right">Students</TableHead>
                    <TableHead className="text-right">Mean GPA</TableHead>
                    <TableHead className="text-right">Latest CGPA</TableHead>
                    <TableHead className="text-right">Semesters</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.series.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="max-w-[260px] truncate font-medium">{s.name}</TableCell>
                      <TableCell className="text-right">{s.students}</TableCell>
                      <TableCell className="text-right">{s.avg_gpa?.toFixed(2) ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{s.latest_cgpa?.toFixed(2) ?? "—"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{s.values.filter((v) => v.results > 0).length}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Picker({
  value, onChange, items, placeholder,
}: { value: string; onChange: (v: string) => void; items: { id: string; label: string }[]; placeholder: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {items.map((i) => <SelectItem key={i.id} value={i.id}>{i.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-serif text-lg font-bold text-primary">{value}</div>
    </div>
  );
}
