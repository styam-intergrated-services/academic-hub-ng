# Results Audit + Spreadsheet Findings + CA1–CA4 Split

No data or files were changed in this pass. Everything below is verified against the live database and the 13 uploaded spreadsheets.

## A. Database findings

- 1,638 student records exist, all named — but only 331 of them have any result row.
- Departments with students and **zero** results: Educational Administration and Planning (469), Computer Science (259), Human Kinetics (67), Business Management (39), Sociology (25).
- Results exist for only two sessions: 2022/2023 (7,743 rows, 201 students) and 2024/2025 (1,407 rows, 130 students).
- Stale GPA: 73 students have published results but CGPA 0; 1,323 students show 0 total credit units; `gpa_records` holds only 122 rows, so semester GPA history is nearly empty college-wide.
- 143 results are stuck pre-publication (44 draft, 99 submitted) and invisible to students.
- 1,390 of 1,638 students have no login account.

## B. Spreadsheet findings (the reason imports stalled)

All the department files share one FUDMA/AKCOE workbook layout, which is a **wide matrix**, not a row-per-result sheet:

```text
row 6:  S/N | NAME & MATRIC | COURSE     |            | GCE101 | (blank) | (blank) | GCE102 ...
row 7:                        C/UNIT                  |   2
row 8:                        STATUS                  |   C
row 9:                        MAX. CONT. | CONT. SPENT |  CA   |  EXAM   |  TOTAL  |  CA ...
row 10+: 1  | TAHIR Muktar… |     8      |     1       |  24   |   26    |   50    | ...
```

Per file: a `REG.` sheet (student register + course register), then `SCR(CONT1)`/`SCR(100L)` score matrices and `CONT.1R`/`100LF` computed result sheets — 15 to 19 sheets each.

Concrete problems found:

1. **Missing columns / merged headers.** Course code, credit unit and status sit on three different header rows, with two blank spacer columns per course block. Department and programme are only in the sheet preamble, never per row. Level/contact is only in the sheet name.
2. **EXAM column empty in several files** (e.g. Computer Science 2024/2025, Arabic sets): the whole mark sits in the CA column and TOTAL repeats it — e.g. CA 60, EXAM blank, TOTAL 60. A naive import would reject these because CA is capped at 40.
3. **English 2022/2023 is effectively empty** — every CA/EXAM cell is blank and TOTAL shows "-"; only the register has data. That file yields students, not results.
4. **Some course codes are prefixed inconsistently** (`GCE 102` vs `GCE103` vs `FUDMAGCE104`, `FUDMA-ENG 111`) and need normalising against the catalogue.
5. **EGC has no department row of its own** — the 272 Guidance and Counselling students currently sit under Educational Psychology.
6. **Duplicate file** — `2024-2025_BSM_DEPARTMENT_RESULT_new.xlsx` and `..._new_1.xlsx` are byte-identical; import once.
7. Sociology and BSM graduation-list files carry final CGPA/class only, no course scores — they belong in the graduation-list flow, not the result importer.

## C. Score-integrity rule (your requirement)

No score will be altered. The importer will:

- Read TOTAL from the sheet and store it as the authoritative total, verbatim.
- Store the sheet's CA and EXAM values exactly as written; where EXAM is blank, EXAM stays blank and the mark stays in CA — no proportional splitting, no clamping to 40/60.
- Relax the current 0–40 CA / 0–60 EXAM validation so real sheet values are never rewritten, and log any out-of-range value as a warning instead of adjusting it.
- Note: earlier imports (Islamic Studies, Hausa) were loaded by a routine that derived CA/EXAM from the total (exam = min(total, 60), CA = remainder). Totals and grades there are correct; the CA/EXAM split is synthetic. Plan includes a one-time pass to restore the sheet's real CA/EXAM for those rows without touching any total.

## D. CA1–CA4 split

The source sheets carry a **single** CA figure per course, so the split is a schema and display change, not a re-scoring:

- Add `ca1`, `ca2`, `ca3`, `ca4` (nullable numeric) to `results`; keep `ca_score` as the CA total.
- On import: place the sheet's CA value into `ca1` and leave `ca2`–`ca4` empty. `ca_score` stays exactly the sheet value. Nothing is divided or estimated.
- `ca_score` becomes derived when any CA component is entered manually: `ca_score = ca1 + ca2 + ca3 + ca4`, via a database trigger, so grades stay consistent.
- Broadsheets, the results archive, the edit dialog, transcripts and the bulk PDF/DOCX exports gain CA1–CA4 columns, with the CA total and Exam/Total unchanged.
- The Excel/Word upload parser accepts `ca1..ca4` headers when a future sheet provides the breakdown.

## E. Work order

1. Migration: add `ca1`–`ca4` plus the CA-total trigger; relax the CA/EXAM range checks to warn-only.
2. Rewrite the sheet parser for the FUDMA wide-matrix layout: read the `REG.` sheet for students and course register, then each `SCR(...)` sheet for the CA/EXAM/TOTAL triplets, normalising course codes and pulling contact/level from the sheet name.
3. Create the Educational Guidance and Counselling department and move its 272 students (needs your confirmation).
4. Dry-run each file, show the validation report (unknown matric numbers, missing columns, out-of-range values, duplicates, counts by department/programme/level), then commit file by file.
5. Restore real CA/EXAM for the previously imported Islamic Studies and Hausa rows from their sheets, totals untouched.
6. Load the Sociology and BSM graduation lists into the graduation-list flow.
7. Run the chunked semester-GPA and CGPA recalculation across every student with published results.
8. Decide on the 44 draft / 99 submitted results, and bulk-create logins for the 1,390 students without accounts.
9. Surface CA1–CA4 in every results view and export.
