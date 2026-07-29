import { getStudentDashboardStats, type PortalUser } from "@/lib/portal.functions";
import { getStudentExtras } from "@/lib/dashboard.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Award, BookOpen, ClipboardList, Wallet, TrendingUp, CalendarDays, FileCheck2, User } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { StatCard } from "@/components/portal/StatCard";
import { EmptyState } from "@/components/portal/EmptyState";
import { NotificationsCard } from "@/components/dashboards/widgets/NotificationsCard";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export function StudentDashboard({ user }: { user: PortalUser }) {
  const s = user.student;
  const statsFn = useServerFn(getStudentDashboardStats);
  const extrasFn = useServerFn(getStudentExtras);
  const { data: stats } = useQuery({
    queryKey: ["portal", "student-stats", user.id],
    queryFn: () => statsFn(),
    enabled: !!s,
    staleTime: 30_000,
  });
  const { data: extras, isLoading: extrasLoading } = useQuery({
    queryKey: ["portal", "student-extras", user.id],
    queryFn: () => extrasFn(),
    enabled: !!s,
    staleTime: 30_000,
  });

  const registered = s ? (stats?.registered_courses ?? "…") : "—";
  const published = s ? (stats?.published_results ?? "…") : "—";
  const creditsEarned = s ? s.total_credit_units : "—";
  const gradePoints = s ? Number(s.total_grade_points).toFixed(1) : "—";
  const lastGpa = extras?.semesterGpa.at(-1);

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
        <StatCard icon={TrendingUp} label="Last semester GPA" value={lastGpa ? lastGpa.gpa.toFixed(2) : "—"} />
        <StatCard icon={BookOpen} label="Registered courses" value={String(registered)} />
        <StatCard icon={ClipboardList} label="Published results" value={String(published)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-serif">GPA progression</CardTitle>
            <CardDescription>Semester GPA against your running CGPA</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {extrasLoading ? (
              <Skeleton className="h-full" />
            ) : (extras?.semesterGpa.length ?? 0) === 0 ? (
              <EmptyState title="No GPA history yet" description="Your GPA appears once a semester's results are published." />
            ) : (
              <ResponsiveContainer>
                <LineChart data={extras!.semesterGpa}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis domain={[0, 5]} fontSize={11} />
                  <Tooltip />
                  <Line type="monotone" dataKey="gpa" stroke="hsl(var(--primary))" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="cgpa" stroke="hsl(var(--accent-foreground))" strokeDasharray="4 4" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Academic record</CardTitle>
            <CardDescription>Your department and programme on file</CardDescription>
          </CardHeader>
          <CardContent>
            {extrasLoading ? (
              <Skeleton className="h-32" />
            ) : !extras?.academic ? (
              <EmptyState title="No record" description="No student record is linked to this account yet." />
            ) : (
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3 border-b pb-2">
                  <dt className="text-muted-foreground">Department</dt>
                  <dd className="text-right font-medium">{extras.academic.department}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-b pb-2">
                  <dt className="text-muted-foreground">Programme</dt>
                  <dd className="text-right font-medium">{extras.academic.programme}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-b pb-2">
                  <dt className="text-muted-foreground">Level</dt>
                  <dd className="text-right font-medium">{extras.academic.level}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-b pb-2">
                  <dt className="text-muted-foreground">Year of entry</dt>
                  <dd className="text-right font-medium tabular-nums">{extras.academic.entry_year ?? "—"}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Matric number</dt>
                  <dd className="text-right font-mono text-xs">{extras.academic.matric_number}</dd>
                </div>
              </dl>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Graduation record</CardTitle>
            <CardDescription>Final CGPA and class of degree as approved</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {extrasLoading ? (
              <Skeleton className="h-32" />
            ) : (extras?.graduation.length ?? 0) === 0 ? (
              <EmptyState
                title="No graduation record"
                description="A graduation record appears here once your final results are approved."
              />
            ) : (
              extras!.graduation.map((g) => (
                <div key={g.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{g.title}</span>
                    <Badge variant={g.status === "approved" ? "default" : "secondary"} className="capitalize">
                      {g.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Final CGPA <b className="tabular-nums text-foreground">{g.cgpa?.toFixed(2) ?? "—"}</b></span>
                    <span className="truncate">Class <b className="text-foreground">{g.classification ?? "—"}</b></span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>


      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Recent results</CardTitle>
            <CardDescription>Latest published course scores</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {extrasLoading ? (
              <Skeleton className="h-32" />
            ) : (extras?.recentResults.length ?? 0) === 0 ? (
              <EmptyState title="No published results" description="Published results will show here." />
            ) : (
              extras!.recentResults.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-muted-foreground">{r.code}</div>
                    <div className="truncate font-medium">{r.title}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="tabular-nums text-muted-foreground">{r.total_score ?? "—"}</span>
                    <Badge variant={r.grade === "F" ? "destructive" : "secondary"}>{r.grade ?? "—"}</Badge>
                  </div>
                </div>
              ))
            )}
            <Link to="/results"><Button size="sm" variant="secondary" className="mt-2"><Award className="mr-2 size-4" />All results</Button></Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2"><CalendarDays className="size-4 text-primary" />Upcoming exams</CardTitle>
            <CardDescription>Scheduled papers for your registered courses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {extrasLoading ? (
              <Skeleton className="h-32" />
            ) : (extras?.upcomingExams.length ?? 0) === 0 ? (
              <EmptyState title="No exams scheduled" description="Your exam timetable will appear here when Registry publishes it." />
            ) : (
              extras!.upcomingExams.map((e) => (
                <div key={e.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{e.code}</span>
                    <span className="text-xs">{new Date(e.exam_date).toDateString()}</span>
                  </div>
                  <div className="truncate font-medium">{e.title}</div>
                  <div className="text-xs text-muted-foreground">{e.start_time} · {e.venue}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <NotificationsCard />
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Quick actions</CardTitle>
            <CardDescription>Frequently used tasks</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Link to="/registration"><Button className="w-full justify-start" variant="secondary"><ClipboardList className="mr-2 size-4" /> Register courses</Button></Link>
            <Link to="/results"><Button className="w-full justify-start" variant="secondary"><Award className="mr-2 size-4" /> View results</Button></Link>
            <Link to="/transcript"><Button className="w-full justify-start" variant="secondary"><FileCheck2 className="mr-2 size-4" /> My transcript</Button></Link>
            <Link to="/courses"><Button className="w-full justify-start" variant="secondary"><BookOpen className="mr-2 size-4" /> My courses</Button></Link>
            <Link to="/fees"><Button className="w-full justify-start" variant="secondary"><Wallet className="mr-2 size-4" /> Pay fees</Button></Link>
            <Link to="/profile"><Button className="w-full justify-start" variant="secondary"><User className="mr-2 size-4" /> Update profile</Button></Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
