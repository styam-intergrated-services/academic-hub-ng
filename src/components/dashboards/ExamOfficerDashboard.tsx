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
import { DashboardHero } from "@/components/dashboards/widgets/DashboardHero";
import { QuickActions } from "@/components/dashboards/widgets/QuickActions";
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
      <DashboardHero
        eyebrow="Examinations Office"
        title={`Welcome, ${user.full_name ?? "Examination Officer"}`}
        subtitle={
          !isLoading && (data?.scopes.length ?? 0) === 0
            ? "No examination scope assigned yet — contact the Registry."
            : undefined
        }
        chips={(data?.scopes ?? []).map((s) => (
          <Badge key={`${s.type}-${s.name}`} variant="secondary" className="border-white/20 bg-white/10 text-white">
            {s.type}: {s.name}
          </Badge>
        ))}
      />

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

        <QuickActions
          title="Examination tools"
          description="Everything scoped to your department, faculty or programme"
          actions={[
            { label: "Scoped results", to: "/scoped-results", icon: FileCheck2, hint: "Within your scope" },
            { label: "Results archive", to: "/results-archive", icon: Archive, hint: "Published history" },
            { label: "Schedule & invigilators", to: "/exam-schedule", icon: CalendarDays, hint: "Timetable" },
            { label: "Lecturer allocations", to: "/allocations", icon: Users, hint: "Course staffing" },
            { label: "Student records", to: "/students", icon: Users, hint: "Directory" },
            { label: "Update profile", to: "/profile", icon: ShieldCheck, hint: "Photo & contact" },
          ]}
        />
      </div>

      <NotificationsCard />
    </div>
  );
}
