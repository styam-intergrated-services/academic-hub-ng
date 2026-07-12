import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/portal/ComingSoon";

export const Route = createFileRoute("/_authenticated/teaching")({
  component: () => <ComingSoon title="My Teaching" description="Courses assigned to you this semester." />,
});
