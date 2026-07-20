## Result artifacts — Printable Broadsheet + Official Transcript

Focused slice on the two result-output artifacts AKCOE actually issues on paper. Both reuse the existing published-results + GPA pipeline; no grading-rule changes.

### 1. Course Broadsheet (per offering)

The sheet Registry pins on the noticeboard / files after publication.

- Route: `/broadsheet/$offeringId` (Registry, Dean, HOD-of-dept, and the offering's lecturers).
- Server fn `getBroadsheet({ offering_id })` returns: course (code, title, credit units, level), semester + session, department + school, roster ordered by matric, each row's CA/40, Exam/60, Total/100, Grade, Grade Point, plus summary stats (count, pass/fail by grade, average, highest, lowest).
- Rendered as an on-screen A4 layout using existing tokens; **Print** button uses `window.print()` with a `@media print` stylesheet (no PDF library — stays inside the Worker runtime limits, prints identical output cross-browser via the browser's built-in "Save as PDF").
- Header: AKCOE crest + full name + "OFFICE OF THE REGISTRAR", session/semester/course line.
- Signatory block (blank lines for wet signatures): **Course Lecturer · HOD · Dean · Registrar · Provost** — matches the AKCOE brief hierarchy.
- Only rows with status `published` are shown. Empty state if none.

### 2. Official Transcript (per student)

Cumulative NCE academic record.

- Student self-service: `/transcript` (own record only).
- Registry: `/students/$id/transcript` (any student).
- Server fn `getTranscript({ student_id })` (student_id defaults to `auth.uid()` for students; Registry/ICT/Super/Dean can pass any id, enforced server-side): bio (name, matric, DOB, gender, state, programme, department, school, entry session, current level, standing), then per-semester blocks in chronological order — each block lists published courses (code, title, units, grade, grade point), semester GPA, TCU (Total Credit Units), TGP (Total Grade Points), running CGPA. Footer: overall CGPA, total units earned, class of result, date issued.
- Two visual modes toggled by a `?official=1` query param:
  - **Unofficial** (default, students): watermarked "UNOFFICIAL — STUDENT COPY", no signatories.
  - **Official** (Registry only): no watermark, signatory block (Registrar · Provost), transcript serial `AKCOE/TR/<YYYY>/<seq>` recorded to a new `transcripts_issued` audit table so re-issues are traceable.
- Print via `window.print()` + `@media print` (same approach as broadsheet).
- Class of result derived from CGPA using the AKCOE bands already in `recompute_student_cgpa` (Distinction ≥4.5, Credit ≥3.5, Merit ≥2.5, Pass ≥1.0) — surfaced as a label; the DB `standing` field is unchanged.

### 3. Wiring

- Broadsheet link added on `/approvals` (per offering, after it reaches `published`) and on `/upload-results` for the lecturer.
- Transcript link added to the student dashboard ("View my transcript") and to the student detail page `/students/$id` for Registry ("Issue official transcript").
- Nav (`PortalShell`): "Transcript" for students; no new top-level entry for staff (accessed contextually from student pages).

### Technical details

- New file `src/lib/transcripts.functions.ts` — `getBroadsheet`, `getTranscript`, `issueOfficialTranscript` (Registry-only; inserts into `transcripts_issued` and returns the serial).
- New migration:
  - `transcripts_issued(id, student_id, serial, issued_by, issued_at, metadata)` with GRANTs, RLS (student can SELECT own; Registry/ICT/Super can SELECT/INSERT), no UPDATE/DELETE.
  - Small helper SQL function `next_transcript_serial(_year int)` (SECURITY DEFINER, revoked from anon/authenticated, called only via `issueOfficialTranscript`).
- New routes: `src/routes/_authenticated.broadsheet.$offeringId.tsx`, `src/routes/_authenticated.transcript.tsx`, `src/routes/_authenticated.students.$id.transcript.tsx`.
- New shared print styles appended to `src/styles.css` under `@media print` — hide `PortalShell` chrome, force A4, black-on-white, page-break rules between semester blocks.
- No new npm dependencies. Uses existing tokens, Recharts not needed here.
- Grading, GPA, CGPA, and approval flow untouched — this slice only *reads and formats* already-published data.

### Out of scope (next slices)

- Course registration UI for students (24-unit cap already enforced by DB trigger).
- Fees module + payment gating.
- Bulk transcript export for a graduating cohort.
