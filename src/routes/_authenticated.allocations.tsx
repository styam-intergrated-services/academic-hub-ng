import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listOfferingsForAllocation,
  searchStaff,
  allocateLecturer,
  removeLecturerAllocation,
} from "@/lib/exams.functions";
import { listAcademicStructure } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { X, UserPlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/allocations")({
  component: AllocationsPage,
});

function AllocationsPage() {
  const qc = useQueryClient();
  const loadStruct = useServerFn(listAcademicStructure);
  const loadOfferings = useServerFn(listOfferingsForAllocation);
  const staffFn = useServerFn(searchStaff);
  const allocFn = useServerFn(allocateLecturer);
  const removeFn = useServerFn(removeLecturerAllocation);

  const { data: struct } = useQuery({ queryKey: ["academic-structure"], queryFn: () => loadStruct(), staleTime: 60_000 });
  const [semesterId, setSemesterId] = useState<string>("");
  const [staffSearch, setStaffSearch] = useState("");

  const { data: offerings, isLoading } = useQuery({
    queryKey: ["alloc-offerings", semesterId],
    queryFn: () => loadOfferings({ data: semesterId ? { semester_id: semesterId } : {} }),
    enabled: !!struct,
  });

  const { data: staff } = useQuery({
    queryKey: ["staff-search", staffSearch],
    queryFn: () => staffFn({ data: { search: staffSearch } }),
    staleTime: 30_000,
  });

  const semesters = useMemo(
    () =>
      (struct?.semesters ?? []).map((s: any) => ({
        id: s.id,
        label: `${struct?.sessions.find((x: any) => x.id === s.session_id)?.name ?? ""} — ${s.type}`,
      })),
    [struct]
  );

  const alloc = useMutation({
    mutationFn: (v: { offering_id: string; lecturer_id: string; is_lead: boolean }) => allocFn({ data: v }),
    onSuccess: () => { toast.success("Lecturer allocated"); qc.invalidateQueries({ queryKey: ["alloc-offerings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (v: { offering_id: string; lecturer_id: string }) => removeFn({ data: v }),
    onSuccess: () => { toast.success("Allocation removed"); qc.invalidateQueries({ queryKey: ["alloc-offerings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl text-primary">Course Allocation</h2>
        <p className="text-sm text-muted-foreground">Assign lecturers to course offerings. Mark one lecturer as lead per offering.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Filter</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-3">
          <Select value={semesterId} onValueChange={setSemesterId}>
            <SelectTrigger className="md:w-96"><SelectValue placeholder="All semesters" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All semesters</SelectItem>
              {semesters.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Search staff by name or email…" value={staffSearch} onChange={(e) => setStaffSearch(e.target.value)} className="md:w-96" />
        </CardContent>
      </Card>

      {isLoading ? <Skeleton className="h-64" /> : (
        <div className="space-y-4">
          {(offerings ?? []).length === 0 && (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No offerings.</CardContent></Card>
          )}
          {(offerings ?? []).map((o: any) => (
            <OfferingCard
              key={o.id}
              offering={o}
              staff={(staff ?? []).filter((p: any) => !o.lecturers?.some((l: any) => l.lecturer_id === p.id))}
              onAllocate={(lecturer_id, is_lead) => alloc.mutate({ offering_id: o.id, lecturer_id, is_lead })}
              onRemove={(lecturer_id) => remove.mutate({ offering_id: o.id, lecturer_id })}
              busy={alloc.isPending || remove.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OfferingCard({
  offering, staff, onAllocate, onRemove, busy,
}: {
  offering: any; staff: any[];
  onAllocate: (id: string, isLead: boolean) => void;
  onRemove: (id: string) => void;
  busy: boolean;
}) {
  const [pick, setPick] = useState("");
  const [lead, setLead] = useState(false);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-base">
          {offering.course?.code} — {offering.course?.title}
        </CardTitle>
        <CardDescription>
          {offering.semester?.session?.name} · {offering.semester?.type} semester · {offering.course?.credit_units} units
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {(offering.lecturers ?? []).length === 0 && (
            <span className="text-xs text-muted-foreground">No lecturers allocated yet.</span>
          )}
          {(offering.lecturers ?? []).map((l: any) => (
            <Badge key={l.lecturer_id} variant={l.is_lead ? "default" : "secondary"} className="gap-1">
              {l.profile?.full_name ?? l.profile?.email ?? l.lecturer_id.slice(0, 8)}
              {l.is_lead && <span className="text-[10px] uppercase">Lead</span>}
              <button onClick={() => onRemove(l.lecturer_id)} disabled={busy} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex flex-col md:flex-row gap-2">
          <Select value={pick} onValueChange={setPick}>
            <SelectTrigger className="md:w-80"><SelectValue placeholder="Select staff to allocate" /></SelectTrigger>
            <SelectContent>
              {staff.length === 0
                ? <SelectItem value="none" disabled>No matching staff</SelectItem>
                : staff.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>)
              }
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={lead} onCheckedChange={(v) => setLead(!!v)} /> Mark as lead
          </label>
          <Button
            disabled={!pick || busy}
            onClick={() => { if (pick) { onAllocate(pick, lead); setPick(""); setLead(false); } }}
          >
            <UserPlus className="h-4 w-4 mr-2" /> Allocate
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
