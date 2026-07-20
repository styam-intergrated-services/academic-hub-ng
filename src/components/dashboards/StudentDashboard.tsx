import type { PortalUser } from "@/lib/portal.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Award, BookOpen, ClipboardList, Wallet, TrendingUp } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function StudentDashboard({ user }: { user: PortalUser }) {
  const s = user.student;
  return (
    <div className="space-y-6">
      <section className="bg-hero-gradient text-white rounded-xl p-6 md:p-8 shadow-elegant">
        <div className="text-xs uppercase tracking-widest text-white/70">Student Portal</div>
        <h1 className="mt-2 font-serif text-3xl md:text-4xl font-bold">Welcome, {user.full_name ?? "Student"}</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-sm text-white/80">
          {s ? (
            <>
              <span>Matric: <b className="text-gold">{s.matric_number}</b></span>
              <span>•</span>
              <span>CGPA: <b className="text-gold">{Number(s.cgpa).toFixed(2)}</b></span>
              <span>•</span>
              <span>Standing: <Badge variant="secondary" className="capitalize">{s.standing}</Badge></span>
            </>
          ) : <span>Your student record hasn't been activated yet. Contact the Registry.</span>}
        </div>
      </section>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Award} label="CGPA" value={s ? Number(s.cgpa).toFixed(2) : "—"} />
        <StatCard icon={BookOpen} label="Registered courses" value="—" />
        <StatCard icon={ClipboardList} label="Published results" value="—" />
        <StatCard icon={Wallet} label="Fees status" value={s ? "View" : "—"} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="font-serif">Quick actions</CardTitle><CardDescription>Frequently used tasks</CardDescription></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Link to="/registration"><Button className="w-full justify-start" variant="secondary"><ClipboardList className="h-4 w-4 mr-2" /> Register courses</Button></Link>
            <Link to="/results"><Button className="w-full justify-start" variant="secondary"><Award className="h-4 w-4 mr-2" /> View results</Button></Link>
            <Link to="/transcript"><Button className="w-full justify-start" variant="secondary"><Award className="h-4 w-4 mr-2" /> My transcript</Button></Link>
            <Link to="/fees"><Button className="w-full justify-start" variant="secondary"><Wallet className="h-4 w-4 mr-2" /> Pay fees</Button></Link>
            <Link to="/profile"><Button className="w-full justify-start" variant="secondary"><TrendingUp className="h-4 w-4 mr-2" /> Update profile</Button></Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="font-serif">Academic standing</CardTitle><CardDescription>Your current status</CardDescription></CardHeader>
          <CardContent>
            {s ? (
              <div className="space-y-2 text-sm">
                <p>Credit units earned: <b>{"—"}</b></p>
                <p>Grade points: <b>{"—"}</b></p>
                <p>Standing: <Badge className="capitalize" variant={s.standing === "excellent" ? "default" : "secondary"}>{s.standing}</Badge></p>
                <p className="text-muted-foreground pt-2">Results only appear after they have been fully approved and published by Registry.</p>
              </div>
            ) : <p className="text-sm text-muted-foreground">No student record on file.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
            <div className="mt-1 text-2xl font-serif font-bold text-primary">{value}</div>
          </div>
          <div className="w-10 h-10 rounded-md bg-primary/10 text-primary grid place-items-center"><Icon className="h-5 w-5" /></div>
        </div>
      </CardContent>
    </Card>
  );
}
