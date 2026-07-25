import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listExaminationOfficers,
  setExaminationOfficerScope,
  removeExaminationOfficerScope,
  searchStaff,
} from "@/lib/exams.functions";
import { listAcademicStructure } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/exam-officers")({
  component: ExamOfficersPage,
});

type ScopeType = "programme" | "department" | "faculty";

function ExamOfficersPage() {
  const qc = useQueryClient();
  const loadStruct = useServerFn(listAcademicStructure);
  const listFn = useServerFn(listExaminationOfficers);
  const setFn = useServerFn(setExaminationOfficerScope);
  const rmFn = useServerFn(removeExaminationOfficerScope);
  const staffFn = useServerFn(searchStaff);

  const { data: struct } = useQuery({ queryKey: ["academic-structure"], queryFn: () => loadStruct(), staleTime: 60_000 });
  const { data: officers, isLoading } = useQuery({ queryKey: ["exam-officers"], queryFn: () => listFn() });

  const [search, setSearch] = useState("");
  const { data: staff } = useQuery({
    queryKey: ["staff-search-eo", search],
    queryFn: () => staffFn({ data: { search, roles: ["examination_officer"] } }),
  });

  const [userId, setUserId] = useState("");
  const [scopeType, setScopeType] = useState<ScopeType>("department");
  const [scopeId, setScopeId] = useState("");

  const scopeOptions = useMemo(() => {
    if (!struct) return [];
    if (scopeType === "faculty") return struct.faculties.map((f: any) => ({ id: f.id, label: `${f.code} — ${f.name}` }));
    if (scopeType === "department") return struct.departments.map((d: any) => ({ id: d.id, label: `${d.code} — ${d.name}` }));
    return struct.programmes.map((p: any) => ({ id: p.id, label: `${p.code} — ${p.name}` }));
  }, [struct, scopeType]);

  const scopeLabel = (row: any) => {
    const list = row.scope_type === "faculty" ? struct?.faculties
      : row.scope_type === "department" ? struct?.departments
      : struct?.programmes;
    const found = (list ?? []).find((x: any) => x.id === row.scope_id);
    return found ? `${found.code ?? ""} ${found.name ?? ""}`.trim() : row.scope_id.slice(0, 8);
  };

  const save = useMutation({
    mutationFn: () => setFn({ data: { user_id: userId, scope_type: scopeType, scope_id: scopeId } }),
    onSuccess: () => { toast.success("Scope assigned"); setUserId(""); setScopeId(""); qc.invalidateQueries({ queryKey: ["exam-officers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => rmFn({ data: { id } }),
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["exam-officers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl text-primary">Examination Officers</h2>
        <p className="text-sm text-muted-foreground">
          Assign a programme, department, or faculty scope to any user who already has the <code>examination_officer</code> role
          (granted from Users &amp; Roles).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Assign scope</CardTitle>
          <CardDescription>Pick a user with the examination_officer role, then choose the scope they should oversee.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <Input placeholder="Search users…" value={search} onChange={(e) => setSearch(e.target.value)} className="md:col-span-4" />
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger><SelectValue placeholder="User" /></SelectTrigger>
            <SelectContent>
              {(staff ?? []).length === 0
                ? <SelectItem value="none" disabled>No users with EO role</SelectItem>
                : (staff ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={scopeType} onValueChange={(v) => { setScopeType(v as ScopeType); setScopeId(""); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="programme">Programme</SelectItem>
              <SelectItem value="department">Department</SelectItem>
              <SelectItem value="faculty">Faculty</SelectItem>
            </SelectContent>
          </Select>
          <Select value={scopeId} onValueChange={setScopeId}>
            <SelectTrigger><SelectValue placeholder={`Select ${scopeType}`} /></SelectTrigger>
            <SelectContent>
              {scopeOptions.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button disabled={!userId || !scopeId || save.isPending} onClick={() => save.mutate()}>
            <Plus className="h-4 w-4 mr-2" /> Assign
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Current assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>User</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Target</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {isLoading
                  ? <TableRow><TableCell colSpan={4}>Loading…</TableCell></TableRow>
                  : (officers ?? []).length === 0
                  ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No scopes assigned yet.</TableCell></TableRow>
                  : (officers ?? []).map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.profile?.full_name ?? r.profile?.email ?? r.user_id.slice(0, 8)}</TableCell>
                      <TableCell><Badge variant="outline">{r.scope_type}</Badge></TableCell>
                      <TableCell>{scopeLabel(r)}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => remove.mutate(r.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
