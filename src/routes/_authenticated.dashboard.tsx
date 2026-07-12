import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPortalUser } from "@/lib/portal.functions";
import { StudentDashboard } from "@/components/dashboards/StudentDashboard";
import { LecturerDashboard } from "@/components/dashboards/LecturerDashboard";
import { AdminDashboard } from "@/components/dashboards/AdminDashboard";
import { ApplicantDashboard } from "@/components/dashboards/ApplicantDashboard";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardRouter,
});

function DashboardRouter() {
  const getUser = useServerFn(getPortalUser);
  const { data: user } = useSuspenseQuery({
    queryKey: ["portal", "user"],
    queryFn: () => getUser(),
    staleTime: 60_000,
  });

  switch (user.primary_role) {
    case "student":     return <StudentDashboard user={user} />;
    case "lecturer":    return <LecturerDashboard user={user} />;
    case "hod":
    case "dean":
    case "registry":
    case "bursary":
    case "ict_admin":
    case "super_admin": return <AdminDashboard user={user} />;
    default:            return <ApplicantDashboard user={user} />;
  }
}
