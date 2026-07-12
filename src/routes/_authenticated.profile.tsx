import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/portal/ComingSoon";

export const Route = createFileRoute("/_authenticated/profile")({
  component: () => <ComingSoon title="Profile" description="View and update your personal information." />,
});
