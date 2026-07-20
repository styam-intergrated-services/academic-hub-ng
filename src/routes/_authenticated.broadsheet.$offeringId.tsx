import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBroadsheet } from "@/lib/transcripts.functions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, Printer, ShieldAlert } from "lucide-react";
import { BroadsheetView } from "@/components/BroadsheetView";

export const Route = createFileRoute("/_authenticated/broadsheet/$offeringId")({
  component: BroadsheetPage,
});

function BroadsheetPage() {
  const { offeringId } = Route.useParams();
  const fn = useServerFn(getBroadsheet);
  const { data, isLoading, error } = useQuery({
    queryKey: ["broadsheet", offeringId],
    queryFn: () => fn({ data: { offering_id: offeringId } }),
  });

  if (isLoading) return <Skeleton className="h-96" />;
  if (error) return <Card><CardContent className="pt-6 text-destructive flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> {(error as Error).message}</CardContent></Card>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2 no-print">
        <Link to="/approvals" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Back
        </Link>
        <Button onClick={() => window.print()} className="bg-primary text-primary-foreground">
          <Printer className="h-4 w-4 mr-2" /> Print / Save PDF
        </Button>
      </div>
      <Card className="p-6 md:p-10 bg-white text-black">
        <BroadsheetView data={data} />
      </Card>
    </div>
  );
}
