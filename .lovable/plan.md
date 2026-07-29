## Goal

Two things, in order:
1. Take the whole portal from "2019 bootstrap" to a 2026 editorial-tech look — real imagery, depth, motion, text-reveal animations.
2. Build the admissions/application journey as **front end only** — screens, states and flows with local mock data, no backend wiring.

Nothing about existing results, auth, roles or database logic changes.

---

## Part 1 — Visual system refresh

**Palette & tokens** (`src/styles.css`)
- Keep the Navy & Gold identity but deepen it: richer navy surfaces, a brighter champagne-gold accent, warmer ivory, plus new tokens for glass surfaces, glow, mesh gradient and elevated shadows.
- Add tokens: `--gradient-mesh`, `--glass-bg`, `--glass-border`, `--shadow-glow`, `--shadow-lift`.
- Typography scale bump: larger display sizes, tighter tracking, better line heights. Playfair Display stays for headings, Inter for body.
- Dark mode gets the same treatment, not an afterthought.

**Motion layer**
- Install `motion` (Motion for React) for reveal/stagger/layout animation.
- Build reusable primitives in `src/components/motion/`:
  - `TextReveal` — word-by-word or line-by-line masked reveal for headings
  - `Reveal` — scroll-triggered fade/slide with stagger support
  - `Counter` — animated number count-up for stats
  - `Marquee`, `Spotlight` (cursor-follow glow on cards), `Magnetic` (buttons)
- All motion respects `prefers-reduced-motion`.

**Imagery** — the site currently has zero images. Generate a branded set:
- Campus/hero photography-style images (lecture hall, students, library, graduation)
- Abstract navy/gold gradient textures for section backgrounds
- Programme-card thumbnails for the schools listing
- Subtle noise/grain overlay utility

**Pages reworked**
- `/` — full-bleed cinematic hero with layered image + mesh gradient, animated headline reveal, animated stat counters, bento grid of portal features, schools showcase with imagery, CTA band.
- `/about` — editorial layout: pull-quotes for vision/mission, scroll-revealed values, school cards with images and hover depth (replaces the flat card grid).
- `/contact` — split layout, map-style visual, animated form fields, staggered contact cards.
- `/auth` — split-screen: brand imagery panel + polished form with motion feedback.
- `SiteLayout` — glass sticky header that condenses on scroll, mobile sheet nav (currently nav links are hidden on mobile), richer footer.
- Portal shell + dashboards — refined sidebar with active-state motion, animated stat cards, skeleton polish, page transitions on route change. Layout and data stay as-is; presentation only.

---

## Part 2 — Admissions front end (no backend)

New route group under `/admissions`, driven entirely by local mock data in `src/lib/mock/admissions.ts`.

```text
/admissions            marketing page: how to apply, requirements, timeline, fees
/admissions/apply      multi-step application wizard
/admissions/status     applicant status tracker
/admissions/review     staff review queue (UI shell)
/admissions/letter     admission letter preview + print
```

**Apply wizard** — 5 animated steps with progress rail:
1. Personal details
2. Contact & origin
3. Academic history (O'level grid, prior qualifications)
4. Programme choice (1st and 2nd choice with programme cards)
5. Documents + review & submit → animated success screen with mock application number

Client-side validation with zod + react-hook-form, state held in the wizard, no persistence.

**Status tracker** — animated stepper: Submitted → Under review → Screening → Decision → Admitted, with a mock timeline.

**Review queue** — table of mock applications with filters, a detail drawer, and approve/reject/waitlist buttons that mutate local state only.

**Admission letter** — print-ready A4 letter with crest, matric number, programme, session, signature block; uses the existing print CSS.

Every screen is clearly separated from the live `/apply` route so nothing existing breaks.

---

## Technical notes

- New dependency: `motion`. No other runtime additions.
- All colors via semantic tokens in `src/styles.css` — no hardcoded hex or `text-white` in components.
- Images generated as assets and imported directly; hero image URL also wired into `og:image`/`twitter:image` on the routes that render it.
- Each new route gets its own `head()` with unique title/description/OG tags; new routes added to `sitemap.xml`.
- Zero changes to server functions, migrations, RLS or auth. The admissions module imports no Supabase client.

---

## Suggested order

1. Tokens, typography, motion primitives, image generation
2. Public pages: `/`, `/about`, `/contact`, `/auth`, `SiteLayout`
3. Portal shell + dashboard presentation polish
4. Admissions front end (5 screens)
5. Responsive + reduced-motion + dark-mode pass
