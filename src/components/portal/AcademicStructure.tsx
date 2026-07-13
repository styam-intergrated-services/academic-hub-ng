import { useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listAcademicStructure,
  upsertFaculty, deleteFaculty,
  upsertDepartment, deleteDepartment,
  upsertProgramme, deleteProgramme,
  upsertLevel, deleteLevel,
  upsertSession, deleteSession,
  upsertSemester, deleteSemester,
  upsertCourse, deleteCourse,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil, Plus, Trash2 } from "lucide-react";

export function useAcademicStructure() {
  const load = useServerFn(listAcademicStructure);
  return useQuery({
    queryKey: ["academic-structure"],
    queryFn: () => load(),
    staleTime: 30_000,
  });
}

export function SectionCard({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="font-serif text-lg">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function DataTable({ head, rows, loading, empty }: { head: string[]; rows: ReactNode[][]; loading?: boolean; empty?: string }) {
  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader><TableRow>{head.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={head.length}><Skeleton className="h-6" /></TableCell></TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow><TableCell colSpan={head.length} className="text-center text-muted-foreground py-6">{empty ?? "No records."}</TableCell></TableRow>
          ) : rows.map((r, i) => <TableRow key={i}>{r.map((c, j) => <TableCell key={j}>{c}</TableCell>)}</TableRow>)}
        </TableBody>
      </Table>
    </div>
  );
}

export function DeleteButton({ onConfirm, label = "record" }: { onConfirm: () => void; label?: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this {label}?</AlertDialogTitle>
          <AlertDialogDescription>This cannot be undone. Related records may prevent deletion.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ============ FACULTIES ============
export function FacultiesSection({ data }: { data: Awaited<ReturnType<typeof listAcademicStructure>> }) {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertFaculty);
  const del = useServerFn(deleteFaculty);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const mut = useMutation({
    mutationFn: (v: any) => upsert({ data: v }),
    onSuccess: () => { toast.success("Faculty saved"); qc.invalidateQueries({ queryKey: ["academic-structure"] }); setOpen(false); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Faculty deleted"); qc.invalidateQueries({ queryKey: ["academic-structure"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SectionCard
      title="Faculties"
      description="Top-level academic groupings."
      action={
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New faculty</Button></DialogTrigger>
          <FacultyForm editing={editing} onSubmit={(v) => mut.mutate(v)} pending={mut.isPending} />
        </Dialog>
      }
    >
      <DataTable
        head={["Code", "Name", ""]}
        rows={data.faculties.map((f) => [
          <Badge variant="outline" key="c">{f.code}</Badge>,
          f.name,
          <div className="flex justify-end gap-1" key="a">
            <Button variant="ghost" size="icon" onClick={() => { setEditing(f); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
            <DeleteButton onConfirm={() => delMut.mutate(f.id)} label="faculty" />
          </div>,
        ])}
      />
    </SectionCard>
  );
}
function FacultyForm({ editing, onSubmit, pending }: { editing: any | null; onSubmit: (v: any) => void; pending: boolean }) {
  const [name, setName] = useState(editing?.name ?? "");
  const [code, setCode] = useState(editing?.code ?? "");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} faculty</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Faculty of Education" /></div>
        <div><Label>Code</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="EDU" /></div>
      </div>
      <DialogFooter>
        <Button disabled={pending || !name || !code} onClick={() => onSubmit({ id: editing?.id, name, code })}>{editing ? "Save" : "Create"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ============ DEPARTMENTS ============
export function DepartmentsSection({ data }: { data: Awaited<ReturnType<typeof listAcademicStructure>> }) {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertDepartment);
  const del = useServerFn(deleteDepartment);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const mut = useMutation({
    mutationFn: (v: any) => upsert({ data: v }),
    onSuccess: () => { toast.success("Department saved"); qc.invalidateQueries({ queryKey: ["academic-structure"] }); setOpen(false); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["academic-structure"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const facByCode = new Map(data.faculties.map((f) => [f.id, f]));

  return (
    <SectionCard
      title="Departments"
      description="Departments belong to a faculty."
      action={
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild><Button size="sm" disabled={data.faculties.length === 0}><Plus className="h-4 w-4 mr-1" /> New department</Button></DialogTrigger>
          <DepartmentForm editing={editing} faculties={data.faculties} onSubmit={(v) => mut.mutate(v)} pending={mut.isPending} />
        </Dialog>
      }
    >
      <DataTable
        head={["Code", "Department", "Faculty", ""]}
        rows={data.departments.map((d) => [
          <Badge variant="outline" key="c">{d.code}</Badge>,
          d.name,
          facByCode.get(d.faculty_id)?.name ?? "—",
          <div className="flex justify-end gap-1" key="a">
            <Button variant="ghost" size="icon" onClick={() => { setEditing(d); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
            <DeleteButton onConfirm={() => delMut.mutate(d.id)} label="department" />
          </div>,
        ])}
      />
    </SectionCard>
  );
}
function DepartmentForm({ editing, faculties, onSubmit, pending }: { editing: any | null; faculties: any[]; onSubmit: (v: any) => void; pending: boolean }) {
  const [name, setName] = useState(editing?.name ?? "");
  const [code, setCode] = useState(editing?.code ?? "");
  const [facultyId, setFacultyId] = useState(editing?.faculty_id ?? faculties[0]?.id ?? "");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} department</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Faculty</Label>
          <Select value={facultyId} onValueChange={setFacultyId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{faculties.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Department of Mathematics" /></div>
        <div><Label>Code</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="MTH" /></div>
      </div>
      <DialogFooter>
        <Button disabled={pending || !name || !code || !facultyId} onClick={() => onSubmit({ id: editing?.id, faculty_id: facultyId, name, code })}>{editing ? "Save" : "Create"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ============ PROGRAMMES ============
export function ProgrammesSection({ data }: { data: Awaited<ReturnType<typeof listAcademicStructure>> }) {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertProgramme);
  const del = useServerFn(deleteProgramme);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const mut = useMutation({
    mutationFn: (v: any) => upsert({ data: v }),
    onSuccess: () => { toast.success("Programme saved"); qc.invalidateQueries({ queryKey: ["academic-structure"] }); setOpen(false); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["academic-structure"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deptById = new Map(data.departments.map((d) => [d.id, d]));

  return (
    <SectionCard
      title="Programmes"
      description="Academic programmes (e.g. NCE Mathematics)."
      action={
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild><Button size="sm" disabled={data.departments.length === 0}><Plus className="h-4 w-4 mr-1" /> New programme</Button></DialogTrigger>
          <ProgrammeForm editing={editing} departments={data.departments} onSubmit={(v) => mut.mutate(v)} pending={mut.isPending} />
        </Dialog>
      }
    >
      <DataTable
        head={["Code", "Programme", "Department", "Years", ""]}
        rows={data.programmes.map((p) => [
          <Badge variant="outline" key="c">{p.code}</Badge>,
          p.name,
          deptById.get(p.department_id)?.name ?? "—",
          p.duration_years,
          <div className="flex justify-end gap-1" key="a">
            <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
            <DeleteButton onConfirm={() => delMut.mutate(p.id)} label="programme" />
          </div>,
        ])}
      />
    </SectionCard>
  );
}
function ProgrammeForm({ editing, departments, onSubmit, pending }: { editing: any | null; departments: any[]; onSubmit: (v: any) => void; pending: boolean }) {
  const [name, setName] = useState(editing?.name ?? "");
  const [code, setCode] = useState(editing?.code ?? "");
  const [deptId, setDeptId] = useState(editing?.department_id ?? departments[0]?.id ?? "");
  const [years, setYears] = useState<number>(editing?.duration_years ?? 3);
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} programme</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Department</Label>
          <Select value={deptId} onValueChange={setDeptId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="NCE Mathematics / Physics" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Code</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="NCE-MTH-PHY" /></div>
          <div><Label>Duration (years)</Label><Input type="number" min={1} max={6} value={years} onChange={(e) => setYears(parseInt(e.target.value) || 3)} /></div>
        </div>
      </div>
      <DialogFooter>
        <Button disabled={pending || !name || !code || !deptId} onClick={() => onSubmit({ id: editing?.id, department_id: deptId, name, code, duration_years: years })}>{editing ? "Save" : "Create"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ============ LEVELS ============
export function LevelsSection({ data }: { data: Awaited<ReturnType<typeof listAcademicStructure>> }) {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertLevel);
  const del = useServerFn(deleteLevel);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const mut = useMutation({
    mutationFn: (v: any) => upsert({ data: v }),
    onSuccess: () => { toast.success("Level saved"); qc.invalidateQueries({ queryKey: ["academic-structure"] }); setOpen(false); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["academic-structure"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SectionCard
      title="Levels"
      description="Academic levels (NCE I, II, III)."
      action={
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New level</Button></DialogTrigger>
          <LevelForm editing={editing} onSubmit={(v) => mut.mutate(v)} pending={mut.isPending} />
        </Dialog>
      }
    >
      <DataTable
        head={["Order", "Code", "Name", ""]}
        rows={data.levels.map((l) => [
          l.order_index,
          <Badge variant="outline" key="c">{l.code}</Badge>,
          l.name,
          <div className="flex justify-end gap-1" key="a">
            <Button variant="ghost" size="icon" onClick={() => { setEditing(l); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
            <DeleteButton onConfirm={() => delMut.mutate(l.id)} label="level" />
          </div>,
        ])}
      />
    </SectionCard>
  );
}
function LevelForm({ editing, onSubmit, pending }: { editing: any | null; onSubmit: (v: any) => void; pending: boolean }) {
  const [code, setCode] = useState(editing?.code ?? "");
  const [name, setName] = useState(editing?.name ?? "");
  const [order, setOrder] = useState<number>(editing?.order_index ?? 1);
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} level</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Code</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="NCE1" /></div>
          <div><Label>Order</Label><Input type="number" value={order} onChange={(e) => setOrder(parseInt(e.target.value) || 0)} /></div>
        </div>
        <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="NCE Year 1" /></div>
      </div>
      <DialogFooter>
        <Button disabled={pending || !name || !code} onClick={() => onSubmit({ id: editing?.id, code, name, order_index: order })}>{editing ? "Save" : "Create"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ============ SESSIONS ============
export function SessionsSection({ data }: { data: Awaited<ReturnType<typeof listAcademicStructure>> }) {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertSession);
  const del = useServerFn(deleteSession);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const mut = useMutation({
    mutationFn: (v: any) => upsert({ data: v }),
    onSuccess: () => { toast.success("Session saved"); qc.invalidateQueries({ queryKey: ["academic-structure"] }); setOpen(false); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["academic-structure"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SectionCard
      title="Academic Sessions"
      description="Academic years, e.g. 2025/2026. Only one may be active at a time."
      action={
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New session</Button></DialogTrigger>
          <SessionForm editing={editing} onSubmit={(v) => mut.mutate(v)} pending={mut.isPending} />
        </Dialog>
      }
    >
      <DataTable
        head={["Name", "Start", "End", "Status", ""]}
        rows={data.sessions.map((s) => [
          <span className="font-medium" key="n">{s.name}</span>,
          s.start_date,
          s.end_date,
          <Badge key="s" variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>,
          <div className="flex justify-end gap-1" key="a">
            <Button variant="ghost" size="icon" onClick={() => { setEditing(s); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
            <DeleteButton onConfirm={() => delMut.mutate(s.id)} label="session" />
          </div>,
        ])}
      />
    </SectionCard>
  );
}
function SessionForm({ editing, onSubmit, pending }: { editing: any | null; onSubmit: (v: any) => void; pending: boolean }) {
  const [name, setName] = useState(editing?.name ?? "");
  const [start, setStart] = useState(editing?.start_date ?? "");
  const [end, setEnd] = useState(editing?.end_date ?? "");
  const [status, setStatus] = useState(editing?.status ?? "upcoming");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} session</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="2025/2026" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Start date</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div><Label>End date</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        </div>
        <div><Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["upcoming","active","archived","closed"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button disabled={pending || !name || !start || !end} onClick={() => onSubmit({ id: editing?.id, name, start_date: start, end_date: end, status })}>{editing ? "Save" : "Create"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ============ SEMESTERS ============
export function SemestersSection({ data }: { data: Awaited<ReturnType<typeof listAcademicStructure>> }) {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertSemester);
  const del = useServerFn(deleteSemester);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const mut = useMutation({
    mutationFn: (v: any) => upsert({ data: v }),
    onSuccess: () => { toast.success("Semester saved"); qc.invalidateQueries({ queryKey: ["academic-structure"] }); setOpen(false); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["academic-structure"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const sessById = new Map(data.sessions.map((s) => [s.id, s]));

  return (
    <SectionCard
      title="Semesters"
      description="First and second semester within an academic session."
      action={
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild><Button size="sm" disabled={data.sessions.length === 0}><Plus className="h-4 w-4 mr-1" /> New semester</Button></DialogTrigger>
          <SemesterForm editing={editing} sessions={data.sessions} onSubmit={(v) => mut.mutate(v)} pending={mut.isPending} />
        </Dialog>
      }
    >
      <DataTable
        head={["Session", "Type", "Start", "End", "Reg open", "Current", ""]}
        rows={data.semesters.map((s) => [
          sessById.get(s.session_id)?.name ?? "—",
          <Badge key="t" variant="outline">{s.type}</Badge>,
          s.start_date,
          s.end_date,
          s.registration_open ? <Badge key="r">open</Badge> : <span key="r" className="text-muted-foreground text-xs">closed</span>,
          s.is_current ? <Badge key="c" variant="default">current</Badge> : "",
          <div className="flex justify-end gap-1" key="a">
            <Button variant="ghost" size="icon" onClick={() => { setEditing(s); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
            <DeleteButton onConfirm={() => delMut.mutate(s.id)} label="semester" />
          </div>,
        ])}
      />
    </SectionCard>
  );
}
function SemesterForm({ editing, sessions, onSubmit, pending }: { editing: any | null; sessions: any[]; onSubmit: (v: any) => void; pending: boolean }) {
  const [sessionId, setSessionId] = useState(editing?.session_id ?? sessions[0]?.id ?? "");
  const [type, setType] = useState(editing?.type ?? "first");
  const [start, setStart] = useState(editing?.start_date ?? "");
  const [end, setEnd] = useState(editing?.end_date ?? "");
  const [regOpen, setRegOpen] = useState<boolean>(editing?.registration_open ?? false);
  const [current, setCurrent] = useState<boolean>(editing?.is_current ?? false);
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} semester</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Session</Label>
          <Select value={sessionId} onValueChange={setSessionId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="first">First</SelectItem><SelectItem value="second">Second</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Start</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div><Label>End</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        </div>
        <div className="flex items-center justify-between rounded-md border p-3">
          <div><Label>Registration open</Label><p className="text-xs text-muted-foreground">Allow students to register courses.</p></div>
          <Switch checked={regOpen} onCheckedChange={setRegOpen} />
        </div>
        <div className="flex items-center justify-between rounded-md border p-3">
          <div><Label>Set as current semester</Label><p className="text-xs text-muted-foreground">Only one semester may be current.</p></div>
          <Switch checked={current} onCheckedChange={setCurrent} />
        </div>
      </div>
      <DialogFooter>
        <Button disabled={pending || !sessionId || !start || !end} onClick={() => onSubmit({ id: editing?.id, session_id: sessionId, type, start_date: start, end_date: end, registration_open: regOpen, is_current: current })}>{editing ? "Save" : "Create"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ============ COURSES ============
export function CoursesSection({ data }: { data: Awaited<ReturnType<typeof listAcademicStructure>> }) {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertCourse);
  const del = useServerFn(deleteCourse);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const mut = useMutation({
    mutationFn: (v: any) => upsert({ data: v }),
    onSuccess: () => { toast.success("Course saved"); qc.invalidateQueries({ queryKey: ["academic-structure"] }); setOpen(false); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["academic-structure"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deptById = new Map(data.departments.map((d) => [d.id, d]));
  const levelById = new Map(data.levels.map((l) => [l.id, l]));

  return (
    <SectionCard
      title="Courses"
      description="Course catalogue. Offerings for a semester are managed separately."
      action={
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild><Button size="sm" disabled={data.departments.length === 0 || data.levels.length === 0}><Plus className="h-4 w-4 mr-1" /> New course</Button></DialogTrigger>
          <CourseForm editing={editing} departments={data.departments} levels={data.levels} onSubmit={(v) => mut.mutate(v)} pending={mut.isPending} />
        </Dialog>
      }
    >
      <DataTable
        head={["Code", "Title", "Dept", "Level", "Semester", "Units", "Active", ""]}
        rows={data.courses.map((c) => [
          <Badge variant="outline" key="c">{c.code}</Badge>,
          <span className="font-medium" key="t">{c.title}</span>,
          deptById.get(c.department_id)?.code ?? "—",
          levelById.get(c.level_id)?.code ?? "—",
          c.semester_type,
          c.credit_units,
          c.is_active ? <Badge key="a">active</Badge> : <Badge key="a" variant="secondary">inactive</Badge>,
          <div className="flex justify-end gap-1" key="a">
            <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
            <DeleteButton onConfirm={() => delMut.mutate(c.id)} label="course" />
          </div>,
        ])}
      />
    </SectionCard>
  );
}
function CourseForm({ editing, departments, levels, onSubmit, pending }: { editing: any | null; departments: any[]; levels: any[]; onSubmit: (v: any) => void; pending: boolean }) {
  const [code, setCode] = useState(editing?.code ?? "");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [deptId, setDeptId] = useState(editing?.department_id ?? departments[0]?.id ?? "");
  const [levelId, setLevelId] = useState(editing?.level_id ?? levels[0]?.id ?? "");
  const [sem, setSem] = useState(editing?.semester_type ?? "first");
  const [units, setUnits] = useState<number>(editing?.credit_units ?? 3);
  const [active, setActive] = useState<boolean>(editing?.is_active ?? true);
  const [desc, setDesc] = useState<string>(editing?.description ?? "");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} course</DialogTitle></DialogHeader>
      <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Code</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="EDU111" /></div>
          <div><Label>Credit units</Label><Input type="number" min={1} max={12} value={units} onChange={(e) => setUnits(parseInt(e.target.value) || 1)} /></div>
        </div>
        <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Introduction to Education" /></div>
        <div><Label>Department</Label>
          <Select value={deptId} onValueChange={setDeptId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Level</Label>
            <Select value={levelId} onValueChange={setLevelId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{levels.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Semester</Label>
            <Select value={sem} onValueChange={setSem}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="first">First</SelectItem><SelectItem value="second">Second</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>Description</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} /></div>
        <div className="flex items-center justify-between rounded-md border p-3">
          <Label>Active</Label>
          <Switch checked={active} onCheckedChange={setActive} />
        </div>
      </div>
      <DialogFooter>
        <Button disabled={pending || !code || !title || !deptId || !levelId} onClick={() => onSubmit({ id: editing?.id, department_id: deptId, code, title, credit_units: units, level_id: levelId, semester_type: sem, is_active: active, description: desc || null })}>{editing ? "Save" : "Create"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
