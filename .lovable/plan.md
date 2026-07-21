## Goal

Introduce a first-class **Provost** role at AKCOE with an executive dashboard, read-only reports, an approvals surface for senate-level items, and notifications — strictly view/approve only, never operational.

Also: grant Provost to `ayubansar200@gmail.com`, and close the remaining gaps in the result pipeline that a Provost view exposes.

---

## 1. New role: `provost`

- Add `'provost'` to the `app_role` enum (migration).
- Slot into `ROLE_PRIORITY` in `src/lib/portal.functions.ts` just below `super_admin`/`ict_admin` so it takes precedence over dean/hod for dashboard routing.
- Add to the `APP_ROLES` list in `src/lib/admin.functions.ts` so it appears in the Users & Roles grant UI.
- Extend `assertRegistry`-style helpers with an `assertProvost` (read-only) and reuse `assertSenate` (provost OR registry OR super_admin) for senate-approval mutations.

### Grant to the user
- `ayubansar200@gmail.com` has **no profile yet** (unregistered). Plan: create a one-shot DB trigger `auto_grant_pending_roles` keyed on `pending_role_grants(email, role)`; when `handle_new_user` fires, drain matching rows and insert into `user_roles`. Seed one row for this email with role `provost`. When they sign up next, the role attaches automatically — no manual step needed.

---

## 2. Provost Dashboard (`src/components/dashboards/ProvostDashboard.tsx`)

Rendered from `_authenticated.dashboard.tsx` when `primary_role === 'provost'`.

**KPI cards** (one server fn `getProvostOverview` returning all counts in a single call to keep it fast):
- Total Students, Total Staff (users with any staff role), Total Departments, Total Programmes
- Admissions This Session (applications matriculated in current session), Registered Students (unique students with course_registrations in current semester)
- Students with Outstanding Fees, Revenue Generated (from `payments`) — gated behind fees feature flag; show "—" placeholder if flag off
- Results Awaiting Senate Approval (see §4), Published Results (this session)
- Upcoming Events, Recent Announcements (see §5)

**Charts**: enrollment by department (bar), GPA distribution (histogram), pass/fail rate per school (stacked bar). Reuse recharts already in AdminDashboard.

---

## 3. Provost sidebar & routes

Add to `PortalShell.tsx` nav (visible only when `roles.includes('provost')`):
- `/dashboard` — executive dashboard
- `/reports` — reports hub (new)
- `/approvals` — filtered to senate-level queue (reuse existing route with a `?scope=senate` tab)
- `/announcements` — create/approve (new, see §5)
- Read-only links: `/students`, `/applications`, `/departments`, `/broadsheet/*`, `/transcripts`

**Guard rails (Provost is view/approve only):**
- Hide from nav and gate at route-level: `/upload-results`, `/registration`, `/fees`, `/apply`, `/admin` (structure CRUD), `/users` role editing.
- Add `<FeatureUnavailable reason="read-only">` fallback if a Provost lands on a mutating route via direct URL.
- Server-side: `provost` is **not** added to any `upsertCourse/upsertDepartment/matriculate/upsertResult` authorization check — existing `assertRegistry` and lecturer/HOD checks already exclude it.

---

## 4. Reports hub (`src/routes/_authenticated.reports.tsx`)

Tabbed page (Academic / Financial / Administrative), each tab a read-only card grid with CSV export.

- **Academic**: enrolment by department, pass/fail per course, GPA distribution, graduation stats (students at NCE3 with CGPA ≥ 1.0), course registration stats per semester.
- **Financial**: total revenue, outstanding fees aging, payment trends (line chart), collection by programme. Gated by fees flag.
- **Administrative**: staff list (grouped by role), department stats (students/staff/courses per dept), admission stats (funnel: submitted → reviewed → matriculated), student population by level/gender/state.

One server fn per tab (`getAcademicReports`, `getFinancialReports`, `getAdminReports`) using `requireSupabaseAuth` + `assertProvost`.

---

## 5. Senate approvals (announcements, graduation, session opening, calendar, policies)

New tables (single migration, with GRANTs + RLS):
- `announcements(title, body, category, status: draft|pending_senate|published|archived, author_id, approved_by, approved_at, publish_at)`
- `graduation_lists(session_id, status: draft|pending_senate|approved, prepared_by, approved_by, approved_at)` + `graduation_list_entries(list_id, student_id, cgpa, classification)`
- `policy_documents(title, category, body_md, version, status: draft|pending_senate|active|archived, approved_by, approved_at)`
- `academic_calendar_events(session_id, title, event_date, category, description, is_public)` — Provost approves the whole calendar per session via `academic_sessions.calendar_approved_by/_at` columns.

**Approval surface**: extend `/approvals` with tabs — Results (existing) / Announcements / Graduation Lists / Policies / Calendar & Sessions. Provost sees only items in `pending_senate`; approve/reject writes audit_logs entry.

**"Senate-approved results" toggle**: add `results.requires_senate` boolean (default false). When a Dean marks a course result batch as senate-required (e.g. final-year), Registry publish is blocked until Provost approves. Optional; ships off by default so existing flow is unchanged.

---

## 6. Result-management gaps still open (Provost view surfaces these)

Ship the ones that plug real holes; skip the nice-to-haves for later:

1. **Result correction / re-open workflow** — after publish, Registry can flag a `results` row `correction_requested`; the row re-enters HOD → Dean → Registry → (Provost if senate-required) with the reason logged in `result_history`. Recomputes CGPA on re-publish.
2. **Absent / Incomplete / Withheld codes** — add `result_status_code enum('OK','ABS','INC','WH')`. `fill_result_grade` treats non-OK as no grade point; `recompute_*_gpa` excludes them from units. Broadsheet & transcript render the code instead of a numeric grade.
3. **Moderation flags on the broadsheet** — auto-tag courses with >90% A or >40% F for HOD review; surface as a pill on `/approvals` and in the Provost's "Result Analytics" report.
4. **Carry-over surface** — a materialized `carry_over_courses` view (student × failed offering) drives a "Carry Overs" tab on `/students/:id` and the Provost's pass/fail report.

Deferred: semester GPA statement PDF (already covered by transcript UNOFFICIAL view — revisit when students explicitly request per-semester export).

---

## 7. Notifications for Provost

Extend the existing `notifications` table categories and add triggers:
- `senate_approval` — when any item enters `pending_senate` status → notify all users with `provost` role.
- `session_lifecycle` — when a session's `status` flips to `upcoming` and calendar is unapproved.
- `admissions_batch` — daily rollup when N applications reach `matriculated`.
- `revenue_milestone` — Bursary sets targets in `fee_structures`; trigger fires on % thresholds.
- `security_critical` and `system_update` — inserted by ICT admin actions (existing audit hook, add category).

Provost dashboard reads unread count from `notifications` where `user_id = auth.uid()`.

---

## Technical notes

- **Migration order**: (a) enum `provost` + `pending_role_grants` + seed row; (b) new tables (announcements, graduation_lists, policies, calendar) with GRANTs + RLS + owner/staff/provost policies; (c) `results` additions (`status_code`, `requires_senate`, `correction_requested`); (d) triggers for senate notifications and auto-grant.
- **RLS**: senate tables — draft rows visible to author + registry, `pending_senate` visible to provost, `published/active` visible to all authenticated. Mutations gated by `has_role`.
- **No changes** to `client.ts`, `client.server.ts`, `auth-middleware.ts`, `types.ts` — regenerated automatically after the enum migration.
- **Existing modules untouched**: lecturer upload, HOD/Dean approval, transcript issuance, fees gating, PWA install prompt.

---

## What I need from you before building

1. Confirm the plan, or trim any of §5/§6 you don't want yet.
2. Should the calendar/announcements be public-facing (visible on the marketing route) or portal-only?
3. For "Senate-approved results", should it default **off** (opt-in per offering) or **on** for NCE3 final-year courses?
