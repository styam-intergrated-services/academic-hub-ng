import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getImportContext,
  runBulkResultImport,
  type ImportReport,
  type ImportRow,
} from "@/lib/bulk-results.functions";
import { PageHeader } from "@/components/portal/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toCsv, downloadCsv } from "@/lib/csv";
import { readTabularFile } from "@/lib/sheet-import";

import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Play, Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/bulk-results")({
  head: () => ({
    meta: [
      { title: "Bulk Result Upload — AKCOE Portal" },
      { name: "description", content: "Import a department score sheet into the results archive in bulk." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BulkResultsPage,
});

const TEMPLATE_HEADER = [
  "matric_number", "course_code", "course_title", "credit_units",
  "category", "contact_no", "score", "ca", "exam", "status_code",
];

function BulkResultsPage() {
  const ctxFn = useServerFn(getImportContext);
  const runFn = useServerFn(runBulkResultImport);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: ctx } = useQuery({ queryKey: ["bulk-import", "context"], queryFn: () => ctxFn() });

  const [sessionName, setSessionName] = useState("");
  const [publish, setPublish] = useState(true);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportReport | null>(null);
  const [committed, setCommitted] = useState<ImportReport | null>(null);

  const dryRun = useMutation({
    mutationFn: () => runFn({ data: { session_name: sessionName, publish, dry_run: true, rows } }),
    onSuccess: (r) => { setPreview(r); setCommitted(null); toast.success("Preview complete — nothing saved yet"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const commit = useMutation({
    mutationFn: () => runFn({ data: { session_name: sessionName, publish, dry_run: false, rows } }),
    onSuccess: (r) => { setCommitted(r); toast.success(`Imported ${r.results_created + r.results_updated} results`); },
    onError: (e: Error) => toast.error(e.message),
  });

  const ready = sessionName.trim().length > 0 && rows.length > 0;

  async function handleFile(file: File) {
    try {
      const tables = await readTabularFile(file);
      if (tables.length === 0) {
        toast.error("No table found in that file");
        return;
      }
      const all: ImportRow[] = [];
      const errs: string[] = [];
      for (const t of tables) {
        const { rows: parsed, errors } = parseSheet(t.table);
        if (parsed.length === 0 && tables.length > 1) continue; // skip non-score sheets
        all.push(...parsed);
        errs.push(...errors.map((e) => (tables.length > 1 ? `${t.name}: ${e}` : e)));
      }
      setRows(all);
      setParseErrors(errs);
      setFileName(file.name);
      setPreview(null);
      setCommitted(null);
      if (all.length) toast.success(`${all.length} rows read from ${file.name}`);
      else toast.error("No usable rows found in that file");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }


  function downloadTemplate() {
    downloadCsv(
      "akcoe-result-upload-template.csv",
      toCsv([
        TEMPLATE_HEADER,
        ["FUDMA/AKCOE/22/SOC/0211", "SOC211", "Introduction to Sociology", 2, "subject_major", 1, 62, "", "", "OK"],
        ["FUDMA/AKCOE/22/SOC/0232", "SOC211", "Introduction to Sociology", 2, "subject_major", 1, "", 30, 45, "OK"],
      ])
    );
  }

  const sample = useMemo(() => rows.slice(0, 12), [rows]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bulk Result Upload"
        description="Import a department score sheet (CSV, Excel .xlsx or Word .docx) for any programme. Always preview first — nothing is written until you commit."
        actions={
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="mr-2 size-4" /> CSV template
          </Button>
        }
      />

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>How matching works</AlertTitle>
        <AlertDescription className="text-sm">
          Students are matched by <strong>matric number</strong> — the student record must already exist.
          Courses are matched by <strong>course code</strong> within that student's department and created
          automatically if new. Give either a single <code>score</code> (0–100, split into CA/Exam behind
          the scenes) or explicit <code>ca</code> (≤40) and <code>exam</code> (≤60). Use{" "}
          <code>contact_no</code> for the semester/contact number and <code>status_code</code> for
          OK / ABS / INC / WH.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif">1 · Session and file</CardTitle>
          <CardDescription>
            {ctx ? `${ctx.studentCount.toLocaleString()} student records available for matching` : "Loading…"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="session">Academic session</Label>
            <Input
              id="session"
              list="known-sessions"
              placeholder="e.g. 2024/2025 Academic Session"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
            />
            <datalist id="known-sessions">
              {(ctx?.sessions ?? []).map((s) => <option key={s} value={s} />)}
            </datalist>
            <p className="text-xs text-muted-foreground">
              Existing sessions are reused; a new name creates an archived session.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Score sheet (CSV, Excel or Word)</Label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls,.xlsm,.docx,text/csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ""; }}
            />
            <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-2 size-4" />
              {fileName ?? "Choose .csv, .xlsx or .docx file"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Excel workbooks: every sheet that looks like a score sheet is read. Word files: data is read
              from the document's tables.
            </p>

            {rows.length > 0 ? (
              <p className="text-xs text-muted-foreground">{rows.length.toLocaleString()} rows ready</p>
            ) : null}
          </div>

          <div className="flex items-center justify-between rounded-md border p-3 sm:col-span-2">
            <div>
              <div className="text-sm font-medium">Publish immediately</div>
              <p className="text-xs text-muted-foreground">
                On: historical records go straight to Published and recompute CGPA. Off: rows land as Draft
                and follow the normal HOD → Dean → Registry approval route.
              </p>
            </div>
            <Switch checked={publish} onCheckedChange={setPublish} />
          </div>
        </CardContent>
      </Card>

      {parseErrors.length > 0 ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{parseErrors.length} rows skipped while reading the file</AlertTitle>
          <AlertDescription className="max-h-40 overflow-y-auto text-xs">
            {parseErrors.slice(0, 25).map((e, i) => <div key={i}>{e}</div>)}
          </AlertDescription>
        </Alert>
      ) : null}

      {sample.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Preview of file contents</CardTitle>
            <CardDescription>First {sample.length} of {rows.length.toLocaleString()} rows</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matric no</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead className="text-right">CU</TableHead>
                  <TableHead className="text-right">Contact</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">CA</TableHead>
                  <TableHead className="text-right">Exam</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sample.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{r.matric_number}</TableCell>
                    <TableCell>{r.course_code}</TableCell>
                    <TableCell className="text-right">{r.credit_units ?? "—"}</TableCell>
                    <TableCell className="text-right">{r.contact_no ?? 1}</TableCell>
                    <TableCell className="text-right">{r.score ?? "—"}</TableCell>
                    <TableCell className="text-right">{r.ca ?? "—"}</TableCell>
                    <TableCell className="text-right">{r.exam ?? "—"}</TableCell>
                    <TableCell>{r.status_code ?? "OK"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="font-serif">2 · Preview, then commit</CardTitle>
          <CardDescription>The preview reports every problem row without saving anything.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={() => dryRun.mutate()} disabled={!ready || dryRun.isPending}>
            {dryRun.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FileSpreadsheet className="mr-2 size-4" />}
            Preview import
          </Button>
          <Button
            variant="default"
            onClick={() => commit.mutate()}
            disabled={!ready || !preview || commit.isPending}
          >
            {commit.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Play className="mr-2 size-4" />}
            Commit import
          </Button>
        </CardContent>
      </Card>

      {preview && !committed ? <Report title="Preview (nothing saved)" report={preview} /> : null}
      {committed ? <Report title="Import complete" report={committed} done /> : null}
    </div>
  );
}

function Report({ title, report, done }: { title: string; report: ImportReport; done?: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {done ? <CheckCircle2 className="size-4 text-primary" /> : <FileSpreadsheet className="size-4" />}
          {title}
        </CardTitle>
        <CardDescription>{report.session_name}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{report.rows_read.toLocaleString()} rows read</Badge>
          <Badge variant="outline">{report.results_created.toLocaleString()} results {done ? "created" : "to create"}</Badge>
          <Badge variant="outline">{report.results_updated.toLocaleString()} updated</Badge>
          <Badge variant="outline">{report.courses_created} courses</Badge>
          <Badge variant="outline">{report.offerings_created} offerings</Badge>
          <Badge variant="outline">{report.registrations_created} enrolments</Badge>
          <Badge variant={report.errors.length ? "destructive" : "outline"}>
            {report.errors.length} problem rows
          </Badge>
        </div>

        {report.errors.length > 0 ? (
          <div className="max-h-72 overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Row</TableHead>
                  <TableHead>Matric no</TableHead>
                  <TableHead>Problem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.errors.map((e, i) => (
                  <TableRow key={i}>
                    <TableCell>{e.row}</TableCell>
                    <TableCell className="font-mono text-xs">{e.matric_number ?? "—"}</TableCell>
                    <TableCell className="text-sm">{e.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* ---------- sheet parsing (CSV / Excel / Word tables) ---------- */

function parseSheet(input: string[][]): { rows: ImportRow[]; errors: string[] } {
  const table = input.filter((r) => r.some((c) => (c ?? "").trim() !== ""));
  if (table.length < 2) return { rows: [], errors: ["File has no data rows"] };

  const header = table[0].map((h) => (h ?? "").trim().toLowerCase().replace(/\s+/g, "_"));

  const idx = (...names: string[]) => {
    for (const n of names) { const i = header.indexOf(n); if (i >= 0) return i; }
    return -1;
  };
  const cols = {
    matric: idx("matric_number", "matric_no", "matric", "matricno"),
    code: idx("course_code", "course", "code"),
    title: idx("course_title", "title"),
    units: idx("credit_units", "credit_unit", "cu", "units"),
    category: idx("category"),
    contact: idx("contact_no", "contact", "semester", "semester_no"),
    score: idx("score", "total", "total_score"),
    ca: idx("ca", "ca_score"),
    exam: idx("exam", "exam_score"),
    status: idx("status_code", "status", "remark"),
  };

  const errors: string[] = [];
  if (cols.matric < 0) errors.push("Missing a matric_number column");
  if (cols.code < 0) errors.push("Missing a course_code column");
  if (errors.length) return { rows: [], errors };

  const num = (v: string | undefined) => {
    const s = (v ?? "").trim();
    if (s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  const rows: ImportRow[] = [];
  for (let i = 1; i < table.length; i++) {
    const r = table[i];
    const matric = (r[cols.matric] ?? "").trim();
    const code = (r[cols.code] ?? "").trim();
    if (!matric && !code) continue;
    if (!matric || !code) { errors.push(`Line ${i + 1}: matric number and course code are both required`); continue; }
    rows.push({
      matric_number: matric,
      course_code: code,
      course_title: cols.title >= 0 ? (r[cols.title] ?? "").trim() || null : null,
      credit_units: cols.units >= 0 ? num(r[cols.units]) : null,
      category: cols.category >= 0 ? (r[cols.category] ?? "").trim() || null : null,
      contact_no: cols.contact >= 0 ? num(r[cols.contact]) : null,
      score: cols.score >= 0 ? num(r[cols.score]) : null,
      ca: cols.ca >= 0 ? num(r[cols.ca]) : null,
      exam: cols.exam >= 0 ? num(r[cols.exam]) : null,
      status_code: cols.status >= 0 ? (r[cols.status] ?? "").trim().toUpperCase() || null : null,
    });
  }
  return { rows, errors };
}
