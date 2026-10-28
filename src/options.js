import { DEFAULT_SETTINGS, LIST_KEEP, LIST_SESSION, MAX_IMPORT_BYTES, MAX_LIST_ENTRIES, compileExpression, cleanExpression, parseImport, mergeLists, isPublicSuffixExpression, siteOf, normHost, decideCookie } from './lib.js';
import { t, tn, num, localize } from './i18n.js';

const $ = (id) => document.getElementById(id);

async function getSettings() {
  const { settings = {} } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...settings };
}

async function renderSettings() {
  const s = await getSettings();
  document.querySelectorAll('[data-setting]').forEach((el) => {
    const key = el.dataset.setting;
    if (el.type === 'checkbox') el.checked = !!s[key];
    else el.value = String(s[key]);
  });
}

document.querySelectorAll('[data-setting]').forEach((el) => {
  el.addEventListener('change', async () => {
    const s = await getSettings();
    const key = el.dataset.setting;
    s[key] = el.type === 'checkbox' ? el.checked : el.dataset.type === 'number' ? Number(el.value) : el.value;
    if (key === 'enabled' && el.checked) s.needsSetup = false;
    await chrome.storage.local.set({ settings: s });
  });
});

function msg(id, text, err = false) {
  const el = $(id);
  el.textContent = text;
  el.className = 'msg' + (err ? ' err' : '');
  if (text) setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, 5000);
}

async function renderLists() {
  const { lists = [] } = await chrome.storage.local.get('lists');
  const table = $('lists');
  table.textContent = '';
  $('listsEmpty').hidden = lists.length > 0;
  const sorted = [...lists].sort((a, b) => a.expression.localeCompare(b.expression));
  for (const item of sorted) {
    const tr = document.createElement('tr');
    const tdE = document.createElement('td');
    tdE.className = 'expr';
    tdE.textContent = item.expression;
    const tdL = document.createElement('td');
    tdL.className = 'x';
    const sel = document.createElement('select');
    sel.setAttribute('aria-label', t('listFor', item.expression));
    for (const [v, label] of [[LIST_KEEP, t('segKeep')], [LIST_SESSION, t('segSession')]]) {
      const o = document.createElement('option');
      o.value = v; o.textContent = label; o.selected = item.list === v;
      sel.append(o);
    }
    sel.addEventListener('change', () => updateItem(item.expression, sel.value));
    tdL.append(sel);
    const tdX = document.createElement('td');
    tdX.className = 'x';
    const del = document.createElement('button');
    del.textContent = t('remove');
    del.setAttribute('aria-label', t('removeAria', item.expression));
    del.addEventListener('click', () => updateItem(item.expression, null));
    tdX.append(del);
    tr.append(tdE, tdL, tdX);
    table.append(tr);
  }
}

async function updateItem(expression, list) {
  const { lists = [] } = await chrome.storage.local.get('lists');
  const next = lists.filter((i) => i.expression !== expression);
  if (list) next.push({ expression, list });
  await chrome.storage.local.set({ lists: next });
}

$('addForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const raw = $('expr').value;
  const expression = cleanExpression(raw);
  if (!compileExpression(expression)) {
    msg('addMsg', t('notDomain'), true);
    return;
  }
  const { lists = [] } = await chrome.storage.local.get('lists');
  const next = lists.filter((i) => cleanExpression(i.expression) !== expression);
  if (next.length >= MAX_LIST_ENTRIES) {
    msg('addMsg', t('listsFull', num(MAX_LIST_ENTRIES)), true);
    return;
  }
  next.push({ expression, list: $('listType').value });
  await chrome.storage.local.set({ lists: next });
  $('expr').value = '';
  if (isPublicSuffixExpression(expression)) {
    msg('addMsg', t('addedSuffix', expression, expression.replace(/^\*\./, '')), true);
  } else {
    msg('addMsg', t('added', expression));
  }
});

$('importBtn').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (file.size > MAX_IMPORT_BYTES) {
    msg('importMsg', t('fileTooLarge'), true);
    return;
  }
  const incoming = parseImport(await file.text());
  if (!incoming.length) {
    msg('importMsg', t('noSitesFound'), true);
    return;
  }
  const { lists = [] } = await chrome.storage.local.get('lists');
  const { lists: merged, added } = mergeLists(lists.map((i) => ({ ...i })), incoming);
  if (merged.length > MAX_LIST_ENTRIES) {
    msg('importMsg', t('tooManyImport', num(MAX_LIST_ENTRIES)), true);
    return;
  }
  await chrome.storage.local.set({ lists: merged });
  const skipped = incoming.length - added.length;
  msg('importMsg', skipped ? t('importedSkipped', tn('siteCount', added.length), num(skipped)) : t('imported', tn('siteCount', added.length)));
});

$('exportBtn').addEventListener('click', async () => {
  const { lists = [] } = await chrome.storage.local.get('lists');
  const blob = new Blob([JSON.stringify({ crumbclear: 1, exported: new Date().toISOString(), lists }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `crumbclear-lists-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

// Log entries store the reason in English; show it in the UI language.
const REASONS = { 'tab closed': 'reasonTabClosed', manual: 'reasonManual', 'browser start': 'reasonStartup' };

async function renderActivity() {
  const { stats = {}, log = [] } = await chrome.storage.local.get(['stats', 'log']);
  $('sCookies').textContent = num(stats.cookies || 0);
  $('sSites').textContent = num(stats.sites || 0);
  $('sRuns').textContent = num(stats.runs || 0);
  const table = $('log');
  table.textContent = '';
  $('logEmpty').hidden = log.length > 0;
  for (const entry of log.slice(0, 50)) {
    const tr = document.createElement('tr');
    const when = document.createElement('td');
    when.className = 'when';
    when.textContent = new Date(entry.time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
    const what = document.createElement('td');
    const total = entry.siteCount ?? entry.sites.length;
    const sites = entry.sites.slice(0, 6).join(', ') + (total > 6 ? ' ' + t('moreSites', num(total - 6)) : '');
    what.textContent = `${tn('cookieCount', entry.cookies)} · ${sites || t(entry.cookies ? 'logPrivate' : 'logSiteDataOnly')} · ${t(REASONS[entry.reason] || 'reasonAuto')}`;
    tr.append(when, what);
    table.append(tr);
  }
}

$('clearLog').addEventListener('click', async () => {
  await chrome.storage.local.set({ log: [] });
});


// ---------- first-run setup: choose sites to keep before anything is cleaned ----------
let setupSites = [];
const setupChecked = new Set();

async function cookieSites(lists) {
  let cookies = [];
  try { cookies = await chrome.cookies.getAll({}); } catch { /* no cookies readable */ }
  const counts = new Map();
  for (const c of cookies) {
    const site = siteOf(normHost(c.domain));
    // Only cookies auto-clean would delete; sign-in services on the Keep list drop out.
    if (!site || !decideCookie(c, { openSites: new Set(), lists, startup: false }).remove) continue;
    counts.set(site, (counts.get(site) || 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function drawSetupSites() {
  const filter = $('setupFilter').value.trim().toLowerCase();
  const ul = $('setupSites');
  ul.textContent = '';
  for (const [site, n] of setupSites) {
    if (filter && !site.includes(filter)) continue;
    const li = document.createElement('li');
    const label = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.value = site;
    box.checked = setupChecked.has(site);
    box.addEventListener('change', () => { if (box.checked) setupChecked.add(site); else setupChecked.delete(site); });
    const name = document.createElement('span');
    name.className = 'expr';
    name.textContent = site;
    const count = document.createElement('span');
    count.className = 'n';
    count.textContent = tn('cookieCount', n);
    label.append(box, name, count);
    li.append(label);
    ul.append(li);
  }
  $('setupEmpty').hidden = setupSites.length > 0;
}

async function renderSetup() {
  const s = await getSettings();
  const show = s.needsSetup && !s.enabled;
  $('setup').hidden = !show;
  if (!show) return;
  const { lists = [] } = await chrome.storage.local.get('lists');
  setupSites = await cookieSites(lists);
  drawSetupSites();
}

$('setupFilter').addEventListener('input', drawSetupSites);
$('setupAll').addEventListener('click', () => {
  $('setupSites').querySelectorAll('input').forEach((b) => { b.checked = true; setupChecked.add(b.value); });
});
$('setupDone').addEventListener('click', async () => {
  const picked = [...setupChecked].map((expression) => ({ expression, list: LIST_KEEP }));
  const { lists = [] } = await chrome.storage.local.get('lists');
  const { lists: merged } = mergeLists(lists.map((i) => ({ ...i })), picked);
  if (merged.length > MAX_LIST_ENTRIES) {
    msg('setupMsg', t('tooManySetup', num(MAX_LIST_ENTRIES)), true);
    return;
  }
  const s = await getSettings();
  await chrome.storage.local.set({ lists: merged, settings: { ...s, enabled: true, needsSetup: false } });
  setupChecked.clear();
  msg('addMsg', picked.length ? t('autoCleanOnKept', tn('siteCount', picked.length)) : t('autoCleanIsOn'));
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings) { renderSettings(); renderSetup(); }
  if (changes.lists) { renderLists(); if (!$('setup').hidden) renderSetup(); }
  if (changes.log || changes.stats) renderActivity();
});

localize();
renderSettings();
renderSetup();
renderLists();
renderActivity();
