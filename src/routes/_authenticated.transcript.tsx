import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { getTranscript } from "@/lib/transcripts.functions";
import { downloadElementAsPdf } from "@/lib/download-pdf";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Printer, ShieldAlert } from "lucide-react";
import { TranscriptView } from "@/components/TranscriptView";

export const Route = createFileRoute("/_authenticated/transcript")({
  validateSearch: (search: Record<string, unknown>) => ({
    download: search.download === "1" || search.download === true ? true : undefined,
  }),
  component: TranscriptPage,
});

function TranscriptPage() {
  const { download } = Route.useSearch();
  const fn = useServerFn(getTranscript);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const autoRan = useRef(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["transcript", "me"],
    queryFn: () => fn({ data: {} }),
  });

  async function handleDownload() {
    if (!sheetRef.current) return;
    setDownloading(true);
    try {
      const matric = (data as any)?.student?.matric_number ?? "transcript";
      await downloadElementAsPdf(sheetRef.current, `Transcript-${String(matric).replace(/[^\w-]+/g, "_")}.pdf`);
    } catch {
      toast.error("Could not generate the PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  if (isLoading) return <Skeleton className="h-96" />;
  if (error) return <Card><CardContent className="pt-6 text-destructive flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> {(error as Error).message}</CardContent></Card>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2 no-print">
        <div>
          <h2 className="font-serif text-2xl text-primary">My Transcript</h2>
          <p className="text-sm text-muted-foreground">Unofficial student copy. For an official transcript, contact the Registry.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownload} disabled={downloading}>
            <Download className="h-4 w-4 mr-2" /> {downloading ? "Preparing…" : "Download PDF"}
          </Button>
          <Button onClick={() => window.print()} className="bg-primary text-primary-foreground">
            <Printer className="h-4 w-4 mr-2" /> Print
          </Button>
        </div>
      </div>
      <Card ref={sheetRef} className="p-6 md:p-10 bg-white text-black">
        <TranscriptView data={data} official={false} />
      </Card>
    </div>
  );
}

