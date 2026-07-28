## Goal

Load the three official graduation spreadsheets into the portal as real college data: 63 graduating students across Sociology and Business Management degree programmes, each with a records page, a portal login, and an approved graduation list per session.

## What the files contain

Each file has the same layout: S/N, Matric No., Name, Gender, Date of Birth, State of Origin, Current Level, Entry Level, Entry Mode, Year Admitted, TCE (total credits earned), CGPA, Class, Remark. No per-course results — summary only.

| File | Programme | Session | Students |
|---|---|---|---|
| 2022-2023 Sociology | B.Sc. Sociology (Top-Up) | 2022/2023 | 7 |
| 2024-2025 Sociology | B.Sc. Sociology (Top-Up) | 2024/2025 | 17 |
| 2024/2025 BSM | B.Sc. Business Management (Top-Up) — new | 2024/2025 | 39 |

The 2024/2025 Sociology file uses short matric numbers (`FUDMA/AKCOE/1265`) while the others use the full form (`FUDMA/AKCOE/24/BSM/0902`); both are kept verbatim as the login identifier.

## Steps

1. **Add the missing programme** — create `BSC-BSM-TOPUP`, "B.Sc. Business Management (Top-Up)", degree, 4 years, FUDMA-affiliated, under the existing Business Management department. Mirrors the Sociology Top-Up record.

2. **Create the student records** — one row per student with matric number, full name, programme, department, current level (L400), entry session, entry year, gender/DOB/state on the profile, CGPA and total credits taken straight from the sheet, standing set from the CGPA, and marked inactive-on-graduation only after the list is approved (they stay active for now so their dashboards work).

3. **Build the graduation lists** — three lists, one per file, titled e.g. "2024/2025 B.Sc. Business Management Graduation List", status `approved`, each containing its students with the CGPA and the classification exactly as printed in the file (Second Class Upper / Second Class Lower — the sheet's own wording, not recomputed).

4. **Create logins** — one auth account per student using the same synthetic-email matric login already used for the Islamic Studies cohort. Temporary password = year admitted (2022 or 2024), with the existing forced password-change-on-first-login flow and its "Skip for now" option.

5. **Verify** — confirm counts (7 / 17 / 39), spot-check a few CGPAs and classifications against the sheets, and sign in as one student to confirm the dashboard and record page render.

## Notes and constraints

- Grading, classification, graduation-eligibility and academic-standing logic is left untouched. Because these files carry no course results, the automatic eligibility engine would report these students as blocked; the imported classification and CGPA are stored as historical fact from the official list rather than recomputed.
- The existing Islamic Studies 2022/2023 data is not modified.
- The header text inside all three sheets reads "B.sc BUSINESS ADMINISTRATIVE" — that appears to be a copy-paste artefact in the source documents; I'll use the programme implied by the filename and matric prefix (SOC / BSM) instead. Tell me if that's wrong.
