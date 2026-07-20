## 1. Pre-created super_admin login

I'll mint credentials myself and seed them via migration so you can sign in immediately at `/auth`.

- **Email:** `admin@akcoekano.com`
- **Password:** I'll generate a strong random one (16 chars, mixed case + digits + symbols) and show it to you **once in chat, on the next turn after you approve** — I can't generate secrets in plan mode. Save it in a password manager; I can't retrieve it later.

Migration does:
- Insert the user directly into `auth.users` with the bcrypt-hashed password, `email_confirmed_at = now()` (so no email verification needed), and provider `email`.
- Insert matching `public.profiles` row (`full_name: 'AKCOE Super Admin'`).
- Insert `('<that user id>', 'super_admin')` into `public.user_roles`.
- All idempotent via `ON CONFLICT DO NOTHING`, keyed by the fixed email.

After first login you should:
- Go to **Profile** and change the password (I'll make sure the profile page exposes a "Change password" action if it isn't already there — small UI addition only).
- Optionally create your own personal super_admin account from **Users & Roles** and stop using the shared one.

Security note: a shared, chat-delivered credential is inherently weaker than a per-person account. Rotating the password on first login closes that gap.

## 2. Android / desktop "Install this app" prompt

Manifest-only PWA (no service worker, no offline mode — you didn't ask for offline, and adding a service worker inside the Lovable preview causes stale-cache issues).

- Add `public/manifest.webmanifest` with AKCOE name, theme color (navy), background, `display: "standalone"`, and icons derived from the existing AKCOE logo (192px + 512px, plus a maskable variant).
- Add `<link rel="manifest">`, `<meta name="theme-color">`, and `apple-touch-icon` tags in `src/routes/__root.tsx` `head()`.
- Add a small `InstallPrompt` component mounted in `__root.tsx`:
  - Listens for the browser's `beforeinstallprompt` event (fires on Android Chrome / Edge / desktop Chrome when the site meets install criteria).
  - Shows a dismissible banner (not a native `alert()` — nicer UX, same effect) that says "Install AKCOE Portal as an app" with **Install** and **Not now** buttons.
  - On **Install**, calls the saved `prompt()` to trigger the native install dialog.
  - On **Not now**, stores a `localStorage` flag so we don't nag on every visit; re-shows after 7 days.
  - Also detects iOS Safari (which doesn't fire `beforeinstallprompt`) and shows a one-time hint: "Tap Share → Add to Home Screen".
  - Hides itself when already running in standalone mode (`display-mode: standalone`).
  - Hidden inside the Lovable editor preview iframe (checked via `window.self !== window.top`) so it doesn't pop up while you're building.

## Out of scope
- Offline caching / service worker.
- Push notifications.
- Native Play Store / App Store packaging.
