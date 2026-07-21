import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  evaluateFinalYearEligibility,
  listGraduationLists,
  createGraduationList,
  addEligibleToList,
  listGraduationEntries,
  listAcademicSessionsForGraduation,
} from "@/lib/graduation.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, GraduationCap, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/graduation")({
  component: GraduationPage,
  head: () => ({
    meta: [
      { title: "Graduation Lists — AKCOE" },
      { name: "description", content: "Registry graduation eligibility, candidate lists and classification." },
    ],
  }),
});

function GraduationPage() {
  const qc = useQueryClient();
  const loadSessions = useServerFn(listAcademicSessionsForGraduation);
  const loadLists = useServerFn(listGraduationLists);
  const evaluate = useServerFn(evaluateFinalYearEligibility);
  const createList = useServerFn(createGraduationList);
  const addEligible = useServerFn(addEligibleToList);
  const loadEntries = useServerFn(listGraduationEntries);

  const sessionsQ = useQuery({ queryKey: ["grad", "sessions"], queryFn: () => loadSessions() });
  const listsQ = useQuery({ queryKey: ["grad", "lists"], queryFn: () => loadLists() });

  const [sessionId, setSessionId] = useState<string>("");
  const [title, setTitle] = useState<string>("Provisional Graduation List");
  const [selectedList, setSelectedList] = useState<string>("");

  const evalQ = useQuery({
    queryKey: ["grad", "eligibility", sessionId],
    queryFn: () => evaluate({ data: { session_id: sessionId } }),
    enabled: !!sessionId,
  });

  const entriesQ = useQuery({
    queryKey: ["grad", "entries", selectedList],
    queryFn: () => loadEntries({ data: { list_id: selectedList } }),
    enabled: !!selectedList,
  });

  const createMut = useMutation({
    mutationFn: () => createList({ data: { session_id: sessionId, title } }),
    onSuccess: (r: any) => {
      toast.success("List created");
      qc.invalidateQueries({ queryKey: ["grad", "lists"] });
      setSelectedList(r.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMut = useMutation({
    mutationFn: () => addEligible({ data: { list_id: selectedList, session_id: sessionId } }),
    onSuccess: (r: any) => {
      toast.success(`Added ${r.added} eligible student(s)`);
      qc.invalidateQueries({ queryKey: ["grad", "entries", selectedList] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const eligibleCount = (evalQ.data?.students ?? []).filter((s: any) => s.eligibility?.eligible).length;
  const ineligible = (evalQ.data?.students ?? []).filter((s: any) => !s.eligibility?.eligible);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl text-primary flex items-center gap-2"><GraduationCap className="h-5 w-5" /> Graduation Management</h2>
        <p className="text-sm text-muted-foreground">Run eligibility checks against the Academic Brief and build candidate lists per session.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Session & candidate list</CardTitle>
          <CardDescription>Select an academic session, then evaluate final-year students.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label>Session</Label>
              <Select value={sessionId} onValueChange={setSessionId}>
                <SelectTrigger><SelectValue placeholder="Choose session" /></SelectTrigger>
                <SelectContent>
                  {(sessionsQ.data ?? []).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} {s.status === "active" ? "(active)" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>New list title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button disabled={!sessionId || !title || createMut.isPending} onClick={() => createMut.mutate()}>
                <Plus className="h-4 w-4 mr-1" /> Create list
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">Eligibility results</CardTitle>
            <CardDescription>{sessionId ? `${eligibleCount} eligible of ${evalQ.data?.students.length ?? 0} final-year students.` : "Pick a session to evaluate."}</CardDescription>
          </CardHeader>
          <CardContent>
            {!sessionId ? <p className="text-sm text-muted-foreground">—</p> : evalQ.isLoading ? <Skeleton className="h-40" /> : (
              <div className="rounded border overflow-x-auto max-h-[420px] overflow-y-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Matric</TableHead><TableHead>Name</TableHead><TableHead>CGPA</TableHead><TableHead>Class</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(evalQ.data?.students ?? []).map((s: any) => (
                      <TableRow key={s.student_id}>
                        <TableCell className="font-mono text-xs">{s.matric_number}</TableCell>
                        <TableCell>{s.full_name}</TableCell>
                        <TableCell>{Number(s.eligibility?.cgpa ?? 0).toFixed(2)}</TableCell>
                        <TableCell><Badge variant="outline">{s.classification}</Badge></TableCell>
                        <TableCell>
                          {s.eligibility?.eligible
                            ? <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Eligible</Badge>
                            : <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Blocked</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {ineligible.length > 0 && (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-medium">Why blocked ({ineligible.length})</summary>
                <ul className="mt-2 space-y-2 text-xs">
                  {ineligible.map((s: any) => (
                    <li key={s.student_id} className="border-l-2 border-destructive/60 pl-2">
                      <div className="font-medium">{s.matric_number} — {s.full_name}</div>
                      <ul className="list-disc list-inside text-muted-foreground">
                        {(s.eligibility?.reasons ?? []).map((r: string, i: number) => <li key={i}>{r}</li>)}
                      </ul>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">Graduation lists</CardTitle>
            <CardDescription>Select or create a list, then add all currently eligible students.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Existing list</Label>
              <Select value={selectedList} onValueChange={setSelectedList}>
                <SelectTrigger><SelectValue placeholder="Choose list" /></SelectTrigger>
                <SelectContent>
                  {(listsQ.data ?? []).map((l: any) => (
                    <SelectItem key={l.id} value={l.id}>{l.title} — {l.session?.name} ({l.status})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button disabled={!selectedList || !sessionId || addMut.isPending} onClick={() => addMut.mutate()} variant="secondary">
              Add all eligible to this list
            </Button>

            {selectedList && (
              <div className="rounded border overflow-x-auto max-h-[320px] overflow-y-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Matric</TableHead><TableHead>Name</TableHead><TableHead>CGPA</TableHead><TableHead>Class</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(entriesQ.data ?? []).length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">No entries yet.</TableCell></TableRow>
                    ) : (entriesQ.data ?? []).map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-mono text-xs">{e.student?.matric_number}</TableCell>
                        <TableCell>{e.student?.profile?.full_name}</TableCell>
                        <TableCell>{Number(e.cgpa ?? 0).toFixed(2)}</TableCell>
                        <TableCell><Badge variant="outline">{e.classification}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
