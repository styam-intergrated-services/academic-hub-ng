import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAuditLogs, STAFF_AUDIT_ACTIONS, type AuditLogRow } from "@/lib/admin.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollText, Search, Download, RotateCcw } from "lucide-react";
import { toCsv, downloadCsv } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/audit-logs")({
  component: AuditLogPage,
});

const ACTION_LABEL: Record<string, string> = {
  staff_account_created: "Staff account created",
  staff_assignment_updated: "Staff assignment updated",
  role_granted: "Role granted",
  role_revoked: "Role revoked",
};

function AuditLogPage() {
  const [action, setAction] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const fetchLogs = useServerFn(listAuditLogs);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "audit-logs", action, search, from, to],
    queryFn: () =>
      fetchLogs({
        data: {
          action: action === "all" ? undefined : action,
          staff_only: true,
          search,
          from: from || undefined,
          to: to || undefined,
          limit: 300,
        },
      }),
    staleTime: 10_000,
  });

  const rows = useMemo<AuditLogRow[]>(() => data ?? [], [data]);

  function exportCsv() {
    const header = ["When", "Action", "Staff", "Staff email", "Roles", "Department", "Changed by"];
    const body = rows.map((r) => [
      new Date(r.created_at).toISOString(),
      ACTION_LABEL[r.action] ?? r.action,
      r.target_name ?? "",
      r.target_email ?? "",
      rolesOf(r),
      departmentOf(r) ?? "",
      r.actor_name ?? r.actor_email ?? "",
    ]);
    downloadCsv("akcoe-staff-audit-log.csv", toCsv([header, ...body]));
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
          <CardDescription>Narrow by action, staff member, or date range.</CardDescription>
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
                  placeholder="Staff name, email, role or department…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Action</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All staff changes</SelectItem>
                  {STAFF_AUDIT_ACTIONS.map((a) => (
                    <SelectItem key={a} value={a}>{ACTION_LABEL[a] ?? a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="audit-from">From</Label>
                <Input id="audit-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="audit-to">To</Label>
                <Input id="audit-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">{rows.length} entries</span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => { setAction("all"); setSearch(""); setFrom(""); setTo(""); }}
              >
                <RotateCcw className="h-4 w-4 mr-1" /> Reset
              </Button>
              <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
                <Download className="h-4 w-4 mr-1" /> Export CSV
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
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Staff member</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Changed by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8" /></TableCell></TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
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
