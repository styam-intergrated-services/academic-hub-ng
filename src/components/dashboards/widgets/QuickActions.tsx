import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type QuickAction = {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
};

/**
 * Uniform quick-action grid used by every role dashboard. Links only — no logic.
 */
export function QuickActions({
  title = "Quick actions",
  description = "Frequently used tasks",
  actions,
}: {
  title?: string;
  description?: string;
  actions: QuickAction[];
}) {
  return (
    <Card className="h-full rounded-2xl">
      <CardHeader>
        <CardTitle className="font-serif">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {actions.map(({ label, to, icon: Icon, hint }) => (
          <Link
            key={to + label}
            to={to as never}
            className="group flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-gold/50 hover:bg-accent/40"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-gold/20 group-hover:text-gold">
              <Icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{label}</span>
              {hint ? <span className="block truncate text-xs text-muted-foreground">{hint}</span> : null}
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
