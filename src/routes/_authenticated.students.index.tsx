import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listStudents } from "@/lib/students.functions";
import { useAcademicStructure } from "@/components/portal/AcademicStructure";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Download, ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/students/")({
  component: StudentsPage,
});

const STANDINGS = ["excellent", "good", "probation", "withdrawn"] as const;

function StudentsPage() {
  const list = useServerFn(listStudents);
  const { data: academic } = useAcademicStructure();

  const [search, setSearch] = useState("");
  const [department_id, setDept] = useState<string>("all");
  const [programme_id, setProg] = useState<string>("all");
  const [level_id, setLevel] = useState<string>("all");
  const [session_id, setSession] = useState<string>("all");
  const [standing, setStanding] = useState<string>("all");
  const [active, setActive] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const params = {
    search,
    department_id: department_id !== "all" ? department_id : undefined,
    programme_id: programme_id !== "all" ? programme_id : undefined,
    level_id: level_id !== "all" ? level_id : undefined,
    session_id: session_id !== "all" ? session_id : undefined,
    standing: standing !== "all" ? (standing as (typeof STANDINGS)[number]) : undefined,
    is_active: active === "all" ? undefined : active === "active",
    page,
    pageSize,
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["students", "list", params],
    queryFn: () => list({ data: params }),
    staleTime: 15_000,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const deptMap = new Map((academic?.departments ?? []).map((d: any) => [d.id, d]));
  const progMap = new Map((academic?.programmes ?? []).map((p: any) => [p.id, p]));
  const levelMap = new Map((academic?.levels ?? []).map((l: any) => [l.id, l]));

  const filteredProgs = programme_id === "all"
    ? academic?.programmes ?? []
    : academic?.programmes ?? [];
  const progsForDept = department_id === "all"
    ? academic?.programmes ?? []
    : (academic?.programmes ?? []).filter((p: any) => p.department_id === department_id);

  function exportCsv() {
    const header = ["Matric No", "Full Name", "Email", "Programme", "Department", "Level", "CGPA", "Standing", "Active"];
    const lines = [header.join(",")];
    for (const r of rows) {
      const dept = deptMap.get(r.department_id)?.name ?? "";
      const prog = progMap.get(r.programme_id)?.name ?? "";
      const lvl = levelMap.get(r.current_level_id)?.name ?? "";
      lines.push([r.matric_number, r.full_name ?? "", r.email ?? "", prog, dept, lvl, r.cgpa, r.standing, r.is_active ? "yes" : "no"]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `students-page-${page}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-serif text-2xl text-primary">Students</h2>
          <p className="text-sm text-muted-foreground">Directory of student records, scoped to your role.</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Filters</CardTitle>
          <CardDescription>{total.toLocaleString()} student{total === 1 ? "" : "s"} match.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Matric no, name, email…" className="pl-9"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <FilterSelect label="Department" value={department_id} onChange={(v) => { setDept(v); setProg("all"); setPage(1); }}
              options={[["all","All departments"], ...(academic?.departments ?? []).map((d: any) => [d.id, d.name] as [string, string])]} />
            <FilterSelect label="Programme" value={programme_id} onChange={(v) => { setProg(v); setPage(1); }}
              options={[["all","All programmes"], ...progsForDept.map((p: any) => [p.id, p.name] as [string, string])]} />
            <FilterSelect label="Level" value={level_id} onChange={(v) => { setLevel(v); setPage(1); }}
              options={[["all","All levels"], ...(academic?.levels ?? []).map((l: any) => [l.id, l.name] as [string, string])]} />
            <FilterSelect label="Entry session" value={session_id} onChange={(v) => { setSession(v); setPage(1); }}
              options={[["all","All sessions"], ...(academic?.sessions ?? []).map((s: any) => [s.id, s.name] as [string, string])]} />
            <FilterSelect label="Standing" value={standing} onChange={(v) => { setStanding(v); setPage(1); }}
              options={[["all","Any standing"], ...STANDINGS.map((s) => [s, s] as [string, string])]} />
            <FilterSelect label="Status" value={active} onChange={(v) => { setActive(v); setPage(1); }}
              options={[["all","Any status"],["active","Active"],["inactive","Inactive"]]} />
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matric No</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Programme</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead className="text-right">CGPA</TableHead>
                  <TableHead>Standing</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-8" /></TableCell></TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No students match your filters.</TableCell></TableRow>
                ) : (
                  rows.map((r: any) => (
                    <TableRow key={r.id} className="hover:bg-muted/40">
                      <TableCell className="font-mono text-xs">
                        <Link to="/students/$id" params={{ id: r.id }} className="text-primary hover:underline">{r.matric_number}</Link>
                      </TableCell>
                      <TableCell className="font-medium">{r.full_name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-sm">{progMap.get(r.programme_id)?.name ?? "—"}</TableCell>
                      <TableCell className="text-sm">{deptMap.get(r.department_id)?.name ?? "—"}</TableCell>
                      <TableCell className="text-sm">{levelMap.get(r.current_level_id)?.name ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">{Number(r.cgpa ?? 0).toFixed(2)}</TableCell>
                      <TableCell><StandingBadge value={r.standing} /></TableCell>
                      <TableCell>
                        <Badge variant={r.is_active ? "secondary" : "outline"}>{r.is_active ? "Active" : "Inactive"}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {isFetching ? "Loading…" : `Page ${page} of ${pages}`}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

export function StandingBadge({ value }: { value: string }) {
  const map: Record<string, string> = {
    excellent: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    good: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
    probation: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    withdrawn: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  };
  return <Badge variant="outline" className={map[value] ?? ""}>{value}</Badge>;
}
