import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const GRADE_TONE: Record<string, string> = {
  A: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  B: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  C: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  D: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  E: "bg-orange-600/15 text-orange-800 dark:text-orange-300 border-orange-600/30",
  F: "bg-destructive/15 text-destructive border-destructive/30",
};

export function GradeBadge({ grade }: { grade?: string | null }) {
  if (!grade) return <span className="text-muted-foreground">—</span>;
  const tone = GRADE_TONE[grade.toUpperCase()] ?? "bg-muted text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={cn("font-mono font-semibold", tone)}>
      {grade}
    </Badge>
  );
}

const STATUS_LABEL: Record<string, string> = {
  OK: "Scored",
  ABS: "Absent",
  INC: "Incomplete",
  WH: "Withheld",
  draft: "Draft",
  submitted: "Submitted",
  hod_approved: "HOD approved",
  dean_approved: "Dean approved",
  registry_approved: "Registry approved",
  published: "Published",
  rejected: "Rejected",
};

const STATUS_TONE: Record<string, string> = {
  OK: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  ABS: "bg-destructive/15 text-destructive border-destructive/30",
  INC: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  WH: "bg-muted text-muted-foreground border-border",
  draft: "bg-muted text-muted-foreground border-border",
  submitted: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  hod_approved: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  dean_approved: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
  registry_approved: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  published: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};

export function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const tone = STATUS_TONE[status] ?? "bg-muted text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap", tone)}>
      {STATUS_LABEL[status] ?? status.replace(/_/g, " ")}
    </Badge>
  );
}
