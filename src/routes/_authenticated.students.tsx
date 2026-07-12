import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/portal/ComingSoon";

export const Route = createFileRoute("/_authenticated/students")({
  component: () => <ComingSoon title="Students" description="Manage student records within your scope." />,
});
