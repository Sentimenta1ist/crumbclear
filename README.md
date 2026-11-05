<p align="center">
  <img src="icons/icon128.png" width="96" height="96" alt="CrumbClear icon">
</p>

<h1 align="center">CrumbClear</h1>

<p align="center">
  <b>Auto delete cookies when you close a tab.</b><br>
  Cookies, localStorage, IndexedDB, cache and service workers of the closed site, gone. Sites you trust stay logged in. Free and open source.
</p>

<p align="center">
  <img alt="Manifest V3" src="https://img.shields.io/badge/Manifest-V3-0f766e">
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-2f8f5b">
  <img alt="No network requests" src="https://img.shields.io/badge/network%20requests-none-2f8f5b">
  <img alt="Version" src="https://img.shields.io/badge/version-1.2.0-555">
  <img alt="Languages" src="https://img.shields.io/badge/languages-6-555">
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/aggadloggaflppnahldcfmhhedonhjia?utm_source=github&utm_medium=readme"><b>Install from the Chrome Web Store</b></a> ·
  <a href="https://sentimenta1ist.github.io/crumbclear/privacy.html">Privacy policy</a> ·
  <a href="https://github.com/Sentimenta1ist/crumbclear/issues">Report an issue</a>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="store/screenshots/en/4-dark.jpg">
    <img src="store/screenshots/en/1.jpg" width="820" alt="CrumbClear popup showing the current site, its cookie count, the Clean on close / Until restart / Keep switch and Undo">
  </picture>
</p>

## Why

Close the last tab of a site, and CrumbClear deletes the cookies and site data it left behind. Trackers embedded on that site go with it. Sites you put on your Keep list are never touched, so you stay logged in where it matters.

It started as a replacement for Cookie AutoDelete, which stopped working when Chrome turned off Manifest V2 extensions. You can import your old lists in one step.

## Features

| | |
|---|---|
| <img src="icons/readme/eraser.svg" width="18" height="18" alt="" align="top"> **Cleans on tab close** | Cookies and, optionally, localStorage, IndexedDB, cache storage and service workers, after a delay you choose (instantly to 15 minutes). |
| <img src="icons/readme/pin.svg" width="18" height="18" alt="" align="top"> **Keep and Until restart lists** | Keep sites forever or until the next browser start. One click in the popup, or patterns like `*.example.com`. |
| <img src="icons/readme/cookie.svg" width="18" height="18" alt="" align="top"> **More than cookies** | Partitioned (CHIPS) cookies stored under the closed site go too, and so does its site data unless you turn that off. |
| <img src="icons/readme/shield-check.svg" width="18" height="18" alt="" align="top"> **Safe first run** | Nothing is deleted after install until you pick the sites you want to stay logged in to. |
| <img src="icons/readme/key-round.svg" width="18" height="18" alt="" align="top"> **Sign-in keeps working** | Google, Microsoft, Apple, GitHub and Okta sign-in are on the Keep list from the start. Remove any you don't want. |
| <img src="icons/readme/file-input.svg" width="18" height="18" alt="" align="top"> **Cookie AutoDelete import** | Whitelist becomes Keep, greylist becomes Until restart. Plain text lists work too. |
| <img src="icons/readme/eye.svg" width="18" height="18" alt="" align="top"> **See what happens** | Cookie count on the icon, colored by what will happen to the site, and a local activity log. |
| <img src="icons/readme/undo-2.svg" width="18" height="18" alt="" align="top"> **Undo** | Cleaned too much? The last cleanup's cookies can be put back for 10 minutes. |
| <img src="icons/readme/languages.svg" width="18" height="18" alt="" align="top"> **Six languages** | English, Deutsch, 日本語, 简体中文, 繁體中文, Polski. |

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="store/screenshots/en/5-dark.jpg">
    <img src="store/screenshots/en/3.jpg" width="820" alt="CrumbClear settings page with cleanup totals and the activity log">
  </picture>
</p>

## Moving from Cookie AutoDelete

1. In Cookie AutoDelete, open Settings and choose **Export**.
2. Install CrumbClear. The settings page opens on its own.
3. Under **Import and export**, choose **Import lists…** and pick the exported file.
4. Pick any other sites to keep, then turn on auto-clean.

CrumbClear is an independent project, not affiliated with Cookie AutoDelete.

## What it does not protect against

CrumbClear cleans up after a site is closed. It does not stop malware or another extension on your computer from taking a session while the site is open, it does not block trackers while a page is open, and it does not hide your IP address. Pair it with a content blocker if you want that. What it does: a site and its trackers find nothing when you come back, and a one-time copy of your browser data holds only the sites you keep.

## Privacy

- No servers, no analytics, no ads, no network requests. A strict Content Security Policy blocks network access from the extension's pages.
- "Report a problem" opens a GitHub issue in a new tab, and after uninstalling Chrome opens a short feedback page. Both are ordinary pages that carry only the version number.
- Settings, lists and the activity log stay on your device in `chrome.storage`. Cookies for Undo are held in memory only, for 10 minutes.
- No content scripts: the extension never reads the pages you visit.

Full policy: [privacy.html](https://sentimenta1ist.github.io/crumbclear/privacy.html).

## Install

- **Chrome Web Store:** [CrumbClear: Auto Delete Cookies on Tab Close](https://chromewebstore.google.com/detail/aggadloggaflppnahldcfmhhedonhjia?utm_source=github&utm_medium=readme).
- **From source:** run `scripts/build.sh`, unzip `dist/crumbclear-<version>.zip`, open `chrome://extensions`, turn on Developer mode, click **Load unpacked** and choose the unzipped folder.

<details>
<summary><b>Development</b></summary>

### Structure
- `src/background.js` — service worker: tab events, cleanup, badge, popup messages
- `src/lib.js` — pure decision logic (what to delete, list matching, imports)
- `src/popup.*`, `src/options.*`, `src/ui.css` — UI; `src/i18n.js` and `_locales/` — translations
- `src/vendor/tldts.js` — Public Suffix List (tldts 7.4.18, MIT), so `mail.google.com` and `accounts.google.com` count as one site
- `test/` — Node tests; `scripts/build.sh` — store zip
- `privacy.html` — privacy policy; `index.html` — landing page; `LISTING.md` — store listing text; `store/` — store images; `icons/src/` — icon sources

### Tests and build
```
node --test test/*.test.mjs
scripts/build.sh
```
`background.test.mjs` runs the real service worker against an in-memory fake of the chrome APIs; `pages.test.mjs` runs the popup and options scripts against a small fake DOM. The build runs the tests and writes a zip with only `manifest.json`, the four icons, `_locales/` and `src/`.

</details>

## License

MIT, see [LICENSE](LICENSE).
