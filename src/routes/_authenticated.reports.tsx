import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAcademicReports, getFinancialReports, getAdminReports } from "@/lib/provost.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, LineChart, Line, PieChart, Pie, Cell, Legend, CartesianGrid,
} from "recharts";
import { FEATURE_FLAGS } from "@/lib/feature-flags";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

const NGN = (n: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
const COLORS = ["hsl(210 80% 55%)","hsl(160 70% 45%)","hsl(40 90% 55%)","hsl(280 65% 55%)","hsl(0 75% 55%)"];

function download(name: string, rows: any[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const csv = [cols.join(","), ...rows.map(r => cols.map(c => JSON.stringify(r[c] ?? "")).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `${name}.csv`; a.click();
}

function ReportsPage() {
  const [tab, setTab] = useState("academic");
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl text-primary">Reports</h2>
        <p className="text-sm text-muted-foreground">Executive analytics across academics, finance and administration. Read-only.</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="academic">Academic</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="admin">Administrative</TabsTrigger>
        </TabsList>
        <TabsContent value="academic" className="space-y-4 mt-4"><AcademicTab /></TabsContent>
        <TabsContent value="financial" className="space-y-4 mt-4"><FinancialTab /></TabsContent>
        <TabsContent value="admin" className="space-y-4 mt-4"><AdminTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function AcademicTab() {
  const fn = useServerFn(getAcademicReports);
  const { data, isLoading } = useQuery({ queryKey: ["reports","academic"], queryFn: () => fn(), staleTime: 60_000 });
  if (isLoading || !data) return <Skeleton className="h-64" />;
  return (
    <>
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="Enrolment by department" onExport={() => download("enrolment_by_department", data.enrolmentByDept)}>
          <BarChart data={data.enrolmentByDept}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3}/>
            <XAxis dataKey="name" fontSize={10} interval={0} angle={-30} textAnchor="end" height={80}/>
            <YAxis allowDecimals={false} fontSize={11}/><Tooltip/>
            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4,4,0,0]}/>
          </BarChart>
        </ChartCard>
        <ChartCard title="GPA distribution" onExport={() => download("gpa_distribution", data.gpaDistribution)}>
          <BarChart data={data.gpaDistribution}>
            <XAxis dataKey="name" fontSize={11}/><YAxis allowDecimals={false} fontSize={11}/><Tooltip/>
            <Bar dataKey="count" fill="hsl(160 70% 45%)" radius={[4,4,0,0]}/>
          </BarChart>
        </ChartCard>
        <ChartCard title="Graduation classification" onExport={() => download("graduation_stats", data.graduationStats)}>
          <BarChart data={data.graduationStats}>
            <XAxis dataKey="classification" fontSize={11}/><YAxis allowDecimals={false} fontSize={11}/><Tooltip/>
            <Bar dataKey="count" fill="hsl(280 65% 55%)" radius={[4,4,0,0]}/>
          </BarChart>
        </ChartCard>
        <TableCard title="Top registered courses" onExport={() => download("registration_stats", data.registrationStats)}
          headers={["Code","Title","Registered"]}
          rows={data.registrationStats.map((r) => [r.code, r.title, r.registered])} />
      </div>
      <TableCard title="Pass / Fail per course (top 20)" onExport={() => download("pass_fail", data.passFail)}
        headers={["Code","Title","Total","Pass","Fail","Pass rate"]}
        rows={data.passFail.map((r) => [r.code, r.title, r.total, r.pass, r.fail, r.total ? `${Math.round((r.pass/r.total)*100)}%` : "—"])} />
    </>
  );
}

function FinancialTab() {
  const fn = useServerFn(getFinancialReports);
  const { data, isLoading } = useQuery({ queryKey: ["reports","financial"], queryFn: () => fn(), staleTime: 60_000 });
  if (!FEATURE_FLAGS.fees) return <p className="text-sm text-muted-foreground">Financial reports become available once the fees module is enabled.</p>;
  if (isLoading || !data) return <Skeleton className="h-64" />;
  return (
    <>
      <div className="grid md:grid-cols-3 gap-4">
        <MetricCard label="Total revenue" value={NGN(data.totalRevenue)} />
        <MetricCard label="Outstanding" value={NGN(data.totalOutstanding)} />
        <MetricCard label="Collection rate" value={`${data.collectionRate}%`} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="Revenue trend (last 12 months)" onExport={() => download("revenue_trend", data.trend)}>
          <LineChart data={data.trend}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3}/>
            <XAxis dataKey="month" fontSize={11}/><YAxis fontSize={11}/><Tooltip formatter={(v: any) => NGN(Number(v))}/>
            <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2}/>
          </LineChart>
        </ChartCard>
        <TableCard title="Collection by programme" onExport={() => download("collection_by_programme", data.byProgramme)}
          headers={["Programme","Amount"]}
          rows={data.byProgramme.map((r) => [r.name, NGN(r.amount)])} />
      </div>
    </>
  );
}

function AdminTab() {
  const fn = useServerFn(getAdminReports);
  const { data, isLoading } = useQuery({ queryKey: ["reports","admin"], queryFn: () => fn(), staleTime: 60_000 });
  if (isLoading || !data) return <Skeleton className="h-64" />;
  return (
    <>
      <div className="grid lg:grid-cols-2 gap-4">
        <TableCard title="Staff by role" onExport={() => download("staff_by_role", data.staffByRole)}
          headers={["Role","Count"]} rows={data.staffByRole.map((r) => [r.role.replace("_"," "), r.count])} />
        <TableCard title="Department statistics" onExport={() => download("department_stats", data.departmentStats)}
          headers={["Department","Students","Courses"]}
          rows={data.departmentStats.map((r) => [r.name, r.students, r.courses])} />
        <ChartCard title="Admission funnel" onExport={() => download("admission_funnel", data.admissionFunnel)}>
          <BarChart data={data.admissionFunnel}>
            <XAxis dataKey="status" fontSize={11}/><YAxis allowDecimals={false} fontSize={11}/><Tooltip/>
            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4,4,0,0]}/>
          </BarChart>
        </ChartCard>
        <ChartCard title="Population by level" onExport={() => download("population_by_level", data.populationByLevel)}>
          <BarChart data={data.populationByLevel}>
            <XAxis dataKey="name" fontSize={11}/><YAxis allowDecimals={false} fontSize={11}/><Tooltip/>
            <Bar dataKey="count" fill="hsl(160 70% 45%)" radius={[4,4,0,0]}/>
          </BarChart>
        </ChartCard>
        <ChartCard title="Gender split" onExport={() => download("gender_split", data.genderSplit)}>
          <PieChart>
            <Pie data={data.genderSplit} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80}>
              {data.genderSplit.map((s, i) => <Cell key={s.name} fill={COLORS[i % COLORS.length]}/>)}
            </Pie>
            <Legend wrapperStyle={{ fontSize: 11 }}/><Tooltip/>
          </PieChart>
        </ChartCard>
      </div>
    </>
  );
}

function ChartCard({ title, children, onExport }: { title: string; children: React.ReactElement; onExport: () => void }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="font-serif text-base">{title}</CardTitle>
        <Button variant="ghost" size="sm" onClick={onExport}><Download className="h-4 w-4"/></Button>
      </CardHeader>
      <CardContent className="h-64"><ResponsiveContainer>{children}</ResponsiveContainer></CardContent>
    </Card>
  );
}

function TableCard({ title, headers, rows, onExport }: { title: string; headers: string[]; rows: any[][]; onExport: () => void }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="font-serif text-base">{title}</CardTitle>
        <Button variant="ghost" size="sm" onClick={onExport}><Download className="h-4 w-4"/></Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto max-h-72 overflow-y-auto">
          <Table>
            <TableHeader><TableRow>{headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 ? <TableRow><TableCell colSpan={headers.length} className="text-center text-muted-foreground py-6">No data yet.</TableCell></TableRow>
                : rows.map((r, i) => <TableRow key={i}>{r.map((c, j) => <TableCell key={j}>{c}</TableCell>)}</TableRow>)}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-serif font-bold text-primary">{value}</div>
      </CardContent>
    </Card>
  );
}
