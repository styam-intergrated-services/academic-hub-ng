import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import { getTranscript, issueOfficialTranscript } from "@/lib/transcripts.functions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, Printer, ShieldAlert, FileSignature } from "lucide-react";
import { TranscriptView } from "@/components/TranscriptView";

const searchSchema = z.object({ official: z.coerce.boolean().optional(), serial: z.string().optional() });

export const Route = createFileRoute("/_authenticated/transcripts/$id")({
  validateSearch: (s: unknown) => searchSchema.parse(s ?? {}),
  component: StudentTranscriptPage,
});

function StudentTranscriptPage() {
  const { id } = Route.useParams();
  const { official, serial } = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const fn = useServerFn(getTranscript);
  const issueFn = useServerFn(issueOfficialTranscript);

  const { data, isLoading, error } = useQuery({
    queryKey: ["transcript", id],
    queryFn: () => fn({ data: { student_id: id } }),
  });

  const issueMut = useMutation({
    mutationFn: () => issueFn({ data: { student_id: id } }),
    onSuccess: (r: any) => {
      toast.success(`Issued serial ${r.serial}`);
      qc.invalidateQueries({ queryKey: ["transcript", id] });
      navigate({ search: { official: true, serial: r.serial } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to issue"),
  });

  if (isLoading) return <Skeleton className="h-96" />;
  if (error) return <Card><CardContent className="pt-6 text-destructive flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> {(error as Error).message}</CardContent></Card>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2 no-print">
        <Link to="/students/$id" params={{ id }} className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Back to student
        </Link>
        <div className="flex gap-2">
          {!official && (
            <Button variant="outline" onClick={() => issueMut.mutate()} disabled={issueMut.isPending}>
              <FileSignature className="h-4 w-4 mr-2" /> Issue official transcript
            </Button>
          )}
          {official && (
            <Button variant="outline" onClick={() => navigate({ search: {} })}>
              Switch to unofficial view
            </Button>
          )}
          <Button onClick={() => window.print()} className="bg-primary text-primary-foreground">
            <Printer className="h-4 w-4 mr-2" /> Print / Save PDF
          </Button>
        </div>
      </div>
      <Card className="p-6 md:p-10 bg-white text-black">
        <TranscriptView data={data} official={!!official} serial={serial} />
      </Card>
    </div>
  );
}
