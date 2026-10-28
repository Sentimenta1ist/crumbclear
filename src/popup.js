import { DEFAULT_SETTINGS, LIST_KEEP, LIST_SESSION, hostFromUrl, siteOf, listStatus, cleanExpression, ruleFor, plural } from './lib.js';

const $ = (id) => document.getElementById(id);
let host = null;
let site = null;
let incognito = false;

const HINTS = {
  '': 'Cookies and site data are deleted after you close the last tab of this site.',
  session: 'Kept while the browser is open, deleted the next time the browser starts (if "Clean on browser start" is on).',
  keep: 'Never cleaned automatically. Use for sites you want to stay logged in to.',
};

async function load() {
  const { settings = {}, lists = [], stats = {} } = await chrome.storage.local.get(['settings', 'lists', 'stats']);
  const s = { ...DEFAULT_SETTINGS, ...settings };
  $('enabled').checked = s.enabled;
  $('enabledLabel').textContent = s.enabled ? 'Auto-clean on' : 'Auto-clean off';
  // Until the user has picked sites to keep, a manual clean would sign them out everywhere.
  const setupPending = s.needsSetup && !s.enabled;
  $('cleanNow').disabled = setupPending;
  $('cleanNow').title = setupPending ? 'Finish setup in Settings first' : '';
  $('stats').textContent = setupPending ? 'Finish setup in Settings to start' : `${plural(stats.cookies || 0, 'cookie')} cleaned`;

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
  pill.textContent = status === LIST_KEEP ? 'Kept' : status === LIST_SESSION ? 'Kept until restart' : s.enabled ? 'Cleaned on close' : 'Auto-clean paused';
  document.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.list === status)));
  let hint = HINTS[status];
  const rule = ruleFor(host, lists);
  if (status && !own && rule) hint += ` Set by the rule "${rule.expression}" in Settings.`;
  $('hint').textContent = hint;

  const info = await ask({ type: 'site-info', host });
  $('count').textContent = info
    ? plural(info.cookies, 'cookie') + (info.partitioned ? ` · ${info.partitioned} partitioned` : '') +
      (info.openTabs > 1 ? ` · open in ${info.openTabs} tabs` : '')
    : '';
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
    toast(`The rule "${rule.expression}" in Settings still applies to ${site}.`);
  }
  load();
}

function toast(text) {
  $('toast').textContent = text;
  setTimeout(() => { $('toast').textContent = ''; }, 3500);
}

document.querySelectorAll('.seg button').forEach((b) =>
  b.addEventListener('click', () => setList(b.dataset.list || null)));

$('enabled').addEventListener('change', async (e) => {
  const { settings = {} } = await chrome.storage.local.get('settings');
  await chrome.storage.local.set({ settings: { ...DEFAULT_SETTINGS, ...settings, enabled: e.target.checked, ...(e.target.checked ? { needsSetup: false } : {}) } });
  load();
});

$('cleanNow').addEventListener('click', async () => {
  $('cleanNow').disabled = true;
  const r = await ask({ type: 'clean-now' });
  $('cleanNow').disabled = false;
  toast(!r ? 'Could not clean. Try again, or reload CrumbClear in chrome://extensions.'
    : r.cookies ? `Removed ${plural(r.cookies, 'cookie')} from ${plural(r.sites.length, 'closed site')}.`
      : 'Nothing to clean: no closed sites left behind.');
  load();
});

$('cleanSite').addEventListener('click', async () => {
  if (!host) return;
  $('cleanSite').disabled = true;
  const r = await ask({ type: 'clean-site', host, incognito });
  $('cleanSite').disabled = false;
  toast(!r ? 'Could not clean. Try again, or reload CrumbClear in chrome://extensions.'
    : r.cookies ? `Removed ${plural(r.cookies, 'cookie')} for ${site}. Reload the page to see it logged out.`
      : `No cookies left for ${site}.`);
  load();
});

$('openOptions').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

load();
