import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { getMyTeaching, getOfferingRoster, upsertResult, upsertResultsBulk, submitResults } from "@/lib/results.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Save, Send, Download, Upload, AlertCircle } from "lucide-react";
import { parseCsv, toCsv, downloadCsv } from "@/lib/csv";

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

const EDITABLE_STATUSES = new Set(["draft","hod_rejected","dean_rejected","registry_rejected"]);

function RosterEditor({ offeringId }: { offeringId: string }) {
  const qc = useQueryClient();
  const rosterFn = useServerFn(getOfferingRoster);
  const upsert = useServerFn(upsertResult);
  const bulk = useServerFn(upsertResultsBulk);
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

  const bulkMut = useMutation({
    mutationFn: (rows: any[]) => bulk({ data: { offering_id: offeringId, rows } }),
    onSuccess: (r: any) => {
      toast.success(`Saved ${r.written} row${r.written === 1 ? "" : "s"}${r.skipped ? ` · ${r.skipped} skipped (locked)` : ""}`);
      qc.invalidateQueries({ queryKey: ["roster", offeringId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Bulk import failed"),
  });

  const rows = data ?? [];
  const rejected = rows.filter((r: any) => r.result?.[0]?.rejection_reason && EDITABLE_STATUSES.has(r.result[0].status));

  return (
    <div className="space-y-4">
      {rejected.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{rejected.length} row{rejected.length === 1 ? "" : "s"} sent back for revision</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 text-sm list-disc list-inside space-y-0.5">
              {rejected.slice(0, 5).map((r: any) => (
                <li key={r.id}>
                  <span className="font-mono">{r.student?.matric_number}</span> — {r.result[0].rejection_reason}
                </li>
              ))}
              {rejected.length > 5 && <li className="text-muted-foreground">…and {rejected.length - 5} more</li>}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="font-serif">Class roster</CardTitle>
            <CardDescription>Only approved registrations appear here</CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            <ImportExportBar rows={rows} onImport={(payload) => bulkMut.mutate(payload)} pending={bulkMut.isPending} offeringId={offeringId} />
            <Button onClick={() => submitMut.mutate()} disabled={submitMut.isPending} className="bg-primary text-primary-foreground">
              <Send className="h-4 w-4 mr-2" />Submit for approval
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-40" /> : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No students registered yet.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Matric</TableHead><TableHead>Name</TableHead>
                <TableHead>CA (0-40)</TableHead><TableHead>Exam (0-60)</TableHead>
                <TableHead>Total</TableHead><TableHead>Grade</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((row: any) => {
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
    </div>
  );
}

type FixableRow = {
  rowNumber: number;
  matric: string;
  registrationId: string;
  studentId: string;
  studentName: string;
  ca: string;
  exam: string;
  error: string;
};
type HardError = { rowNumber: number; matric: string; reason: string };
type PendingImport = {
  toWrite: Array<{ registration_id: string; student_id: string; ca_score: number | null; exam_score: number | null; rowNumber: number }>;
  fixable: FixableRow[];
  hardErrors: HardError[];
  skippedLocked: number;
  totalRows: number;
};

function validateFixable(f: FixableRow): string | null {
  const caRaw = f.ca.trim(); const examRaw = f.exam.trim();
  const ca = caRaw === "" ? null : Number(caRaw);
  const exam = examRaw === "" ? null : Number(examRaw);
  if (ca !== null && (!Number.isFinite(ca) || ca < 0 || ca > 40)) return "CA out of range (0–40)";
  if (exam !== null && (!Number.isFinite(exam) || exam < 0 || exam > 60)) return "Exam out of range (0–60)";
  if (ca === null && exam === null) return "At least one score required";
  return null;
}

function ImportExportBar({ rows, onImport, pending, offeringId }: { rows: any[]; onImport: (payload: any[]) => void; pending: boolean; offeringId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<PendingImport | null>(null);

  function exportTemplate() {
    const header = ["matric_number", "full_name", "ca_score", "exam_score", "status"];
    const body = rows.map((row: any) => {
      const r = row.result?.[0];
      return [
        row.student?.matric_number ?? "",
        row.student?.profile?.full_name ?? "",
        r?.ca_score ?? "",
        r?.exam_score ?? "",
        r?.status ?? "empty",
      ];
    });
    downloadCsv(`roster-${offeringId.slice(0,8)}.csv`, toCsv([header, ...body]));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length < 2) { toast.error("CSV appears empty."); return; }
    const header = parsed[0].map((h) => h.trim().toLowerCase());
    const iMatric = header.indexOf("matric_number");
    const iCa = header.indexOf("ca_score");
    const iExam = header.indexOf("exam_score");
    if (iMatric < 0 || iCa < 0 || iExam < 0) {
      toast.error("CSV must include matric_number, ca_score, exam_score columns.");
      return;
    }

    const byMatric = new Map<string, any>();
    for (const row of rows) byMatric.set(String(row.student?.matric_number ?? "").trim(), row);

    const toWrite: PendingImport["toWrite"] = [];
    const fixable: FixableRow[] = [];
    const hardErrors: HardError[] = [];
    const seen = new Set<string>();
    let skippedLocked = 0;
    let totalRows = 0;

    for (let i = 1; i < parsed.length; i++) {
      const line = parsed[i];
      if (line.every((c) => c.trim() === "")) continue;
      totalRows++;
      const rowNumber = i + 1;
      const matric = (line[iMatric] ?? "").trim();
      if (!matric) { hardErrors.push({ rowNumber, matric: "", reason: "Missing matric_number" }); continue; }
      if (seen.has(matric)) { hardErrors.push({ rowNumber, matric, reason: "Duplicate matric in CSV" }); continue; }
      seen.add(matric);
      const target = byMatric.get(matric);
      if (!target) { hardErrors.push({ rowNumber, matric, reason: "Not in this roster" }); continue; }

      const existing = target.result?.[0];
      if (existing && !EDITABLE_STATUSES.has(existing.status)) { skippedLocked++; continue; }

      const caRaw = (line[iCa] ?? "").trim();
      const examRaw = (line[iExam] ?? "").trim();
      const draft: FixableRow = {
        rowNumber, matric,
        registrationId: target.id,
        studentId: target.student_id,
        studentName: target.student?.profile?.full_name ?? "",
        ca: caRaw, exam: examRaw, error: "",
      };
      const err = validateFixable(draft);
      if (err) { draft.error = err; fixable.push(draft); continue; }

      toWrite.push({
        registration_id: target.id,
        student_id: target.student_id,
        ca_score: caRaw === "" ? null : Number(caRaw),
        exam_score: examRaw === "" ? null : Number(examRaw),
        rowNumber,
      });
    }

    setState({ toWrite, fixable, hardErrors, skippedLocked, totalRows });
  }

  function editFixable(idx: number, patch: Partial<FixableRow>) {
    setState((s) => {
      if (!s) return s;
      const next = [...s.fixable];
      const merged = { ...next[idx], ...patch };
      merged.error = validateFixable(merged) ?? "";
      next[idx] = merged;
      return { ...s, fixable: next };
    });
  }

  function recheck() {
    setState((s) => {
      if (!s) return s;
      const stillFixable: FixableRow[] = [];
      const newlyValid: PendingImport["toWrite"] = [];
      for (const f of s.fixable) {
        const err = validateFixable(f);
        if (err) { stillFixable.push({ ...f, error: err }); continue; }
        newlyValid.push({
          registration_id: f.registrationId,
          student_id: f.studentId,
          ca_score: f.ca.trim() === "" ? null : Number(f.ca),
          exam_score: f.exam.trim() === "" ? null : Number(f.exam),
          rowNumber: f.rowNumber,
        });
      }
      const promoted = newlyValid.length;
      if (promoted > 0) toast.success(`Fixed ${promoted} row${promoted === 1 ? "" : "s"}`);
      else if (stillFixable.length > 0) toast.error("Some rows still have errors");
      return { ...s, fixable: stillFixable, toWrite: [...s.toWrite, ...newlyValid] };
    });
  }

  function confirmImport() {
    if (!state) return;
    onImport(state.toWrite.map(({ rowNumber: _n, ...rest }) => rest));
    setState(null);
  }

  const blockedByErrors = (state?.fixable.length ?? 0) > 0;

  return (
    <>
      <Button variant="outline" size="sm" onClick={exportTemplate} disabled={rows.length === 0}>
        <Download className="h-4 w-4 mr-2" />Export CSV
      </Button>
      <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={pending}>
        <Upload className="h-4 w-4 mr-2" />Import CSV
      </Button>
      <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onFile} />

      <Dialog open={!!state} onOpenChange={(o) => !o && setState(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review CSV import</DialogTitle>
            <DialogDescription>
              Fix invalid rows below and click <span className="font-medium">Re-check</span>, then import.
              All imported rows are saved as <span className="font-medium">draft</span>.
            </DialogDescription>
          </DialogHeader>
          {state && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatPill label="Rows in file" value={state.totalRows} tone="muted" />
                <StatPill label="Ready to write" value={state.toWrite.length} tone="ok" />
                <StatPill label="Need fixes" value={state.fixable.length} tone={state.fixable.length ? "err" : "muted"} />
                <StatPill label="Locked (skipped)" value={state.skippedLocked} tone="warn" />
              </div>

              {state.fixable.length > 0 && (
                <div className="rounded-md border">
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b">
                    <div className="font-medium">Fixable errors ({state.fixable.length})</div>
                    <Button size="sm" variant="secondary" onClick={recheck}>Re-check</Button>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y">
                    {state.fixable.map((f, idx) => (
                      <div key={`${f.rowNumber}-${f.matric}`} className="grid grid-cols-[auto,1fr,auto,auto] items-center gap-2 px-3 py-2">
                        <span className="text-[11px] text-muted-foreground tabular-nums">L{f.rowNumber}</span>
                        <div className="min-w-0">
                          <div className="font-mono text-xs">{f.matric}</div>
                          <div className="text-xs text-muted-foreground truncate">{f.studentName}</div>
                          {f.error && <div className="text-[11px] text-rose-600">{f.error}</div>}
                        </div>
                        <Input value={f.ca} onChange={(e) => editFixable(idx, { ca: e.target.value })}
                          type="number" min={0} max={40} step={0.5} placeholder="CA" className="w-20" />
                        <Input value={f.exam} onChange={(e) => editFixable(idx, { exam: e.target.value })}
                          type="number" min={0} max={60} step={0.5} placeholder="Exam" className="w-20" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {state.hardErrors.length > 0 && (
                <div className="rounded-md border">
                  <div className="px-3 py-2 bg-muted/40 border-b font-medium">
                    Unfixable rows ({state.hardErrors.length}) — skipped
                  </div>
                  <div className="max-h-40 overflow-y-auto text-xs">
                    {state.hardErrors.slice(0, 40).map((e) => (
                      <div key={`${e.rowNumber}-${e.matric}`} className="px-3 py-1.5 border-b last:border-0">
                        <span className="text-muted-foreground">L{e.rowNumber}</span>{" "}
                        <span className="font-mono">{e.matric || "—"}</span>{" · "}
                        <span className="text-rose-600">{e.reason}</span>
                      </div>
                    ))}
                    {state.hardErrors.length > 40 && (
                      <div className="px-3 py-1.5 text-muted-foreground">…and {state.hardErrors.length - 40} more</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setState(null)}>Cancel</Button>
            <Button onClick={confirmImport} disabled={!state || state.toWrite.length === 0 || pending || blockedByErrors}
              title={blockedByErrors ? "Resolve all fixable errors first" : undefined}>
              Import {state ? state.toWrite.length : 0} row{state?.toWrite.length === 1 ? "" : "s"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatPill({ label, value, tone }: { label: string; value: number; tone: "ok" | "warn" | "err" | "muted" }) {
  const map: Record<string, string> = {
    ok: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    warn: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    err: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
    muted: "bg-muted text-muted-foreground border-border",
  };
  return (
    <div className={`rounded-md border px-3 py-2 ${map[tone]}`}>
      <div className="text-[10px] uppercase tracking-widest">{label}</div>
      <div className="mt-0.5 font-serif text-lg font-bold">{value}</div>
    </div>
  );
}

function ScoreRow({ row, existing, offeringId, onSave }: any) {
  const [ca, setCa] = useState<string>(existing?.ca_score?.toString() ?? "");
  const [exam, setExam] = useState<string>(existing?.exam_score?.toString() ?? "");
  const locked = existing && !EDITABLE_STATUSES.has(existing.status);
  const total = (Number(ca) || 0) + (Number(exam) || 0);
  return (
    <TableRow>
      <TableCell className="font-mono">{row.student?.matric_number}</TableCell>
      <TableCell>
        {row.student?.profile?.full_name}
        {existing?.rejection_reason && !locked && (
          <div className="text-[11px] text-rose-600 mt-0.5">↺ {existing.rejection_reason}</div>
        )}
      </TableCell>
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
