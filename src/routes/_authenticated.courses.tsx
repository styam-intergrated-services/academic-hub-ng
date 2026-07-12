import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/portal/ComingSoon";

export const Route = createFileRoute("/_authenticated/courses")({
  component: () => <ComingSoon title="My Courses" description="Your currently registered courses." />,
});
