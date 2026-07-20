import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPortalUser, type AppRole } from "@/lib/portal.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, User, BookOpen, ClipboardList, Users, Building2, FileCheck2,
  Wallet, GraduationCap, LogOut, Menu, X, Bell, Award, Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import akceLogo from "@/assets/akce-logo.asset.json";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; roles?: AppRole[] };

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/apply", label: "Admission Application", icon: GraduationCap, roles: ["applicant"] },
  { to: "/courses", label: "My Courses", icon: BookOpen, roles: ["student"] },
  { to: "/registration", label: "Course Registration", icon: ClipboardList, roles: ["student"] },
  { to: "/results", label: "My Results", icon: Award, roles: ["student"] },
  { to: "/transcript", label: "My Transcript", icon: FileCheck2, roles: ["student"] },
  { to: "/fees", label: "Fees & Payments", icon: Wallet, roles: ["student","bursary","super_admin","ict_admin"] },
  { to: "/teaching", label: "My Teaching", icon: BookOpen, roles: ["lecturer"] },
  { to: "/upload-results", label: "Upload Results", icon: FileCheck2, roles: ["lecturer"] },
  { to: "/approvals", label: "Result Approvals", icon: FileCheck2, roles: ["hod","dean","registry","super_admin"] },
  { to: "/applications", label: "Admissions", icon: GraduationCap, roles: ["registry","super_admin","ict_admin"] },
  { to: "/students", label: "Students", icon: GraduationCap, roles: ["hod","dean","registry","super_admin","ict_admin"] },
  { to: "/departments", label: "Departments", icon: Building2, roles: ["super_admin","ict_admin","registry","dean"] },
  { to: "/users", label: "Users & Roles", icon: Users, roles: ["super_admin","ict_admin"] },
  { to: "/admin", label: "Administration", icon: Settings, roles: ["super_admin","ict_admin","registry"] },
];

export function PortalShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getUser = useServerFn(getPortalUser);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: user, isLoading } = useQuery({
    queryKey: ["portal", "user"],
    queryFn: () => getUser(),
    staleTime: 60_000,
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const visible = NAV.filter((n) => !n.roles || (user && n.roles.some((r) => user.roles.includes(r))));

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-sidebar text-sidebar-foreground transform transition-transform md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
          <Link to="/dashboard" className="flex items-center gap-2">
            <img src={akceLogo.url} alt="AKCOE" className="h-10 w-10 rounded-md object-cover bg-white p-0.5" />
            <div className="leading-tight">
              <div className="font-serif font-bold text-sm">AKCOE Portal</div>
              <div className="text-[10px] uppercase tracking-widest opacity-70">Academic System</div>
            </div>
          </Link>
          <button className="md:hidden" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-4rem)]">
          {visible.map((item) => {
            const active = pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to as any}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "hover:bg-sidebar-accent/50"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className="md:pl-64">
        <header className="h-16 bg-background border-b flex items-center justify-between px-4 md:px-6 sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <button className="md:hidden" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></button>
            <h1 className="font-serif text-lg text-primary">
              {visible.find((n) => n.to === pathname)?.label ?? "Portal"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-md hover:bg-muted"><Bell className="h-5 w-5" /></button>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8"><AvatarFallback className="bg-primary text-primary-foreground text-xs">{(user?.full_name ?? user?.email ?? "?").slice(0,2).toUpperCase()}</AvatarFallback></Avatar>
                <div className="hidden sm:block leading-tight">
                  <div className="text-sm font-medium">{user?.full_name ?? user?.email}</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{user?.primary_role?.replace("_"," ")}</div>
                </div>
                <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out"><LogOut className="h-4 w-4" /></Button>
              </div>
            )}
          </div>
        </header>
        <main className="p-4 md:p-6 max-w-7xl mx-auto">{children}</main>
      </div>
    </div>
  );
}
