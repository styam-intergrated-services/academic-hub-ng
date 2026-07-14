import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getStudentDetail, updateStudentAdmin } from "@/lib/students.functions";
import { getPortalUser } from "@/lib/portal.functions";
import { useAcademicStructure } from "@/components/portal/AcademicStructure";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StandingBadge } from "./_authenticated.students";
import { ChevronLeft, ShieldAlert } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/students/$id")({
  component: StudentDetailPage,
});

function StudentDetailPage() {
  const { id } = Route.useParams();
  const getDetail = useServerFn(getStudentDetail);
  const getUser = useServerFn(getPortalUser);
  const { data: academic } = useAcademicStructure();

  const { data: me } = useQuery({ queryKey: ["portal","user"], queryFn: () => getUser(), staleTime: 60_000 });
  const { data, isLoading, error } = useQuery({
    queryKey: ["students", "detail", id],
    queryFn: () => getDetail({ data: { id } }),
    staleTime: 15_000,
  });

  if (isLoading) return <Skeleton className="h-96" />;
  if (error) return <Card><CardContent className="pt-6 text-destructive flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> {(error as Error).message}</CardContent></Card>;
  if (!data) return null;

  const { student, profile, gpa_records, registrations, results } = data;
  const dept = academic?.departments.find((d: any) => d.id === student.department_id);
  const prog = academic?.programmes.find((p: any) => p.id === student.programme_id);
  const level = academic?.levels.find((l: any) => l.id === student.current_level_id);
  const canAdmin = !!me?.roles.some((r) => ["super_admin","ict_admin","registry"].includes(r));

  return (
    <div className="space-y-6">
      <Link to="/students" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ChevronLeft className="h-4 w-4" /> Back to students
      </Link>

      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-6 items-center">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-primary text-primary-foreground text-lg">
              {(profile?.full_name ?? profile?.email ?? "?").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-64">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">{student.matric_number}</div>
            <h2 className="font-serif text-2xl text-primary">{profile?.full_name ?? "—"}</h2>
            <div className="text-sm text-muted-foreground">{profile?.email}</div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">{prog?.name ?? "—"}</Badge>
              <Badge variant="outline">{dept?.name ?? "—"}</Badge>
              <Badge variant="outline">{level?.name ?? "—"}</Badge>
              <StandingBadge value={student.standing} />
              <Badge variant={student.is_active ? "secondary" : "outline"}>{student.is_active ? "Active" : "Inactive"}</Badge>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">CGPA</div>
            <div className="font-serif text-3xl font-bold text-primary">{Number(student.cgpa ?? 0).toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">{student.total_credit_units ?? 0} units earned</div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="academic">
        <TabsList>
          <TabsTrigger value="academic">Academic</TabsTrigger>
          <TabsTrigger value="registrations">Registrations</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          {canAdmin && <TabsTrigger value="admin">Admin actions</TabsTrigger>}
        </TabsList>

        <TabsContent value="academic" className="pt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="font-serif text-lg">GPA history</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Session</TableHead>
                  <TableHead>Semester</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">GPA</TableHead>
                  <TableHead className="text-right">CGPA</TableHead>
                  <TableHead>Standing</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {gpa_records.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No GPA records yet.</TableCell></TableRow>}
                  {gpa_records.map((g: any) => (
                    <TableRow key={g.id}>
                      <TableCell>{g.semesters?.academic_sessions?.name ?? "—"}</TableCell>
                      <TableCell className="capitalize">{g.semesters?.type ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">{g.credit_units}</TableCell>
                      <TableCell className="text-right font-mono">{Number(g.gpa).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono">{Number(g.cgpa).toFixed(2)}</TableCell>
                      <TableCell><StandingBadge value={g.standing} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="font-serif text-lg">Published results</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">CA</TableHead>
                  <TableHead className="text-right">Exam</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {results.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">No published results.</TableCell></TableRow>}
                  {results.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.course_offerings?.courses?.code}</TableCell>
                      <TableCell>{r.course_offerings?.courses?.title}</TableCell>
                      <TableCell className="text-right font-mono">{r.course_offerings?.courses?.credit_units}</TableCell>
                      <TableCell className="text-right font-mono">{r.ca_score ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">{r.exam_score ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">{r.total_score ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline">{r.grade ?? "—"}</Badge></TableCell>
                      <TableCell className="text-right font-mono">{Number(r.grade_point ?? 0).toFixed(1)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="registrations" className="pt-4">
          <Card>
            <CardHeader><CardTitle className="font-serif text-lg">Course registrations</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Registered</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {registrations.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No registrations.</TableCell></TableRow>}
                  {registrations.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.course_offerings?.courses?.code}</TableCell>
                      <TableCell>{r.course_offerings?.courses?.title}</TableCell>
                      <TableCell className="text-right font-mono">{r.course_offerings?.courses?.credit_units}</TableCell>
                      <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(r.registered_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile" className="pt-4">
          <Card>
            <CardHeader><CardTitle className="font-serif text-lg">Bio-data</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-3 md:grid-cols-2 text-sm">
                <Row label="Full name" value={profile?.full_name} />
                <Row label="Email" value={profile?.email} />
                <Row label="Phone" value={profile?.phone} />
                <Row label="Date of birth" value={profile?.date_of_birth} />
                <Row label="Gender" value={profile?.gender} />
                <Row label="State of origin" value={profile?.state_of_origin} />
                <Row label="LGA" value={profile?.lga} />
                <Row label="Address" value={profile?.address} />
                <Row label="Entry year" value={student.entry_year} />
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        {canAdmin && (
          <TabsContent value="admin" className="pt-4">
            <AdminActions student={student} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="border-b pb-2">
      <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd>{value ?? <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

function AdminActions({ student }: { student: any }) {
  const update = useServerFn(updateStudentAdmin);
  const { data: academic } = useAcademicStructure();
  const qc = useQueryClient();
  const [level, setLevel] = useState<string>(student.current_level_id);
  const [prog, setProg] = useState<string>(student.programme_id);
  const [dept, setDept] = useState<string>(student.department_id);

  const mut = useMutation({
    mutationFn: (patch: any) => update({ data: { id: student.id, patch } }),
    onSuccess: () => {
      toast.success("Student updated");
      qc.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const progsForDept = (academic?.programmes ?? []).filter((p: any) => p.department_id === dept);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-lg">Administrative changes</CardTitle>
        <CardDescription>All changes are audit-logged.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Department</div>
            <Select value={dept} onValueChange={(v) => { setDept(v); setProg(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(academic?.departments ?? []).map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Programme</div>
            <Select value={prog} onValueChange={setProg}>
              <SelectTrigger><SelectValue placeholder="Select programme" /></SelectTrigger>
              <SelectContent>{progsForDept.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Level</div>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(academic?.levels ?? []).map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={mut.isPending}
            onClick={() => mut.mutate({ current_level_id: level, programme_id: prog, department_id: dept })}
          >Save changes</Button>
          <Button variant={student.is_active ? "destructive" : "default"} disabled={mut.isPending}
            onClick={() => mut.mutate({ is_active: !student.is_active })}
          >{student.is_active ? "Suspend student" : "Reinstate student"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
