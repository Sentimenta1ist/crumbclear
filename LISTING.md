# CrumbClear — Chrome Web Store listing

Store page: https://chromewebstore.google.com/detail/aggadloggaflppnahldcfmhhedonhjia

The name and summary come from `_locales/*/messages.json` (`extName`, `extDescription`), so each store language shows its own. The texts below go into the dashboard by hand: Store listing → language selector at the top → Description.

Store policy: no keyword lists, no fake reviews, no other product names in the name or summary. Cookie AutoDelete is named in the description only to say what users can import, with "not affiliated".

## Name and summary (from the package)
| Language | Name | Summary |
|---|---|---|
| en | CrumbClear: Auto Delete Cookies | Auto delete cookies when you close a tab. Cookie cleaner with keep lists, partitioned cookie support and list import. No tracking. |
| de | CrumbClear: Cookies automatisch löschen | Löscht Cookies automatisch beim Schließen eines Tabs. Mit Ausnahmelisten, partitionierten Cookies und Listenimport. Kein Tracking. |
| ja | CrumbClear: Cookie 自動削除 | タブを閉じると Cookie を自動で削除。残すサイトのリスト、パーティション Cookie 対応、リストのインポート。トラッキングなし。 |
| zh_CN | CrumbClear：自动删除 Cookie | 关闭标签页时自动删除 Cookie。支持保留列表、分区 Cookie 和列表导入。无跟踪。 |
| zh_TW | CrumbClear：自動刪除 Cookie | 關閉分頁時自動刪除 Cookie。支援保留清單、分區 Cookie 與清單匯入。不追蹤。 |
| pl | CrumbClear: automatyczne usuwanie cookies | Automatycznie usuwa pliki cookie po zamknięciu karty. Listy wyjątków, obsługa partycjonowanych cookies, import list. Bez śledzenia. |

## Category
Privacy & Security

## Description — English (Global / English) · screenshots: store/screenshots/en/
Auto delete cookies when you close a tab. CrumbClear is a free, open-source cookie cleaner for Chrome: close the last tab of a site and its cookies and site data are cleared automatically, while the sites on your Keep list stay logged in.

Looking for a Cookie AutoDelete alternative that works with Manifest V3? CrumbClear imports your old whitelist and greylist in one step. It is an independent project, not affiliated with Cookie AutoDelete.

HOW IT WORKS
• Close the last tab of a site, and CrumbClear deletes its cookies after a short delay (instantly, 30 s, 1, 5 or 15 minutes).
• Cookies of sites still open in any tab are never cleaned automatically, including other subdomains of the same site.
• Google, Microsoft, Apple, GitHub and Okta sign-in are on the Keep list from the start, so "Sign in with…" keeps working.
• Optional: a tab moving to another site counts as closing the old one (off by default, so sign-in and payment pages don't break).

SAFE FIRST RUN
• Nothing is deleted right after you install. CrumbClear first shows the sites that have cookies now; tick the ones you want to stay logged in to, then turn on auto-clean.

KEEP WHAT YOU NEED
• Keep: never cleaned automatically. For banking, email, work tools.
• Until restart: kept while the browser is open, cleaned the next time it starts.
• One click in the popup, or patterns like *.example.com in settings.

NEW IN 1.1
• Undo: put back the cookies of the last cleanup for 10 minutes.
• Available in English, Deutsch, 日本語, 简体中文, 繁體中文 and Polski.
• The popup shows when a site is open in several tabs.

WHAT MAKES IT DIFFERENT
• Partitioned cookies (CHIPS) of the closed site are cleaned too, so trackers embedded on it go with it.
• Also clears localStorage, IndexedDB, cache storage and service workers, even for sites that never set a cookie.
• Cookie count on the icon, colored by what will happen to the site, and a local activity log.

PRIVACY
No servers, no analytics, no ads. Settings and lists stay in your browser. Nothing is sent anywhere. Source code: github.com/Sentimenta1ist/crumbclear

## Description — German / Deutsch · screenshots: store/screenshots/de/
Löscht Cookies automatisch, wenn Sie einen Tab schließen. CrumbClear ist ein kostenloser Open-Source-Cookie-Cleaner für Chrome: Schließen Sie den letzten Tab einer Website, werden ihre Cookies und Websitedaten automatisch gelöscht. Websites auf Ihrer Behalten-Liste bleiben angemeldet.

Sie suchen eine Alternative zu Cookie AutoDelete für Manifest V3? CrumbClear importiert Ihre Whitelist und Greylist in einem Schritt. Unabhängiges Projekt, nicht mit Cookie AutoDelete verbunden.

SO FUNKTIONIERT ES
• Nach dem Schließen des letzten Tabs einer Website löscht CrumbClear ihre Cookies nach einer kurzen Verzögerung (sofort, 30 s, 1, 5 oder 15 Minuten).
• Cookies von Websites, die noch in einem Tab offen sind, werden nie automatisch gelöscht.
• Die Anmeldung bei Google, Microsoft, Apple, GitHub und Okta ist von Anfang an auf der Behalten-Liste.

SICHERER ERSTER START
• Nach der Installation wird nichts gelöscht. Sie wählen zuerst die Websites, bei denen Sie angemeldet bleiben möchten.

LISTEN
• Behalten: wird nie automatisch gelöscht. Bis zum Neustart: bleibt, solange der Browser offen ist.
• Ein Klick im Popup oder Muster wie *.example.com in den Einstellungen.

NEU IN 1.1
• Rückgängig: Die Cookies der letzten Bereinigung lassen sich 10 Minuten lang wiederherstellen.
• Auf Deutsch, Englisch, Japanisch, Chinesisch und Polnisch.

AUSSERDEM
• Partitionierte Cookies (CHIPS) der geschlossenen Website werden mit gelöscht.
• Auch localStorage, IndexedDB, Cache-Speicher und Service Worker.
• Cookie-Anzahl am Symbol und ein lokaler Verlauf.

DATENSCHUTZ
Keine Server, keine Analyse, keine Werbung. Einstellungen und Listen bleiben in Ihrem Browser. Quellcode: github.com/Sentimenta1ist/crumbclear

## Description — Japanese / 日本語 · screenshots: store/screenshots/ja/
タブを閉じると Cookie を自動で削除。CrumbClear は無料・オープンソースの Chrome 用 Cookie クリーナーです。サイトの最後のタブを閉じると、その Cookie とサイトデータが自動で削除されます。保持リストのサイトはログインしたままです。

Manifest V3 で使える Cookie AutoDelete の代わりを探していますか？ ホワイトリストとグレーリストをそのままインポートできます。Cookie AutoDelete とは無関係の独立したプロジェクトです。

しくみ
• サイトの最後のタブを閉じると、少し待ってから Cookie を削除します（すぐに、30 秒、1・5・15 分）。
• どこかのタブで開いているサイトの Cookie は自動では削除しません。
• Google、Microsoft、Apple、GitHub、Okta のログインは最初から保持リストに入っています。

安全な初回起動
• インストール直後は何も削除しません。先にログインしたままにしたいサイトを選びます。

リスト
• 保持: 自動では削除しない。再起動まで: ブラウザを開いている間だけ保持。
• ポップアップでワンクリック、または設定で *.example.com のようなパターン。

1.1 の新機能
• 元に戻す: 前回の削除で消えた Cookie を 10 分間復元できます。
• 日本語に対応しました。

そのほか
• 閉じたサイトのパーティション Cookie（CHIPS）も削除。
• localStorage、IndexedDB、キャッシュストレージ、Service Worker も削除。
• アイコンに Cookie の数、削除の記録はブラウザ内だけ。

プライバシー
サーバーなし、分析なし、広告なし。設定とリストはブラウザ内に保存され、どこにも送信されません。ソースコード: github.com/Sentimenta1ist/crumbclear

## Description — Chinese (China) / 中文（中国）, simplified 简体 · screenshots: store/screenshots/zh_CN/
关闭标签页时自动删除 Cookie。CrumbClear 是免费开源的 Chrome Cookie 清理工具：关闭网站的最后一个标签页后，其 Cookie 和网站数据会被自动删除，保留列表中的网站保持登录。

在找适用于 Manifest V3 的 Cookie AutoDelete 替代品？CrumbClear 可一键导入你的白名单和灰名单。独立项目，与 Cookie AutoDelete 无关。

工作方式
• 关闭网站的最后一个标签页后，CrumbClear 会在短暂延迟后删除其 Cookie（立即、30 秒、1、5 或 15 分钟）。
• 仍在任何标签页中打开的网站，其 Cookie 不会被自动清理。
• Google、Microsoft、Apple、GitHub 和 Okta 登录默认在保留列表中。

安全的首次运行
• 安装后不会立即删除任何内容。先选择你想保持登录的网站。

列表
• 保留：永不自动清理。保留到重启：浏览器打开期间保留。
• 在弹出窗口中一键设置，或在设置中使用 *.example.com 这样的规则。

1.1 新功能
• 撤销：上次清理删除的 Cookie 可在 10 分钟内恢复。
• 支持简体中文。

更多
• 同时清理已关闭网站的分区 Cookie（CHIPS）。
• 还会清理 localStorage、IndexedDB、缓存存储和 Service Worker。
• 图标上显示 Cookie 数量，清理记录只保存在本地。

隐私
无服务器、无分析、无广告。设置和列表保存在你的浏览器中，不会发送到任何地方。源代码：github.com/Sentimenta1ist/crumbclear

## Description — Chinese (Taiwan) / 中文（台灣）, traditional 繁體 · screenshots: store/screenshots/zh_TW/
關閉分頁時自動刪除 Cookie。CrumbClear 是免費開源的 Chrome Cookie 清除工具：關閉網站的最後一個分頁後，其 Cookie 和網站資料會被自動刪除，保留清單中的網站維持登入。

在找適用於 Manifest V3 的 Cookie AutoDelete 替代方案？CrumbClear 可一鍵匯入你的白名單和灰名單。獨立專案，與 Cookie AutoDelete 無關。

運作方式
• 關閉網站的最後一個分頁後，CrumbClear 會在短暫延遲後刪除其 Cookie（立即、30 秒、1、5 或 15 分鐘）。
• 仍在任何分頁中開啟的網站，其 Cookie 不會被自動清除。
• Google、Microsoft、Apple、GitHub 和 Okta 登入預設在保留清單中。

安全的首次執行
• 安裝後不會立即刪除任何內容。先選擇你想保持登入的網站。

清單
• 保留：永不自動清除。保留到重新啟動：瀏覽器開啟期間保留。
• 在彈出視窗中一鍵設定，或在設定中使用 *.example.com 這樣的規則。

1.1 新功能
• 復原：上次清除刪掉的 Cookie 可在 10 分鐘內還原。
• 支援繁體中文。

更多
• 同時清除已關閉網站的分區 Cookie（CHIPS）。
• 也會清除 localStorage、IndexedDB、快取儲存空間和 Service Worker。
• 圖示上顯示 Cookie 數量，清除記錄只保存在本機。

隱私
沒有伺服器、沒有分析、沒有廣告。設定和清單保存在你的瀏覽器中，不會傳送到任何地方。原始碼：github.com/Sentimenta1ist/crumbclear

## Description — Polish / Polski · screenshots: store/screenshots/pl/
Automatycznie usuwa pliki cookie po zamknięciu karty. CrumbClear to darmowy cleaner cookies dla Chrome o otwartym kodzie: zamknij ostatnią kartę witryny, a jej pliki cookie i dane zostaną usunięte. Witryny z listy Zachowaj pozostają zalogowane.

Szukasz zamiennika Cookie AutoDelete działającego w Manifest V3? CrumbClear importuje białą i szarą listę jednym krokiem. Niezależny projekt, niepowiązany z Cookie AutoDelete.

JAK TO DZIAŁA
• Po zamknięciu ostatniej karty witryny CrumbClear usuwa jej pliki cookie po krótkim opóźnieniu (od razu, 30 s, 1, 5 lub 15 minut).
• Pliki cookie witryn otwartych w dowolnej karcie nigdy nie są czyszczone automatycznie.
• Logowanie Google, Microsoft, Apple, GitHub i Okta jest od początku na liście Zachowaj.

BEZPIECZNE PIERWSZE URUCHOMIENIE
• Zaraz po instalacji nic nie jest usuwane. Najpierw wybierasz witryny, w których chcesz pozostać zalogowany.

LISTY
• Zachowaj: nigdy nie czyszczone automatycznie. Do restartu: zachowane, dopóki przeglądarka jest otwarta.
• Jedno kliknięcie w okienku albo wzorce typu *.example.com w ustawieniach.

NOWOŚCI W 1.1
• Cofnij: pliki cookie z ostatniego czyszczenia można przywrócić przez 10 minut.
• Wersja polska.

PONADTO
• Czyści też partycjonowane pliki cookie (CHIPS) zamkniętej witryny.
• Usuwa localStorage, IndexedDB, pamięć podręczną i service workery.
• Liczba plików cookie na ikonie i lokalna historia czyszczeń.

PRYWATNOŚĆ
Bez serwerów, analityki i reklam. Ustawienia i listy zostają w przeglądarce. Kod źródłowy: github.com/Sentimenta1ist/crumbclear

## Permission justifications (for the review form)
• cookies: The extension's single purpose is deleting cookies of sites the user has closed. chrome.cookies.getAll lists cookies (including partitioned ones) and chrome.cookies.remove deletes those of closed sites. For the Undo button, the cookies removed by the last cleanup are held in chrome.storage.session (memory only) for 10 minutes and restored with chrome.cookies.set only when the user clicks Undo. Cookie values are never written to disk or transmitted.
• Host permission *://*/*: chrome.cookies can only read and delete cookies of hosts the extension has host permission for, and the sites a user closes can be any site, so access cannot be limited to a fixed list. The same permission exposes the URLs of open tabs, which the extension needs to know which sites are still open and must keep their cookies. No content scripts are injected and no page content is read.
• browsingData: deletes localStorage, IndexedDB, cache storage, file systems and service workers of the exact origins of closed sites (an optional setting, on by default).
• storage: saves settings, keep lists, the host names of visited sites awaiting cleanup and a local cleanup history on the device.
• alarms: runs the cleanup after the delay the user chooses (30 s to 15 min) even if the service worker was stopped in between.
• Remote code: No. All code is in the package; src/vendor/tldts.js is the readable build of the MIT-licensed tldts 7.4.18 library (Public Suffix List data).

## Data usage (Privacy practices tab)
Same as 1.0.1 (decision 2026-10-28: Undo is disclosed in the cookies justification instead of ticking Authentication information, which would scare users on the listing):
• Web history: YES. Host names of visited sites are stored locally until cleaned.
• Website content: YES. Cookies (data in a website's browser storage) are read and deleted; for Undo, the last cleanup's cookies are held in memory for 10 minutes.
• Authentication information: NO. If a review asks for it, tick it and resubmit.
• All other categories: NO.
• Certifications: tick all three.
• Privacy policy URL: https://sentimenta1ist.github.io/crumbclear/privacy.html

## Single purpose (field text)
Automatically delete the cookies and site data of websites after the user closes all of their tabs.

## Test instructions (Access → Test instructions)
No account or login is needed. 1) Install; the settings page opens and asks which sites to keep. Click "Keep selected and turn on auto-clean". 2) Open any website, close its tab, wait 30 seconds: its cookies are gone (Settings → Activity shows the cleanup). 3) Open the popup: "Undo" puts the cookies of the last cleanup back. The extension makes no network requests.

## Assets (store/)
• Screenshots 1280×800 JPEG, per language: `store/screenshots/<lang>/1.jpg … 3.jpg`; English also has `4-dark.jpg` and `5-dark.jpg`.
• Small promo tile 440×280: `store/promo-440x280.jpg`.
• Marquee 1400×560: `store/marquee-1400x560.jpg` (needed to be featured in collections).
• Store icon: the 128 px icon in the package (96×96 artwork with transparent padding, as the store asks).

## Links with tracking
The store shows sources of page views under Analytics → Impressions when links carry `utm_source`:
• README: `?utm_source=github&utm_medium=readme`
• Landing page: `?utm_source=landing`
• AlternativeTo: `?utm_source=alternativeto`
• X, Reddit, forums: `?utm_source=x`, `?utm_source=reddit`, `?utm_source=forum`

## Microsoft Edge Add-ons
The same zip works in Edge. Partner Center (https://partner.microsoft.com/dashboard/microsoftedge) → New extension → upload `dist/crumbclear-1.1.0.zip`. Use the descriptions above, the same screenshots, the same privacy policy URL. The rating request in the popup only shows in Chrome.

## Featured badge
After 1.1 is live: Chrome Web Store One Stop Support (https://support.google.com/chrome_webstore/contact/one_stop_support) → "I want to nominate my extension for featuring". Points to mention: open source, no network requests, strict CSP, minimal permissions, safe first run, six languages.
