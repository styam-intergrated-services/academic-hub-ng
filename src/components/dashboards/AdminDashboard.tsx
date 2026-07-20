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
      <section className="bg-hero-gradient text-white rounded-xl p-6 md:p-8 shadow-elegant">
        <div className="text-xs uppercase tracking-widest text-white/70">Administration</div>
        <h1 className="mt-2 font-serif text-3xl md:text-4xl font-bold">Welcome, {user.full_name ?? "Administrator"}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          {user.roles.map((r) => (
            <Badge key={r} variant="secondary" className="bg-white/10 text-white border-white/20 capitalize">{r.replace("_"," ")}</Badge>
          ))}
        </div>
        {data?.scope === "partial" && (
          <div className="mt-4 text-xs text-white/80">Showing data scoped to your department / faculty.</div>
        )}
      </section>

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
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
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
                    {standingData.map((s) => <Cell key={s.name} fill={STANDING_COLORS[s.name] ?? "hsl(var(--muted))"} />)}
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

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isRegistry && <>
          <QuickCard title="Departments" desc="Manage faculties, departments and programmes" to="/departments" icon={Building2} />
          <QuickCard title="Students" desc="View and manage student records" to="/students" icon={GraduationCap} />
        </>}
        <QuickCard title="Result approvals" desc="HOD → Dean → Registry workflow" to="/approvals" icon={FileCheck2} />
        {user.roles.some((r) => ["super_admin","ict_admin"].includes(r)) && (
          <QuickCard title="Users & Roles" desc="Assign roles and permissions" to="/users" icon={Users} />
        )}
        {isFinancial && <QuickCard title="Fees & Payments" desc="Fee structures and payment verification" to="/fees" icon={Wallet} />}
        <QuickCard title="Administration" desc="Sessions, semesters and general settings" to="/admin" icon={Settings} />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, to, search }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | null; to?: string; search?: Record<string, string> }) {
  const inner = (
    <Card className={to ? "hover:shadow-md transition-shadow cursor-pointer" : ""}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
            <div className="mt-1 text-2xl font-serif font-bold text-primary">
              {value === null ? <Skeleton className="h-7 w-16" /> : value}
            </div>
          </div>
          <div className="w-10 h-10 rounded-md bg-primary/10 text-primary grid place-items-center"><Icon className="h-5 w-5" /></div>
        </div>
      </CardContent>
    </Card>
  );
  if (!to) return inner;
  return <Link to={to as any} search={search as any}>{inner}</Link>;
}

function QuickCard({ title, desc, to, icon: Icon }: { title: string; desc: string; to: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-primary text-primary-foreground grid place-items-center"><Icon className="h-4 w-4" /></div>
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
