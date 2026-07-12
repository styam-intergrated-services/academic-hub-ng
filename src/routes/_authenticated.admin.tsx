import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/portal/ComingSoon";

export const Route = createFileRoute("/_authenticated/admin")({
  component: () => <ComingSoon title="Administration" description="Academic sessions, semesters and system settings." />,
});
