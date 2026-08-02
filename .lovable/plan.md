# Email login details to users automatically

Yes, this is possible — with two important caveats.

## Caveats

1. **Passwords cannot be looked up.** Stored passwords are hashed and cannot be read back, so an email can never contain an existing password. The flow therefore *issues a fresh temporary password* for the account at the moment of sending, and the email delivers that one. The user is forced to change it at first login (the existing `must_change_password` behaviour).
2. **Students have no real email address.** Student accounts log in with matric number + entry year and use internal synthetic addresses, so nothing can be delivered to them until a real email is recorded on their record. They are skipped and reported as "no email on file". Staff/admin accounts (real emails) work immediately.

## Prerequisite: sender domain

Emails must come from a domain you own — `akcoekano.com` is already connected to this project, so a sending subdomain (e.g. `notify.akcoekano.com`) gets set up through the email setup dialog. Sending activates once DNS verifies; nothing else is needed from you afterwards.

## What will be built

1. **Branded "Your portal login details" email template**
   - AKCOE navy/gold styling, recipient name, portal URL, their login username (email), the temporary password, and a "you must change this at first sign-in" note.

2. **Server-side send action (Registry / ICT admin / Super admin only)**
   - For one account: reset to a fresh temporary password, mark `must_change_password`, send the email, write an audit log entry.
   - Reuses the existing admin password-reset path so no new privileged logic is introduced.

3. **UI in `/users`**
   - A "Send login details" button on each directory row that has a real email address (disabled with a tooltip for synthetic student accounts).
   - A bulk "Send to selected" action for staff accounts, with a confirmation dialog stating that each recipient's password will be reset.
   - Toast feedback per send, plus a summary for bulk (sent / skipped-no-email / failed).

4. **Audit trail**
   - Every send logged in `audit_logs` (who sent, to whom, when), so it appears in `/audit-logs`.

## Students — optional follow-up

If you want students to receive their details by email too, we would add an email field to the student record and an import path for their addresses. That is a separate step; say the word and it goes in the same build.

## Technical notes

- Lovable-managed email sending: React Email template in `src/lib/email-templates/`, server-only send helper, no queues or email tables.
- Send happens inside a server function guarded by the existing registry/ICT/super-admin role check, never from the browser.
- Idempotency key per (account, send event) so retries do not duplicate messages.
- No changes to grading, results, approvals, student login flow, or any academic data.
