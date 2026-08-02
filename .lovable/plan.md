# Email existing login details to each user

Yes — this is possible, and no passwords get changed. The emails simply state the credentials in the format already in use.

## Credential formats kept exactly as-is

- **Staff (Provost, Exam Director/Officers, HODs, Lecturers, admins)**
  - Username: their email address
  - Password: `Surname@2026`
  - Still prompted to set a personal password at first sign-in (unchanged).
- **Students**
  - Username: their matric number
  - Password: their year of entry
  - Nothing about the matric login flow changes.

Because the format is derived (surname / entry year), the email is generated from the record on file — no password reset, no new password, no change to `must_change_password`.

## Prerequisite: sender domain

Emails must come from a domain you own. `akcoekano.com` is already connected, so a sending subdomain (e.g. `notify.akcoekano.com`) gets set up through the email setup dialog once, then sending activates after DNS verifies.

## Where the emails go

- Staff: their real email address — ready to send immediately.
- Students: student records currently hold **no personal email address** (their login identity is a matric number), so there is nowhere to deliver to yet. The build therefore adds:
  - an optional personal email field on the student record,
  - a CSV import ("matric number, email") so you can load the addresses you have,
  - and the send action skips any student with no address, reporting them in a "no email on file" list.

## What will be built

1. **Two branded email templates** (AKCOE navy/gold)
   - *Staff login details*: name, portal link, username = email, password = `Surname@2026`, note to change it at first sign-in.
   - *Student login details*: name, portal link, username = matric number, password = entry year, short "how to sign in" steps.

2. **Send actions, admin-only** (Registry / ICT admin / Super admin)
   - Send to one recipient, or bulk send to a filtered set (all staff, a department, a programme/level cohort).
   - Read-only with respect to credentials: nothing in the auth system is modified.

3. **UI**
   - `/users`: "Email login details" per staff row, plus a bulk "Email all staff" action with a confirmation dialog.
   - `/students`: same per-student action and a bulk "Email login details" for the current filtered list, with counts of sent / skipped (no email) / failed.
   - Student email import screen for the CSV of addresses.

4. **Audit trail**
   - Every send recorded in `audit_logs` (who sent, to whom, when) and visible in `/audit-logs`.

## Technical notes

- Lovable-managed sending: React Email templates in `src/lib/email-templates/`, server-only send helper, one recipient per send, idempotency key per (recipient, send batch) so retries never duplicate.
- Passwords are rendered from the existing derived rules (surname + `@2026`; entry year) inside the server function — never read from or written to auth.
- Bulk sends are throttled to respect the hourly send allowance; a summary is returned when a batch is rate-limited so it can be resumed.
- No changes to grading, results, approvals, graduation, or any academic data.

## One thing to confirm

Do you have a list of student email addresses to import, or should student emails be collected in-app later (e.g. asked at first sign-in) and sent then?
