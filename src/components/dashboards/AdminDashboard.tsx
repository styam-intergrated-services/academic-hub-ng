import type { PortalUser } from "@/lib/portal.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Building2, GraduationCap, ClipboardList, Settings, FileCheck2, Wallet, TrendingUp, AlertTriangle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getManagementStats } from "@/lib/students.functions";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, Legend } from "recharts";
import { PipelineWidget } from "@/components/dashboards/widgets/PipelineWidget";
import { ApprovalsShortcut } from "@/components/dashboards/widgets/ApprovalsShortcut";
import { SessionBanner } from "@/components/dashboards/widgets/SessionBanner";
import { GpaTrendsCard } from "@/components/dashboards/widgets/GpaTrendsCard";
import { NotificationsCard } from "@/components/dashboards/widgets/NotificationsCard";
import { DashboardHero } from "@/components/dashboards/widgets/DashboardHero";
import { QuickActions } from "@/components/dashboards/widgets/QuickActions";

export function AdminDashboard({ user }: { user: PortalUser }) {
  const stats = useServerFn(getManagementStats);
  const isFinancial = user.roles.includes("bursary");
  const isRegistry = user.roles.some((r) => ["registry","super_admin","ict_admin"].includes(r));

  const { data, isLoading } = useQuery({
    queryKey: ["management","stats"],
    queryFn: () => stats(),
    staleTime: 30_000,
  });

  const t = data?.totals;
  const standingData = data ? Object.entries(data.standingCounts).map(([k, v]) => ({ name: k, value: v })) : [];
  const STANDING_COLORS: Record<string, string> = {
    excellent: "hsl(160 70% 45%)",
    good: "hsl(210 80% 55%)",
    probation: "hsl(40 90% 55%)",
    withdrawn: "hsl(0 75% 55%)",
  };
  const semesterLabel = data?.currentSemester
    ? `${data.currentSemester.session_name} · ${data.currentSemester.type}`
    : undefined;

  return (
    <div className="space-y-6">
      <DashboardHero
        eyebrow="Administration"
        title={`Welcome, ${user.full_name ?? "Administrator"}`}
        subtitle={data?.scope === "partial" ? "Showing data scoped to your department / faculty." : undefined}
        chips={user.roles.map((r) => (
          <Badge key={r} variant="secondary" className="border-white/20 bg-white/10 capitalize text-white">
            {r.replace("_", " ")}
          </Badge>
        ))}
      />

      <SessionBanner semester={data?.currentSemester ?? null} canToggle={isRegistry} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={GraduationCap} label="Students" value={isLoading ? null : (t?.students ?? 0).toLocaleString()} to="/students" />
        <StatCard icon={TrendingUp} label="Avg CGPA" value={isLoading ? null : (t?.avgCgpa ?? 0).toFixed(2)} />
        <StatCard icon={AlertTriangle} label="On probation" value={isLoading ? null : (t?.probation ?? 0).toLocaleString()} to="/students" search={{ standing: "probation" }} />
        <StatCard icon={ClipboardList} label="Pending approvals" value={isLoading ? null : (t?.pendingApprovals ?? 0).toLocaleString()} to="/approvals" />
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2"><PipelineWidget pipeline={data.pipeline} semesterLabel={semesterLabel} /></div>
          <ApprovalsShortcut items={data.pendingForMe ?? []} />
        </div>
      )}

      <GpaTrendsCard />



      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">Students per level</CardTitle>
            <CardDescription>Enrolment distribution across levels.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {isLoading || !data ? <Skeleton className="h-full" /> : (
              <ResponsiveContainer>
                <BarChart data={data.perLevel}>
                  <XAxis dataKey="level" fontSize={11} />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="count" fill="var(--primary)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">Academic standing</CardTitle>
            <CardDescription>Distribution across the {data?.scope === "all" ? "college" : "current scope"}. Click a slice to filter.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {isLoading || !data ? <Skeleton className="h-full" /> : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={standingData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80}>
                    {standingData.map((s) => <Cell key={s.name} fill={STANDING_COLORS[s.name] ?? "var(--muted)"} />)}
                  </Pie>
                  <Legend
                    wrapperStyle={{ fontSize: 11, cursor: "pointer" }}
                    onClick={(e: any) => {
                      if (typeof window === "undefined") return;
                      const v = e?.value;
                      if (v) window.location.href = `/students?standing=${encodeURIComponent(v)}`;
                    }}
                  />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="font-serif text-lg">Enrolment by programme</CardTitle>
          <CardDescription>Live student counts, average CGPA and probation cases per programme.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading || !data ? (
            <div className="p-4"><Skeleton className="h-40" /></div>
          ) : (data.perProgramme?.length ?? 0) === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No programmes in scope yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-background text-left">
                  <tr>
                    <th className="px-4 py-2 font-medium">Programme</th>
                    <th className="px-4 py-2 font-medium">Department</th>
                    <th className="px-4 py-2 text-right font-medium">Students</th>
                    <th className="px-4 py-2 text-right font-medium">Avg CGPA</th>
                    <th className="px-4 py-2 text-right font-medium">On probation</th>
                  </tr>
                </thead>
                <tbody>
                  {data.perProgramme.map((p: any) => (
                    <tr key={p.programme_id} className="border-b last:border-0 even:bg-muted/30">
                      <td className="px-4 py-2">
                        <div className="font-medium">{p.name}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">{p.code}</div>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{p.department}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold">{p.count.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{p.count ? p.avgCgpa.toFixed(2) : "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{p.probation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <QuickActions
        description="Live shortcuts for the tasks you use most"
        actions={[
          ...(isRegistry
            ? [
                { label: "Departments", to: "/departments", icon: Building2, hint: "Faculties & programmes" },
                { label: "Students", to: "/students", icon: GraduationCap, hint: `${(t?.students ?? 0).toLocaleString()} on record` },
              ]
            : []),
          { label: "Result approvals", to: "/approvals", icon: FileCheck2, hint: `${(t?.pendingApprovals ?? 0).toLocaleString()} pending` },
          { label: "Results archive", to: "/results-archive", icon: ClipboardList, hint: "By department & level" },
          ...(user.roles.some((r) => ["super_admin", "ict_admin"].includes(r))
            ? [{ label: "Users & roles", to: "/users", icon: Users, hint: "Onboard staff" }]
            : []),
          ...(isFinancial ? [{ label: "Fees & payments", to: "/fees", icon: Wallet, hint: "Verify payments" }] : []),
          { label: "Administration", to: "/admin", icon: Settings, hint: "Sessions & semesters" },
        ]}
      />


      <NotificationsCard />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, to, search }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | null; to?: string; search?: Record<string, string> }) {
  const inner = (
    <Card className={to ? "card-hover h-full rounded-2xl" : "h-full rounded-2xl"}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{label}</div>
            <div className="mt-1 font-serif text-2xl font-bold tabular-nums text-primary sm:text-3xl">
              {value === null ? <Skeleton className="h-7 w-16" /> : value}
            </div>
          </div>
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></div>
        </div>
      </CardContent>
    </Card>
  );
  if (!to) return inner;
  return <Link to={to as any} search={search as any}>{inner}</Link>;
}

function QuickCard({ title, desc, to, icon: Icon }: { title: string; desc: string; to: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card className="card-hover h-full rounded-2xl">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"><Icon className="size-4" /></div>
          <div>
            <CardTitle className="font-serif text-base">{title}</CardTitle>
            <CardDescription>{desc}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Link to={to as any}><Button variant="secondary" size="sm">Open</Button></Link>
      </CardContent>
    </Card>
  );
}
