import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { getBroadsheet } from "@/lib/transcripts.functions";
import { downloadElementAsPdf } from "@/lib/download-pdf";
import {
  buildBroadsheetDoc,
  downloadBlob,
  exportPerStudent,
  renderDoc,
  safeName,
  type ResultExportRow,
} from "@/lib/bulk-export";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, Download, FileDown, Loader2, Printer, ShieldAlert } from "lucide-react";
import { BroadsheetView } from "@/components/BroadsheetView";


export const Route = createFileRoute("/_authenticated/broadsheet/$offeringId")({
  component: BroadsheetPage,
});

function BroadsheetPage() {
  const { offeringId } = Route.useParams();
  const fn = useServerFn(getBroadsheet);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["broadsheet", offeringId],
    queryFn: () => fn({ data: { offering_id: offeringId } }),
  });

  const [exporting, setExporting] = useState<string | null>(null);

  async function handleDownload() {
    if (!sheetRef.current) return;
    setDownloading(true);
    try {
      const code = (data as any)?.offering?.course?.code ?? "broadsheet";
      await downloadElementAsPdf(sheetRef.current, `Broadsheet-${String(code).replace(/[^\w-]+/g, "_")}.pdf`);
    } catch {
      toast.error("Could not generate the PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  function toExportRows(): ResultExportRow[] {
    const d = data as any;
    const course = d?.offering?.course ?? {};
    const sem = d?.offering?.semester ?? {};
    return (d?.results ?? []).map((r: any) => ({
      session_name: sem.session?.name ?? "—",
      semester_label: sem.label ?? (sem.type === "second" ? "Second semester" : "First semester"),
      department_name: d?.department?.name ?? "—",
      level_name: course.level?.name ?? "—",
      course_code: course.code ?? "—",
      course_title: course.title ?? "—",
      credit_units: course.credit_units ?? 0,
      matric_number: r.student?.matric_number ?? "—",
      student_name: r.student?.profile?.full_name ?? "—",
      programme_name: null,
      ca_score: r.ca_score ?? null,
      exam_score: r.exam_score ?? null,
      total_score: r.total_score ?? null,
      grade: r.grade ?? null,
      grade_point: r.grade_point ?? null,
    }));
  }

  async function runExport(kind: "broadsheet" | "slips", format: "pdf" | "docx") {
    const exportRows = toExportRows();
    if (!exportRows.length) {
      toast.error("There are no result rows to export.");
      return;
    }
    setExporting(kind === "broadsheet" ? "Building broadsheet…" : "Building slips…");
    try {
      const code = safeName((data as any)?.offering?.course?.code ?? "broadsheet");
      if (kind === "broadsheet") {
        const blob = await renderDoc(buildBroadsheetDoc(exportRows), format);
        downloadBlob(blob, `Broadsheet-${code}.${format}`);
        toast.success("Broadsheet exported");
      } else {
        const count = await exportPerStudent(exportRows, format, `${code}-student-slips-${format}.zip`);
        toast.success(count > 1 ? `${count} student slips exported in a zip` : "Student slip exported");
      }
    } catch (e) {
      toast.error(`Export failed: ${(e as Error).message}`);
    } finally {
      setExporting(null);
    }
  }

  if (isLoading) return <Skeleton className="h-96" />;
  if (error) return <Card><CardContent className="pt-6 text-destructive flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> {(error as Error).message}</CardContent></Card>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2 no-print">
        <Link to="/approvals" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Back
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownload} disabled={downloading}>
            <Download className="h-4 w-4 mr-2" /> {downloading ? "Preparing…" : "Download PDF"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={exporting !== null}>
                {exporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4 mr-2" />
                )}
                {exporting ?? "Bulk export"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Broadsheet</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => runExport("broadsheet", "pdf")}>PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={() => runExport("broadsheet", "docx")}>
                Word (.docx)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Per-student slips (zipped)</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => runExport("slips", "pdf")}>PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={() => runExport("slips", "docx")}>
                Word (.docx)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => window.print()} className="bg-primary text-primary-foreground">
            <Printer className="h-4 w-4 mr-2" /> Print
          </Button>
        </div>
      </div>

      <Card ref={sheetRef} className="p-6 md:p-10 bg-white text-black">
        <BroadsheetView data={data} />
      </Card>
    </div>
  );
}

