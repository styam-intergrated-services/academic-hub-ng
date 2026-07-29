## Goal

Give Super Admin, Registry and Examination Officers a dedicated place to browse all published results (2,056 records), organised department by department, level by level.

## New page: Results Archive (`/results-archive`)

Visible in the sidebar under **Results** for `super_admin`, `ict_admin`, `registry` and `examination_officer`.

Layout:
1. **Filter bar** — Session, Semester/Contact, Department, Programme, Level, Course, Status code (OK/ABS/INC/WH), and a free-text search for matric number or student name.
2. **Summary strip** — total records matching the filter, number of students, number of courses, pass rate and grade distribution (A–F counts).
3. **Grouped browser** — collapsible accordion: Department → Level → Course, each row showing course code/title, credit units, number of results and average score. Expanding a course reveals its result rows (matric, name, CA, exam, total, grade, status) with a link to the existing broadsheet.
4. **Flat table view** — a toggle to see the same filtered set as one paginated table (server-side pagination, 100 rows per page) for quick scanning and export.

## Access rules

- `super_admin`, `ict_admin`, `registry`: all results, college-wide.
- `examination_officer`: identical page and features, but the query is restricted to offerings inside their assigned department/faculty/programme scope (reuses the existing `eo_covers_offering` scope logic). No change to their current permissions.
- Everyone else: no nav entry and the page returns an unauthorised message.
- Read-only throughout — no editing, approving or deleting from this page.

## Exports

- **CSV** — exports the full filtered set (not just the visible page), one row per result: session, semester, department, programme, level, course code/title, credit units, matric, student name, CA, exam, total, grade, grade point, status.
- **Printable PDF** — a departmental result sheet rendered in-browser through a print-optimised layout, with the AKCOE crest, department/level/course headings and a signature block, so Registry can print per department or per course.

## Technical notes

- New `src/lib/results-archive.functions.ts` with authenticated server functions: `getResultsArchiveFilters` (dropdown options), `getResultsArchive` (filtered + paginated rows plus grouped aggregates), and `exportResultsArchive` (full filtered set for CSV). Each resolves the caller's roles server-side and applies the exam-officer scope when applicable.
- New route `src/routes/_authenticated.results-archive.tsx` plus small presentational components under `src/components/results/`.
- One nav entry added to `src/components/portal/PortalShell.tsx`.
- No database migration and no change to existing results, approval or upload flows.
