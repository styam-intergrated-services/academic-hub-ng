## Goal

Take the `2022-2023_DE_AKCOE_HAU.xlsx` workbook and add it to the results already in the portal — no separate system, same tables, same archive, same transcripts. Every student in that file gets a student record, a profile, a login, and a working dashboard, exactly like the Islamic Studies cohort.

## What the file contains (already inspected)

- `REG.` sheet: 124 students, matric numbers in the form `FUDMA/AKCOE/HAU/22/XXXX`, all Direct Entry.
- `SCR(CONT1)` … `SCR(CONT6)`: raw CA and Exam scores per course for Contacts 1–6 of the 2022/2023 session.
- Courses: HAU 111–161, HAU 211–261, ENG 112/132, GST 111–131, GST 211–221 and the later contacts, mostly 2 credit units.
- Contacts 2–6 also carry a "CARRYOVER COURSES" block — resits of earlier courses.

None of these 124 students, and no B.A. Hausa (LVT) programme, exist in the portal yet.

## Steps

1. **Extract the workbook** into a data file (`src/lib/imports/akcoe-hau-2022.data.json`) holding the 124 students and every course score, the same way the Islamic Studies import works. Scores are kept as separate CA and Exam values since the file provides both.

2. **Create the programme** — B.A. Hausa (LVT), FUDMA-affiliated, under the Hausa Language department (created if it isn't there), so these students sit in the right place in the department/level hierarchy.

3. **Create the 124 student records** with their names, matric numbers, entry year 2022, and the correct level based on how far they progressed.

4. **Import the results** into the existing results table as published records, so they immediately appear in the Results Archive, transcripts, broadsheets and reports alongside the 2,056 results already there. Where a course was resat in a carryover block, the later score replaces the earlier one so the final grade is the one that counts. Any result that already exists is skipped rather than duplicated.

5. **Recompute GPA/CGPA and standing** for each student from the published results.

6. **Create logins and profiles** — one account per student, signing in with their matric number and the standard temporary password `AKCOE@2022`, flagged to prompt a password change on first sign-in. A profile row carrying the student's full name is created so the dashboard greets them correctly.

7. **Verify** by signing in as one of the Hausa students and confirming the dashboard shows their courses, grades, GPA/CGPA and transcript, and that the Results Archive now lists Hausa Language alongside Islamic Studies.

## Technical notes

The import runs through the existing `admin_bulk_import_results` routine (extended slightly to accept a full name and a programme hint for new students) rather than a new one-off function, so future score sheets from other departments follow the same path. Account creation reuses the same bulk auth-provisioning approach used for the 119 existing student accounts. A dry-run pass is done first to surface any bad rows before anything is written.
