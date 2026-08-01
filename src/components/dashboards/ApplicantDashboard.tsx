import type { PortalUser } from "@/lib/portal.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Info } from "lucide-react";
import { DashboardHero } from "@/components/dashboards/widgets/DashboardHero";

export function ApplicantDashboard({ user }: { user: PortalUser }) {
  return (
    <div className="space-y-6">
      <DashboardHero
        eyebrow="Welcome"
        title={`Hello, ${user.full_name ?? user.email}`}
        subtitle="Your account is active. An administrator will assign your role shortly."
      />

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="font-serif flex items-center gap-2"><Info className="h-5 w-5 text-primary" />What happens next?</CardTitle>
          <CardDescription>Your access will unlock once your role is assigned.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>Depending on your role, you'll see:</p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>Students: course registration, results, fees</li>
            <li>Lecturers: teaching load and result upload</li>
            <li>HOD / Dean / Registry: result approvals and department management</li>
            <li>Bursary: payment verification and fee structures</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
