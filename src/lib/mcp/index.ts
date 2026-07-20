import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoami from "./tools/whoami";
import listFaculties from "./tools/list-faculties";
import listMyRegistrations from "./tools/list-my-registrations";
import listMyResults from "./tools/list-my-results";
import listNotifications from "./tools/list-notifications";
import listMyCatalog from "./tools/list-my-catalog";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "akcoe-portal-mcp",
  title: "AKCOE Portal",
  version: "0.1.0",
  instructions:
    "Aminu Kano College of Education (AKCOE) portal tools. Callers act as the signed-in AKCOE user; all data access respects portal role-based security (students see only their own registrations, results, and notifications).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoami, listFaculties, listMyRegistrations, listMyResults, listNotifications, listMyCatalog],
});
