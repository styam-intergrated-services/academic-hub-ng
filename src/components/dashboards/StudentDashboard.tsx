import { getStudentDashboardStats, type PortalUser } from "@/lib/portal.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Award, BookOpen, ClipboardList, Wallet, TrendingUp } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

export function StudentDashboard({ user }: { user: PortalUser }) {
  const s = user.student;
  const statsFn = useServerFn(getStudentDashboardStats);
  const { data: stats } = useQuery({
    queryKey: ["portal", "student-stats", user.id],
    queryFn: () => statsFn(),
    enabled: !!s,
    staleTime: 30_000,
  });

  const registered = s ? (stats?.registered_courses ?? "…") : "—";
  const published = s ? (stats?.published_results ?? "…") : "—";
  const creditsEarned = s ? s.total_credit_units : "—";
  const gradePoints = s ? Number(s.total_grade_points).toFixed(1) : "—";

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-hero-gradient p-6 text-white shadow-elegant md:p-8">
        <div className="text-[10px] uppercase tracking-widest text-white/70">Student Portal</div>
        <h1 className="mt-2 font-serif text-2xl font-bold sm:text-3xl md:text-4xl">
          Welcome, {user.full_name ?? "Student"}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/85">
          {s ? (
            <>
              <span className="rounded-full bg-white/10 px-3 py-1">
                Matric <b className="ml-1 font-mono text-gold">{s.matric_number}</b>
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1">
                CGPA <b className="ml-1 text-gold tabular-nums">{Number(s.cgpa).toFixed(2)}</b>
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 capitalize">
                Standing <b className="ml-1 text-gold">{s.standing}</b>
              </span>
            </>
          ) : (
            <span>Your student record hasn't been activated yet. Contact the Registry.</span>
          )}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard icon={Award} label="CGPA" value={s ? Number(s.cgpa).toFixed(2) : "—"} accent />
        <StatCard icon={BookOpen} label="Registered courses" value={String(registered)} />
        <StatCard icon={ClipboardList} label="Published results" value={String(published)} />
        <StatCard icon={TrendingUp} label="Credit units" value={String(creditsEarned)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Quick actions</CardTitle>
            <CardDescription>Frequently used tasks</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Link to="/registration"><Button className="w-full justify-start" variant="secondary"><ClipboardList className="mr-2 size-4" /> Register courses</Button></Link>
            <Link to="/results"><Button className="w-full justify-start" variant="secondary"><Award className="mr-2 size-4" /> View results</Button></Link>
            <Link to="/transcript"><Button className="w-full justify-start" variant="secondary"><Award className="mr-2 size-4" /> My transcript</Button></Link>
            <Link to="/fees"><Button className="w-full justify-start" variant="secondary"><Wallet className="mr-2 size-4" /> Pay fees</Button></Link>
            <Link to="/profile"><Button className="w-full justify-start" variant="secondary"><TrendingUp className="mr-2 size-4" /> Update profile</Button></Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Academic standing</CardTitle>
            <CardDescription>Your current status</CardDescription>
          </CardHeader>
          <CardContent>
            {s ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-muted-foreground">Credit units earned</span>
                  <b className="tabular-nums">{creditsEarned}</b>
                </div>
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-muted-foreground">Grade points</span>
                  <b className="tabular-nums">{gradePoints}</b>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Standing</span>
                  <Badge className="capitalize" variant={s.standing === "excellent" ? "default" : "secondary"}>{s.standing}</Badge>
                </div>
                <p className="pt-2 text-xs text-muted-foreground">
                  Results only appear after they have been fully approved and published by Registry.
                </p>
              </div>
            ) : (
              <EmptyState title="No student record" description="No student record is on file for this account yet." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

