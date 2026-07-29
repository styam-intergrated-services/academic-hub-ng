import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPortalUser, type AppRole } from "@/lib/portal.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, User, BookOpen, ClipboardList, Users, Building2, FileCheck2,
  Wallet, GraduationCap, LogOut, Menu, X, Bell, Award, Settings, TrendingUp, Megaphone, AlertTriangle, Archive,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { cn } from "@/lib/utils";
import akceLogo from "@/assets/akce-logo.asset.json";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import { ThemeToggle } from "@/components/portal/ThemeToggle";


type NavGroup = "Overview" | "Academics" | "Results" | "Administration";

type NavItem = {
  to: string;
  label: string;
  group: NavGroup;
  icon: React.ComponentType<{ className?: string }>;
  roles?: AppRole[];
  flag?: keyof typeof FEATURE_FLAGS;
};

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", group: "Overview", icon: LayoutDashboard },
  { to: "/profile", label: "Profile", group: "Overview", icon: User },
  { to: "/apply", label: "Admission Application", group: "Academics", icon: GraduationCap, roles: ["applicant"] },
  { to: "/courses", label: "My Courses", group: "Academics", icon: BookOpen, roles: ["student"] },
  { to: "/registration", label: "Course Registration", group: "Academics", icon: ClipboardList, roles: ["student"], flag: "registration" },
  { to: "/results", label: "My Results", group: "Results", icon: Award, roles: ["student"] },
  { to: "/transcript", label: "My Transcript", group: "Results", icon: FileCheck2, roles: ["student"] },
  { to: "/fees", label: "Fees & Payments", group: "Academics", icon: Wallet, roles: ["student","bursary","super_admin","ict_admin"], flag: "fees" },
  { to: "/teaching", label: "My Teaching", group: "Academics", icon: BookOpen, roles: ["lecturer"] },
  { to: "/upload-results", label: "Upload Results", group: "Results", icon: FileCheck2, roles: ["lecturer"] },
  { to: "/approvals", label: "Result Approvals", group: "Results", icon: FileCheck2, roles: ["hod","dean","registry","super_admin","provost"] },
  { to: "/results-archive", label: "Results Archive", group: "Results", icon: Archive, roles: ["super_admin","ict_admin","registry","examination_officer"] },
  { to: "/result-cycle", label: "Semester Cycle", group: "Results", icon: CalendarRange, roles: ["super_admin","ict_admin","registry"] },
  // Soft-launched (unlinked): /scoped-results, /exam-schedule, /allocations, /exam-officers
  { to: "/reports", label: "Reports", group: "Administration", icon: TrendingUp, roles: ["provost","super_admin","ict_admin"] },
  { to: "/announcements", label: "Announcements", group: "Administration", icon: Megaphone, roles: ["provost","registry","super_admin","ict_admin","dean"] },
  { to: "/applications", label: "Admissions", group: "Administration", icon: GraduationCap, roles: ["registry","super_admin","ict_admin","provost"] },
  { to: "/students", label: "Students", group: "Academics", icon: GraduationCap, roles: ["hod","dean","registry","super_admin","ict_admin","provost"] },
  { to: "/departments", label: "Departments", group: "Administration", icon: Building2, roles: ["super_admin","ict_admin","registry","dean","provost"] },
  { to: "/users", label: "Users & Roles", group: "Administration", icon: Users, roles: ["super_admin","ict_admin"] },
  { to: "/graduation", label: "Graduation", group: "Results", icon: GraduationCap, roles: ["registry","super_admin","ict_admin","provost"] },
  { to: "/standing", label: "Academic Standing", group: "Results", icon: AlertTriangle, roles: ["registry","super_admin","ict_admin","provost","dean","hod"] },
  { to: "/admin", label: "Administration", group: "Administration", icon: Settings, roles: ["super_admin","ict_admin","registry"] },

];

export function PortalShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getUser = useServerFn(getPortalUser);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [hasSession, setHasSession] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setHasSession(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setHasSession(!!session);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  const { data: user, isLoading } = useQuery({
    queryKey: ["portal", "user"],
    queryFn: () => getUser(),
    staleTime: 60_000,
    enabled: hasSession === true,
  });

  // First-login gate:
  //  - staff/admin-created accounts (profiles.must_change_password) MUST change the
  //    temporary password before reaching anything else;
  //  - students on the default matric temp password are prompted but may postpone.
  useEffect(() => {
    if (!user) return;
    if (pathname === "/first-login") return;
    const skipped = sessionStorage.getItem("akcoe:skip-password-change") === "1";
    if (user.must_change_password) {
      if (skipped) return;
      navigate({ to: "/first-login", replace: true });
      return;
    }
    if (!user.student) return;
    if (user.student.default_password_changed) return;
    if (skipped) return;
    navigate({ to: "/first-login", replace: true });
  }, [user, pathname, navigate]);


  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    sessionStorage.removeItem("akcoe:skip-password-change");
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const visible = NAV.filter(
    (n) =>
      (!n.flag || FEATURE_FLAGS[n.flag]) &&
      (!n.roles || (user && n.roles.some((r) => user.roles.includes(r))))
  );

  const groups: NavGroup[] = ["Overview", "Academics", "Results", "Administration"];
  const currentLabel = visible.find((n) => n.to === pathname)?.label ?? "Portal";
  const initials = (user?.full_name ?? user?.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Mobile scrim */}
      {open ? (
        <div
          className="fixed inset-0 z-30 bg-foreground/50 backdrop-blur-[1px] md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col bg-sidebar text-sidebar-foreground shadow-xl transition-transform duration-200 md:w-64 md:translate-x-0 md:shadow-none",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-sidebar-border px-4">
          <Link to="/dashboard" className="flex min-w-0 items-center gap-2">
            <img
              src={akceLogo.url}
              alt="Aminu Kano College of Education logo"
              className="size-10 shrink-0 rounded-md bg-white object-cover p-0.5"
            />
            <div className="min-w-0 leading-tight">
              <div className="truncate font-serif text-sm font-bold">AKCOE Portal</div>
              <div className="truncate text-[10px] uppercase tracking-widest opacity-70">
                Academic System
              </div>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close navigation menu"
            onClick={() => setOpen(false)}
            className="size-11 shrink-0 text-sidebar-foreground hover:bg-sidebar-accent/50 md:hidden"
          >
            <X className="size-5" />
          </Button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto p-3">
          {groups.map((g) => {
            const items = visible.filter((n) => n.group === g);
            if (items.length === 0) return null;
            return (
              <div key={g} className="space-y-1">
                <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest opacity-50">
                  {g}
                </div>
                {items.map((item) => {
                  const active =
                    pathname === item.to ||
                    (item.to !== "/dashboard" && pathname.startsWith(item.to));
                  return (
                    <Link
                      key={item.to}
                      to={item.to as any}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-sm"
                          : "hover:bg-sidebar-accent/50",
                      )}
                    >
                      <item.icon className="size-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className="md:pl-64">
        <header className="sticky top-0 z-20 grid h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b bg-background/95 px-3 backdrop-blur md:px-6">
          <div className="flex min-w-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open navigation menu"
              onClick={() => setOpen(true)}
              className="size-11 shrink-0 md:hidden"
            >
              <Menu className="size-5" />
            </Button>
            <div className="min-w-0 leading-tight">
              <h1 className="truncate font-serif text-base text-primary sm:text-lg">
                {currentLabel}
              </h1>
              <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
                Aminu Kano College of Education
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              className="size-11 shrink-0"
            >
              <Bell className="size-5" />
            </Button>

            {isLoading ? (
              <Skeleton className="h-9 w-9 rounded-full sm:w-32" />
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex min-w-0 items-center gap-2 rounded-full p-1 pr-1 transition-colors hover:bg-muted sm:pr-3"
                    aria-label="Account menu"
                  >
                    <Avatar className="size-9 shrink-0">
                      <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden min-w-0 text-left leading-tight sm:block">
                      <div className="truncate text-sm font-medium">
                        {user?.full_name ?? user?.email}
                      </div>
                      <div className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">
                        {user?.primary_role?.replace("_", " ")}
                      </div>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate">
                    {user?.full_name ?? user?.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile">
                      <User className="mr-2 size-4" /> Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void signOut()}>
                    <LogOut className="mr-2 size-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

