import type { PortalUser } from "@/lib/portal.functions";
import { getExamOfficerOverview } from "@/lib/dashboard.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { StatCard } from "@/components/portal/StatCard";
import { EmptyState } from "@/components/portal/EmptyState";
import { NotificationsCard } from "@/components/dashboards/widgets/NotificationsCard";
import { Archive, CalendarDays, ClipboardList, FileCheck2, Users, ShieldCheck } from "lucide-react";

export function ExamOfficerDashboard({ user }: { user: PortalUser }) {
  const fn = useServerFn(getExamOfficerOverview);
  const { data, isLoading } = useQuery({
    queryKey: ["portal", "exam-officer", user.id],
    queryFn: () => fn(),
    staleTime: 30_000,
  });

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-hero-gradient p-6 text-white shadow-elegant md:p-8">
        <div className="text-[10px] uppercase tracking-widest text-white/70">Examinations Office</div>
        <h1 className="mt-2 font-serif text-2xl font-bold sm:text-3xl md:text-4xl">
          Welcome, {user.full_name ?? "Examination Officer"}
        </h1>
        <div className="mt-3 flex flex-wrap gap-2">
          {(data?.scopes ?? []).map((s) => (
            <Badge key={`${s.type}-${s.name}`} variant="secondary" className="border-white/20 bg-white/10 text-white">
              {s.type}: {s.name}
            </Badge>
          ))}
          {!isLoading && (data?.scopes.length ?? 0) === 0 ? (
            <span className="text-sm text-white/80">No examination scope assigned yet — contact the Registry.</span>
          ) : null}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard icon={ShieldCheck} label="Scopes" value={isLoading ? "…" : (data?.scopes.length ?? 0)} accent />
        <StatCard icon={ClipboardList} label="Course offerings" value={isLoading ? "…" : (data?.offeringsCovered ?? 0)} />
        <StatCard icon={FileCheck2} label="Results in workflow" value={isLoading ? "…" : (data?.pendingResults ?? 0)} />
        <StatCard icon={Archive} label="Published results" value={isLoading ? "…" : (data?.publishedResults ?? 0)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif">
              <CalendarDays className="size-4 text-primary" /> Upcoming exams
            </CardTitle>
            <CardDescription>Scheduled papers within your scope</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <Skeleton className="h-32" />
            ) : (data?.upcomingExams.length ?? 0) === 0 ? (
              <EmptyState title="No exams scheduled" description="Schedule papers and assign invigilators from the exam timetable." />
            ) : (
              data!.upcomingExams.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-muted-foreground">{e.code}</div>
                    <div className="truncate">{e.venue}</div>
                  </div>
                  <div className="shrink-0 text-right text-xs">
                    <div>{new Date(e.exam_date).toDateString()}</div>
                    <div className="text-muted-foreground">{e.start_time}</div>
                  </div>
                </div>
              ))
            )}
            <Link to="/exam-schedule"><Button size="sm" variant="secondary" className="mt-2"><CalendarDays className="mr-2 size-4" />Exam timetable</Button></Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Examination tools</CardTitle>
            <CardDescription>Everything scoped to your department, faculty or programme</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Link to="/scoped-results"><Button className="w-full justify-start" variant="secondary"><FileCheck2 className="mr-2 size-4" />Scoped results</Button></Link>
            <Link to="/results-archive"><Button className="w-full justify-start" variant="secondary"><Archive className="mr-2 size-4" />Results archive</Button></Link>
            <Link to="/exam-schedule"><Button className="w-full justify-start" variant="secondary"><CalendarDays className="mr-2 size-4" />Schedule & invigilators</Button></Link>
            <Link to="/allocations"><Button className="w-full justify-start" variant="secondary"><Users className="mr-2 size-4" />Lecturer allocations</Button></Link>
            <Link to="/students"><Button className="w-full justify-start" variant="secondary"><Users className="mr-2 size-4" />Student records</Button></Link>
            <Link to="/profile"><Button className="w-full justify-start" variant="secondary"><ShieldCheck className="mr-2 size-4" />Update profile</Button></Link>
          </CardContent>
        </Card>
      </div>

      <NotificationsCard />
    </div>
  );
}
