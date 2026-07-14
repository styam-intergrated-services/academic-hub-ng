## Students Directory + HOD/Dean Views

Build a proper students-records surface plus role-aware analytics for HODs, Deans, Registry, ICT and Super Admin. Fills out the `/students` route (currently ComingSoon) and upgrades the Admin dashboard with real KPIs scoped by role.

### Scope

1. **Students directory (`/students`)**
   - Server-side searchable, filterable, paginated list of students.
   - Filters: department, programme, level, session of admission, standing (excellent/good/probation/withdrawn), status (active/suspended/graduated/withdrawn), free-text search on matric number / name / email.
   - Table columns: matric no, full name, programme, department, level, CGPA, standing, status.
   - Row action → Student detail drawer/page.
   - Role scoping enforced server-side:
     - `hod` → only students in their department.
     - `dean` → only students in departments under their faculty.
     - `registry`, `super_admin`, `ict_admin` → all students.
     - `lecturer` → only students registered in one of their offerings (read-only, minimal columns).
   - Export current filter to CSV.

2. **Student detail (`/students/$id`)**
   - Header: photo/avatar, matric no, full name, programme, department, level, standing badge, status.
   - Tabs:
     - **Academic**: semester-by-semester GPA history + published results with credit units, grade, grade points; CGPA summary.
     - **Registrations**: current & past course registrations by semester.
     - **Profile**: contact/bio-data from `profiles` + `students`.
     - **Admin actions** (registry/super_admin only): change level, change status (suspend/reinstate/graduate/withdraw), reassign programme/department. All writes audited into `audit_logs`.

3. **HOD/Dean management views (upgrade `AdminDashboard`)**
   - Real KPIs, scoped by role:
     - Total students in scope, active, on probation, withdrawn.
     - Average CGPA in scope.
     - Pending result approvals in scope.
     - Current session/semester banner.
   - Charts (recharts, already available via shadcn):
     - Students per level (bar).
     - Standing distribution (donut).
     - Results pipeline (draft → submitted → approved → published) for the current semester.
   - "My department/faculty" quick links.

4. **Server functions (`src/lib/students.functions.ts`)**
   - `listStudents({ search, department_id, programme_id, level_id, session_id, standing, status, page, pageSize })` → paginated rows + total count, scoped by caller role.
   - `getStudentDetail(id)` → student + profile + programme + department + level + gpa_records + published results + registrations, with authorization check.
   - `updateStudentAdmin({ id, patch })` → registry/super_admin only; validates transitions; writes `audit_logs`.
   - `getManagementStats()` → role-scoped KPI bundle for the dashboard.
   - All use `.middleware([requireSupabaseAuth])`; scope enforced in-handler on top of RLS.

5. **RLS review (migration if needed)**
   - Current `students` table has 2 policies. Confirm:
     - Students read own row.
     - Registry / super_admin / ict_admin full access.
     - HOD read where `department_id` matches an HOD assignment.
     - Dean read where department's faculty matches a Dean assignment.
     - Lecturer read only via join to `course_registrations` for their offerings (via a `SECURITY DEFINER` helper `public.lecturer_can_see_student(_student uuid)` to avoid recursive policy joins).
   - Same review for `gpa_records`, `course_registrations`, `results` reads so HOD/Dean detail views work under RLS.
   - Only add missing policies; do not loosen existing ones. Migration is a no-op if all policies already exist.

6. **UI plumbing**
   - New route: `src/routes/_authenticated.students.$id.tsx`.
   - Update `src/routes/_authenticated.students.tsx` to render the directory.
   - Extract a small `StudentsTable`, `StudentFilters`, `StudentDetail` under `src/components/portal/students/`.
   - Update `src/components/dashboards/AdminDashboard.tsx` to use `getManagementStats()`.
   - Add `Users2` link entry — already present in `PortalShell` for the right roles; no nav changes needed.

### Out of scope (deferred)

- Bulk import of students (CSV upload) — after this slice.
- Transcript PDF export — after Fees are in so it can include payment status.
- HOD/Dean assignment UI (which HOD owns which department) — will piggyback on the existing `/users` role admin; assignment table can come with the Admissions slice.

### Technical notes

- Pagination is server-side with `range()` + `count: 'exact'` to stay fast on thousands of rows.
- All list queries select only the columns the table shows; detail queries hydrate the rest.
- Every write in `updateStudentAdmin` inserts a matching `audit_logs` row (actor, action, before/after).
- KPI queries use aggregated SQL (single round-trip per card group) rather than fetching rows into JS.
- Charts render client-side from the aggregated payload; no client-side aggregation of raw rows.
- No schema changes to existing tables; the only DB change is additive RLS policies + a `lecturer_can_see_student` helper if not already present.

### Deliverables

- `src/lib/students.functions.ts`
- `src/routes/_authenticated.students.tsx` (directory)
- `src/routes/_authenticated.students.$id.tsx` (detail)
- `src/components/portal/students/*` (table, filters, detail tabs)
- Updated `src/components/dashboards/AdminDashboard.tsx`
- One additive migration for RLS gaps (if the review finds any)

Once approved I'll implement, then run a quick RLS + role-scope smoke test before handing back.
