## Goal

Produce one complete, printable list of login details for every user of the portal — staff (Provost, Exam Director, HODs, Registry/ICT, lecturers, admin) and students — so you can hand out credentials.

## The one blocker

Passwords are stored hashed, so no one (including me) can read an existing password back out of the system. For any account where the password was never recorded, the only way to give you a usable credential is to set a fresh known one.

## What I'll do

**1. Standardise temporary passwords**

- Staff (Provost, Exam Director, 9 HODs, Registry/ICT, lecturers, admin): temporary password = their registered phone number, matching the existing rule. Where a phone number is missing, generate a strong readable one (e.g. `Akcoe@2026`).
- Students: no change needed — matric-number login with year of entry as the temporary password already works for every imported student.
- Every staff account keeps the forced password change on first sign-in, so the temporary password only works once.

**2. Fill the lecturer gap**

Only one account currently carries the `lecturer` role, so result upload can't be demonstrated broadly. I'll grant the `lecturer` role to each HOD (they teach as well as approve) so every department has a working uploader.

**3. Generate the credentials sheet**

A single document (PDF + CSV) with these columns, grouped by role:

```text
Name | Staff code | Login (email or matric) | Temporary password | Role | Dashboard they land on
```

Sections:
- Provost
- Examination Director
- Heads of Department (9)
- Registry / ICT Admin / Super Admin
- Lecturers
- Students — a per-programme sheet (Islamic Studies LVT, Sociology Top-Up, Business Management Top-Up, NCE) listing matric number and entry-year password

Files land in your downloads area as `AKCOE_Portal_Logins.pdf` and `AKCOE_Portal_Logins.csv`.

**4. Sanity check**

Sign in as one staff account and one student account against the live preview to confirm the sheet's credentials actually work and route to the right dashboard.

## Technical notes

- Password resets go through the admin auth API in a server function; no schema change is needed.
- `must_change_password` stays `true` for staff so the first-login screen still fires.
- Nothing in grading, classification, graduation, standing, or the imported results data is touched.
- The credentials sheet contains live passwords — treat it as confidential and rotate anything shared broadly.
