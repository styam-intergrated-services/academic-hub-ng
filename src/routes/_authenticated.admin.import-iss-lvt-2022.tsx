import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getIssLvt2022Summary, runIssLvt2022Import } from "@/lib/imports/iss-lvt-2022.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle2, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/import-iss-lvt-2022")({
  component: ImportIssLvt2022,
});

type Result = Awaited<ReturnType<typeof runIssLvt2022Import>>;

function ImportIssLvt2022() {
  const summaryFn = useServerFn(getIssLvt2022Summary);
  const runFn = useServerFn(runIssLvt2022Import);
  const { data: summary, isLoading } = useQuery({
    queryKey: ["iss-lvt-2022-summary"],
    queryFn: () => summaryFn(),
  });
  const [preview, setPreview] = useState<Result | null>(null);
  const [committed, setCommitted] = useState<Result | null>(null);

  const dryRun = useMutation({
    mutationFn: () => runFn({ data: { dry_run: true } }),
    onSuccess: (r) => {
      setPreview(r);
      toast.success("Preview complete");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const commit = useMutation({
    mutationFn: () => runFn({ data: { dry_run: false } }),
    onSuccess: (r) => {
      setCommitted(r);
      toast.success("Import complete");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl text-primary">Import historical results — ISS LVT 2022/2023 (DE)</h2>
        <p className="text-sm text-muted-foreground">
          Super Admin only. Loads parsed FUDMA result sheets (Contact 2, 3, 4) for the B.A. Islamic Studies (LVT)
          Direct Entry 2022 cohort. Runs a preview first; nothing is written to the database until you press Commit.
        </p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>How this works</AlertTitle>
        <AlertDescription className="space-y-1 text-sm">
          <p>1. Preview shows exact counts. 2. Commit inserts everything as <b>published</b> results — bypassing the approval chain by design.</p>
          <p>Students not yet in the system are created under B.A. Islamic Studies (LVT), Islamic Studies dept, entry 2022. Their <code>auth_user_id</code> stays null; they claim their account later via matric-number login.</p>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Fixture summary</CardTitle>
          <CardDescription>Parsed from the uploaded PDFs (Contact 2, 3, 4).</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading || !summary ? <Skeleton className="h-32" /> : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <Info label="Session" value={summary.session} />
                <Info label="Programme" value={summary.programme_name} />
                <Info label="Department" value={summary.department} />
                <Info label="Entry year" value={String(summary.entry_year)} />
                <Info label="Contacts" value={summary.contacts.map((c) => `C${c.contact_no}→${c.level_code}`).join(", ")} />
                <Info label="Students" value={String(summary.student_count)} />
                <Info label="Courses" value={String(summary.course_count)} />
                <Info label="Result rows" value={String(summary.result_count)} />
              </div>

              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Sample students</div>
                <Table>
                  <TableHeader><TableRow><TableHead>Matric</TableHead><TableHead>Name</TableHead><TableHead className="text-right">Result rows</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {summary.sample_students.map((s) => (
                      <TableRow key={s.matric_number}>
                        <TableCell className="font-mono text-xs">{s.matric_number}</TableCell>
                        <TableCell>{s.name}</TableCell>
                        <TableCell className="text-right">{s.result_count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Sample courses</div>
                <div className="flex flex-wrap gap-1.5">
                  {summary.sample_courses.map((c) => (
                    <Badge key={c.code} variant="outline" className="font-mono text-xs">
                      {c.code} · {c.credit_units}u · {c.category === "general_studies" ? "GS" : "SM"} · C{c.contacts.join(",")}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={() => dryRun.mutate()} disabled={dryRun.isPending || commit.isPending} variant="outline">
          {dryRun.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
          Run preview
        </Button>
        <Button
          onClick={() => commit.mutate()}
          disabled={!preview || committed !== null || commit.isPending || dryRun.isPending}
        >
          {commit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
          Commit import
        </Button>
      </div>

      {preview && <ResultBlock title="Preview (nothing written)" data={preview} />}
      {committed && <ResultBlock title="Committed" data={committed} tone="success" />}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-md px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

function ResultBlock({ title, data, tone }: { title: string; data: Result; tone?: "success" }) {
  return (
    <Card className={tone === "success" ? "border-primary/50" : ""}>
      <CardHeader>
        <CardTitle className="font-serif text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Info label="Semesters new" value={String(data.semesters_created)} />
          <Info label="Courses new" value={String(data.courses_created)} />
          <Info label="Offerings new" value={String(data.offerings_created)} />
          <Info label="Students new" value={String(data.students_new)} />
          <Info label="Students existing" value={String(data.students_existing)} />
          <Info label="Registrations new" value={String(data.registrations_created)} />
          <Info label="Result rows" value={String(data.results_upserted)} />
          <Info label="Session id" value={data.session_id.slice(0, 8) + "…"} />
        </div>
      </CardContent>
    </Card>
  );
}
