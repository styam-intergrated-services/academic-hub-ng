import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { EditResultDialog } from "@/components/portal/EditResultDialog";

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getResultsArchive, getSummaryRecords, type ArchiveRow, type SummaryRow } from "@/lib/results-archive.functions";
import { PageHeader } from "@/components/portal/PageHeader";
import { GradeBadge, StatusBadge } from "@/components/portal/StatusBadges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toCsv, downloadCsv } from "@/lib/csv";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  buildBroadsheetDoc,
  downloadBlob,
  exportPerStudent,
  renderDoc,
  type ResultExportRow,
} from "@/lib/bulk-export";
import { toast } from "sonner";
import { Search, Download, Printer, Layers, Building2, GraduationCap, FileDown, Loader2 } from "lucide-react";


export const Route = createFileRoute("/_authenticated/results-archive")({
  head: () => ({
    meta: [
      { title: "Results Archive — AKCOE Portal" },
      { name: "description", content: "Browse every published result by department, level and course." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResultsArchivePage,
});

const ALL = "all";

function ResultsArchivePage() {
  const fetchArchive = useServerFn(getResultsArchive);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["results", "archive"],
    queryFn: () => fetchArchive(),
    staleTime: 120_000,
  });

  const canEdit = data?.scope === "college";
  const rows = data?.rows ?? [];


  const [session, setSession] = useState(ALL);
  const [dept, setDept] = useState(ALL);
  const [level, setLevel] = useState(ALL);
  const [programme, setProgramme] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [q, setQ] = useState("");

  const options = useMemo(() => {
    const uniq = (list: { id: string; label: string }[]) => {
      const m = new Map<string, string>();
      for (const i of list) if (i.id) m.set(i.id, i.label);
      return Array.from(m, ([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
    };
    return {
      sessions: uniq(rows.map((r) => ({ id: r.session_id, label: r.session_name }))),
      departments: uniq(rows.map((r) => ({ id: r.department_id, label: r.department_name }))),
      levels: uniq(rows.map((r) => ({ id: r.level_id, label: r.level_name }))),
      programmes: uniq(rows.map((r) => ({ id: r.programme_id ?? "", label: r.programme_name ?? "" }))),
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (session !== ALL && r.session_id !== session) return false;
      if (dept !== ALL && r.department_id !== dept) return false;
      if (level !== ALL && r.level_id !== level) return false;
      if (programme !== ALL && r.programme_id !== programme) return false;
      if (status !== ALL && r.status !== status) return false;
      if (!needle) return true;
      return (
        r.matric_number.toLowerCase().includes(needle) ||
        r.student_name.toLowerCase().includes(needle) ||
        r.course_code.toLowerCase().includes(needle) ||
        r.course_title.toLowerCase().includes(needle)
      );
    });
  }, [rows, session, dept, level, programme, status, q]);

  const grouped = useMemo(() => groupRows(filtered), [filtered]);
  const summary = useMemo(() => summarise(filtered), [filtered]);

  function handleCsv() {
    const header = [
      "Department", "Level", "Course code", "Course title", "Credit units",
      "Session", "Semester", "Matric no", "Student", "Programme",
      "CA", "Exam", "Total", "Grade", "Grade point", "Status code", "Status",
    ];
    const body = filtered.map((r) => [
      r.department_name, r.level_name, r.course_code, r.course_title, r.credit_units,
      r.session_name, r.semester_label, r.matric_number, r.student_name, r.programme_name ?? "",
      r.ca_score, r.exam_score, r.total_score, r.grade, r.grade_point, r.status_code, r.status,
    ]);
    downloadCsv(`akcoe-results-archive-${new Date().toISOString().slice(0, 10)}.csv`, toCsv([header, ...body]));
  }

  function handlePrint() {
    printArchive(grouped, summary.total);
  }

  const [exporting, setExporting] = useState<string | null>(null);
  const studentCount = useMemo(
    () => new Set(filtered.map((r) => r.matric_number)).size,
    [filtered],
  );

  const scopeLabel = useMemo(() => {
    const parts = [
      options.departments.find((d) => d.id === dept)?.label,
      options.levels.find((l) => l.id === level)?.label,
      options.sessions.find((s) => s.id === session)?.label,
    ].filter(Boolean);
    return parts.length ? parts.join(" · ") : "All departments, levels and sessions";
  }, [options, dept, level, session]);

  async function runExport(kind: "broadsheet" | "slips", format: "pdf" | "docx") {
    if (!filtered.length) return;
    setExporting(kind === "broadsheet" ? "Building broadsheet…" : "Building slips…");
    try {
      const exportRows = filtered as unknown as ResultExportRow[];
      const stamp = new Date().toISOString().slice(0, 10);
      if (kind === "broadsheet") {
        const blob = await renderDoc(buildBroadsheetDoc(exportRows, scopeLabel), format);
        downloadBlob(blob, `akcoe-broadsheet-${stamp}.${format}`);
        toast.success(`Broadsheet exported (${filtered.length.toLocaleString()} records)`);
      } else {
        const count = await exportPerStudent(exportRows, format, `akcoe-student-results-${format}-${stamp}.zip`);
        toast.success(
          count > 1 ? `${count} student slips exported in a zip` : "Student slip exported",
        );
      }
    } catch (e) {
      toast.error(`Export failed: ${(e as Error).message}`);
    } finally {
      setExporting(null);
    }
  }


  return (
    <div className="space-y-6">
      <PageHeader
        title="Results Archive"
        description={
          data?.scope === "scoped"
            ? "Published and in-progress results within your examination scope, grouped by department, level and course."
            : "Every result record in the college, grouped by department, level and course."
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleCsv} disabled={!filtered.length}>
              <Download className="mr-2 size-4" /> CSV
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={!filtered.length || exporting !== null}>
                  {exporting ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <FileDown className="mr-2 size-4" />
                  )}
                  {exporting ?? "Bulk export"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Combined broadsheet</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => runExport("broadsheet", "pdf")}>
                  Broadsheet — PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => runExport("broadsheet", "docx")}>
                  Broadsheet — Word (.docx)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>
                  Per-student slips ({studentCount.toLocaleString()} student
                  {studentCount === 1 ? "" : "s"}
                  {studentCount > 1 ? ", zipped" : ""})
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => runExport("slips", "pdf")}>
                  Student slips — PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => runExport("slips", "docx")}>
                  Student slips — Word (.docx)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" onClick={handlePrint} disabled={!filtered.length}>
              <Printer className="mr-2 size-4" /> Print
            </Button>
          </>
        }
      />


      {error ? (
        <Card><CardContent className="p-6 text-sm text-destructive">
          {(error as Error).message}
        </CardContent></Card>
      ) : null}

      {/* Summary bento */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Result records" value={summary.total.toLocaleString()} icon={Layers} />
        <Stat label="Departments" value={String(summary.departments)} icon={Building2} />
        <Stat label="Students" value={summary.students.toLocaleString()} icon={GraduationCap} />
        <Stat label="Pass rate" value={summary.total ? `${summary.passRate.toFixed(1)}%` : "—"} icon={Layers} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Matric no, student or course"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Picker value={session} onChange={setSession} items={options.sessions} placeholder="All sessions" />
          <Picker value={dept} onChange={setDept} items={options.departments} placeholder="All departments" />
          <Picker value={level} onChange={setLevel} items={options.levels} placeholder="All levels" />
          <Picker value={programme} onChange={setProgramme} items={options.programmes} placeholder="All programmes" />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {["published", "registry_approved", "dean_approved", "hod_approved", "submitted", "draft"].map((s) => (
                <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : grouped.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">
          No result records match these filters.
        </CardContent></Card>
      ) : (
        <Accordion type="multiple" className="space-y-3">
          {grouped.map((d) => (
            <AccordionItem key={d.id} value={d.id} className="rounded-lg border bg-card px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3 pr-2">
                  <span className="truncate font-serif text-base font-semibold text-primary">{d.name}</span>
                  <Badge variant="secondary" className="shrink-0">{d.count.toLocaleString()} results</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <Accordion type="multiple" className="space-y-2">
                  {d.levels.map((l) => (
                    <AccordionItem key={l.id} value={`${d.id}:${l.id}`} className="rounded-md border bg-muted/30 px-3">
                      <AccordionTrigger className="py-3 text-sm hover:no-underline">
                        <div className="flex min-w-0 flex-1 items-center justify-between gap-3 pr-2">
                          <span className="truncate font-medium">{l.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {l.courses.length} courses · {l.count.toLocaleString()} results
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-4 pb-3">
                        {l.courses.map((c) => (
                          <div key={c.id} className="rounded-md border bg-background">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold">
                                  {c.code} — {c.title}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {c.credit_units} CU · {c.session_name} · {c.semester_label}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2 text-xs">
                                <Badge variant="outline">{c.rows.length} students</Badge>
                                <Badge variant="outline">Pass {c.passRate.toFixed(0)}%</Badge>
                                <Badge variant="outline">Avg {c.avg.toFixed(1)}</Badge>
                              </div>
                            </div>
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Matric no</TableHead>
                                    <TableHead>Student</TableHead>
                                    <TableHead className="text-right">CA</TableHead>
                                    <TableHead className="text-right">Exam</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead>Grade</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="w-10" />
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {c.rows.map((r) => (
                                    <TableRow key={r.id}>
                                      <TableCell className="font-mono text-xs">{r.matric_number}</TableCell>
                                      <TableCell className="max-w-[220px] truncate">{r.student_name}</TableCell>
                                      <TableCell className="text-right">{r.ca_score ?? "—"}</TableCell>
                                      <TableCell className="text-right">{r.exam_score ?? "—"}</TableCell>
                                      <TableCell className="text-right font-medium">{r.total_score ?? "—"}</TableCell>
                                      <TableCell><GradeBadge grade={r.grade} /></TableCell>
                                      <TableCell><StatusBadge status={r.status_code === "OK" ? r.status : r.status_code} /></TableCell>
                                      <TableCell className="text-right">
                                        {canEdit ? <EditResultDialog row={r} onSaved={refetch} /> : null}
                                      </TableCell>
                                    </TableRow>
                                  ))}

                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <SummaryOnlySection />
    </div>
  );
}

function Picker({
  value, onChange, items, placeholder,
}: { value: string; onChange: (v: string) => void; items: { id: string; label: string }[]; placeholder: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {items.map((i) => <SelectItem key={i.id} value={i.id}>{i.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-md bg-primary/10 p-2 text-primary"><Icon className="size-5" /></div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="font-serif text-xl font-bold text-primary">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- grouping + stats ---------- */

type CourseGroup = {
  id: string; code: string; title: string; credit_units: number;
  session_name: string; semester_label: string;
  rows: ArchiveRow[]; passRate: number; avg: number;
};
type LevelGroup = { id: string; name: string; order: number; count: number; courses: CourseGroup[] };
type DeptGroup = { id: string; name: string; count: number; levels: LevelGroup[] };

function groupRows(rows: ArchiveRow[]): DeptGroup[] {
  const depts = new Map<string, DeptGroup>();
  const courseBuckets = new Map<string, CourseGroup>();

  for (const r of rows) {
    const dKey = r.department_id || r.department_name;
    let d = depts.get(dKey);
    if (!d) { d = { id: dKey, name: r.department_name, count: 0, levels: [] }; depts.set(dKey, d); }
    d.count++;

    const lKey = r.level_id || r.level_name;
    let l = d.levels.find((x) => x.id === lKey);
    if (!l) { l = { id: lKey, name: r.level_name, order: r.level_order, count: 0, courses: [] }; d.levels.push(l); }
    l.count++;

    const cKey = `${dKey}|${lKey}|${r.offering_id}`;
    let c = courseBuckets.get(cKey);
    if (!c) {
      c = {
        id: cKey, code: r.course_code, title: r.course_title, credit_units: r.credit_units,
        session_name: r.session_name, semester_label: r.semester_label,
        rows: [], passRate: 0, avg: 0,
      };
      courseBuckets.set(cKey, c);
      l.courses.push(c);
    }
    c.rows.push(r);
  }

  for (const c of courseBuckets.values()) {
    c.rows.sort((a, b) => a.matric_number.localeCompare(b.matric_number));
    const passes = c.rows.filter((r) => (r.grade_point ?? 0) > 0).length;
    c.passRate = c.rows.length ? (passes / c.rows.length) * 100 : 0;
    const scored = c.rows.filter((r) => r.total_score != null);
    c.avg = scored.length ? scored.reduce((s, r) => s + (r.total_score ?? 0), 0) / scored.length : 0;
  }

  const out = Array.from(depts.values());
  for (const d of out) {
    d.levels.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    for (const l of d.levels) l.courses.sort((a, b) => a.code.localeCompare(b.code));
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

function summarise(rows: ArchiveRow[]) {
  const departments = new Set(rows.map((r) => r.department_id)).size;
  const students = new Set(rows.map((r) => r.student_id)).size;
  const passes = rows.filter((r) => (r.grade_point ?? 0) > 0).length;
  return {
    total: rows.length,
    departments,
    students,
    passRate: rows.length ? (passes / rows.length) * 100 : 0,
  };
}

/* ---------- printable sheet ---------- */

function esc(v: unknown) {
  return String(v ?? "—").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}

function printArchive(groups: DeptGroup[], total: number) {
  const win = window.open("", "_blank", "width=1024,height=768");
  if (!win) return;
  const body = groups.map((d) => `
    <h2>${esc(d.name)} <small>(${d.count} results)</small></h2>
    ${d.levels.map((l) => `
      <h3>${esc(l.name)}</h3>
      ${l.courses.map((c) => `
        <div class="course">
          <div class="chead"><strong>${esc(c.code)}</strong> — ${esc(c.title)}
            <span>${esc(c.credit_units)} CU · ${esc(c.session_name)} · ${esc(c.semester_label)}</span></div>
          <table>
            <thead><tr><th>Matric no</th><th>Student</th><th>CA</th><th>Exam</th><th>Total</th><th>Grade</th><th>Status</th></tr></thead>
            <tbody>
              ${c.rows.map((r) => `<tr>
                <td>${esc(r.matric_number)}</td><td>${esc(r.student_name)}</td>
                <td class="n">${esc(r.ca_score)}</td><td class="n">${esc(r.exam_score)}</td>
                <td class="n">${esc(r.total_score)}</td><td>${esc(r.grade)}</td><td>${esc(r.status_code)}</td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>`).join("")}
    `).join("")}
  `).join("");

  win.document.write(`<!doctype html><html><head><meta charset="utf-8">
  <title>AKCOE — Results Archive</title>
  <style>
    body{font-family:Georgia,'Times New Roman',serif;color:#111;margin:24px;}
    h1{font-size:20px;margin:0 0 4px;} .meta{font-size:12px;color:#555;margin-bottom:16px;}
    h2{font-size:15px;margin:22px 0 6px;border-bottom:2px solid #0b1f3a;padding-bottom:3px;}
    h3{font-size:13px;margin:14px 0 4px;color:#444;}
    .course{margin:0 0 12px;page-break-inside:avoid;}
    .chead{font-size:12px;margin-bottom:3px;} .chead span{color:#666;margin-left:6px;font-size:11px;}
    table{border-collapse:collapse;width:100%;font-size:11px;font-family:Arial,Helvetica,sans-serif;}
    th,td{border:1px solid #bbb;padding:3px 5px;text-align:left;} th{background:#f1f3f6;}
    td.n{text-align:right;}
    @media print{ body{margin:10mm;} }
  </style></head><body>
  <h1>Aminu Kano College of Education — Results Archive</h1>
  <div class="meta">${total.toLocaleString()} result records · generated ${new Date().toLocaleString()}</div>
  ${body}
  </body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

/* ---------- graduating cohorts handed over as summary-only records ---------- */

function SummaryOnlySection() {
  const fetchSummaries = useServerFn(getSummaryRecords);
  const { data } = useQuery({
    queryKey: ["results", "summary-records"],
    queryFn: () => fetchSummaries(),
    staleTime: 300_000,
  });

  const rows = (data ?? []).filter((r) => !r.has_course_results && r.cgpa > 0);
  const grouped = useMemo(() => {
    const m = new Map<string, { name: string; rows: SummaryRow[] }>();
    for (const r of rows) {
      const key = r.programme_name || r.department_name;
      const g = m.get(key) ?? { name: key, rows: [] };
      g.rows.push(r);
      m.set(key, g);
    }
    return Array.from(m.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  if (grouped.length === 0) return null;

  function exportCsv() {
    const header = [
      "Programme", "Department", "Matric no", "Student", "Level",
      "Entry year", "Credits earned", "CGPA", "Classification", "Standing",
    ];
    const body = rows.map((r) => [
      r.programme_name ?? "", r.department_name, r.matric_number, r.student_name, r.level_code,
      r.entry_year, r.total_credit_units, r.cgpa, r.classification, r.standing,
    ]);
    downloadCsv(`akcoe-graduating-records-${new Date().toISOString().slice(0, 10)}.csv`, toCsv([header, ...body]));
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="font-serif text-base">Graduating records (summary only)</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Cohorts handed over as graduation lists — final CGPA, credits earned and class of degree are on
            record, but course-by-course score sheets have not been uploaded yet, so these students do not
            appear in the course groupings above.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} className="shrink-0">
          <Download className="mr-2 size-4" /> CSV
        </Button>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="space-y-2">
          {grouped.map((g) => (
            <AccordionItem key={g.name} value={g.name} className="rounded-md border bg-muted/30 px-3">
              <AccordionTrigger className="py-3 text-sm hover:no-underline">
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3 pr-2">
                  <span className="truncate font-medium">{g.name}</span>
                  <Badge variant="secondary" className="shrink-0">{g.rows.length} students</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <div className="overflow-x-auto rounded-md border bg-background">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Matric no</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead className="text-right">Credits</TableHead>
                        <TableHead className="text-right">CGPA</TableHead>
                        <TableHead>Classification</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {g.rows.map((r) => (
                        <TableRow key={r.student_id}>
                          <TableCell className="font-mono text-xs">{r.matric_number}</TableCell>
                          <TableCell className="max-w-[220px] truncate">{r.student_name}</TableCell>
                          <TableCell>{r.level_code}</TableCell>
                          <TableCell className="text-right">{r.total_credit_units}</TableCell>
                          <TableCell className="text-right font-medium">{r.cgpa.toFixed(2)}</TableCell>
                          <TableCell><Badge variant="outline">{r.classification}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
