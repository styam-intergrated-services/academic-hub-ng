import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const STAGES: Array<{ key: string; label: string; color: string; approvalStatus?: string }> = [
  { key: "draft", label: "Draft", color: "hsl(210 16% 70%)" },
  { key: "submitted", label: "Submitted", color: "hsl(210 80% 55%)", approvalStatus: "submitted" },
  { key: "hod_approved", label: "HOD", color: "hsl(190 80% 45%)", approvalStatus: "hod_approved" },
  { key: "dean_approved", label: "Dean", color: "hsl(160 70% 45%)", approvalStatus: "dean_approved" },
  { key: "registry_approved", label: "Registry", color: "hsl(45 90% 50%)", approvalStatus: "registry_approved" },
  { key: "published", label: "Published", color: "hsl(140 60% 40%)" },
];

export function PipelineWidget({ pipeline, semesterLabel }: { pipeline: Record<string, number>; semesterLabel?: string }) {
  const total = STAGES.reduce((a, s) => a + (pipeline[s.key] ?? 0), 0);
  const rejected = (pipeline.hod_rejected ?? 0) + (pipeline.dean_rejected ?? 0) + (pipeline.registry_rejected ?? 0) + (pipeline.rejected ?? 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-lg">Results pipeline</CardTitle>
        <CardDescription>
          {semesterLabel ? `${semesterLabel} · ` : ""}
          {total.toLocaleString()} result{total === 1 ? "" : "s"} across stages{rejected > 0 ? ` · ${rejected} rejected` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">No results in the current semester yet.</div>
        ) : (
          <>
            <div className="flex h-3 w-full overflow-hidden rounded-full border">
              {STAGES.map((s) => {
                const v = pipeline[s.key] ?? 0;
                const pct = total ? (v / total) * 100 : 0;
                if (pct === 0) return null;
                return <div key={s.key} title={`${s.label}: ${v}`} style={{ width: `${pct}%`, backgroundColor: s.color }} />;
              })}
            </div>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {STAGES.map((s) => {
                const v = pipeline[s.key] ?? 0;
                const inner = (
                  <div className="rounded-md border px-3 py-2 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{s.label}</span>
                    </div>
                    <div className="mt-1 font-serif text-xl font-bold">{v.toLocaleString()}</div>
                  </div>
                );
                return s.approvalStatus
                  ? <Link key={s.key} to="/approvals" search={{ status: s.approvalStatus }}>{inner}</Link>
                  : <div key={s.key}>{inner}</div>;
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
