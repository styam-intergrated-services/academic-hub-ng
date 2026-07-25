
## What the files actually contain

- **`AKCOE_ISS_2022-2023_DE.xlsx`** — the registration workbook. 15 sheets: `REG.` (nominal roll), and 7 paired sheets `SCR(CONT1..6)` + `CONT.1..6R` + `SO1`/`SO1R`. Contains the students, course codes per Contact, credit units, and course status (C/E). Score cells are blank (`-`) — this is the empty template.
- **PDFs `_CONT._2.pdf`, `_3.pdf`, `_4.pdf`** — the actual scored FUDMA result sheets for Contact 2 (200L), Contact 3 (300L), Contact 4 (400L). Each row has per-course total scores with letter grades (e.g. `40E`, `71A`, `0F`) plus TCR/TCE/TGP/GPA/CGPA and PASS/CO remarks.
- Session shown: **2022/2023**. Programme: **B.A. Islamic Studies (LVT)**, Islamic Studies dept. Matric format: `FUDMA/AKCOE/22/ISL/####`.

Contacts 1, 5, 6, SO1 are empty in the sheet (not yet held at time of export) — nothing to import for those.

## Approach

Confirmed choices from the previous turn:
- Import as **published** historical results (skip approval chain).
- **Auto-create** students that don't exist yet.
- **Flexible Contact→semester mapping** — the LVT programme runs "Contacts" (residency blocks), not the standard First/Second semester rhythm. I'll model this so the mapping is editable, not baked in.

### 1. Data model changes (small)

- Add `label text` and `contact_number int` (nullable) to `semesters`. Existing rows keep `type='first'/'second'`; LVT rows use `label='Contact 2'`, `contact_number=2`. The `semester_type` enum stays as-is (first/second) — LVT rows will pick one arbitrarily (first for odd contacts, second for even) purely to satisfy NOT NULL, with the display driven by `label`.
- Add an admin screen (Registry/Super Admin only, unlinked from nav for now) `/semesters` to rename/relabel semesters and change their `contact_number` — this is the "room for change in contact semester feature" the user asked for.
- Ensure course `category` is set correctly for GST vs ISL courses that are inserted on the fly (GST → `general_studies`, ISL → `subject_major`).

### 2. Extraction pipeline (one-shot server-side script, not user-facing)

Written as a `createServerFn` under `src/lib/imports/iss-lvt-2022.functions.ts`, gated to `super_admin`, invoked once from a hidden `/admin/import-iss-lvt-2022` route:

```text
For each PDF (Contact 2, 3, 4):
  1. pdftotext -layout → parsed via a hand-tuned regex per header row.
  2. Extract:
      - Contact number + level (200/300/400) from header
      - Column course codes (ISL***, GST***) with their credit units
      - Per student: matric, name, then a score cell per column like "40E" or "0F" or "-"
  3. Yield rows: { matric, name, contact_no, course_code, credit_units, category, total_score }
```

Because manually parsing 3 fixed-format PDFs is fragile, the parser runs in **preview mode first**: it writes a `/mnt/documents/iss-lvt-preview.csv` and shows a diff table (students to create, offerings to create, results to insert) before any DB write. Only after the admin clicks **Confirm import** do writes happen.

### 3. Upsert order

```text
1. Session          → academic_sessions where name='2022/2023' (create if absent)
2. Semesters        → one per Contact seen (e.g. 'Contact 2', contact_number=2)
                      linked to the session
3. Courses          → for every course code encountered, upsert into `courses`
                      under Islamic Studies dept, level = Contact level,
                      credit_units from the sheet, category = general_studies (GST*)
                      or subject_major (ISL*)
4. Course offerings → one per (course, semester) pair
5. Students         → upsert by matric_number under B.A. Islamic Studies (LVT),
                      department = Islamic Studies, entry_year=2022, current_level_id
                      = the highest Contact seen for that matric,
                      auth_user_id = NULL (they claim via matric login later),
                      default_password_changed = FALSE
6. Course registrations → one approved row per (student, offering)
7. Results          → one row per (student, offering):
                        ca_score = 0
                        exam_score = total_score from PDF
                        status = 'published'
                        status_code = 'OK' when numeric, else 'ABS' for missing/dash
                      Grade + grade_point are computed by the existing
                      fill_result_grade trigger; CGPA/GPA/standing are refreshed
                      by on_result_published_after.
8. Audit            → one audit_logs row per import batch (entity='results',
                      metadata={source: 'ISS-LVT-2022-2023', pdf: <filename>, rows: N}).
```

Notes on the score model: the PDFs only give a **total** per course (letter appended is derived), not a CA/Exam split. Storing `ca_score=0, exam_score=total` preserves the total and lets `fill_result_grade` recompute the correct letter via the 5-point scale. If you'd rather encode the historical split as null CA / total in exam, it stays consistent with transcripts and broadsheets.

### 4. Registration-trigger workaround

`validate_registration()` blocks inserts when `registration_open=false` and caps at 24 units. For historical import we bypass by setting `registration_open=true` on the LVT semesters temporarily inside the same transaction, or by calling a new SECURITY DEFINER function `admin_insert_historical_registration(...)` that skips the trigger. I'll take the second approach — cleaner, leaves no side effects.

### 5. UI additions (all admin-only, unlinked from nav per prior convention)

- `/admin/import-iss-lvt-2022` — the import runner (Preview → Confirm). Shows extracted counts, warnings, and post-import summary.
- `/semesters` — list/rename semesters, change `label` and `contact_number`, toggle `is_current`. Registry + Super Admin only.

### 6. Verification after import

- Query a handful of matrics against the PDF: MUHAMMAD Kabir Yahaya (0105), HAMBALI Muhammad (0210), ABDULLAHI Muhammad Adam (0218) — confirm their Contact 2 total scores, GPA, and CGPA match the PDF's TGP/GPA/CGPA columns. If GPA computed from grades differs from the PDF value by more than ±0.02, halt and surface the mismatch.
- Sample the transcript view for one of them to visually confirm.

## Technical section (implementation detail)

- **Files added**: `src/lib/imports/iss-lvt-2022.functions.ts`, `src/lib/imports/iss-lvt-parser.ts` (pure, unit-testable), `src/routes/_authenticated/admin.import-iss-lvt-2022.tsx`, `src/routes/_authenticated/semesters.tsx`, `src/lib/semesters.functions.ts`.
- **Migrations**:
  1. `ALTER TABLE semesters ADD COLUMN label text, ADD COLUMN contact_number int;`
  2. `CREATE FUNCTION admin_insert_historical_registration(...) SECURITY DEFINER` — inserts into `course_registrations` bypassing `validate_registration` (gated to `super_admin`).
  3. Grants + RLS: `semesters` UPDATE policy widened to registry+super_admin for `label`, `contact_number`, `is_current` only.
- **PDFs are parsed at import time** on the server using `pdf-parse` (pure JS, Worker-safe) — no `pdftotext` needed at runtime; the parser fixture is validated locally against the three provided files.
- **The XLSX is NOT ingested** — its score cells are all blank. It's kept only as a reference to cross-check credit units and course codes during parsing (checked-in as a JSON fixture `src/lib/imports/iss-lvt-2022.registration.json`).

## Out of scope for this plan

- Contact 1, 5, 6, SO1 (no scored data supplied).
- Any change to grading scale, classification thresholds, standing rules, or approval chain.
- Sidebar/nav entries for the new admin pages (kept unlinked, direct-URL only).
- Bulk historical uploads for other cohorts — this plan is specific to ISS-LVT 2022/2023 Direct Entry. The parser + import runner will be structured so a second cohort just needs a new fixture and a new route entry.
