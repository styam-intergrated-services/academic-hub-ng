import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listAcademicStructure } from "@/lib/admin.functions";
import { getCycleOverview, createOfferings, enrolCohort, removeOffering } from "@/lib/result-cycle.functions";
import { PageHeader } from "@/components/portal/PageHeader";
import { EmptyState } from "@/components/portal/EmptyState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { CalendarRange, Users, Trash2, FileSpreadsheet, PlusCircle, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/result-cycle")({
  head: () => ({
    meta: [
      { title: "Semester Result Cycle — AKCOE Portal" },
      { name: "description", content: "Open offerings, enrol cohorts and track results from draft to publication." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResultCyclePage,
});

const STAGE: Record<string, { label: string; tone: string }> = {
  no_enrolment: { label: "No enrolment", tone: "bg-muted text-muted-foreground border-border" },
  awaiting_scores: { label: "Awaiting scores", tone: "bg-muted text-muted-foreground border-border" },
  draft: { label: "Draft", tone: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30" },
  submitted: { label: "With HOD", tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30" },
  hod_approved: { label: "With Dean", tone: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30" },
  dean_approved: { label: "With Registry", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  registry_approved: { label: "Ready to publish", tone: "bg-amber-600/15 text-amber-800 dark:text-amber-300 border-amber-600/30" },
  published: { label: "Published", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  returned: { label: "Returned for correction", tone: "bg-destructive/15 text-destructive border-destructive/30" },
  in_progress: { label: "In progress", tone: "bg-muted text-muted-foreground border-border" },
};

const PIPELINE = ["Draft", "Submitted", "HOD", "Dean", "Registry", "Published"];

function ResultCyclePage() {
  const qc = useQueryClient();
  const structFn = useServerFn(listAcademicStructure);
  const overviewFn = useServerFn(getCycleOverview);
  const createFn = useServerFn(createOfferings);
  const enrolFn = useServerFn(enrolCohort);
  const removeFn = useServerFn(removeOffering);

  const { data: struct } = useQuery({ queryKey: ["academic-structure"], queryFn: () => structFn(), staleTime: 60_000 });
  const [semesterId, setSemesterId] = useState<string>("");

  const semesters = useMemo(() => {
    const sessions = new Map((struct?.sessions ?? []).map((s: any) => [s.id, s.name]));
    return (struct?.semesters ?? []).map((s: any) => ({
      id: s.id,
      label: `${sessions.get(s.session_id) ?? "Session"} — ${s.type} semester${s.is_current ? " (current)" : ""}`,
      is_current: s.is_current,
    }));
  }, [struct]);

  const effectiveSemester = semesterId || semesters.find((s) => s.is_current)?.id || semesters[0]?.id || "";

  const { data, isLoading } = useQuery({
    queryKey: ["result-cycle", effectiveSemester],
    queryFn: () => overviewFn({ data: { semester_id: effectiveSemester } }),
    enabled: !!effectiveSemester,
    staleTime: 15_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["result-cycle"] });

  const create = useMutation({
    mutationFn: (v: { course_ids: string[] }) => createFn({ data: { semester_id: effectiveSemester, course_ids: v.course_ids } }),
    onSuccess: (r: any) => { toast.success(`${r.created} offering(s) opened${r.skipped ? `, ${r.skipped} already existed` : ""}`); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const enrol = useMutation({
    mutationFn: (v: any) => enrolFn({ data: v }),
    onSuccess: (r: any) => { toast.success(`${r.enrolled} student(s) enrolled${r.skipped ? `, ${r.skipped} already enrolled` : ""}`); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const drop = useMutation({
    mutationFn: (offering_id: string) => removeFn({ data: { offering_id } }),
    onSuccess: () => { toast.success("Offering removed"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const offerings = data?.offerings ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Semester Result Cycle"
        description="Open offerings, enrol the cohort, then follow each course from lecturer draft through to publication."
        actions={
          <Select value={effectiveSemester} onValueChange={setSemesterId}>
            <SelectTrigger className="w-[280px]"><SelectValue placeholder="Select semester" /></SelectTrigger>
            <SelectContent>
              {semesters.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm">
          {PIPELINE.map((p, i) => (
            <span key={p} className="flex items-center gap-2">
              <Badge variant={i === PIPELINE.length - 1 ? "default" : "secondary"}>{p}</Badge>
              {i < PIPELINE.length - 1 ? <ArrowRight className="size-3.5 text-muted-foreground" /> : null}
            </span>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">
            Publishing recomputes GPA/CGPA, updates academic standing and notifies each student.
          </span>
        </CardContent>
      </Card>

      <OpenOfferingsCard
        struct={struct}
        existingCourseIds={new Set(offerings.map((o: any) => o.course_id))}
        disabled={!effectiveSemester || create.isPending}
        onOpen={(ids) => create.mutate({ course_ids: ids })}
      />

      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Cycle monitor</CardTitle>
          <CardDescription>{offerings.length} offering(s) in this semester</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : offerings.length === 0 ? (
            <EmptyState
              icon={CalendarRange}
              title="No offerings yet"
              description="Open offerings for this semester's courses to start the cycle."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead>Department / level</TableHead>
                    <TableHead>Lecturer</TableHead>
                    <TableHead className="text-right">Enrolled</TableHead>
                    <TableHead className="text-right">Scores</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offerings.map((o: any) => {
                    const scored = Object.values(o.statusCounts as Record<string, number>).reduce((a, b) => a + b, 0);
                    const stage = STAGE[o.stage] ?? STAGE.in_progress;
                    return (
                      <TableRow key={o.offering_id}>
                        <TableCell>
                          <div className="font-mono text-xs text-muted-foreground">{o.code}</div>
                          <div className="max-w-[240px] truncate font-medium">{o.title}</div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="max-w-[200px] truncate">{o.department_name}</div>
                          <div className="text-xs text-muted-foreground">{o.level_name}</div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {o.lecturers.length === 0 ? (
                            <Link to="/allocations" className="text-xs text-destructive underline">Allocate</Link>
                          ) : (
                            o.lecturers.map((l: any) => (
                              <div key={l.id} className="max-w-[180px] truncate text-xs">{l.name}{l.is_lead ? " (lead)" : ""}</div>
                            ))
                          )}
                        </TableCell>
                        <TableCell className="text-right">{o.enrolled}</TableCell>
                        <TableCell className="text-right">{scored}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={stage.tone}>{stage.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <EnrolDialog
                              struct={struct}
                              offering={o}
                              pending={enrol.isPending}
                              onEnrol={(v) => enrol.mutate({ offering_id: o.offering_id, ...v })}
                            />
                            <Link to="/broadsheet/$offeringId" params={{ offeringId: o.offering_id }}>
                              <Button size="icon" variant="ghost" title="Broadsheet"><FileSpreadsheet className="size-4" /></Button>
                            </Link>
                            {scored === 0 ? (
                              <Button
                                size="icon" variant="ghost" title="Remove offering"
                                onClick={() => drop.mutate(o.offering_id)}
                              >
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function OpenOfferingsCard({
  struct, existingCourseIds, disabled, onOpen,
}: {
  struct: any;
  existingCourseIds: Set<string>;
  disabled: boolean;
  onOpen: (courseIds: string[]) => void;
}) {
  const [dept, setDept] = useState("all");
  const [level, setLevel] = useState("all");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const courses = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (struct?.courses ?? []).filter((c: any) => {
      if (existingCourseIds.has(c.id)) return false;
      if (!c.is_active) return false;
      if (dept !== "all" && c.department_id !== dept) return false;
      if (level !== "all" && c.level_id !== level) return false;
      if (needle && !(`${c.code} ${c.title}`.toLowerCase().includes(needle))) return false;
      return true;
    }).slice(0, 200);
  }, [struct, existingCourseIds, dept, level, q]);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif">1. Open offerings</CardTitle>
        <CardDescription>Select the courses running this semester.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <Select value={dept} onValueChange={setDept}>
            <SelectTrigger><SelectValue placeholder="All departments" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {(struct?.departments ?? []).map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger><SelectValue placeholder="All levels" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              {(struct?.levels ?? []).map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Search course code or title" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
          {courses.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">No unopened courses match these filters.</p>
          ) : courses.map((c: any) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 text-sm hover:bg-muted/60">
              <Checkbox checked={picked.has(c.id)} onCheckedChange={() => toggle(c.id)} />
              <span className="font-mono text-xs text-muted-foreground">{c.code}</span>
              <span className="min-w-0 flex-1 truncate">{c.title}</span>
              <span className="text-xs text-muted-foreground">{c.credit_units} CU</span>
            </label>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">{picked.size} selected</span>
          <Button
            disabled={disabled || picked.size === 0}
            onClick={() => { onOpen(Array.from(picked)); setPicked(new Set()); }}
          >
            <PlusCircle className="mr-2 size-4" /> Open offerings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EnrolDialog({
  struct, offering, pending, onEnrol,
}: {
  struct: any;
  offering: any;
  pending: boolean;
  onEnrol: (v: { programme_id?: string; department_id?: string; level_id?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [programme, setProgramme] = useState("all");
  const [department, setDepartment] = useState(offering.department_id || "all");
  const [level, setLevel] = useState(offering.level_id || "all");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" title="Enrol cohort"><Users className="size-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif">Enrol cohort — {offering.code}</DialogTitle>
          <DialogDescription>
            Active students matching these filters are registered for this course as approved registrations.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger><SelectValue placeholder="Any department" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any department</SelectItem>
              {(struct?.departments ?? []).map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={programme} onValueChange={setProgramme}>
            <SelectTrigger><SelectValue placeholder="Any programme" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any programme</SelectItem>
              {(struct?.programmes ?? [])
                .filter((p: any) => department === "all" || p.department_id === department)
                .map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger><SelectValue placeholder="Any level" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any level</SelectItem>
              {(struct?.levels ?? []).map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button
            disabled={pending || (programme === "all" && department === "all" && level === "all")}
            onClick={() => {
              onEnrol({
                programme_id: programme !== "all" ? programme : undefined,
                department_id: department !== "all" ? department : undefined,
                level_id: level !== "all" ? level : undefined,
              });
              setOpen(false);
            }}
          >
            Enrol students
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
