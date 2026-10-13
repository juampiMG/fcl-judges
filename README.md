# FCL Judge Desk

Client source is in `web/`. Scores stay in browser IndexedDB; tab navigation is restored from sessionStorage. Runtime access is enforced by `worker/auth.js` for every application asset.

## Build and test

Run `node --test tests/*.test.js` and `node scripts/build-auth.mjs`. The build embeds the client into `dist/server/index.js`; there is no public static-assets binding. Never edit generated `dist/` files.

Production secrets are configured in Sites: `JUDGE_PASSWORD` and `JUDGE_SESSION_SECRET`. Keep both out of source and browser bundles. Changing either invalidates existing access cookies. Local preview uses the same environment key names, with test-only values, then `node server.mjs`.

The access cookie is signed, HttpOnly, Secure, SameSite=Strict and expires after 30 days. No password is stored in it. Sites owner-private access remains a separate outer boundary.

Opening/reloading requires connectivity. The migration service worker removes only legacy FCL shell caches; it does not clear IndexedDB or sessionStorage. An already loaded counter can continue recording locally offline. Login throttling is a best-effort per-worker-instance limit, in addition to the existing private Sites boundary.
