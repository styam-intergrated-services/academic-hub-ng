import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export function ComingSoon({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="space-y-4">
      <h2 className="font-serif text-2xl text-primary">{title}</h2>
      <Card>
        <CardHeader>
          <CardTitle className="font-serif flex items-center gap-2"><Sparkles className="h-5 w-5 text-gold" /> Coming next</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {children ?? (
            <p>This module is scheduled in the roadmap. The database schema, permissions, and server functions are already in place — the UI will be built in the next iteration.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
