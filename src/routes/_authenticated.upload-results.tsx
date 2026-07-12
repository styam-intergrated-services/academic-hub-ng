import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getMyTeaching, getOfferingRoster, upsertResult, submitResults } from "@/lib/results.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Save, Send } from "lucide-react";

export const Route = createFileRoute("/_authenticated/upload-results")({
  component: UploadResults,
});

function UploadResults() {
  const teachingFn = useServerFn(getMyTeaching);
  const { data: teaching, isLoading } = useQuery({ queryKey: ["teaching"], queryFn: () => teachingFn() });
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl text-primary">Upload Results</h2>
        <p className="text-sm text-muted-foreground">Enter CA (max 40) and Exam (max 60). Grades compute automatically. Submit to send for HOD approval.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="font-serif">My teaching load</CardTitle><CardDescription>Select a course to enter scores</CardDescription></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-32" /> : (teaching?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">You have no course assignments this semester.</p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {teaching?.map((t: any) => {
                const o = t.offering;
                const active = selected === o.id;
                return (
                  <button key={o.id} onClick={() => setSelected(o.id)} className={`text-left rounded-lg border p-4 transition-colors ${active ? "border-primary bg-primary/5" : "hover:bg-muted"}`}>
                    <div className="font-mono text-xs text-muted-foreground">{o.course.code}</div>
                    <div className="font-medium">{o.course.title}</div>
                    <div className="mt-1 flex gap-2 text-xs text-muted-foreground">
                      <span>{o.course.credit_units} units</span>
                      <span>•</span>
                      <span className="capitalize">{o.semester.type} — {o.semester.session?.name}</span>
                    </div>
                    {t.is_lead && <Badge className="mt-2" variant="secondary">Lead</Badge>}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && <RosterEditor offeringId={selected} />}
    </div>
  );
}

function RosterEditor({ offeringId }: { offeringId: string }) {
  const qc = useQueryClient();
  const rosterFn = useServerFn(getOfferingRoster);
  const upsert = useServerFn(upsertResult);
  const submit = useServerFn(submitResults);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["roster", offeringId],
    queryFn: () => rosterFn({ data: { offering_id: offeringId } }),
  });

  const upsertMut = useMutation({
    mutationFn: (v: any) => upsert({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["roster", offeringId] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save"),
  });

  const submitMut = useMutation({
    mutationFn: () => submit({ data: { offering_id: offeringId } }),
    onSuccess: () => { toast.success("Submitted for HOD approval"); refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Submit failed"),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="font-serif">Class roster</CardTitle>
          <CardDescription>Only approved registrations appear here</CardDescription>
        </div>
        <Button onClick={() => submitMut.mutate()} disabled={submitMut.isPending} className="bg-primary text-primary-foreground">
          <Send className="h-4 w-4 mr-2" />Submit for approval
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-40" /> : (data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No students registered yet.</p>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Matric</TableHead><TableHead>Name</TableHead>
              <TableHead>CA (0-40)</TableHead><TableHead>Exam (0-60)</TableHead>
              <TableHead>Total</TableHead><TableHead>Grade</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data?.map((row: any) => {
                const r = row.result?.[0];
                return (
                  <ScoreRow key={row.id} row={row} existing={r} offeringId={offeringId} onSave={(v: any) => upsertMut.mutate(v)} />
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ScoreRow({ row, existing, offeringId, onSave }: any) {
  const [ca, setCa] = useState<string>(existing?.ca_score?.toString() ?? "");
  const [exam, setExam] = useState<string>(existing?.exam_score?.toString() ?? "");
  const locked = existing && !["draft","hod_rejected","dean_rejected","registry_rejected"].includes(existing.status);
  const total = (Number(ca) || 0) + (Number(exam) || 0);
  return (
    <TableRow>
      <TableCell className="font-mono">{row.student?.matric_number}</TableCell>
      <TableCell>{row.student?.profile?.full_name}</TableCell>
      <TableCell><Input value={ca} onChange={(e) => setCa(e.target.value)} type="number" min={0} max={40} step={0.5} disabled={locked} className="w-24" /></TableCell>
      <TableCell><Input value={exam} onChange={(e) => setExam(e.target.value)} type="number" min={0} max={60} step={0.5} disabled={locked} className="w-24" /></TableCell>
      <TableCell>{ca || exam ? total.toFixed(1) : "—"}</TableCell>
      <TableCell>{existing?.grade ?? "—"}</TableCell>
      <TableCell>
        {existing ? <Badge variant="secondary" className="capitalize">{existing.status.replace("_"," ")}</Badge> : <Badge variant="outline">Empty</Badge>}
        {!locked && (
          <Button size="sm" variant="ghost" className="ml-2" onClick={() =>
            onSave({
              registration_id: row.id,
              student_id: row.student_id,
              offering_id: offeringId,
              ca_score: ca === "" ? null : Number(ca),
              exam_score: exam === "" ? null : Number(exam),
            })
          }><Save className="h-3 w-3 mr-1" />Save</Button>
        )}
      </TableCell>
    </TableRow>
  );
}
