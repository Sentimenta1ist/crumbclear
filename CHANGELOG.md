# Changelog

## 1.1.0 — 2026-10-28

### Added
- Undo: the cookies removed by the last cleanup can be put back for 10 minutes (held in memory only, never for incognito windows). Restored sites are not cleaned again until you open and close them.
- Six languages: English, German, Japanese, Simplified Chinese, Traditional Chinese, Polish.
- The popup says when a site is open in several tabs.
- A one-time request to rate CrumbClear in the Chrome Web Store, after 20 cleanups. "No thanks" hides it for good.

### Changed
- New look: teal colours and a new icon.
- "Clean" in the popup is now "Clean on close", and "Clean closed tabs" is no longer the highlighted button.
- Host access is limited to http and https sites (was all URLs).
- The cookie count on the icon reads only the current site's cookies instead of every cookie in the browser.

### Fixed
- "Clean this site" in an incognito window no longer touches the normal profile, and the reverse.
- Site data on non-default ports (for example `localhost:8080`) is now cleaned.
- Closing tabs one after another can no longer postpone the cleanup forever: at most 30 seconds past the delay.

## 1.0.1 — 2026-10-08
First public release.

### Added
- "Clean closed tabs" in the popup is unavailable until first-run setup is finished.
- Safe first run: auto-clean stays off after install until you pick the sites to keep from the ones that have cookies now.
- Google, Microsoft, Apple, GitHub and Okta sign-in are on the Keep list by default.
- Warning when a list rule covers a whole public suffix such as `com`.
- Unicode domains in lists (converted to punycode).

### Changed
- Until restart texts say that cleaning on the next start depends on "Clean on browser start".
- "Clean when a tab moves to another site" is off by default, so sign-in and 3-D Secure pages no longer break the original site's session.
- A Keep or Until restart rule for a subdomain also keeps its parent-domain cookies (`mail.google.com` keeps the `.google.com` sign-in cookies).
- The `tabs` permission is no longer requested.
- The bundled tldts library is the readable build.
- Strict Content Security Policy for the popup and settings pages: only packaged scripts, styles and images, no network access.
- Better colour contrast and labels for screen readers; settings messages are announced.

### Fixed
- A crafted list rule could freeze the extension (regex backtracking).
- Incognito host names were written to persistent storage.
- Parallel cleanups, lost tab-site tracking after the service worker restarted, loading tabs not protecting their site.
- Restored tabs are awaited before the first automatic clean after the browser starts.
- Import limits (size, nesting, number of entries); one invalid origin no longer cancels all site-data removal.
- Messages to the service worker are checked for sender and input.
- A failed storage write while a page loaded no longer stops that tab's site from being tracked.

## 1.0.0
Initial build (not published).
