import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/portal/ComingSoon";

export const Route = createFileRoute("/_authenticated/departments")({
  component: () => <ComingSoon title="Departments" description="Faculties, departments and programmes." />,
});
