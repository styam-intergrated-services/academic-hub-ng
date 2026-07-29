import type { ReactNode } from "react";
import { motion } from "motion/react";
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
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="h-full"
    >
    <Card className={cn("card-hover h-full overflow-hidden rounded-2xl", accent && "border-gold/40 bg-gold/[0.03]")}>

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
              "grid size-11 shrink-0 place-items-center rounded-xl",
              accent ? "bg-gold/15 text-gold" : "bg-primary/10 text-primary",
            )}
          >
            <Icon className="size-5" />
          </div>
        ) : null}
      </CardContent>
    </Card>
    </motion.div>
  );
}

