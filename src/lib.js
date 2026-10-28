// Pure logic shared by the service worker, popup and options page.
// No chrome.* calls here, so it can be unit-tested in Node.
import { getDomain, parse } from './vendor/tldts.js';

export const DEFAULT_SETTINGS = {
  enabled: true,
  delaySec: 30,          // 0 = clean immediately after a tab closes
  // Off by default: a sign-in or 3-D Secure page in the same tab would make
  // the original site look closed and lose its session.
  cleanOnDomainChange: false,
  cleanSiteData: true,   // localStorage, IndexedDB, cache storage, service workers
  cleanOnStartup: true,  // also clears keep-until-restart sites
  showBadge: true,
  needsSetup: false,     // true from install until the user picks sites to keep
  ratePrompt: '',        // '' until the rating request is answered: 'done' or 'dismissed'
};

// Sign-in services that other sites depend on while they are open. Added to
// the Keep list on install; the user can remove any of them.
export const LOGIN_PROVIDERS = [
  'accounts.google.com',
  'accounts.youtube.com',
  'login.microsoftonline.com',
  'login.live.com',
  'appleid.apple.com',
  'github.com',
  'okta.com',
];

export const LIST_KEEP = 'keep';     // never cleaned
export const LIST_SESSION = 'session'; // kept until the browser restarts

export function normHost(h) {
  return String(h || '').trim().toLowerCase().replace(/^\.+/, '').replace(/\.+$/, '');
}

export function hostFromUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return normHost(u.hostname);
  } catch {
    return null;
  }
}

// Key for the visited list: the host, plus the port when it is not the
// scheme's default, because site data is stored per origin.
export function visitKeyFromUrl(url) {
  const host = hostFromUrl(url);
  if (!host) return null;
  const { port } = new URL(url);
  return port ? `${host}:${port}` : host;
}

// "localhost:8080" -> { host: 'localhost', port: '8080' }; "[::1]:3000" works too.
export function splitHostPort(key) {
  const m = /^(.*?)(?::(\d{1,5}))?$/.exec(String(key || ''));
  return { host: m[1], port: m[2] || null };
}

// Registrable site ("mail.google.com" -> "google.com"). Private suffixes
// like github.io are respected so separate GitHub Pages sites stay separate.
export function siteOf(host) {
  const h = normHost(host);
  if (!h) return null;
  return getDomain(h, { allowPrivateDomains: true }) || h;
}

export const MAX_EXPRESSION_LENGTH = 253;
const WILDCARD_CHAR = /[a-z0-9._-]/;

// Does `pattern` (where * matches [a-z0-9._-]*) match `host` or a dot-separated
// suffix of it? Simulates the pattern as an NFA over the reversed strings, so the
// cost is O(host × pattern) with no backtracking, whatever the input.
function matchesSuffix(pattern, host) {
  const p = [...pattern].reverse();
  const h = [...host].reverse();
  const m = p.length;
  const close = (set) => {
    for (const j of [...set]) for (let k = j; k < m && p[k] === '*'; k++) set.add(k + 1);
    return set;
  };
  let states = close(new Set([0]));
  for (let i = 0; i < h.length; i++) {
    const next = new Set();
    for (const j of states) {
      if (j >= m) continue;
      if (p[j] === '*') { if (WILDCARD_CHAR.test(h[i])) next.add(j); } else if (p[j] === h[i]) next.add(j + 1);
    }
    if (!next.size) return false;
    states = close(next);
    // Consumed i + 1 trailing chars; a match must start at a label boundary.
    if (states.has(m) && (i + 1 === h.length || h[i + 1] === '.')) return true;
  }
  return false;
}

// Cookies and tab URLs use punycode, so convert Unicode labels the same way
// ("пример.рф" -> "xn--e1afmkfd.xn--p1ai").
function toAscii(e) {
  if (!/[^\x00-\x7f]/.test(e)) return e;
  return e.split('.').map((label) => {
    if (!/[^\x00-\x7f]/.test(label) || label.includes('*')) return label;
    try { return new URL(`http://${label}`).hostname; } catch { return label; }
  }).join('.');
}

const compiled = new Map();

// Turn a user expression into a matcher with a .test(host) method.
//   example.com      -> example.com and all its subdomains
//   *.example.com    -> same (kept for Cookie AutoDelete compatibility)
//   shop.example.*   -> wildcard anywhere
export function compileExpression(expr) {
  const key = String(expr || '');
  if (compiled.has(key)) return compiled.get(key);
  let e = key.trim().toLowerCase();
  e = e.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').split('/')[0].split('?')[0];
  e = toAscii(e.replace(/:\d+$/, ''));
  if (e.startsWith('*.')) e = e.slice(2);
  e = normHost(e);
  let matcher = null;
  if (e && e.length <= MAX_EXPRESSION_LENGTH && !/[^a-z0-9.*_-]/.test(e)) {
    const body = e;
    matcher = body.includes('*')
      ? { test: (host) => matchesSuffix(body, host) }
      : { literal: body, test: (host) => host === body || host.endsWith('.' + body) };
  }
  if (compiled.size > 10000) compiled.clear();
  compiled.set(key, matcher);
  return matcher;
}

// True for expressions like "com", "co.uk" or "github.io" that would cover
// every site under a public suffix.
export function isPublicSuffixExpression(expr) {
  const e = cleanExpression(expr).replace(/^\*\./, '');
  if (!e || e.includes('*')) return false;
  const p = parse(e, { allowPrivateDomains: true });
  return p.publicSuffix === e && !!(p.isIcann || p.isPrivate);
}

export function cleanExpression(expr) {
  let e = String(expr || '').trim().toLowerCase();
  e = e.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').split('/')[0].split('?')[0];
  e = toAscii(e.replace(/:\d+$/, ''));
  return e.replace(/^\.+/, '').replace(/\.+$/, '');
}

const stronger = (a, b) => (a === LIST_KEEP || b === LIST_KEEP ? LIST_KEEP : a || b || null);

// Lookup tables for a lists array, so matching a host costs one map lookup
// per label instead of a scan over every rule:
//   exact:   literal rule -> status
//   parents: every proper parent domain of a literal rule -> status
//   wild:    rules with wildcards, still scanned
const indexes = new WeakMap();
function indexOf(lists) {
  let ix = indexes.get(lists);
  if (ix) return ix;
  ix = { exact: new Map(), parents: new Map(), wild: [] };
  for (const item of lists) {
    const m = compileExpression(item.expression);
    if (!m) continue;
    const status = item.list === LIST_KEEP ? LIST_KEEP : LIST_SESSION;
    if (!m.literal) { ix.wild.push({ m, status }); continue; }
    ix.exact.set(m.literal, stronger(ix.exact.get(m.literal), status));
    for (let i = m.literal.indexOf('.'); i >= 0; i = m.literal.indexOf('.', i + 1)) {
      const parent = m.literal.slice(i + 1);
      ix.parents.set(parent, stronger(ix.parents.get(parent), status));
    }
  }
  indexes.set(lists, ix);
  return ix;
}

// lists: [{expression, list}] -> 'keep' | 'session' | null. Keep wins.
export function listStatus(host, lists) {
  const h = normHost(host);
  if (!h || !lists || !lists.length) return null;
  const ix = indexOf(lists);
  let status = null;
  for (let s = h; ; ) {
    status = stronger(status, ix.exact.get(s));
    if (status === LIST_KEEP) return status;
    const dot = s.indexOf('.');
    if (dot < 0) break;
    s = s.slice(dot + 1);
  }
  for (const { m, status: st } of ix.wild) {
    if (m.test(h)) status = stronger(status, st);
    if (status === LIST_KEEP) return status;
  }
  return status;
}

// The rule that decides a host's status, for explaining it in the UI.
export function ruleFor(host, lists) {
  const h = normHost(host);
  const status = listStatus(h, lists);
  if (!status) return null;
  return (lists || []).find((i) => {
    const m = compileExpression(i.expression);
    return m && m.test(h) && (i.list === LIST_KEEP ? LIST_KEEP : LIST_SESSION) === status;
  }) || null;
}

export function plural(n, word) {
  return `${Number(n).toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;
}

// Like listStatus, but a rule for a subdomain also covers its parent domains,
// because the browser sends parent-domain cookies to that subdomain: keeping
// "mail.google.com" must keep the ".google.com" cookies Gmail logs in with.
function coveringStatus(host, lists, includeParents) {
  const status = listStatus(host, lists);
  if (status === LIST_KEEP || !includeParents || !lists || !lists.length) return status;
  return stronger(status, indexOf(lists).parents.get(normHost(host)));
}

function hostOfPartition(cookie) {
  const top = cookie && cookie.partitionKey && cookie.partitionKey.topLevelSite;
  return top ? hostFromUrl(top) : null;
}

// Decide what happens to one cookie.
// ctx: { openSites:Set<string>, lists:[], startup:boolean, onlySite?:string }
// returns { remove:boolean, why:string }
export function decideCookie(cookie, ctx) {
  const host = normHost(cookie.domain);
  const site = siteOf(host);
  const topHost = hostOfPartition(cookie);
  const topSite = topHost ? siteOf(topHost) : null;

  if (ctx.onlySite) {
    const hit = site === ctx.onlySite || topSite === ctx.onlySite;
    return hit ? { remove: true, why: 'manual' } : { remove: false, why: 'other-site' };
  }

  const status = coveringStatus(host, ctx.lists, !cookie.hostOnly);
  const topStatus = topHost ? coveringStatus(topHost, ctx.lists, true) : null;
  if (status === LIST_KEEP || topStatus === LIST_KEEP) return { remove: false, why: 'keep' };
  if (!ctx.startup && (status === LIST_SESSION || topStatus === LIST_SESSION)) {
    return { remove: false, why: 'session' };
  }

  // A partitioned cookie lives under its top-level site: keep it while that site is open.
  if (topSite) {
    if (ctx.openSites.has(topSite)) return { remove: false, why: 'open' };
    return { remove: true, why: 'closed' };
  }
  if (ctx.openSites.has(site)) return { remove: false, why: 'open' };
  return { remove: true, why: 'closed' };
}

export function cookieUrl(cookie) {
  const host = normHost(cookie.domain);
  return `${cookie.secure ? 'https' : 'http'}://${host}${cookie.path || '/'}`;
}

// Origins to wipe site data for, given the cleaned hosts.
export function originsFor(hosts) {
  const out = new Set();
  for (const key of hosts) {
    const { host: h, port } = splitHostPort(key);
    const host = normHost(h);
    if (!host) continue;
    const at = port ? `${host}:${port}` : host;
    for (const origin of [`https://${at}`, `http://${at}`]) {
      try {
        if (new URL(origin).origin === origin) out.add(origin);
      } catch { /* not a hostname */ }
    }
  }
  return [...out];
}

export const MAX_IMPORT_BYTES = 1024 * 1024;
export const MAX_LIST_ENTRIES = 5000;
const MAX_IMPORT_DEPTH = 16;

// Accepts CrumbClear exports, Cookie AutoDelete exports and plain lists.
// Returns [{expression, list}] with duplicates removed, at most MAX_LIST_ENTRIES.
export function parseImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    // Plain text: one domain per line -> keep list
    data = String(text).split(/[\r\n,]+/).map((s) => s.trim()).filter(Boolean);
  }
  const found = [];
  const visit = (node, depth = 0) => {
    if (node == null || depth > MAX_IMPORT_DEPTH || found.length >= MAX_LIST_ENTRIES * 2) return;
    if (typeof node === 'string') {
      found.push({ expression: node, list: LIST_KEEP });
      return;
    }
    if (Array.isArray(node)) {
      for (const v of node) visit(v, depth + 1);
      return;
    }
    if (typeof node === 'object') {
      if (typeof node.expression === 'string') {
        const raw = String(node.listType || node.list || '').toUpperCase();
        const list = raw === 'GREY' || raw === 'GRAY' || raw === 'SESSION' ? LIST_SESSION : LIST_KEEP;
        found.push({ expression: node.expression, list });
        return;
      }
      for (const v of Object.values(node)) {
        if (v && typeof v === 'object') visit(v, depth + 1);
      }
    }
  };
  visit(data && data.lists ? data.lists : data);
  return mergeLists([], found).added.slice(0, MAX_LIST_ENTRIES);
}

export function mergeLists(existing, incoming) {
  const seen = new Map(existing.map((i) => [cleanExpression(i.expression), i]));
  const added = [];
  for (const item of incoming) {
    const expression = cleanExpression(item.expression);
    if (!compileExpression(expression)) continue;
    const prev = seen.get(expression);
    if (prev) {
      if (item.list === LIST_KEEP) prev.list = LIST_KEEP;
      continue;
    }
    const entry = { expression, list: item.list === LIST_SESSION ? LIST_SESSION : LIST_KEEP };
    seen.set(expression, entry);
    added.push(entry);
  }
  return { lists: [...seen.values()], added };
}
