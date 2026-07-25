import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = false,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <Card className={cn("overflow-hidden", accent && "border-gold/40")}>
      <CardContent className="flex items-start justify-between gap-3 pt-6">
        <div className="min-w-0">
          <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            {label}
          </div>
          <div
            className={cn(
              "mt-1 font-serif text-2xl font-bold tabular-nums sm:text-3xl",
              accent ? "text-gold" : "text-primary",
            )}
          >
            {value}
          </div>
          {hint ? <div className="mt-1 truncate text-xs text-muted-foreground">{hint}</div> : null}
        </div>
        {Icon ? (
          <div
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-lg",
              accent ? "bg-gold/15 text-gold" : "bg-primary/10 text-primary",
            )}
          >
            <Icon className="size-5" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
