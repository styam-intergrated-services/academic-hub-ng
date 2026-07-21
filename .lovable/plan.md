
## Goals

1. Let any user (including the super admin) change their password from inside the app.
2. Add a "Forgot password?" flow on the sign-in page.
3. Re-enable email confirmation on signup — after the user clicks the link in Gmail, they land signed-in on their dashboard.

## 1. Change password (works for the super admin too)

- On the Profile page, add a "Change password" card: new password + confirm password fields.
- Calls `supabase.auth.updateUser({ password })` — works for the signed-in user, so the shared `admin@akcoekano.com` account can rotate its own password anytime by signing in and updating it here.
- Show success toast and, for the super admin, a reminder to store the new password securely.

## 2. Forgot password on `/auth`

- Add a "Forgot password?" link under the sign-in form that opens a small inline form (or a `?mode=forgot` view on the same route).
- Calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })`.
- Create a new **public** route `/reset-password`:
  - Detects the recovery session from the URL.
  - Shows "Set a new password" form → calls `supabase.auth.updateUser({ password })`.
  - On success, redirects to `/` (dashboard router picks the right role).

## 3. Re-enable email verification on signup

- Turn OFF auto-confirm email in Supabase auth settings (reverse the earlier change).
- In the signup call on `/auth`, pass `emailRedirectTo: window.location.origin + '/'`.
- After the user clicks the verification link in Gmail, Supabase completes the session and redirects to `/`; the existing dashboard router lands them on their role-appropriate dashboard automatically. No extra "please verify" page is needed beyond a confirmation message on the signup form telling them to check their inbox.
- Keep the AKCOE-branded Lovable auth email templates that are already in place so the confirmation email looks like the school, not a generic Supabase message. (If templates aren't scaffolded yet, scaffold them as part of this step — requires the email domain to already be set up.)

## Technical details

- Files touched:
  - `src/routes/auth.tsx` — add "Forgot password?" link + inline request form; add `emailRedirectTo` to signup; show "Check your email to confirm" state.
  - `src/routes/reset-password.tsx` — new public route with the "set new password" form.
  - `src/routes/_authenticated/profile.tsx` (or wherever the profile page lives) — add "Change password" card.
- Supabase config: `configure_auth` with `auto_confirm_email: false`.
- No schema changes, no new tables.
- The super admin login (`admin@akcoekano.com`) continues to work; once signed in they can change the password via Profile, or use "Forgot password?" from `/auth` if they lose it (as long as the mailbox is reachable — otherwise a new migration would be needed to reset it).
