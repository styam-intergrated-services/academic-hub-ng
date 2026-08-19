# Results and Student Records Audit (findings first, no changes made)

## What I checked

Live database counts for students, results, GPA records, plus the uploaded spreadsheets still sitting in the project uploads folder.

## Confirmed findings

**1. Student records exist, results do not.**
- 1,638 student records, all with names.
- Only 331 of them have any result row at all.
- Departments with students but zero results: Educational Administration and Planning (469), Computer Science (259), Human Kinetics (67), Business Management (39), Sociology (25).
- Only two sessions carry results: 2022/2023 (7,743 rows, 201 students) and 2024/2025 (1,407 rows, 130 students).

So the earlier bulk imports created the student profiles but the score sheets for most departments were never imported.

**2. Uploaded score sheets that are still not in the database (13 xlsx files, ~50 MB):**
- EGC 2025/2026 Contact One, EGC 2024/2025 complete result
- English 2022/2023
- Arabic 2022/2023, Arabic 2024/2025 (three variants incl. Level 400)
- Hausa 2022/2023 DE (partially imported)
- Computer Science 2024/2025 Level 3 (1st + 2nd)
- Business Management 2024/2025 (plus duplicate copy)
- Sociology and BSM graduation lists (2022/2023, 2024/2025)

Note: the EGC files have nowhere to land cleanly — the "Educational Guidance and Counselling" department does not exist as its own department row; those 272 students sit under Educational Psychology / B.Ed. Guidance and Counselling.

**3. GPA/CGPA is stale where results do exist.**
- 73 students have published results but CGPA still 0.
- 1,323 students have `total_credit_units` = 0.
- `gpa_records` holds only 122 rows, so the semester GPA history table is nearly empty across the college.

**4. 143 results are stuck before publication** — 44 draft, 99 submitted. Those are invisible to students until they pass the approval cycle.

**5. Login coverage:** 1,390 of 1,638 students have no auth account, so they cannot sign in to view results even once imported.

## Suggested order of work (for your approval later)

1. Per-file mapping pass: parse each pending spreadsheet, map columns to matric / course / contact / CA / exam, and produce a validation report before writing anything.
2. Decide the EGC question: create a real Educational Guidance and Counselling department and move those students, or keep them under Educational Psychology.
3. Import department by department, dry-run first, review the report, then commit.
4. Backfill GPA: run the chunked semester-GPA and CGPA recalculation across all students with published results.
5. Decide what to do with the 44 draft / 99 submitted results (publish or route through the approval cycle).
6. Bulk-create auth accounts for the 1,390 students without logins, following the existing matric/`AKCOE@<entry_year>` convention.

No files or data were changed in this pass.
