## UI/UX polish pass (no functional changes)

Keeps the current navy / gold / ivory identity, Playfair + Inter typography and every existing data path, server function and permission rule exactly as-is. Only presentation code changes.

### 1. Portal shell (`src/components/portal/PortalShell.tsx`)
- Add a dark scrim behind the mobile drawer so tapping outside closes it, and make the drawer slide over a proper overlay instead of floating with no backdrop.
- Group the sidebar links under section labels (Overview / Academics / Results / Administration) so long role-based menus stop reading as one flat list.
- Header: replace the raw `<button>` elements with shadcn `Button` icon variants sized for 44px touch targets, add a page-context subtitle line, and let the user chip collapse to just an avatar with a dropdown (profile, sign out) on phones.
- Fix mobile header truncation with the `grid-cols-[minmax(0,1fr)_auto]` + `min-w-0` + `truncate` pattern.
- Content area gets consistent vertical rhythm and a shared page-header block (title, description, actions) so every screen aligns.

### 2. Shared presentation primitives (new, `src/components/portal/`)
- `PageHeader` — title, subtitle, right-aligned actions slot.
- `StatCard` — one styled KPI tile used by all dashboards instead of four different card treatments.
- `EmptyState` — icon, headline, explanation, optional action. This is what shows when a table has no rows (very relevant right now, since the result tables are empty).
- `TableSkeleton` — consistent loading rows so screens stop flashing blank.

These are pure wrappers; the pages keep their own queries and logic.

### 3. Dashboards
`StudentDashboard`, `LecturerDashboard`, `AdminDashboard`, `ProvostDashboard`, plus the widgets (`SessionBanner`, `PipelineWidget`, `ApprovalsShortcut`):
- Same data, restyled through `StatCard` with clearer number/label hierarchy and gold accents on the primary metric.
- Single-column stacking on phones, 2-up at `sm`, 4-up at `lg`.
- Real empty and loading states instead of zeros with no explanation.

### 4. Results flow screens
`_authenticated.results.tsx`, `_authenticated.upload-results.tsx`, `_authenticated.approvals.tsx`, `_authenticated.broadsheet.$offeringId.tsx`, `_authenticated.transcript.tsx`, `TranscriptView`, `BroadsheetView`:
- Tables get sticky headers, zebra rows, right-aligned numerics, tabular figures and horizontal scroll containers that don't break the page on a 411px screen.
- Grade and status values (OK / ABS / INC / WH, A–F) rendered as consistent colour-coded badges from design tokens.
- Upload screen: clearer step framing for the CSV flow, visible file/validation feedback area, disabled-state reasons spelled out.
- Approvals: status pill legend and clearer stage labelling on the HOD → Registry → Senate trail.
- Broadsheet and transcript get print-friendly styling so a printed slip looks like an official document.

### 5. Mobile pass
Every live sidebar screen reviewed at 411×802: tap targets ≥44px, no horizontal page overflow, tables scroll inside their own container, forms stack, sticky action bars where a form is long.

### 6. Auth and landing
Small consistency pass on `/auth`, `/reset-password`, `/first-login` and the landing page so the signed-out surfaces match the polished portal.

---

## Separate issue: results data is not in the database

I checked the live database while planning. Current row counts:

```text
students             61
courses             251
programmes           28
course_offerings      0
course_registrations  0
results               0
result_history        0
gpa_records           0
transcripts_issued    0
```

The historical ISS-LVT import is not present, and there are no course offerings, so today a lecturer has nothing to upload against and a student has nothing to view. The code paths exist, but the results module has not been proven end-to-end against real data in this database.

**Recommendation: do not tell your client the results feature is ready yet.** After this UI round, the next round should re-run the ISS-LVT import, seed current-session course offerings, and walk the full trail (upload → HOD approve → registry publish → student view → transcript) with real records before any demo. I can plan that as the immediate follow-up.
