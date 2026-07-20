import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTranscript } from "@/lib/transcripts.functions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Printer, ShieldAlert } from "lucide-react";
import { TranscriptView } from "@/components/TranscriptView";

export const Route = createFileRoute("/_authenticated/transcript")({
  component: TranscriptPage,
});

function TranscriptPage() {
  const fn = useServerFn(getTranscript);
  const { data, isLoading, error } = useQuery({
    queryKey: ["transcript", "me"],
    queryFn: () => fn({ data: {} }),
  });

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
        <Button onClick={() => window.print()} className="bg-primary text-primary-foreground">
          <Printer className="h-4 w-4 mr-2" /> Print / Save PDF
        </Button>
      </div>
      <Card className="p-6 md:p-10 bg-white text-black">
        <TranscriptView data={data} official={false} />
      </Card>
    </div>
  );
}
