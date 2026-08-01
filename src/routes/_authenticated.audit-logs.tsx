import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listAuditLogs,
  listAcademicStructure,
  STAFF_AUDIT_ACTIONS,
  type AuditLogPage,
  type AuditLogRow,
} from "@/lib/admin.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollText, Search, Download, RotateCcw, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { toCsv, downloadCsv } from "@/lib/csv";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/audit-logs")({
  component: AuditLogPage,
});

const ACTION_LABEL: Record<string, string> = {
  staff_account_created: "Staff account created",
  staff_assignment_updated: "Staff assignment updated",
  role_granted: "Role granted",
  role_revoked: "Role revoked",
};

const EXPORT_MAX = 2000;

function AuditLogPage() {
  const [action, setAction] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [staffCode, setStaffCode] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [exporting, setExporting] = useState(false);

  const fetchLogs = useServerFn(listAuditLogs);
  const fetchStructure = useServerFn(listAcademicStructure);

  const filters = useMemo(
    () => ({
      action: action === "all" ? undefined : action,
      staff_only: true,
      search,
      staff_code: staffCode,
      department_id: departmentId === "all" ? undefined : departmentId,
      from: from || undefined,
      to: to || undefined,
    }),
    [action, search, staffCode, departmentId, from, to],
  );

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin", "audit-logs", filters, page, pageSize],
    queryFn: () => fetchLogs({ data: { ...filters, page, page_size: pageSize } }) as Promise<AuditLogPage>,
    staleTime: 10_000,
  });

  const { data: structure } = useQuery({
    queryKey: ["admin", "structure", "departments"],
    queryFn: () => fetchStructure(),
    staleTime: 300_000,
  });
  const departments = useMemo(
    () =>
      ((structure?.departments ?? []) as { id: string; name: string }[])
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [structure],
  );

  const rows: AuditLogRow[] = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  function resetFilters() {
    setAction("all");
    setSearch("");
    setStaffCode("");
    setDepartmentId("all");
    setFrom("");
    setTo("");
    setPage(1);
  }

  async function fetchAllFiltered(): Promise<AuditLogRow[]> {
    const res = (await fetchLogs({ data: { ...filters, page: 1, page_size: EXPORT_MAX } })) as AuditLogPage;
    return res.rows;
  }

  function tableData(all: AuditLogRow[]) {
    const header = ["When", "Action", "Staff", "Staff code", "Staff email", "Roles", "Department", "Changed by"];
    const body = all.map((r) => [
      new Date(r.created_at).toLocaleString(),
      ACTION_LABEL[r.action] ?? r.action,
      r.target_name ?? "",
      r.target_staff_code ?? "",
      r.target_email ?? "",
      rolesOf(r),
      departmentOf(r) ?? "",
      r.actor_name ?? r.actor_email ?? "System",
    ]);
    return { header, body };
  }

  function filterSummary() {
    const parts = [
      action === "all" ? "All staff changes" : (ACTION_LABEL[action] ?? action),
      departmentId === "all" ? null : departments.find((d) => d.id === departmentId)?.name,
      staffCode ? `Staff code: ${staffCode}` : null,
      search ? `Search: ${search}` : null,
      from || to ? `${from || "start"} → ${to || "today"}` : null,
    ].filter(Boolean);
    return parts.join(" · ");
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const all = await fetchAllFiltered();
      const { header, body } = tableData(all);
      downloadCsv("akcoe-staff-audit-log.csv", toCsv([header, ...body]));
    } catch {
      toast.error("Could not export the audit log");
    } finally {
      setExporting(false);
    }
  }

  async function exportPdf() {
    setExporting(true);
    try {
      const all = await fetchAllFiltered();
      const { header, body } = tableData(all);
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      doc.setFontSize(15);
      doc.text("Aminu Kano College of Education", 40, 40);
      doc.setFontSize(11);
      doc.text("Staff role & department assignment audit log", 40, 58);
      doc.setFontSize(8);
      doc.text(filterSummary() || "No filters applied", 40, 74);
      doc.text(`Generated ${new Date().toLocaleString()} · ${all.length} entries`, 40, 86);

      autoTable(doc, {
        head: [header],
        body,
        startY: 98,
        styles: { fontSize: 7, cellPadding: 3 },
        headStyles: { fillColor: [17, 34, 64], textColor: 255 },
        alternateRowStyles: { fillColor: [246, 246, 242] },
        didDrawPage: () => {
          const p = doc.getNumberOfPages();
          doc.setFontSize(7);
          doc.text(
            `Page ${p}`,
            doc.internal.pageSize.getWidth() - 60,
            doc.internal.pageSize.getHeight() - 20,
          );
        },
      });
      doc.save("akcoe-staff-audit-log.pdf");
    } catch {
      toast.error("Could not export the audit log as PDF");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl text-primary flex items-center gap-2">
          <ScrollText className="h-5 w-5" /> Audit Log
        </h2>
        <p className="text-sm text-muted-foreground">
          Every staff role grant, revocation and department headship change, with who made it and when.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Filters</CardTitle>
          <CardDescription>
            Search across staff name, staff code, action and department, or narrow by date range.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="audit-search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="audit-search"
                  className="pl-9"
                  placeholder="Staff name, staff code, email, role or department…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Action</Label>
              <Select value={action} onValueChange={(v) => { setAction(v); setPage(1); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All staff changes</SelectItem>
                  {STAFF_AUDIT_ACTIONS.map((a) => (
                    <SelectItem key={a} value={a}>{ACTION_LABEL[a] ?? a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="audit-code">Staff code</Label>
              <Input
                id="audit-code"
                placeholder="e.g. AKCOE12"
                value={staffCode}
                onChange={(e) => { setStaffCode(e.target.value); setPage(1); }}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Department</Label>
              <Select value={departmentId} onValueChange={(v) => { setDepartmentId(v); setPage(1); }}>
                <SelectTrigger><SelectValue placeholder="All departments" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="audit-from">From</Label>
              <Input id="audit-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="audit-to">To</Label>
              <Input id="audit-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">
              {isLoading ? "Loading…" : total === 0 ? "No entries" : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
            </span>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={resetFilters}>
                <RotateCcw className="h-4 w-4 mr-1" /> Reset
              </Button>
              <Button variant="outline" onClick={exportCsv} disabled={total === 0 || exporting || isLoading}>
                <Download className="h-4 w-4 mr-1" /> CSV
              </Button>
              <Button variant="outline" onClick={exportPdf} disabled={total === 0 || exporting || isLoading}>
                <FileText className="h-4 w-4 mr-1" /> PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Assignment history</CardTitle>
          <CardDescription>Newest first. Audit entries are immutable.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Staff member</TableHead>
                  <TableHead>Staff code</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Changed by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-8" /></TableCell></TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                      No staff assignment changes match these filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.action === "role_revoked" ? "destructive" : "secondary"}>
                          {ACTION_LABEL[r.action] ?? r.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {r.target_name ?? r.target_email ?? "—"}
                        {r.target_name && r.target_email && (
                          <span className="block text-xs text-muted-foreground">{r.target_email}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">{r.target_staff_code ?? "—"}</TableCell>
                      <TableCell className="text-sm capitalize">{rolesOf(r) || "—"}</TableCell>
                      <TableCell className="text-sm">{departmentOf(r) ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.actor_name ?? r.actor_email ?? "System"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Rows per page</Label>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}
              >
                <SelectTrigger className="h-8 w-[80px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[25, 50, 100].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Page {page} of {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isFetching}
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page >= pageCount || isFetching}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function rolesOf(r: AuditLogRow): string {
  const m = r.metadata ?? {};
  if (typeof m.role === "string") return m.role.replace("_", " ");
  if (Array.isArray(m.roles)) return (m.roles as string[]).map((x) => x.replace("_", " ")).join(", ");
  return "";
}

function departmentOf(r: AuditLogRow): string | null {
  const m = r.metadata ?? {};
  return typeof m.department_name === "string" ? m.department_name : null;
}
