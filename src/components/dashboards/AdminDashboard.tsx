import type { PortalUser } from "@/lib/portal.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Building2, GraduationCap, ClipboardList, Settings, FileCheck2, Wallet } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function AdminDashboard({ user }: { user: PortalUser }) {
  const isFinancial = user.roles.includes("bursary");
  const isRegistry = user.roles.some((r) => ["registry","super_admin","ict_admin"].includes(r));
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
      </section>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={GraduationCap} label="Students" value="—" />
        <StatCard icon={Users} label="Lecturers" value="—" />
        <StatCard icon={Building2} label="Departments" value="—" />
        <StatCard icon={ClipboardList} label="Pending results" value="—" />
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
