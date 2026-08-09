import { getStudentDashboardStats, type PortalUser } from "@/lib/portal.functions";
import { getStudentExtras } from "@/lib/dashboard.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Award, BookOpen, ClipboardList, Wallet, TrendingUp, CalendarDays, FileCheck2, User, Download } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { StatCard } from "@/components/portal/StatCard";
import { EmptyState } from "@/components/portal/EmptyState";
import { NotificationsCard } from "@/components/dashboards/widgets/NotificationsCard";
import { DashboardHero, HeroChip } from "@/components/dashboards/widgets/DashboardHero";
import { QuickActions } from "@/components/dashboards/widgets/QuickActions";

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
      <DashboardHero
        eyebrow="Student Portal"
        title={`Welcome, ${user.full_name ?? "Student"}`}
        subtitle={
          s ? undefined : "Your student record hasn't been activated yet. Contact the Registry."
        }
        chips={
          s ? (
            <>
              <HeroChip label="Matric" value={<span className="font-mono">{s.matric_number}</span>} />
              {extras?.academic?.programme ? (
                <HeroChip label="Programme" value={<span className="truncate">{extras.academic.programme}</span>} />
              ) : null}
              {extras?.academic?.level ? <HeroChip label="Level" value={extras.academic.level} /> : null}
              <HeroChip label="CGPA" value={<span className="tabular-nums">{Number(s.cgpa).toFixed(2)}</span>} />
              <HeroChip label="Standing" value={<span className="capitalize">{s.standing}</span>} />
            </>
          ) : null
        }
      />

      {s ? (
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/transcript" search={{ download: true }}>
            <Button size="sm" className="bg-primary text-primary-foreground">
              <Download className="mr-2 size-4" /> Download transcript (PDF)
            </Button>
          </Link>
          <Link to="/transcript" search={{ download: undefined }}>
            <Button size="sm" variant="outline"><FileCheck2 className="mr-2 size-4" /> View transcript</Button>
          </Link>
          <Link to="/results">
            <Button size="sm" variant="outline"><Award className="mr-2 size-4" /> All results</Button>
          </Link>
        </div>
      ) : null}

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
                  <Line type="monotone" dataKey="gpa" stroke="var(--primary)" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="cgpa" stroke="var(--gold)" strokeDasharray="4 4" strokeWidth={2} dot={false} />
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

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="font-serif">Semester-by-semester breakdown</CardTitle>
          <CardDescription>Credit units, grade points, GPA and running CGPA per semester</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {extrasLoading ? (
            <div className="p-4"><Skeleton className="h-32" /></div>
          ) : (extras?.semesterGpa.length ?? 0) === 0 ? (
            <div className="p-4">
              <EmptyState title="No GPA records yet" description="Each semester appears here once its results are published." />
            </div>
          ) : (
            <TableScroll>
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Semester</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead className="text-right">GPA</TableHead>
                    <TableHead className="text-right">CGPA</TableHead>
                    <TableHead>Standing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extras!.semesterGpa.map((g, i) => (
                    <TableRow key={`${g.label}-${i}`} className="even:bg-muted/30">
                      <TableCell className="font-medium">{g.label}</TableCell>
                      <TableCell className="text-right tabular-nums">{g.credit_units}</TableCell>
                      <TableCell className="text-right tabular-nums">{g.grade_points.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{g.gpa.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-primary">{g.cgpa.toFixed(2)}</TableCell>
                      <TableCell><Badge variant="secondary" className="capitalize">{g.standing}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableScroll>
          )}
        </CardContent>
      </Card>



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
        <QuickActions
          actions={[
            { label: "Register courses", to: "/registration", icon: ClipboardList, hint: "Current semester" },
            { label: "View results", to: "/results", icon: Award, hint: "Published scores" },
            { label: "My transcript", to: "/transcript", icon: FileCheck2, hint: "Academic record" },
            { label: "My courses", to: "/courses", icon: BookOpen, hint: "Catalogue" },
            { label: "Pay fees", to: "/fees", icon: Wallet, hint: "Bursary" },
            { label: "Update profile", to: "/profile", icon: User, hint: "Photo & contact" },
          ]}
        />

      </div>
    </div>
  );
}
