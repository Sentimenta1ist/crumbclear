import { DEFAULT_SETTINGS, LIST_KEEP, LIST_SESSION, hostFromUrl, siteOf, listStatus, cleanExpression, ruleFor } from './lib.js';
import { t, tn, localize } from './i18n.js';

const $ = (id) => document.getElementById(id);
let host = null;
let site = null;
let incognito = false;

// Ask for a store rating once, after the extension has proved itself.
const RATE_AFTER_RUNS = 20;

const HINTS = {
  '': 'hintClean',
  session: 'hintSession',
  keep: 'hintKeep',
};

async function load() {
  const { settings = {}, lists = [], stats = {} } = await chrome.storage.local.get(['settings', 'lists', 'stats']);
  const s = { ...DEFAULT_SETTINGS, ...settings };
  $('enabled').checked = s.enabled;
  $('enabledLabel').textContent = t(s.enabled ? 'autoCleanOn' : 'autoCleanOff');
  // Until the user has picked sites to keep, a manual clean would sign them out everywhere.
  const setupPending = s.needsSetup && !s.enabled;
  $('cleanNow').disabled = setupPending;
  $('cleanNow').title = setupPending ? t('finishSetupFirst') : '';
  $('stats').textContent = setupPending ? t('finishSetupToStart') : tn('cookiesCleaned', stats.cookies || 0);
  // Only in Chrome: the link goes to the Chrome Web Store listing.
  const chromeStore = !/\bEdg\//.test(globalThis.navigator?.userAgent || '');
  $('rateBox').hidden = !(chromeStore && !s.ratePrompt && s.enabled && (stats.runs || 0) >= RATE_AFTER_RUNS);
  showUndo();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  host = tab ? hostFromUrl(tab.url || '') : null;
  incognito = !!(tab && tab.incognito);
  site = host ? siteOf(host) : null;
  $('siteBox').hidden = !host;
  $('noSite').hidden = !!host;
  $('cleanSite').disabled = !host;
  if (!host) return;

  $('host').textContent = site;
  const status = listStatus(host, lists) || '';
  const own = lists.find((i) => cleanExpression(i.expression) === site);
  const pill = $('statusPill');
  pill.className = 'pill ' + (status === LIST_KEEP ? 'keep' : status === LIST_SESSION ? 'session' : 'clean');
  pill.textContent = t(status === LIST_KEEP ? 'pillKept' : status === LIST_SESSION ? 'pillSession' : s.enabled ? 'pillClean' : 'pillPaused');
  document.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.list === status)));
  let hint = t(HINTS[status]);
  const rule = ruleFor(host, lists);
  if (status && !own && rule) hint += ' ' + t('setByRule', rule.expression);
  $('hint').textContent = hint;

  const info = await ask({ type: 'site-info', host });
  $('count').textContent = info
    ? [tn('cookieCount', info.cookies),
      info.partitioned ? tn('partitionedCount', info.partitioned) : '',
      info.openTabs > 1 ? tn('openInTabs', info.openTabs) : ''].filter(Boolean).join(' · ')
    : '';
}

// The last cleanup can be undone for a few minutes (cookies only).
async function showUndo() {
  const info = await ask({ type: 'undo-info' });
  $('undoBox').hidden = !info;
  if (info) $('undoText').textContent = t('undoText', tn('cookieCount', info.cookies));
}

// Message the service worker; null if it fails (e.g. the worker crashed).
async function ask(msg) {
  try {
    const r = await chrome.runtime.sendMessage(msg);
    return r && !r.error ? r : null;
  } catch {
    return null;
  }
}

async function setList(list) {
  const { lists = [] } = await chrome.storage.local.get('lists');
  const next = lists.filter((i) => cleanExpression(i.expression) !== site);
  if (list) next.push({ expression: site, list });
  await chrome.storage.local.set({ lists: next });
  // A broader rule in Settings can still decide; say so instead of doing nothing visible.
  const rule = ruleFor(host, next);
  if ((listStatus(host, next) || null) !== (list || null) && rule) {
    toast(t('ruleStillApplies', rule.expression, site));
  }
  load();
}

function toast(text) {
  const el = $('toast');
  el.textContent = text;
  setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, 3500);
}

async function setSetting(patch) {
  const { settings = {} } = await chrome.storage.local.get('settings');
  await chrome.storage.local.set({ settings: { ...DEFAULT_SETTINGS, ...settings, ...patch } });
}

localize();

document.querySelectorAll('.seg button').forEach((b) =>
  b.addEventListener('click', () => setList(b.dataset.list || null)));

$('enabled').addEventListener('change', async (e) => {
  await setSetting({ enabled: e.target.checked, ...(e.target.checked ? { needsSetup: false } : {}) });
  load();
});

$('cleanNow').addEventListener('click', async () => {
  $('cleanNow').disabled = true;
  const r = await ask({ type: 'clean-now' });
  $('cleanNow').disabled = false;
  toast(!r ? t('cleanFailed')
    : r.cookies ? t('removedFromClosed', tn('cookieCount', r.cookies), tn('closedSiteCount', r.sites.length))
      : t('nothingToClean'));
  load();
});

$('cleanSite').addEventListener('click', async () => {
  if (!host) return;
  $('cleanSite').disabled = true;
  const r = await ask({ type: 'clean-site', host, incognito });
  $('cleanSite').disabled = false;
  toast(!r ? t('cleanFailed')
    : r.cookies ? t('removedForSite', tn('cookieCount', r.cookies), site)
      : t('noCookiesLeft', site));
  load();
});

$('undo').addEventListener('click', async () => {
  $('undo').disabled = true;
  const r = await ask({ type: 'undo' });
  $('undo').disabled = false;
  toast(r ? t('undone', tn('cookieCount', r.restored)) : t('undoFailed'));
  load();
});

$('rateYes').addEventListener('click', async () => {
  await setSetting({ ratePrompt: 'done' });
  chrome.tabs.create({ url: `https://chromewebstore.google.com/detail/${chrome.runtime.id}/reviews` });
  load();
});

$('rateNo').addEventListener('click', async () => {
  await setSetting({ ratePrompt: 'dismissed' });
  load();
});

$('openOptions').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

load();
