import {
  DEFAULT_SETTINGS, LIST_KEEP, LIST_SESSION, LOGIN_PROVIDERS,
  hostFromUrl, siteOf, normHost, decideCookie, cookieUrl, originsFor, listStatus,
} from './lib.js';

const ALARM = 'crumbclear-clean';
const LOG_LIMIT = 100;
const LOG_SITES_LIMIT = 50;
// Bump when the shape of stored data changes, and migrate in onInstalled.
const SCHEMA_VERSION = 1;
const SETTLE_MIN_MS = 3000;
const SETTLE_MAX_MS = 30000;
const SETTLE_POLL_MS = 1000;

// ---------- storage ----------
async function getState() {
  const s = await chrome.storage.local.get(['settings', 'lists', 'stats']);
  return {
    settings: { ...DEFAULT_SETTINGS, ...(s.settings || {}) },
    lists: s.lists || [],
    stats: s.stats || { cookies: 0, sites: 0, runs: 0 },
  };
}

// Hosts seen since the last clean, so site data is wiped even for sites
// that never set a cookie.
// Several events update it at once, so read-modify-write runs one at a time.
let visitedLock = Promise.resolve();
function updateVisited(fn) {
  const run = visitedLock.then(async () => {
    const { visited = [] } = await chrome.storage.local.get('visited');
    const next = fn(visited);
    if (next) await chrome.storage.local.set({ visited: next.slice(-2000) });
  });
  visitedLock = run.catch(() => {});
  return run;
}

function rememberHost(host) {
  if (!host) return;
  return updateVisited((visited) => (visited.includes(host) ? null : [...visited, host]));
}

// ---------- helpers ----------
async function openSites() {
  const tabs = await chrome.tabs.query({});
  const sites = new Set();
  for (const t of tabs) {
    // While a tab loads, url can be about:blank or the previous page and
    // pendingUrl the site being opened; both count as open.
    for (const url of [t.url, t.pendingUrl]) {
      const host = hostFromUrl(url || '');
      if (host) sites.add(siteOf(host));
    }
  }
  return sites;
}

// Right after the browser starts, session restore may not have reported its
// tabs yet, so their sites would look closed. Before the first automatic clean
// of a browser session, wait until the set of open sites stops changing.
// storage.session survives worker restarts but not browser restarts.
let settled = null;
function waitForTabsToSettle() {
  settled ||= (async () => {
    const { ready } = await chrome.storage.session.get('ready').catch(() => ({}));
    if (ready) return;
    const start = Date.now();
    let prev = null;
    for (;;) {
      const key = [...await openSites()].sort().join(' ');
      const waited = Date.now() - start;
      if ((key === prev && waited >= SETTLE_MIN_MS) || waited >= SETTLE_MAX_MS) break;
      prev = key;
      await new Promise((r) => setTimeout(r, SETTLE_POLL_MS));
    }
    await chrome.storage.session.set({ ready: true }).catch(() => {});
  })();
  return settled;
}

// Cookie stores of incognito windows. Their host names must not reach
// storage.local, which outlives the private session. Chrome's regular store
// is "0"; any other store is private, even after its last tab has closed.
async function incognitoStoreIds() {
  try {
    const [stores, tabs] = await Promise.all([chrome.cookies.getAllCookieStores(), chrome.tabs.query({})]);
    const privateTabs = new Set(tabs.filter((t) => t.incognito).map((t) => t.id));
    return new Set(stores.filter((s) => s.id !== '0' || s.tabIds.some((id) => privateTabs.has(id))).map((s) => s.id));
  } catch {
    return new Set();
  }
}

async function allCookies() {
  let stores = [{ id: undefined }];
  try {
    const s = await chrome.cookies.getAllCookieStores();
    if (s && s.length) stores = s;
  } catch { /* fall back to default store */ }

  const out = [];
  for (const store of stores) {
    const base = store.id ? { storeId: store.id } : {};
    let list;
    try {
      // partitionKey: {} returns partitioned and unpartitioned cookies (Chrome 119+)
      list = await chrome.cookies.getAll({ ...base, partitionKey: {} });
    } catch {
      list = await chrome.cookies.getAll(base);
    }
    out.push(...list);
  }
  return out;
}

async function removeCookie(c) {
  const details = { url: cookieUrl(c), name: c.name, storeId: c.storeId };
  if (c.partitionKey) details.partitionKey = c.partitionKey;
  try {
    return !!(await chrome.cookies.remove(details));
  } catch {
    return false;
  }
}

async function log(entry) {
  const { log: entries = [] } = await chrome.storage.local.get('log');
  entries.unshift(entry);
  await chrome.storage.local.set({ log: entries.slice(0, LOG_LIMIT) });
}

// ---------- cleaning ----------
// Cleans run one at a time, in order. An automatic clean that is still waiting
// to start already covers every tab closed so far, so later ones join it.
let queue = Promise.resolve();
let queuedAuto = null;

function clean({ reason = 'auto', startup = false, onlySite = null } = {}) {
  const auto = !onlySite && !startup && reason !== 'manual';
  if (auto && queuedAuto) return queuedAuto;
  const run = queue.then(() => {
    if (queuedAuto === run) queuedAuto = null;
    return doClean({ reason, startup, onlySite });
  });
  if (auto) queuedAuto = run;
  queue = run.catch(() => {});
  return run;
}

async function doClean({ reason, startup, onlySite }) {
  const { settings, lists, stats } = await getState();
  if (!settings.enabled && !onlySite && reason !== 'manual') return { cookies: 0, sites: [] };
  if (!onlySite && reason !== 'manual') await waitForTabsToSettle();

  const ctx = { openSites: await openSites(), lists, startup, onlySite };
  const cookies = await allCookies();
  const privateStores = await incognitoStoreIds();
  // A site opened while cookies were being read is open too.
  for (const site of await openSites()) ctx.openSites.add(site);
  const cleanedHosts = new Set();
  let removed = 0;

  for (const c of cookies) {
    const { remove } = decideCookie(c, ctx);
    if (!remove) continue;
    if (await removeCookie(c)) {
      removed++;
      if (!privateStores.has(c.storeId)) cleanedHosts.add(normHost(c.domain));
    }
  }

  // Site data for visited hosts that are now closed and not on a list.
  await updateVisited((visited) => visited.filter((host) => {
    const site = siteOf(host);
    const status = listStatus(host, lists);
    const keep =
      status === LIST_KEEP ||
      (!startup && status === LIST_SESSION) ||
      (onlySite ? site !== onlySite : ctx.openSites.has(site));
    if (!keep) cleanedHosts.add(host);
    return keep;
  }));

  const origins = originsFor(cleanedHosts);
  if (settings.cleanSiteData && origins.length) {
    const types = { cacheStorage: true, fileSystems: true, indexedDB: true, localStorage: true, serviceWorkers: true };
    try {
      await chrome.browsingData.remove({ origins }, types);
    } catch {
      // Chrome rejects the whole call if one origin is invalid; retry one by one.
      for (const origin of origins) {
        try { await chrome.browsingData.remove({ origins: [origin] }, types); } catch { /* skip it */ }
      }
    }
  }

  const sites = [...new Set([...cleanedHosts].map(siteOf))].sort();
  if (removed || sites.length) {
    stats.cookies += removed;
    stats.sites += sites.length;
    stats.runs += 1;
    await chrome.storage.local.set({ stats });
    await log({ time: Date.now(), reason, cookies: removed, sites: sites.slice(0, LOG_SITES_LIMIT), siteCount: sites.length });
  }
  updateBadge();
  return { cookies: removed, sites };
}

function schedule({ domainChange = false } = {}) {
  chrome.storage.local.get('settings').then(({ settings }) => {
    const s = { ...DEFAULT_SETTINGS, ...(settings || {}) };
    if (!s.enabled || (domainChange && !s.cleanOnDomainChange)) return;
    if (!s.delaySec) {
      clean({ reason: 'tab closed' }).catch(() => {});
    } else {
      // Re-creating the alarm debounces bursts of closed tabs into one clean.
      chrome.alarms.create(ALARM, { when: Date.now() + s.delaySec * 1000 });
    }
  }).catch(() => {});
}

// ---------- badge: cookie count for the active site ----------
async function updateBadge() {
  try {
    const { settings } = await getState();
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab) return;
    const host = hostFromUrl(tab.url || '');
    if (!settings.showBadge || !host) {
      await chrome.action.setBadgeText({ tabId: tab.id, text: '' });
      return;
    }
    const site = siteOf(host);
    const cookies = (await allCookies()).filter((c) => {
      const top = c.partitionKey && c.partitionKey.topLevelSite;
      return siteOf(c.domain) === site || (top && siteOf(hostFromUrl(top)) === site);
    });
    const { lists } = await getState();
    const status = listStatus(host, lists);
    // White badge text needs 4.5:1 contrast against each of these.
    const color = !settings.enabled ? '#6e6e6e' : status === LIST_KEEP ? '#23784a' : status === LIST_SESSION ? '#946010' : '#c2410c';
    await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color });
    await chrome.action.setBadgeText({ tabId: tab.id, text: cookies.length ? String(Math.min(cookies.length, 999)) : '' });
  } catch { /* tab may be gone */ }
}

// Last committed host per tab, to notice domain changes. Kept in
// storage.session: the worker is stopped when idle and loses its memory.
const tabKey = (tabId) => `tabHost.${tabId}`;

// ---------- events ----------
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(tabKey(tabId)).catch(() => {});
  schedule();
});

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.url || info.status === 'complete') {
    const host = hostFromUrl(tab.url || '');
    // A failed write must not skip the tab tracking below.
    if (host && !tab.incognito) await rememberHost(host).catch(() => {});
    const key = tabKey(tabId);
    const { [key]: prev } = await chrome.storage.session.get(key).catch(() => ({}));
    if (host && host !== prev) await chrome.storage.session.set({ [key]: host }).catch(() => {});
    if (prev && host && siteOf(prev) !== siteOf(host)) schedule({ domainChange: true });
  }
  if (tab.active) updateBadge();
});

chrome.tabs.onActivated.addListener(updateBadge);
chrome.windows.onFocusChanged.addListener(updateBadge);
chrome.cookies.onChanged.addListener(() => {
  clearTimeout(globalThis.__badgeTimer);
  globalThis.__badgeTimer = setTimeout(updateBadge, 400);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) clean({ reason: 'tab closed' }).catch(() => {});
});

chrome.runtime.onStartup.addListener(async () => {
  settled = null;
  await chrome.storage.session.set({ ready: false }).catch(() => {});
  const { settings } = await getState();
  if (settings.enabled && settings.cleanOnStartup) {
    clean({ reason: 'browser start', startup: true }).catch(() => {});
  }
});

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  const s = await chrome.storage.local.get(['settings', 'lists', 'stats']);
  const fresh = reason === 'install' && !s.settings;
  const settings = { ...DEFAULT_SETTINGS, ...(s.settings || {}) };
  let lists = s.lists || [];
  if (fresh) {
    // Nothing is cleaned until the user has picked the sites to keep:
    // otherwise the first closed tab would sign them out almost everywhere.
    settings.enabled = false;
    settings.needsSetup = true;
    const have = new Set(lists.map((i) => i.expression));
    lists = [...lists, ...LOGIN_PROVIDERS.filter((e) => !have.has(e)).map((expression) => ({ expression, list: LIST_KEEP }))];
  }
  await chrome.storage.local.set({
    settings,
    lists,
    stats: s.stats || { cookies: 0, sites: 0, runs: 0 },
    schemaVersion: SCHEMA_VERSION,
  });
  if (reason === 'install') chrome.runtime.openOptionsPage();
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings || changes.lists) updateBadge();
});

// Messages from popup / options. Web pages cannot message us (no
// externally_connectable), but check the sender and input anyway.
const validHost = (h) => typeof h === 'string' && h.length > 0 && h.length <= 253 && /^[a-z0-9.\-_[\]:]+$/i.test(h);

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!sender || sender.id !== chrome.runtime.id || !msg || typeof msg !== 'object') {
    sendResponse(null);
    return false;
  }
  if (msg.type !== 'clean-now' && !validHost(msg.host)) {
    sendResponse(null);
    return false;
  }
  (async () => {
    if (msg.type === 'clean-now') return clean({ reason: 'manual' });
    if (msg.type === 'clean-site') return clean({ reason: 'manual', onlySite: siteOf(msg.host) });
    if (msg.type === 'site-info') {
      const site = siteOf(msg.host);
      const cookies = (await allCookies()).filter((c) => {
        const top = c.partitionKey && c.partitionKey.topLevelSite;
        return siteOf(c.domain) === site || (top && siteOf(hostFromUrl(top)) === site);
      });
      return {
        site,
        cookies: cookies.length,
        partitioned: cookies.filter((c) => c.partitionKey).length,
      };
    }
    return null;
  })().then(sendResponse, (e) => sendResponse({ error: String(e) }));
  return true;
});
