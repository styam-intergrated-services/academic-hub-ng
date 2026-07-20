import { createFileRoute } from "@tanstack/react-router";
import { FeatureUnavailable } from "@/components/portal/FeatureUnavailable";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import { ComingSoon } from "@/components/portal/ComingSoon";

export const Route = createFileRoute("/_authenticated/fees")({
  component: () =>
    FEATURE_FLAGS.fees
      ? <ComingSoon title="Fees & Payments" description="Fee structure, outstanding balances, receipts." />
      : <FeatureUnavailable title="Fees & Payments" />,
});
