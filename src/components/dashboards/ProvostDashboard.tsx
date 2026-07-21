import type { PortalUser } from "@/lib/portal.functions";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProvostOverview } from "@/lib/provost.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Users, GraduationCap, Building2, Layers, UserPlus, ClipboardCheck, Wallet, TrendingUp,
  FileCheck2, BookOpenCheck, CalendarDays, Megaphone, ShieldCheck, Bell,
} from "lucide-react";
import { FEATURE_FLAGS } from "@/lib/feature-flags";

const NGN = (n: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);

export function ProvostDashboard({ user }: { user: PortalUser }) {
  const overview = useServerFn(getProvostOverview);
  const { data, isLoading } = useQuery({
    queryKey: ["provost", "overview"],
    queryFn: () => overview(),
    staleTime: 30_000,
  });

  const t = data?.totals;
  const feesOn = FEATURE_FLAGS.fees;

  const cards: Array<{ label: string; value: string | null; icon: any; to?: string }> = [
    { label: "Total Students", value: t ? t.students.toLocaleString() : null, icon: GraduationCap, to: "/students" },
    { label: "Total Staff", value: t ? t.staff.toLocaleString() : null, icon: Users },
    { label: "Departments", value: t ? t.departments.toLocaleString() : null, icon: Building2, to: "/departments" },
    { label: "Programmes", value: t ? t.programmes.toLocaleString() : null, icon: Layers },
    { label: "Admissions (session)", value: t ? t.admissionsThisSession.toLocaleString() : null, icon: UserPlus, to: "/applications" },
    { label: "Registered Students", value: t ? t.registeredStudents.toLocaleString() : null, icon: ClipboardCheck },
    { label: "Outstanding Fees", value: t ? (feesOn ? t.outstandingFees.toLocaleString() : "—") : null, icon: Wallet },
    { label: "Revenue Generated", value: t ? (feesOn ? NGN(t.revenueGenerated) : "—") : null, icon: TrendingUp },
    { label: "Results Awaiting Approval", value: t ? t.resultsAwaitingSenate.toLocaleString() : null, icon: FileCheck2, to: "/approvals" },
    { label: "Published Results", value: t ? t.publishedResults.toLocaleString() : null, icon: BookOpenCheck },
    { label: "Senate Approvals Pending", value: t ? t.senatePendingCount.toLocaleString() : null, icon: ShieldCheck, to: "/announcements" },
    { label: "Unread Notifications", value: t ? t.unreadNotifications.toLocaleString() : null, icon: Bell },
  ];

  return (
    <div className="space-y-6">
      <section className="bg-hero-gradient text-white rounded-xl p-6 md:p-8 shadow-elegant">
        <div className="text-xs uppercase tracking-widest text-white/70">Office of the Provost</div>
        <h1 className="mt-2 font-serif text-3xl md:text-4xl font-bold">Welcome, {user.full_name ?? "Provost"}</h1>
        <p className="mt-2 text-white/80 max-w-2xl text-sm">
          Executive overview of Aminu Kano College of Education — enrolment, revenue, results, and senate approvals.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {user.roles.map((r) => (
            <Badge key={r} variant="secondary" className="bg-white/10 text-white border-white/20 capitalize">{r.replace("_"," ")}</Badge>
          ))}
          {data?.currentSession && (
            <Badge variant="secondary" className="bg-white/10 text-white border-white/20">Session: {data.currentSession.name}</Badge>
          )}
        </div>
      </section>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Kpi key={c.label} {...c} loading={isLoading} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg flex items-center gap-2"><Megaphone className="h-4 w-4" /> Recent Announcements</CardTitle>
            <CardDescription>Latest activity across the announcement queue.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? <Skeleton className="h-20" /> : (data?.announcements ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No announcements yet.</p>
            ) : (data?.announcements ?? []).map((a: any) => (
              <div key={a.id} className="flex items-start justify-between gap-3 border-b last:border-0 py-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{a.title}</div>
                  <div className="text-xs text-muted-foreground">{a.category} · {new Date(a.created_at).toLocaleDateString()}</div>
                </div>
                <Badge variant={a.status === "published" ? "default" : a.status === "pending_senate" ? "secondary" : "outline"} className="capitalize shrink-0">
                  {a.status.replace("_"," ")}
                </Badge>
              </div>
            ))}
            <div className="pt-2"><Link to="/announcements"><Button size="sm" variant="secondary">Manage announcements</Button></Link></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Upcoming Events</CardTitle>
            <CardDescription>Approved academic calendar events for the session.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? <Skeleton className="h-20" /> : (data?.upcomingEvents ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming events. The Registry can add calendar items.</p>
            ) : (data?.upcomingEvents ?? []).map((e: any) => (
              <div key={e.id} className="flex items-center justify-between gap-3 border-b last:border-0 py-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{e.title}</div>
                  <div className="text-xs text-muted-foreground capitalize">{e.category}</div>
                </div>
                <div className="text-xs font-mono shrink-0">{new Date(e.event_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Executive quick access</CardTitle>
          <CardDescription>The Provost's view is read-and-approve — operational tasks are handled by Registry, Bursary, ICT, Deans and HODs.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-3">
          <Link to="/reports"><Button variant="secondary" className="w-full justify-start"><TrendingUp className="h-4 w-4 mr-2" /> Reports</Button></Link>
          <Link to="/announcements"><Button variant="secondary" className="w-full justify-start"><Megaphone className="h-4 w-4 mr-2" /> Announcements</Button></Link>
          <Link to="/approvals"><Button variant="secondary" className="w-full justify-start"><FileCheck2 className="h-4 w-4 mr-2" /> Approvals queue</Button></Link>
          <Link to="/students"><Button variant="secondary" className="w-full justify-start"><GraduationCap className="h-4 w-4 mr-2" /> Students</Button></Link>
          <Link to="/applications"><Button variant="secondary" className="w-full justify-start"><UserPlus className="h-4 w-4 mr-2" /> Admissions</Button></Link>
          <Link to="/departments"><Button variant="secondary" className="w-full justify-start"><Building2 className="h-4 w-4 mr-2" /> Departments</Button></Link>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, to, loading }: { label: string; value: string | null; icon: any; to?: string; loading: boolean }) {
  const inner = (
    <Card className={to ? "hover:shadow-md transition-shadow cursor-pointer h-full" : "h-full"}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
            <div className="mt-1 text-xl md:text-2xl font-serif font-bold text-primary truncate">
              {loading || value === null ? <Skeleton className="h-7 w-16" /> : value}
            </div>
          </div>
          <div className="w-9 h-9 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0"><Icon className="h-4 w-4" /></div>
        </div>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to as any}>{inner}</Link> : inner;
}
