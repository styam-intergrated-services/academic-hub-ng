## 1. Give you admin access

You currently have no way to self-promote because role assignment itself requires `super_admin` / `ict_admin`. I'll bootstrap you once via a Supabase migration, then you can grant every other role from `/users` yourself.

Steps:
- You tell me the email you'll sign in with (or already signed up with) on the portal.
- I ship a one-shot migration that:
  - Ensures a `profiles` row exists for that email (via `auth.users` lookup).
  - Inserts `('<your-user-id>', 'super_admin')` into `public.user_roles` (idempotent, `ON CONFLICT DO NOTHING`).
- After sign-in, you'll see **Users & Roles**, **Administration**, **Departments**, **Admissions**, **Approvals**, etc. in the sidebar and can grant `ict_admin`, `registry`, `bursary`, `dean`, `hod`, `lecturer` to real staff from the UI.

No hardcoded credentials, no client-side admin checks — the role lives in `user_roles` and every server fn keeps checking it via `has_role` / `has_any_role`.

## 2. Build course registration + fees, but keep them hidden

Approach: build the backend + pages fully, but don't expose them anywhere a normal user can reach. This lets us flip them on later per-role without another build.

### Course registration (student-facing, hidden)
- Backend already has `course_registrations`, `validate_registration` trigger (24-unit cap, respects `semesters.registration_open`), and `SessionBanner` to toggle open/closed.
- Add `src/lib/registration.functions.ts`: `listOpenCatalogForMe`, `listMyRegistrations`, `registerCourse`, `dropCourse` — all `requireSupabaseAuth`, student-only.
- The route file `_authenticated.registration.tsx` already exists as ComingSoon; I'll implement the real UI there (open semester, add/drop, live unit counter, prerequisite check) but:
  - **Remove it from `NAV` in `PortalShell.tsx`** so no sidebar entry renders.
  - Add a `FEATURE_FLAGS` map in `src/lib/feature-flags.ts` (`{ registration: false, fees: false }`) and gate the route's `component` behind it — flag off renders a 404-style "Not available" page even if someone types the URL.
  - Flip a single boolean later to release.

### Fees & payments (hidden)
- Add `fee_structures` seeding helpers and a `payments` server-fn surface (`listMyFees`, `recordManualPayment` for Bursary, `myPaymentStatus`) — no gateway integration yet (Paystack/Remita can be a later slice; the college brief doesn't mandate one).
- Build `_authenticated.fees.tsx` UI (student view: outstanding balance, receipts; bursary view: post payment, per-student ledger).
- Hide the same way: remove `Fees & Payments` from `NAV`, gate route by `FEATURE_FLAGS.fees`.
- **Do NOT wire fee-gating into `validate_registration` yet.** When you're ready to enforce "no registration without payment", it becomes a one-line addition to that trigger + flipping the flag.

### Bulk / graduating-cohort transcripts (hidden)
- Add `getCohortTranscripts(programme_id, entry_year)` server fn and a `/transcripts/cohort` printable page (one transcript per page, page-break rules already in `styles.css`).
- Hidden the same way — no nav entry, gated by `FEATURE_FLAGS.cohortTranscripts`. Registry can still issue single official transcripts from `/students/:id` as today.

### What "hidden" concretely means
```text
NAV in PortalShell.tsx       -> entries removed for registration / fees
src/lib/feature-flags.ts     -> { registration:false, fees:false, cohortTranscripts:false }
route file component         -> if (!FEATURE_FLAGS.x) return <NotAvailable/>;
dashboards                   -> student/bursary/admin widgets for these areas conditionally rendered
```
No DB rollback needed to release later — you just flip the flag.

## Out of scope for this slice
- Payment gateway integration (Paystack/Remita).
- Enforcing fee-payment as a precondition for course registration (trigger change).
- Public marketing pages.

## What I need from you before building
- The email address of your portal account so I can grant `super_admin` in the bootstrap migration.
