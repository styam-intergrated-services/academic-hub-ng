import type { PortalUser } from "@/lib/portal.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BookOpen, FileCheck2, Users, ClipboardList } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function LecturerDashboard({ user }: { user: PortalUser }) {
  return (
    <div className="space-y-6">
      <section className="bg-hero-gradient text-white rounded-xl p-6 md:p-8 shadow-elegant">
        <div className="text-xs uppercase tracking-widest text-white/70">Lecturer Portal</div>
        <h1 className="mt-2 font-serif text-3xl md:text-4xl font-bold">Good day, {user.full_name ?? "Lecturer"}</h1>
        <p className="mt-2 text-white/80">Upload continuous assessment and exam scores, then submit for approval.</p>
      </section>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="font-serif">My teaching</CardTitle><CardDescription>Assigned courses this semester</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Assigned courses will appear here once Registry links you.</p>
            <Link to="/teaching"><Button variant="secondary"><BookOpen className="h-4 w-4 mr-2" />Open teaching</Button></Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="font-serif">Result submission</CardTitle><CardDescription>Draft → Submit → HOD → Dean → Registry → Published</CardDescription></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Link to="/upload-results"><Button className="w-full" variant="secondary"><FileCheck2 className="h-4 w-4 mr-2" />Upload results</Button></Link>
            <Link to="/teaching"><Button className="w-full" variant="secondary"><Users className="h-4 w-4 mr-2" />View classes</Button></Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="font-serif">Workflow</CardTitle></CardHeader>
        <CardContent>
          <ol className="grid md:grid-cols-5 gap-3 text-sm">
            {["Lecturer submits","HOD approves","Dean approves","Registry approves","Published to students"].map((s, i) => (
              <li key={s} className="rounded-md border p-3 bg-muted/40">
                <div className="text-xs text-muted-foreground">Step {i + 1}</div>
                <div className="font-medium">{s}</div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
