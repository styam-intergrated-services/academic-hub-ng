# Dashboard polish, audit log at scale, RLS test CI, and staff emails

## 1. Dashboard UI/UX refresh (all roles)

Presentation-only pass over `StudentDashboard`, `LecturerDashboard`, `AdminDashboard`, `ExamOfficerDashboard`, `ProvostDashboard`, `ApplicantDashboard` and the shared widgets. No query, server function, or permission changes.

- Consistent page header per role: greeting, role badge, matric/staff code, current session/semester chip.
- Unified stat-card grid (reuse `StatCard`) with clearer hierarchy, tabular numbers, subtle staggered reveal.
- Better loading and empty states: skeletons matching final layout, friendly empty copy instead of blank cards.
- Responsive fixes: 1-column mobile, no horizontal overflow on tables/charts, tap targets ≥ 44px.
- Quick-action row per role (e.g. student: results, transcript, profile; lecturer: score entry, teaching; admin: approvals, result cycle, audit log).
- Chart polish: shared axis/tooltip styling, semantic tokens only, readable in dark mode.

## 2. Audit log page at scale

- Server-side pagination: `listAuditLogs` returns `{ rows, total, page, page_size }` with range-based paging and an exact count; page-size selector (25/50/100) and prev/next controls in the UI.
- Search runs in the database, not in memory: match across staff name, staff code, action, and department name. Staff-code and department search work by resolving matching profiles/departments to IDs first, then filtering log rows by target ID and metadata; free text also matches action and actor/target email.
- Filters (date range, action, staff code, department, search) are the single source of truth for both the table and exports.
- Add explicit department and staff-code filter inputs alongside the existing action/date filters.

## 3. Exports with the same filters

- CSV: keep current export, but export the full filtered result set (all pages) rather than the visible page.
- PDF: branded, landscape table (college name, filter summary, generated timestamp, page numbers) using `jspdf` + `jspdf-autotable` added as dependencies.
- Both buttons disabled while the filtered set is empty or loading.

## 4. CI for the RLS regression tests

Lovable has no built-in CI runner, so this lands as a repo workflow that runs wherever the project is synced to GitHub:

- Add `test` and `test:rls` scripts to `package.json` (Vitest is already a dev dependency).
- Add `.github/workflows/rls.yml`: on push and pull request, install with bun, then run `src/tests/rls-hod.test.ts`. The job fails the build if any HOD access assertion breaks.
- The suite currently skips without credentials, so the workflow also fails when the required secrets are absent — that prevents a silent green build. Repo secrets needed: `RLS_TEST_HOD_EMAIL`, `RLS_TEST_HOD_PASSWORD`, plus the Supabase URL and publishable key.

## 5. Staff assignment emails

No sender domain is configured yet, so email delivery cannot be enabled from code alone. Once a domain you own is set up:

- Scaffold app email templates and add a "Staff assignment" template (roles, department, first-login instructions).
- Send it from the staff onboarding server function right after the in-app notification, keyed idempotently to the assignment so retries don't duplicate.
- Suppressed or unverified-domain outcomes are logged and skipped; the in-app notification always still fires.

Setup button is at the end of this plan's approval message.

## Technical notes

- `listAuditLogs` changes its return shape from `AuditLogRow[]` to a paged envelope; `_authenticated.audit-logs.tsx` is the only consumer.
- Paging uses `.range()` with `count: "exact"`; profile/department name resolution stays a second lookup keyed on the current page's IDs, plus a pre-pass to translate staff-code/department search into ID filters.
- New dependencies: `jspdf`, `jspdf-autotable`. No database migrations, no RLS changes, no new tables.
