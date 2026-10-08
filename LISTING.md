# CrumbClear — Chrome Web Store listing

## Name
CrumbClear: Auto Delete Cookies

## Summary (132 chars max; same as the manifest description)
Auto delete cookies when you close a tab. Cookie cleaner with keep lists, partitioned cookie support and list import. No tracking.

## Category
Privacy & Security

## Description
Auto delete cookies when you close a tab. CrumbClear is a lightweight cookie cleaner for Chrome: close the last tab of a site and its cookies and site data are cleared automatically, while the sites on your whitelist (Keep list) stay logged in.

Built for Manifest V3. If you used Cookie AutoDelete before Chrome turned off Manifest V2 extensions, you can bring your lists along (see below). CrumbClear is an independent project, not affiliated with Cookie AutoDelete.

HOW IT WORKS
• When you close the last tab of a site, CrumbClear deletes its cookies after a short delay (you choose: instantly, 30 s, 1, 5 or 15 minutes).
• Optional: navigating a tab to another site can count as closing the old one (off by default, so sign-in and payment pages don't break).
• Cookies of sites still open in any tab are never cleaned automatically, including other subdomains of the same site.
• Google, Microsoft, Apple, GitHub and Okta sign-in are on the Keep list from the start, so "Sign in with…" keeps working. Remove any you don't want.

SAFE FIRST RUN
• Nothing is deleted right after you install. CrumbClear first shows the sites that have cookies now; tick the ones you want to stay logged in to, then turn on auto-clean.

KEEP WHAT YOU NEED
• Keep: never cleaned automatically. For banking, email, work tools.
• Until restart: kept while the browser is open, cleaned the next time the browser starts (with "Clean on browser start", on by default).
• One click in the popup, or patterns like *.example.com in settings.

WHAT MAKES IT DIFFERENT
• Partitioned cookies (CHIPS) are cleaned too. They follow their top-level site, so trackers embedded on a closed site go with it.
• Also clears localStorage, IndexedDB, cache storage and service workers, even for sites that never set a cookie.
• Import a Cookie AutoDelete export in one step: whitelist becomes Keep, greylist becomes Until restart. Plain text lists (one domain per line) work too.
• Cookie count on the icon, colored by what will happen to the site.
• Activity log of what was cleaned and when.

PRIVACY
CrumbClear has no servers, no analytics and no ads. Settings and lists stay in your browser. Nothing is sent anywhere.

## Permission justifications (for the review form)
• cookies: The extension's single purpose is deleting cookies of sites the user has closed. chrome.cookies.getAll lists cookies (including partitioned ones) and chrome.cookies.remove deletes those of closed sites. Cookie values are never stored or transmitted.
• Host permission <all_urls>: chrome.cookies can only read and delete cookies of hosts the extension has host permission for, and the sites a user closes can be any site, so access cannot be limited to a fixed list. The same permission exposes the URLs of open tabs, which the extension needs to know which sites are still open and must keep their cookies. No content scripts are injected and no page content is read.
• browsingData: deletes localStorage, IndexedDB, cache storage, file systems and service workers of the exact origins of closed sites (an optional setting, on by default).
• storage: saves settings, keep lists, the host names of visited sites awaiting cleanup and a local cleanup history on the device.
• alarms: runs the cleanup after the delay the user chooses (30 s to 15 min) even if the service worker was stopped in between.
• Remote code: No. All code is in the package; src/vendor/tldts.js is the readable build of the MIT-licensed tldts 7.4.18 library (Public Suffix List data).

## Data usage (Privacy practices tab)
Chrome Web Store asks extensions to disclose data they handle even when it stays on the device (User Data FAQ). Recommended answers:
• Web history: YES. Host names of visited sites are stored locally until cleaned.
• Website content: YES. Cookies (data in a website's browser storage) are read and deleted.
• All other categories (personally identifiable info, health, financial, authentication info, personal communications, location, user activity): NO. The extension reads cookies only to delete them and does not use or keep their values.
• Certifications: tick all three (no selling or transfer to third parties, no use unrelated to the single purpose, no use for creditworthiness or lending).
• Privacy policy URL: the hosted privacy.html.

## Single purpose (field text)
Automatically delete the cookies and site data of websites after the user closes all of their tabs.

## Assets
• Screenshots 1280×800 (24-bit PNG) in store/: popup-light, popup-dark, options-light, options-dark, activity-light, activity-dark.
• Small promo tile 440×280 (24-bit PNG): store/promo-440x280.png.
• Note: the options screenshots show "Clean when a tab moves to another site" switched on; it is off by default since 1.0.1.

## Launch posts
• r/chrome, r/privacy, r/browsers: "Cookie AutoDelete died with Manifest V2, so I built a replacement that also handles partitioned cookies."
• Reply in existing "Cookie AutoDelete alternative" threads where alternatives are being asked for (Vivaldi forum, Reddit). Avoid posting in Cookie AutoDelete's own issue tracker: it reads as spam and invites reports.
• AlternativeTo: list as an alternative to Cookie AutoDelete.
