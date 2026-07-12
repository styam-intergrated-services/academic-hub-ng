import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/portal/ComingSoon";

export const Route = createFileRoute("/_authenticated/users")({
  component: () => <ComingSoon title="Users & Roles" description="Assign roles and permissions across the portal." />,
});
