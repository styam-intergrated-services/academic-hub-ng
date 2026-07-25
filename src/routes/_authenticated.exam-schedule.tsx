import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listExamSchedules,
  upsertExamSchedule,
  deleteExamSchedule,
  assignInvigilator,
  removeInvigilator,
  getScopedOfferings,
  getMyExamScope,
  searchStaff,
} from "@/lib/exams.functions";
import { listOfferingsForAllocation } from "@/lib/exams.functions";
import { listAcademicStructure } from "@/lib/admin.functions";
import { getPortalUser } from "@/lib/portal.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, X, UserPlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/exam-schedule")({
  component: ExamSchedulePage,
});

const STAFF_ROLES = ["registry", "dean", "super_admin", "ict_admin"];

function ExamSchedulePage() {
  const qc = useQueryClient();
  const meFn = useServerFn(getPortalUser);
  const structFn = useServerFn(listAcademicStructure);
  const scopeFn = useServerFn(getMyExamScope);
  const listFn = useServerFn(listExamSchedules);
  const scopedOffFn = useServerFn(getScopedOfferings);
  const allOffFn = useServerFn(listOfferingsForAllocation);
  const upFn = useServerFn(upsertExamSchedule);
  const rmFn = useServerFn(deleteExamSchedule);
  const staffFn = useServerFn(searchStaff);
  const assignFn = useServerFn(assignInvigilator);
  const removeInvigFn = useServerFn(removeInvigilator);

  const { data: me } = useQuery({ queryKey: ["portal", "user"], queryFn: () => meFn(), staleTime: 60_000 });
  const { data: struct } = useQuery({ queryKey: ["academic-structure"], queryFn: () => structFn(), staleTime: 60_000 });
  const { data: scope } = useQuery({ queryKey: ["my-exam-scope"], queryFn: () => scopeFn() });

  const isStaff = (me?.roles ?? []).some((r) => STAFF_ROLES.includes(r));
  const isEO = (me?.roles ?? []).includes("examination_officer" as any);

  const [semesterId, setSemesterId] = useState<string>("");
  const semesters = useMemo(
    () =>
      (struct?.semesters ?? []).map((s: any) => ({
        id: s.id,
        label: `${struct?.sessions.find((x: any) => x.id === s.session_id)?.name ?? ""} — ${s.type}`,
      })),
    [struct]
  );

  // Offerings available to schedule: EO -> scoped, Staff -> all
  const { data: eligibleOfferings } = useQuery<any[]>({
    queryKey: ["schedulable-offerings", isStaff, semesterId],
    queryFn: async () => {
      const res = isStaff
        ? await allOffFn({ data: semesterId ? { semester_id: semesterId } : {} })
        : await scopedOffFn({ data: semesterId ? { semester_id: semesterId } : {} });
      return (res ?? []) as any[];
    },
    enabled: !!me,
  });

  const offeringIds = useMemo(() => (eligibleOfferings ?? []).map((o: any) => o.id), [eligibleOfferings]);

  const { data: schedules, isLoading } = useQuery<any[]>({
    queryKey: ["exam-schedules", semesterId, offeringIds.join(",")],
    queryFn: async () => (await listFn({
      data: isStaff
        ? (semesterId ? { semester_id: semesterId } : {})
        : { offering_ids: offeringIds },
    })) as any[],
    enabled: !!me && (isStaff || offeringIds.length > 0 || isEO),
  });

  const remove = useMutation({
    mutationFn: (id: string) => rmFn({ data: { id } }),
    onSuccess: () => { toast.success("Schedule removed"); qc.invalidateQueries({ queryKey: ["exam-schedules"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!me) return null;
  if (!isStaff && !isEO) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Access restricted</CardTitle>
          <CardDescription>Only Registry/Dean/Admin staff or examination officers can view this page.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl text-primary">Exam Timetable</h2>
          <p className="text-sm text-muted-foreground">
            Schedule exams for course offerings and assign invigilators.
            {isEO && !isStaff && " You can only schedule for offerings inside your examination scope."}
          </p>
        </div>
        <NewScheduleDialog
          offerings={eligibleOfferings ?? []}
          onSubmit={async (v) => {
            await upFn({ data: v });
            toast.success("Schedule saved");
            qc.invalidateQueries({ queryKey: ["exam-schedules"] });
          }}
        />
      </div>

      <Card>
        <CardHeader><CardTitle className="font-serif text-lg">Filter</CardTitle></CardHeader>
        <CardContent>
          <Select value={semesterId} onValueChange={(v) => setSemesterId(v === "__all__" ? "" : v)}>
            <SelectTrigger className="md:w-96"><SelectValue placeholder="All semesters" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All semesters</SelectItem>
              {semesters.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {isLoading ? <Card><CardContent className="py-6">Loading…</CardContent></Card>
          : (schedules ?? []).length === 0
          ? <Card><CardContent className="py-6 text-center text-muted-foreground">No exam schedules yet.</CardContent></Card>
          : (schedules ?? []).map((s: any) => (
            <ScheduleRow
              key={s.id}
              schedule={s}
              onDelete={() => remove.mutate(s.id)}
              onAssign={async (staff_id) => {
                await assignFn({ data: { schedule_id: s.id, staff_id } });
                qc.invalidateQueries({ queryKey: ["exam-schedules"] });
              }}
              onRemoveInvig={async (id) => {
                await removeInvigFn({ data: { id } });
                qc.invalidateQueries({ queryKey: ["exam-schedules"] });
              }}
              staffFn={(search) => staffFn({ data: { search } })}
            />
          ))}
      </div>
    </div>
  );
}

function NewScheduleDialog({ offerings, onSubmit }: { offerings: any[]; onSubmit: (v: any) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ offering_id: "", exam_date: "", start_time: "", end_time: "", venue: "" });
  const canSave = form.offering_id && form.exam_date && form.start_time && form.end_time && form.venue.trim();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> New schedule</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create exam schedule</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Course offering</Label>
            <Select value={form.offering_id} onValueChange={(v) => setForm({ ...form, offering_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select offering" /></SelectTrigger>
              <SelectContent>
                {offerings.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.course?.code} — {o.course?.title} ({o.semester?.session?.name} · {o.semester?.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Date</Label><Input type="date" value={form.exam_date} onChange={(e) => setForm({ ...form, exam_date: e.target.value })} /></div>
            <div><Label>Start</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
            <div><Label>End</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
          </div>
          <div><Label>Venue</Label><Input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} placeholder="e.g. Main Hall B" /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            disabled={!canSave}
            onClick={async () => {
              try {
                await onSubmit(form);
                setOpen(false);
                setForm({ offering_id: "", exam_date: "", start_time: "", end_time: "", venue: "" });
              } catch (e: any) { toast.error(e.message); }
            }}
          >Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleRow({
  schedule, onDelete, onAssign, onRemoveInvig, staffFn,
}: {
  schedule: any;
  onDelete: () => void;
  onAssign: (staff_id: string) => Promise<void>;
  onRemoveInvig: (id: string) => Promise<void>;
  staffFn: (search: string) => Promise<any[]>;
}) {
  const [search, setSearch] = useState("");
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function doSearch() {
    setLoading(true);
    try { setStaff(await staffFn(search)); } finally { setLoading(false); }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="font-serif text-base">
            {schedule.offering?.course?.code} — {schedule.offering?.course?.title}
          </CardTitle>
          <CardDescription>
            {schedule.offering?.semester?.session?.name} · {schedule.offering?.semester?.type} ·
            {" "}{schedule.exam_date} · {schedule.start_time?.slice(0,5)}–{schedule.end_time?.slice(0,5)} · <b>{schedule.venue}</b>
          </CardDescription>
        </div>
        <Button size="icon" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="text-sm font-medium mb-2">Invigilators</div>
          <div className="flex flex-wrap gap-2">
            {(schedule.invigilators ?? []).length === 0 && (
              <span className="text-xs text-muted-foreground">None assigned.</span>
            )}
            {(schedule.invigilators ?? []).map((iv: any) => (
              <Badge key={iv.id} variant="secondary" className="gap-1">
                {iv.profile?.full_name ?? iv.profile?.email ?? iv.staff_id.slice(0, 8)}
                <button onClick={() => onRemoveInvig(iv.id)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-2">
          <Input placeholder="Search staff…" value={search} onChange={(e) => setSearch(e.target.value)} className="md:w-80" />
          <Button variant="outline" onClick={doSearch} disabled={loading}>Search</Button>
        </div>
        {staff.length > 0 && (
          <div className="rounded-md border max-h-56 overflow-y-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead className="w-24"></TableHead></TableRow></TableHeader>
              <TableBody>
                {staff.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.full_name ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.email}</TableCell>
                    <TableCell>
                      <Button size="sm" onClick={async () => {
                        try { await onAssign(p.id); toast.success("Assigned"); } catch (e: any) { toast.error(e.message); }
                      }}><UserPlus className="h-3.5 w-3.5" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
