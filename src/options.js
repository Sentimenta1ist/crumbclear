import { DEFAULT_SETTINGS, LIST_KEEP, LIST_SESSION, MAX_IMPORT_BYTES, MAX_LIST_ENTRIES, compileExpression, cleanExpression, parseImport, mergeLists, plural, isPublicSuffixExpression, siteOf, normHost, decideCookie } from './lib.js';

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
    sel.setAttribute('aria-label', `List for ${item.expression}`);
    for (const [v, label] of [[LIST_KEEP, 'Keep'], [LIST_SESSION, 'Until restart']]) {
      const o = document.createElement('option');
      o.value = v; o.textContent = label; o.selected = item.list === v;
      sel.append(o);
    }
    sel.addEventListener('change', () => updateItem(item.expression, sel.value));
    tdL.append(sel);
    const tdX = document.createElement('td');
    tdX.className = 'x';
    const del = document.createElement('button');
    del.textContent = 'Remove';
    del.setAttribute('aria-label', `Remove ${item.expression}`);
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
    msg('addMsg', 'That does not look like a domain. Try example.com or *.example.com.', true);
    return;
  }
  const { lists = [] } = await chrome.storage.local.get('lists');
  const next = lists.filter((i) => cleanExpression(i.expression) !== expression);
  if (next.length >= MAX_LIST_ENTRIES) {
    msg('addMsg', `Your lists are full (${MAX_LIST_ENTRIES.toLocaleString()} sites). Remove some first.`, true);
    return;
  }
  next.push({ expression, list: $('listType').value });
  await chrome.storage.local.set({ lists: next });
  $('expr').value = '';
  if (isPublicSuffixExpression(expression)) {
    msg('addMsg', `Added ${expression}. Note: this covers every site ending in .${expression.replace(/^\*\./, '')}.`, true);
  } else {
    msg('addMsg', `Added ${expression}.`);
  }
});

$('importBtn').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (file.size > MAX_IMPORT_BYTES) {
    msg('importMsg', 'That file is too large to be a list of sites (limit 1 MB).', true);
    return;
  }
  const incoming = parseImport(await file.text());
  if (!incoming.length) {
    msg('importMsg', 'No sites found in that file.', true);
    return;
  }
  const { lists = [] } = await chrome.storage.local.get('lists');
  const { lists: merged, added } = mergeLists(lists.map((i) => ({ ...i })), incoming);
  if (merged.length > MAX_LIST_ENTRIES) {
    msg('importMsg', `Too many sites: your lists can hold ${MAX_LIST_ENTRIES.toLocaleString()}. Nothing was imported.`, true);
    return;
  }
  await chrome.storage.local.set({ lists: merged });
  const skipped = incoming.length - added.length;
  msg('importMsg', `Imported ${plural(added.length, 'site')}` + (skipped ? `, ${skipped} already on your lists.` : '.'));
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

async function renderActivity() {
  const { stats = {}, log = [] } = await chrome.storage.local.get(['stats', 'log']);
  $('sCookies').textContent = (stats.cookies || 0).toLocaleString();
  $('sSites').textContent = (stats.sites || 0).toLocaleString();
  $('sRuns').textContent = (stats.runs || 0).toLocaleString();
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
    const sites = entry.sites.slice(0, 6).join(', ') + (total > 6 ? ` +${total - 6} more` : '');
    what.textContent = `${plural(entry.cookies, 'cookie')} · ${sites || (entry.cookies ? 'private windows' : 'site data only')} · ${entry.reason}`;
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
    count.textContent = plural(n, 'cookie');
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
    msg('setupMsg', `Too many sites: your lists can hold ${MAX_LIST_ENTRIES.toLocaleString()}.`, true);
    return;
  }
  const s = await getSettings();
  await chrome.storage.local.set({ lists: merged, settings: { ...s, enabled: true, needsSetup: false } });
  setupChecked.clear();
  msg('addMsg', picked.length ? `Auto-clean is on. Kept ${plural(picked.length, 'site')}.` : 'Auto-clean is on.');
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings) { renderSettings(); renderSetup(); }
  if (changes.lists) { renderLists(); if (!$('setup').hidden) renderSetup(); }
  if (changes.log || changes.stats) renderActivity();
});

renderSettings();
renderSetup();
renderLists();
renderActivity();
