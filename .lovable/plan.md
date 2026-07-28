## What you can tell your client today

Verified against the live database and the actual routes in the app.

### Working end-to-end

- **Student login by matric number** — students sign in with matric number + entry year, get a forced/skippable password change, and land on their dashboard. 125 student records loaded.
- **Students see their results** — 2,159 course results are loaded and all 2,159 are in `published` state, so they are visible to students. Course-by-course scores, grades, grade points and CGPA all render.
- **Transcripts** — student transcript view exists with a print button (browser print → PDF), and the registry-side transcript issue flow with official serials (`AKCOE/TR/YYYY/NNNN`) works; 1 serial already issued.
- **Graduation lists** — three approved lists (Sociology 2022/23, Sociology 2024/25, Business Management 2024/25) with PDF/CSV export.
- **Approval workflow** — Lecturer → HOD → Dean → Registry → Published chain is implemented, with rejection reasons, correction requests and a full audit trail (`result_history`, immutable).
- **Result upload** — manual entry plus bulk CSV import/export, broadsheet per course offering.
- **Admin/Provost dashboards, users & roles, staff accounts** — 11 real staff accounts created with forced password change; departments/HOD wiring done.

### Not ready — three gaps, all data/setup rather than broken code

1. **No lecturer is assigned to any course.** `course_lecturers` has **0 rows** while there are 85 course offerings. A lecturer signing in today sees an empty "My Teaching" page and cannot upload anything. The allocation screen exists; the allocations just have not been made.
2. **No current semester is set.** `semesters.is_current` is false for every row. Several screens (upload targets, provost/current-term widgets, registration windows) key off the current semester and will look empty.
3. **Semester GPA history is empty.** The per-semester GPA table has 0 rows, so student profile pages show "No GPA records yet" even though the overall CGPA is correct. The imported historical results were loaded as final marks without per-semester GPA rows being generated.

Also still deliberately hidden behind feature flags (not a defect): **Course Registration** and **Fees/Payments**.

## Proposed work before you announce rollout

1. Mark the correct session/semester as current so term-scoped screens populate.
2. Allocate lecturers to their course offerings (bulk assign from the existing allocations screen, or a one-off import if you give me the lecturer↔course mapping).
3. Backfill per-semester GPA rows for the imported cohorts by running the existing recompute routine over each student/semester pair, so profile pages and standing history are complete.
4. Re-verify as a real lecturer account: sign in → see assigned course → enter/upload scores → submit → HOD approves → published, and confirm the student sees the new grade.

### Technical notes

- Gap 1/2 are pure data operations against `course_lecturers` and `semesters`; no code changes.
- Gap 3 uses the existing `recompute_semester_gpa` / `recompute_student_cgpa` functions in a backfill migration; CGPA values already match recalculation, so this only adds the missing per-semester rows and must not alter any final CGPA.
- No changes to grading, classification, graduation or standing logic.

## Recommendation

Tell the client the **student-facing side (login, results, transcript printing) is ready to pilot now**. Hold the **lecturer-facing announcement** until lecturer allocations and the current semester are set — that's a short setup task, not new development.
