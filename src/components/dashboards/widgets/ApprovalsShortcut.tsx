import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, ClipboardList } from "lucide-react";

type Pending = { offering_id: string; course_code: string; course_title: string; semester: string; count: number; status: string };

export function ApprovalsShortcut({ items }: { items: Pending[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="font-serif text-lg">Awaiting my approval</CardTitle>
          <CardDescription>Top offerings pending at your level.</CardDescription>
        </div>
        <Link to="/approvals"><Button size="sm" variant="outline">Open queue <ArrowRight className="h-3 w-3 ml-1" /></Button></Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <ClipboardList className="h-6 w-6 opacity-40" />
            Nothing awaiting your action.
          </div>
        ) : items.map((it) => (
          <Link key={it.offering_id} to="/approvals" search={{ status: it.status }} className="block">
            <div className="flex items-center justify-between rounded-md border px-3 py-2 hover:bg-muted/50 transition-colors">
              <div className="min-w-0">
                <div className="font-mono text-xs text-muted-foreground">{it.course_code}</div>
                <div className="text-sm font-medium truncate">{it.course_title}</div>
                <div className="text-[11px] text-muted-foreground capitalize">{it.semester}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="secondary">{it.count}</Badge>
                <Badge variant="outline" className="capitalize">{it.status.replace("_"," ")}</Badge>
              </div>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
