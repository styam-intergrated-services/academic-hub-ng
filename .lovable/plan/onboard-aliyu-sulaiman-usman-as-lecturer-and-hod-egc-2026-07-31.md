# Onboard Aliyu Sulaiman Usman as Lecturer and HOD (EGC)

## What I found
- A profile already exists for `usmanaliyusulaiman32@gmail.com` (Aliyu Sulaiman Usman), but it has no staff code and **no roles assigned at all**.
- There is no department coded `EGC`; the next free staff code is `AKCOE12`.

## What will be done

1. **Create the department**
   - Educational Guidance and Counselling, code `EGC`, under the School of Education (SOE).

2. **Complete his staff profile**
   - Full name: Aliyu Sulaiman Usman
   - Phone: 07032517839
   - Staff code: `AKCOE12`
   - Forced password change on first login stays on (with the existing skip option).

3. **Grant roles**
   - `lecturer`
   - `hod`

4. **Link him as HOD**
   - Set him as the HOD of the new Educational Guidance and Counselling department.

5. **Login**
   - Username: `usmanaliyusulaiman32@gmail.com`
   - Temporary password: `Usman@2026` (same surname pattern as the other 11 staff)

## Technical notes
- Uses the existing `createStaffAccounts` server function path (admin auth API + `profiles` upsert + `user_roles` + `departments.hod_id`), so no new code is required beyond the department row.
- The department row is added via a data insert, not a schema migration.
- Nothing student-side, results, grading, or academic data is touched.

## Verification after applying
- Confirm the EGC department exists with his user id as `hod_id`.
- Confirm `user_roles` contains `lecturer` and `hod` for him.
- Confirm he can sign in with the email + `Usman@2026`.
