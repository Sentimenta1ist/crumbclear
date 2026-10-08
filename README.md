# CrumbClear

A Manifest V3 Chrome extension that deletes cookies and site data after you close the last tab of a site. Sites on your Keep list stay logged in. Imports Cookie AutoDelete lists. No servers, no analytics.

## Features
- Cleans cookies and site data (localStorage, IndexedDB, cache storage, service workers) of closed sites after a delay you choose
- Keep and Until restart lists, with patterns like `*.example.com`
- Partitioned cookies (CHIPS) follow their top-level site
- Safe first run: nothing is deleted until you pick the sites to keep
- Sign-in services (Google, Microsoft, Apple, GitHub, Okta) kept by default
- Import from Cookie AutoDelete or a plain list, export to JSON
- Cookie count on the icon and a local activity log

## Install
- Chrome Web Store: coming soon
- Development: run `scripts/build.sh`, unzip `dist/crumbclear-<version>.zip`, open `chrome://extensions`, turn on Developer mode, click "Load unpacked" and choose the unzipped folder.

## Structure
- `src/background.js` — service worker: tab events, cleanup, badge, popup messages
- `src/lib.js` — pure decision logic (what to delete, list matching, imports)
- `src/popup.*`, `src/options.*`, `src/ui.css` — UI
- `src/vendor/tldts.js` — Public Suffix List (tldts 7.4.18, MIT), so `mail.google.com` and `accounts.google.com` count as one site
- `test/` — Node tests; `scripts/build.sh` — store zip
- `privacy.html` — privacy policy; `LISTING.md` — store listing text; `store/` — store images

## Tests and build
```
node --test test/*.test.mjs
scripts/build.sh
```
`background.test.mjs` runs the real service worker against an in-memory fake of the chrome APIs; `pages.test.mjs` runs the popup and options scripts against a small fake DOM. The build runs the tests and writes a zip with only `manifest.json`, the four icons and `src/`.

## Privacy
Everything stays on your device in `chrome.storage`. Nothing is sent anywhere. Full policy: [privacy.html](privacy.html).

## License
MIT, see [LICENSE](LICENSE).
