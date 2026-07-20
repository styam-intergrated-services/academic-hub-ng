import { createFileRoute } from "@tanstack/react-router";
import { FeatureUnavailable } from "@/components/portal/FeatureUnavailable";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import { ComingSoon } from "@/components/portal/ComingSoon";

export const Route = createFileRoute("/_authenticated/registration")({
  component: () =>
    FEATURE_FLAGS.registration
      ? <ComingSoon title="Course Registration" description="Register for courses this semester." />
      : <FeatureUnavailable title="Course Registration" />,
});
