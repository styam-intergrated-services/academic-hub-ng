import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, LockOpen, Lock } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { setRegistrationOpen } from "@/lib/results.functions";
import { toast } from "sonner";

type Sem = { id: string; type: string; registration_open: boolean; session_name: string } | null;

export function SessionBanner({ semester, canToggle }: { semester: Sem; canToggle: boolean }) {
  const qc = useQueryClient();
  const toggle = useServerFn(setRegistrationOpen);
  const mut = useMutation({
    mutationFn: (open: boolean) => toggle({ data: { open } }),
    onSuccess: (_r, open) => { toast.success(`Registration ${open ? "opened" : "closed"}`); qc.invalidateQueries({ queryKey: ["management","stats"] }); qc.invalidateQueries({ queryKey: ["academic-structure"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to toggle"),
  });

  return (
    <Card>
      <CardContent className="py-4 flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0"><CalendarClock className="h-5 w-5" /></div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Current session</div>
            {semester ? (
              <div className="font-serif text-base font-semibold truncate">
                {semester.session_name} · <span className="capitalize">{semester.type}</span> semester
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No current semester set.</div>
            )}
          </div>
        </div>
        {semester && (
          <div className="flex items-center gap-3">
            <Badge variant={semester.registration_open ? "default" : "outline"} className="gap-1">
              {semester.registration_open ? <LockOpen className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
              Registration {semester.registration_open ? "open" : "closed"}
            </Badge>
            {canToggle && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Open</span>
                <Switch checked={semester.registration_open} disabled={mut.isPending} onCheckedChange={(v) => mut.mutate(v)} />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
