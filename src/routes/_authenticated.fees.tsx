import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/portal/ComingSoon";

export const Route = createFileRoute("/_authenticated/fees")({
  component: () => <ComingSoon title="Fees & Payments" description="Fee structure, outstanding balances, receipts." />,
});
