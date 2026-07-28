## What I verified

I tested the real accounts against the authentication service and drove the live site (www.akcoekano.com) in a browser:

- All 11 staff accounts (Provost, Exam Director, 9 HODs) authenticate correctly with their phone-number temporary passwords.
- Student matric login works: `FUDMA/AKCOE/22/ISL/0210` + `2022` signs in and reaches the password-setup screen.
- Staff login works: `danladiabdu4@gmail.com` + `08064662008` signs in as HOD.

So the accounts and backend are fine. The one failure I could reproduce is in the sign-in page itself.

## The bug

On my first live attempt, tapping **Sign in** silently did nothing — the page reloaded with `?email=...&password=...` in the address bar.

The sign-in page is server-rendered and its form only becomes interactive after the page's JavaScript loads. Tapping Sign in before that (common on a phone with a slow connection) makes the browser do a plain form submission: nothing reaches the auth service, no error appears, and the typed password ends up visible in the URL.

The "invalid login credentials" entries in the auth logs are separate and consistent with mistyped passwords, plus one never-confirmed account created with a typo'd email (`musbahumukhtar219@…` vs the correct `musbahmukhtar219@…`).

## Fix

1. **Stop pre-hydration submits** in `src/routes/auth.tsx` (email sign-in, matric sign-in, sign-up, forgot password): gate the submit buttons on a `hydrated` flag so they can't fall through to a native browser submit, with a brief loading state until the page is interactive.
2. **Never leak passwords into the URL**: add `method="post"` as a safety net, and on mount strip any `email`/`password` query parameters via `history.replaceState`, pre-filling only the email field.
3. **Clear error feedback**: friendly messages for wrong password, unconfirmed account, and matric mistakes ("use your year of entry as the temporary password"), so a failed attempt is never silent.
4. **Delete the typo account** `musbahumukhtar219@gmail.com` (unconfirmed, never signed in) so the Exam Director only has the correct `musbahmukhtar219@gmail.com` account.
5. **Re-verify after publishing**: student matric login, staff email login, and a deliberate wrong password showing a visible error.

## Technical details

- Frontend change is confined to `src/routes/auth.tsx`; no schema, RLS, or auth-configuration changes.
- `hydrated` state set in `useEffect` controls `disabled` on submit buttons (disabled during SSR, enabled after hydration).
- The typo account removal is an auth-admin delete of an unconfirmed user with no linked profile data.
