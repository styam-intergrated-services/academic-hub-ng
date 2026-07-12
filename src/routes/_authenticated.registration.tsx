import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/portal/ComingSoon";

export const Route = createFileRoute("/_authenticated/registration")({
  component: () => <ComingSoon title="Course Registration" description="Register for courses this semester." />,
});
