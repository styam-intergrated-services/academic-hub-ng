## Admin Dashboard + Result Uploading (fully functional)

Ships bulk CSV score entry for lecturers, four admin-dashboard widgets, and tightens the existing per-offering approval flow. No change to the AKCOE grading rules already in place (CA/40, Exam/60, 5-point NCE scale, 24-unit cap, Lecturer → HOD → Dean → Registry → Published).

### 1. Result upload — Bulk CSV import/export

On `/upload-results`, after selecting an offering:
- **Export roster CSV**: `matric_number,full_name,ca_score,exam_score` (prefilled with any existing draft/rejected scores; approved/published rows exported read-only, greyed out on re-import).
- **Import CSV**: parse client-side, validate every row (matric exists in roster, CA 0–40, Exam 0–60, numeric, no duplicates), show a pre-commit summary (`X to insert, Y to update, Z errors, W skipped-locked`), then one server call writes all valid rows as `draft`.
- Server fn `upsertResultsBulk({ offering_id, rows[] })` — validates offering ownership, filters to registrations that belong to the offering, rejects rows whose current status isn't editable (`draft`/`*_rejected`), inserts/updates in a single round-trip.
- Existing single-row save + Submit-for-approval stay unchanged.

### 2. Admin dashboard widgets

Extend `getManagementStats` (already returns `pipeline` + `currentSemesterId`) with a small `pendingForMe` bundle and a `currentSemester` object (session name, semester type, `registration_open`).

- **Results pipeline widget** — horizontal funnel bar for the current semester using the existing `pipeline` counts (draft → submitted → hod_approved → dean_approved → registry_approved → published, plus rejected). Role-scoped: HOD/Dean see their scope only (server-side filter by department/faculty offerings).
- **Approvals queue shortcut** — card listing top 5 offerings awaiting *my* level (HOD→submitted, Dean→hod_approved, Registry→dean_approved+registry_approved-to-publish), each row shows course code/title, semester, count, "Review" → `/approvals`.
- **Session control banner** — shows `Current session · Semester · Registration [open/closed]`. Registry / super_admin / ict_admin get a toggle (`setRegistrationOpen(open: boolean)` server fn writing `semesters.registration_open` for the current semester, audited).
- **Role-scoped drilldowns** — KPI cards and chart bars become links with search params: Students → `/students?standing=probation` etc; pipeline segments → `/approvals?status=submitted`. `/students` and `/approvals` read those params and prefilter.

### 3. Approvals

Keep per-offering behavior. Small quality fixes only:
- Surface `rejection_reason` on the roster for `*_rejected` rows so the lecturer sees why before resubmitting.
- Show approver name + timestamp per stage on the approvals card.

### Technical details

- **New server fns** in `src/lib/results.functions.ts`: `upsertResultsBulk`, `setRegistrationOpen`. Both under `requireSupabaseAuth`; `upsertResultsBulk` verifies caller teaches the offering; `setRegistrationOpen` requires registry/super_admin/ict_admin and writes `audit_logs`.
- **Extend** `getManagementStats` in `src/lib/students.functions.ts` to include `currentSemester` (session name, type, `registration_open`) and `pendingForMe: [{ offering_id, course_code, course_title, semester, count }]` for the caller's approval level, scoped by department/faculty.
- **CSV parsing** client-side with a tiny parser (no new dependency) — RFC-4180-lite, quoted fields, BOM-safe. Export uses `Blob` + object URL; import uses `<input type="file">`.
- **UI**: new `src/components/dashboards/widgets/{PipelineWidget,ApprovalsShortcut,SessionBanner}.tsx`; extend `AdminDashboard.tsx` to render them and wire drilldown links. `/upload-results` gains an `ImportExportBar` above the roster table.
- **Route params**: `/students` and `/approvals` add `validateSearch` for the new filters and honor them in their queries.
- **Rejection reason** column already exists on `results` — no schema change. No migration needed for this slice.

### Deliverables

- `src/lib/results.functions.ts` (add `upsertResultsBulk`, `setRegistrationOpen`)
- `src/lib/students.functions.ts` (extend `getManagementStats`)
- `src/routes/_authenticated.upload-results.tsx` (CSV bar, rejection reason surfacing)
- `src/components/dashboards/AdminDashboard.tsx` + `src/components/dashboards/widgets/*`
- `src/routes/_authenticated.students.index.tsx`, `src/routes/_authenticated.approvals.tsx` (search-param prefilters)

### Out of scope (for a later slice)

- Printable broadsheet PDF, per-row approvals, inline bulk edit UI (skipped per your picks).
- Auto-recompute GPA outside the existing publish trigger.
