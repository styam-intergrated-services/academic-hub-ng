import { getLecturerTeachingCount, type PortalUser } from "@/lib/portal.functions";
import { getLecturerClasses } from "@/lib/dashboard.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BookOpen, FileCheck2, Users, ClipboardCheck, Upload } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { StatCard } from "@/components/portal/StatCard";
import { EmptyState } from "@/components/portal/EmptyState";
import { NotificationsCard } from "@/components/dashboards/widgets/NotificationsCard";

export function LecturerDashboard({ user }: { user: PortalUser }) {
  const teachingFn = useServerFn(getLecturerTeachingCount);
  const classesFn = useServerFn(getLecturerClasses);
  const { data, isLoading } = useQuery({
    queryKey: ["portal", "lecturer-teaching-count", user.id],
    queryFn: () => teachingFn(),
    staleTime: 30_000,
  });
  const { data: cls, isLoading: clsLoading } = useQuery({
    queryKey: ["portal", "lecturer-classes", user.id],
    queryFn: () => classesFn(),
    staleTime: 30_000,
  });

  const n = data?.count ?? 0;
  const classes = cls?.classes ?? [];
  const totalStudents = classes.reduce((a, c) => a + c.students, 0);
  const totalEntered = classes.reduce((a, c) => a + c.entered, 0);
  const totalPending = classes.reduce((a, c) => a + (c.entered - c.submitted), 0);

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-hero-gradient p-6 text-white shadow-elegant md:p-8">
        <div className="text-[10px] uppercase tracking-widest text-white/70">Lecturer Portal</div>
        <h1 className="mt-2 font-serif text-2xl font-bold sm:text-3xl md:text-4xl">
          Good day, {user.full_name ?? "Lecturer"}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-white/80">
          {cls?.semesterLabel ? `Current semester: ${cls.semesterLabel}. ` : ""}
          Upload continuous assessment and exam scores, then submit for approval.
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard icon={BookOpen} label="Courses teaching" value={isLoading ? "…" : n} accent />
        <StatCard icon={Users} label="Students taught" value={clsLoading ? "…" : totalStudents} />
        <StatCard icon={ClipboardCheck} label="Scores entered" value={clsLoading ? "…" : totalEntered} />
        <StatCard icon={FileCheck2} label="Awaiting submission" value={clsLoading ? "…" : totalPending} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif">My classes this semester</CardTitle>
          <CardDescription>Score entry progress per course</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {clsLoading ? (
            <Skeleton className="h-32" />
          ) : classes.length === 0 ? (
            <EmptyState title="No courses assigned" description="Your classes appear here once Registry allocates courses to you." />
          ) : (
            classes.map((c) => {
              const pct = c.students > 0 ? Math.min(100, Math.round((c.entered / c.students) * 100)) : 0;
              return (
                <div key={c.offering_id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-muted-foreground">{c.code} · {c.credit_units} units</div>
                      <div className="truncate font-medium">{c.title}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-xs">
                      <Badge variant="secondary">{c.students} students</Badge>
                      {c.published > 0 ? <Badge>{c.published} published</Badge> : null}
                    </div>
                  </div>
                  <Progress value={pct} className="mt-3 h-2" />
                  <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{c.entered} of {c.students} scores entered</span>
                    <Link to="/broadsheet/$offeringId" params={{ offeringId: c.offering_id }} className="underline">
                      Open broadsheet
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Result submission</CardTitle>
            <CardDescription>Draft → Submit → HOD → Dean → Registry → Published</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Link to="/upload-results"><Button className="w-full justify-start" variant="secondary"><Upload className="mr-2 size-4" />Upload results</Button></Link>
            <Link to="/teaching"><Button className="w-full justify-start" variant="secondary"><Users className="mr-2 size-4" />View classes</Button></Link>
            <Link to="/students"><Button className="w-full justify-start" variant="secondary"><Users className="mr-2 size-4" />Student records</Button></Link>
            <Link to="/profile"><Button className="w-full justify-start" variant="secondary"><FileCheck2 className="mr-2 size-4" />Update profile</Button></Link>
          </CardContent>
        </Card>
        <NotificationsCard />
      </div>

      <Card>
        <CardHeader><CardTitle className="font-serif">Approval workflow</CardTitle></CardHeader>
        <CardContent>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {["Lecturer submits","HOD approves","Dean approves","Registry approves","Published to students"].map((s, i) => (
              <li key={s} className="rounded-lg border bg-muted/40 p-3">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Step {i + 1}</div>
                <div className="mt-0.5 text-sm font-medium">{s}</div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
