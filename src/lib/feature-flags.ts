// Central feature-flag map. Flip a boolean to release a module.
// Hidden modules are removed from the sidebar AND gated at the route level
// so typing the URL renders a "Not available" placeholder.
export const FEATURE_FLAGS = {
  registration: false,
  fees: false,
  cohortTranscripts: false,
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag];
}
