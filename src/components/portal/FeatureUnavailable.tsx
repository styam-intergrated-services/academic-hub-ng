import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

export function FeatureUnavailable({ title }: { title: string }) {
  return (
    <div className="max-w-md mx-auto text-center py-16 space-y-4">
      <div className="mx-auto h-14 w-14 rounded-full bg-muted flex items-center justify-center">
        <Lock className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <h2 className="font-serif text-2xl text-primary">{title}</h2>
        <p className="text-sm text-muted-foreground mt-2">
          This module is not yet available. It will be released in an upcoming update.
        </p>
      </div>
      <Button asChild variant="outline"><Link to="/dashboard">Back to Dashboard</Link></Button>
    </div>
  );
}
