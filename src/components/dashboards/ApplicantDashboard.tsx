import type { PortalUser } from "@/lib/portal.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Info } from "lucide-react";

export function ApplicantDashboard({ user }: { user: PortalUser }) {
  return (
    <div className="space-y-6">
      <section className="bg-hero-gradient text-white rounded-xl p-6 md:p-8 shadow-elegant">
        <div className="text-xs uppercase tracking-widest text-white/70">Welcome</div>
        <h1 className="mt-2 font-serif text-3xl md:text-4xl font-bold">Hello, {user.full_name ?? user.email}</h1>
        <p className="mt-2 text-white/80">Your account is active. An administrator will assign your role shortly.</p>
      </section>

      <Card>
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
