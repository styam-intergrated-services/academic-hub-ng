import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAcademicStructure } from "@/lib/admin.functions";
import { getExportRows, listApprovedOfferings, getBroadsheetData } from "@/lib/results.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileSpreadsheet, FileText, FileType2, Printer, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { EXPORT_COLUMNS, type ExportRow, exportRowsToCsv, exportRowsToPdf, exportRowsToXlsx, generateBroadsheetPdf } from "@/lib/exports";

export const Route = createFileRoute("/_authenticated/exports")({
  component: ExportsPage,
});

function ExportsPage() {
  const structFn = useServerFn(listAcademicStructure);
  const rowsFn = useServerFn(getExportRows);
  const offersFn = useServerFn(listApprovedOfferings);
  const broadFn = useServerFn(getBroadsheetData);

  const { data: struct } = useQuery({ queryKey: ["academic-structure"], queryFn: () => structFn(), staleTime: 60_000 });

  const [semesterId, setSemesterId] = useState<string | "all">("all");
  const [departmentId, setDepartmentId] = useState<string | "all">("all");
  const [programmeId, setProgrammeId] = useState<string | "all">("all");
  const [offeringId, setOfferingId] = useState<string | "all">("all");
  const [includeApproved, setIncludeApproved] = useState(false);

  const filterKey = { semesterId, departmentId, programmeId, offeringId, includeApproved };
  const rowsQuery = useQuery({
    queryKey: ["exports","rows", filterKey],
    queryFn: () => rowsFn({ data: {
      semester_id: semesterId === "all" ? null : semesterId,
      department_id: departmentId === "all" ? null : departmentId,
      programme_id: programmeId === "all" ? null : programmeId,
      offering_id: offeringId === "all" ? null : offeringId,
      include_approved: includeApproved,
    } }),
  });

  const offersQuery = useQuery({
    queryKey: ["exports","offerings", semesterId, departmentId],
    queryFn: () => offersFn({ data: {
      semester_id: semesterId === "all" ? null : semesterId,
      department_id: departmentId === "all" ? null : departmentId,
    } }),
  });

  const rows: ExportRow[] = rowsQuery.data ?? [];

  const programmesForDept = useMemo(() => {
    const all = struct?.programmes ?? [];
    return departmentId === "all" ? all : all.filter((p) => p.department_id === departmentId);
  }, [struct, departmentId]);

  const sessName = (semId: string) => {
    if (semId === "all") return undefined;
    const sem = struct?.semesters.find((s) => s.id === semId);
    if (!sem) return undefined;
    const sess = struct?.sessions.find((s) => s.id === sem.session_id);
    return sess ? `${sess.name} · ${sem.type}` : sem.type;
  };

  function fileBase() {
    const parts = ["results"];
    if (semesterId !== "all") parts.push((sessName(semesterId) ?? "").replace(/[^a-z0-9-]/gi, "_"));
    if (departmentId !== "all") parts.push(struct?.departments.find((d) => d.id === departmentId)?.code ?? "");
    if (programmeId !== "all") parts.push(struct?.programmes.find((p) => p.id === programmeId)?.code ?? "");
    if (offeringId !== "all") {
      const o = offersQuery.data?.find((r: any) => r.offering.id === offeringId);
      if (o) parts.push(o.offering.course.code);
    }
    return parts.filter(Boolean).join("_").toLowerCase();
  }

  function activeSubtitle() {
    const bits: string[] = [];
    if (semesterId !== "all") bits.push(sessName(semesterId) ?? "");
    if (departmentId !== "all") bits.push(`Dept: ${struct?.departments.find((d) => d.id === departmentId)?.name}`);
    if (programmeId !== "all") bits.push(`Programme: ${struct?.programmes.find((p) => p.id === programmeId)?.name}`);
    if (offeringId !== "all") {
      const o = offersQuery.data?.find((r: any) => r.offering.id === offeringId);
      if (o) bits.push(`Course: ${o.offering.course.code} — ${o.offering.course.title}`);
    }
    bits.push(includeApproved ? "Approved + Published" : "Published only");
    return bits.filter(Boolean).join("   ·   ");
  }

  function doExport(kind: "csv" | "xlsx" | "pdf") {
    if (rows.length === 0) { toast.error("No rows to export with the current filters."); return; }
    const base = fileBase();
    if (kind === "csv") exportRowsToCsv(rows, `${base}.csv`);
    else if (kind === "xlsx") exportRowsToXlsx(rows, `${base}.xlsx`);
    else exportRowsToPdf(rows, { filename: `${base}.pdf`, title: "AKCOE — Results Export", subtitle: activeSubtitle() });
    toast.success(`Exported ${rows.length} row${rows.length === 1 ? "" : "s"} as ${kind.toUpperCase()}`);
  }

  async function doBroadsheet() {
    if (offeringId === "all") { toast.error("Select a single course offering to build its broadsheet."); return; }
    try {
      const data = await broadFn({ data: { offering_id: offeringId } });
      const code = (data as any).offering?.course?.code ?? "offering";
      generateBroadsheetPdf(data as any, `broadsheet_${code}.pdf`);
      toast.success("Broadsheet generated");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to build broadsheet");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl text-primary">Result Exports & Broadsheets</h2>
        <p className="text-sm text-muted-foreground">
          Export approved results as CSV, Excel, or PDF. Generate official broadsheets for individual offerings.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="font-serif text-lg">Filters</CardTitle><CardDescription>Everything downstream respects these filters.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Filter label="Semester" value={semesterId} onChange={(v) => { setSemesterId(v); setOfferingId("all"); }}
              options={[["all","All semesters"], ...((struct?.semesters ?? []).map((s) => {
                const sess = struct?.sessions.find((x) => x.id === s.session_id);
                return [s.id, `${sess?.name ?? ""} — ${s.type}${s.is_current ? " (current)" : ""}`] as [string, string];
              }))]} />
            <Filter label="Department" value={departmentId} onChange={(v) => { setDepartmentId(v); setProgrammeId("all"); setOfferingId("all"); }}
              options={[["all","All departments"], ...((struct?.departments ?? []).map((d) => [d.id, `${d.code} — ${d.name}`] as [string,string]))]} />
            <Filter label="Programme" value={programmeId} onChange={(v) => setProgrammeId(v)}
              options={[["all","All programmes"], ...programmesForDept.map((p) => [p.id, `${p.code} — ${p.name}`] as [string,string])]} />
            <Filter label="Course offering" value={offeringId} onChange={(v) => setOfferingId(v)}
              options={[["all","All courses"], ...((offersQuery.data ?? []).map((o: any) => [o.offering.id, `${o.offering.course.code} — ${o.offering.course.title}`] as [string,string]))]} />
          </div>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={includeApproved} onCheckedChange={setIncludeApproved} id="inc" />
              <label htmlFor="inc" className="text-sm">Include Registry-approved (not yet published)</label>
            </div>
            <Button variant="ghost" size="sm" onClick={() => rowsQuery.refetch()} disabled={rowsQuery.isFetching}>
              <RefreshCw className={`h-3 w-3 mr-1 ${rowsQuery.isFetching ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="font-serif text-lg">Export</CardTitle>
            <CardDescription>
              {rowsQuery.isLoading ? "Loading…" : `${rows.length.toLocaleString()} row${rows.length === 1 ? "" : "s"} match the filters.`}
            </CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => doExport("csv")} disabled={rowsQuery.isLoading}><FileText className="h-4 w-4 mr-2" />CSV</Button>
            <Button variant="outline" onClick={() => doExport("xlsx")} disabled={rowsQuery.isLoading}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel</Button>
            <Button variant="outline" onClick={() => doExport("pdf")} disabled={rowsQuery.isLoading}><FileType2 className="h-4 w-4 mr-2" />PDF</Button>
            <Button onClick={doBroadsheet} disabled={offeringId === "all"} className="bg-primary text-primary-foreground">
              <Printer className="h-4 w-4 mr-2" />Broadsheet PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {rowsQuery.isLoading ? <Skeleton className="h-40" /> : rows.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No approved results match the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {EXPORT_COLUMNS.slice(0, 10).map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}
                    <TableHead>Score</TableHead>
                    <TableHead>Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 100).map((r, i) => (
                    <TableRow key={i}>
                      {EXPORT_COLUMNS.slice(0, 10).map((c) => (
                        <TableCell key={c.key}>{String(r[c.key] ?? "—")}</TableCell>
                      ))}
                      <TableCell>{r.total_score ?? "—"}</TableCell>
                      <TableCell><Badge variant="secondary">{r.grade ?? "—"}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {rows.length > 100 && (
                <p className="mt-2 text-xs text-muted-foreground">Preview shows first 100 rows. Export contains all {rows.length}.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<[string, string]> }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent className="max-h-72">
          {options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
