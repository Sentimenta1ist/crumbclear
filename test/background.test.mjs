// Runs the real service worker against an in-memory fake of the chrome.* APIs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const listeners = {};
const on = (name) => ({ addListener: (fn) => (listeners[name] ||= []).push(fn) });
const fire = async (name, ...args) => { for (const fn of listeners[name] || []) await fn(...args); };

let store = {};
let session = { ready: true }; // chrome.storage.session; "ready" = browser has been up for a while
let tabs = [];
let cookies = [];
const removedOrigins = [];
const alarms = {};
const calls = { openSitesQueries: 0, cleanRuns: 0 };
const fail = { storageSet: false, badOrigins: [] };

const pick = (obj, keys) => {
  const ks = keys == null ? Object.keys(obj) : typeof keys === 'string' ? [keys] : keys;
  return Object.fromEntries(ks.filter((k) => k in obj).map((k) => [k, structuredClone(obj[k])]));
};
const matchesDomain = (c, d) => { const cd = c.domain.replace(/^\./, ''); return cd === d || cd.endsWith('.' + d); };

globalThis.chrome = {
  storage: {
    local: {
      get: async (keys) => { if (keys === 'visited') calls.cleanRuns++; return pick(store, keys); },
      set: async (o) => {
        if (fail.storageSet) throw new Error('QUOTA_BYTES quota exceeded');
        Object.assign(store, structuredClone(o));
        await fire('storage.onChanged', Object.fromEntries(Object.keys(o).map((k) => [k, {}])), 'local');
      },
    },
    session: {
      get: async (keys) => pick(session, keys),
      set: async (o) => { Object.assign(session, structuredClone(o)); },
      remove: async (keys) => { for (const k of [].concat(keys)) delete session[k]; },
    },
    onChanged: on('storage.onChanged'),
  },
  tabs: {
    query: async (q = {}) => {
      if (!q.active) calls.openSitesQueries++;
      return q.active ? tabs.slice(0, 1) : tabs;
    },
    onRemoved: on('tabs.onRemoved'), onUpdated: on('tabs.onUpdated'), onActivated: on('tabs.onActivated'),
  },
  windows: { onFocusChanged: on('windows.onFocusChanged') },
  cookies: {
    getAllCookieStores: async () => {
      const incognito = tabs.filter((t) => t.incognito).map((t) => t.id);
      const stores = [{ id: '0', tabIds: tabs.filter((t) => !t.incognito).map((t) => t.id) }];
      if (incognito.length || cookies.some((c) => c.storeId === '1')) stores.push({ id: '1', tabIds: incognito });
      return stores;
    },
    getAll: async (d) => cookies.filter((c) =>
      (d.storeId == null || c.storeId === d.storeId) &&
      (d.domain == null || matchesDomain(c, d.domain)) &&
      (!d.partitionKey ? !c.partitionKey
        : d.partitionKey.topLevelSite ? !!c.partitionKey && c.partitionKey.topLevelSite === d.partitionKey.topLevelSite
          : true)),
    remove: async (d) => {
      const i = cookies.findIndex((c) => c.name === d.name && c.storeId === d.storeId && `${c.secure ? 'https' : 'http'}://${c.domain.replace(/^\./, '')}${c.path}` === d.url && JSON.stringify(c.partitionKey) === JSON.stringify(d.partitionKey));
      if (i < 0) return null;
      cookies.splice(i, 1); return { name: d.name };
    },
    onChanged: on('cookies.onChanged'),
  },
  alarms: { create: (n, o) => { alarms[n] = o; }, clear: async (n) => { delete alarms[n]; }, onAlarm: on('alarms.onAlarm') },
  browsingData: {
    remove: (o) => {
      // Like Chrome: one invalid origin rejects the whole call synchronously.
      if (!o.origins.length) throw new TypeError('origins: Array must have at least 1 items');
      const bad = o.origins.find((x) => fail.badOrigins.includes(x));
      if (bad) throw new Error(`'${bad}' is not a valid origin.`);
      removedOrigins.push(...o.origins);
      return Promise.resolve();
    },
  },
  action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
  runtime: { id: 'crumbclear-test-id', onStartup: on('runtime.onStartup'), onInstalled: on('runtime.onInstalled'), onMessage: on('runtime.onMessage'), openOptionsPage: () => {} },
};

const ck = (domain, name, extra = {}) => ({ domain, name, path: '/', secure: true, storeId: '0', ...extra });
const tick = () => new Promise((r) => setTimeout(r, 30));
const send = (msg, sender = { id: chrome.runtime.id }) => new Promise((res) => { for (const fn of listeners['runtime.onMessage']) fn(msg, sender, res); });

await import('../src/background.js');
await fire('runtime.onInstalled', { reason: 'update' });

test('closing a tab removes only closed sites, partitioned included', async () => {
  store.settings = { ...store.settings, delaySec: 0 };
  tabs = [{ id: 1, url: 'https://mail.google.com/' }];
  cookies = [
    ck('.google.com', 'SID'), ck('accounts.google.com', 'LSID'),
    ck('.shop.com', 'cart'), ck('.ads.net', 'id', { partitionKey: { topLevelSite: 'https://shop.com' } }),
    ck('.ads.net', 'id', { partitionKey: { topLevelSite: 'https://google.com' } }),
  ];
  await fire('tabs.onRemoved', 2); await tick();
  assert.deepEqual(cookies.map((c) => c.domain + ':' + c.name + (c.partitionKey ? '@' + c.partitionKey.topLevelSite : '')).sort(),
    ['.ads.net:id@https://google.com', '.google.com:SID', 'accounts.google.com:LSID']);
  assert.ok(removedOrigins.includes('https://shop.com'));
  assert.equal(store.log[0].cookies, 2);
});

test('delay uses a debounced alarm', async () => {
  store.settings = { ...store.settings, delaySec: 30 };
  tabs = [];
  cookies = [ck('.x.com', 'a')];
  await fire('tabs.onRemoved', 3); await tick();
  assert.equal(cookies.length, 1, 'not removed before the alarm');
  assert.ok(alarms['crumbclear-clean'].when > Date.now() + 25000);
  await fire('alarms.onAlarm', { name: 'crumbclear-clean' }); await tick();
  assert.equal(cookies.length, 0);
});

test('keep and until-restart lists', async () => {
  store.settings = { ...store.settings, delaySec: 0 };
  store.lists = [{ expression: 'github.com', list: 'keep' }, { expression: 'reddit.com', list: 'session' }];
  tabs = [];
  cookies = [ck('.github.com', 'user'), ck('.reddit.com', 'tok'), ck('.other.org', 'x')];
  await fire('tabs.onRemoved', 4); await tick();
  assert.deepEqual(cookies.map((c) => c.domain).sort(), ['.github.com', '.reddit.com']);
  session = {};
  await fire('runtime.onStartup');
  await new Promise((r) => setTimeout(r, 4500));
  assert.deepEqual(cookies.map((c) => c.domain), ['.github.com'], 'session list cleaned on startup');
});

test('domain change in a tab cleans the old site, site data for cookie-less sites too', async () => {
  store.settings = { ...store.settings, cleanOnDomainChange: true };
  store.lists = [];
  tabs = [{ id: 7, url: 'https://news.site/' }];
  cookies = [ck('.news.site', 'a')];
  await fire('tabs.onUpdated', 7, { url: 'https://news.site/' }, tabs[0]); await tick();
  await fire('tabs.onUpdated', 7, { url: 'https://nocookie.app/' }, { id: 7, url: 'https://nocookie.app/' }); await tick();
  tabs = [{ id: 7, url: 'https://weather.io/' }];
  await fire('tabs.onUpdated', 7, { url: 'https://weather.io/' }, tabs[0]); await tick();
  assert.equal(cookies.length, 0);
  assert.ok(removedOrigins.includes('https://nocookie.app'), 'site data cleared for a visited site without cookies');
});

test('popup messages: site info and clean this site', async () => {
  store.lists = [{ expression: 'google.com', list: 'keep' }];
  tabs = [{ id: 1, url: 'https://google.com/' }];
  cookies = [ck('.google.com', 'SID'), ck('.ads.net', 'p', { partitionKey: { topLevelSite: 'https://google.com' } }), ck('.bing.com', 'b')];
  const info = await send({ type: 'site-info', host: 'www.google.com' });
  assert.deepEqual(info, { site: 'google.com', cookies: 2, partitioned: 1, openTabs: 1 });
  const r = await send({ type: 'clean-site', host: 'google.com' });
  assert.equal(r.cookies, 2);
  assert.deepEqual(cookies.map((c) => c.domain), ['.bing.com']);
});

test('site info counts the tabs a site is open in', async () => {
  tabs = [{ id: 1, url: 'https://a.shop.com/' }, { id: 2, url: 'https://shop.com/cart' }, { id: 3, url: 'https://other.com/' }];
  cookies = [];
  assert.equal((await send({ type: 'site-info', host: 'shop.com' })).openTabs, 2);
});

test('"Clean this site" from an incognito window leaves the normal profile alone', async () => {
  store.settings = { ...store.settings, enabled: true, cleanSiteData: true };
  store.lists = [];
  store.visited = ['shop.com'];
  tabs = [{ id: 1, url: 'https://shop.com/', incognito: true }, { id: 2, url: 'https://shop.com/' }];
  cookies = [ck('.shop.com', 'private', { storeId: '1' }), ck('.shop.com', 'regular')];
  const logBefore = store.log.length;
  const before = removedOrigins.length;
  const r = await send({ type: 'clean-site', host: 'shop.com', incognito: true });
  assert.equal(r.cookies, 1);
  assert.deepEqual(cookies.map((c) => c.name), ['regular']);
  assert.deepEqual(store.visited, ['shop.com'], 'regular site data is still pending, not wiped');
  assert.equal(removedOrigins.length, before);
  assert.ok(store.log.length === logBefore + 1 || store.log.length === 100);
  assert.deepEqual(store.log[0].sites, [], 'incognito site is not named in the log');

  // And from a normal window, incognito cookies stay.
  cookies = [ck('.shop.com', 'private', { storeId: '1' }), ck('.shop.com', 'regular')];
  await send({ type: 'clean-site', host: 'shop.com', incognito: false });
  assert.deepEqual(cookies.map((c) => c.name), ['private']);
  assert.ok(removedOrigins.slice(before).includes('https://shop.com'));
  assert.equal(await send({ type: 'clean-site', host: 'shop.com', incognito: 'yes' }), null);
});

test('site data on a non-default port is cleaned with its site', async () => {
  store.settings = { ...store.settings, enabled: true, delaySec: 0, cleanSiteData: true };
  store.lists = [];
  store.visited = [];
  const tab = { id: 90, url: 'http://localhost:8080/app' };
  tabs = [tab];
  cookies = [];
  await fire('tabs.onUpdated', 90, { url: tab.url }, tab); await tick();
  assert.ok(store.visited.includes('localhost:8080'));
  tabs = [];
  const before = removedOrigins.length;
  await fire('tabs.onRemoved', 90); await tick();
  assert.ok(removedOrigins.slice(before).includes('http://localhost:8080'));
  assert.deepEqual(store.log[0].sites, ['localhost']);
  assert.ok(!store.visited.includes('localhost:8080'));
});

test('a steady stream of closed tabs cannot postpone the clean past delay + 30 s', async () => {
  store.settings = { ...store.settings, enabled: true, delaySec: 60 };
  tabs = [];
  delete session.pendingSince;
  const realNow = Date.now;
  let now = realNow();
  Date.now = () => now;
  try {
    await fire('tabs.onRemoved', 700);
    const first = now;
    for (let i = 1; i <= 10; i++) { now += 10000; await fire('tabs.onRemoved', 700 + i); }
    assert.equal(alarms['crumbclear-clean'].when, first + 60000 + 30000);
  } finally {
    Date.now = realNow;
  }
  await fire('alarms.onAlarm', { name: 'crumbclear-clean' }); await tick();
  assert.ok(!('pendingSince' in session), 'next burst starts a new window');
});

test('paused auto-clean does nothing on tab close', async () => {
  store.settings = { ...store.settings, enabled: false, delaySec: 0 };
  tabs = [];
  cookies = [ck('.z.com', 'a')];
  await fire('tabs.onRemoved', 9); await tick();
  assert.equal(cookies.length, 1);
});

test('a burst of closed tabs never runs cleans in parallel and merges queued ones', async () => {
  store.settings = { ...store.settings, enabled: true, delaySec: 0 };
  store.lists = [];
  tabs = [];
  cookies = [ck('.burst.com', 'a')];
  const before = calls.cleanRuns; // each clean reads the visited list once
  for (let i = 0; i < 5; i++) fire('tabs.onRemoved', 100 + i);
  await tick(); await tick();
  assert.equal(cookies.length, 0);
  assert.ok(calls.cleanRuns - before <= 2, `ran ${calls.cleanRuns - before} cleans for 5 closes`);
});

test('after a browser start, cleaning waits for restored tabs to appear', async () => {
  store.settings = { ...store.settings, enabled: true, delaySec: 30, cleanOnStartup: true };
  store.lists = [];
  session = {};
  tabs = []; // session restore has not reported its tabs yet
  cookies = [ck('.restored.com', 'sid'), ck('.gone.com', 'x')];
  await fire('runtime.onStartup');
  await fire('alarms.onAlarm', { name: 'crumbclear-clean' }); // alarm that came due while the browser was closed
  setTimeout(() => { tabs = [{ id: 50, url: 'https://restored.com/' }]; }, 1500);
  await new Promise((r) => setTimeout(r, 600));
  assert.equal(cookies.length, 2, 'nothing removed before tabs settle');
  await new Promise((r) => setTimeout(r, 4500));
  assert.deepEqual(cookies.map((c) => c.domain), ['.restored.com']);
  assert.equal(session.ready, true);
});

test('a tab still loading protects the site it is loading', async () => {
  store.settings = { ...store.settings, enabled: true, delaySec: 0 };
  store.lists = [];
  tabs = [{ id: 60, url: 'about:blank', pendingUrl: 'https://pending.com/login' }, { id: 61, url: 'https://old.com/', pendingUrl: 'https://next.com/' }];
  cookies = [ck('.pending.com', 'a'), ck('.old.com', 'b'), ck('.next.com', 'c'), ck('.closed.com', 'd')];
  await fire('tabs.onRemoved', 62); await tick();
  assert.deepEqual(cookies.map((c) => c.domain).sort(), ['.next.com', '.old.com', '.pending.com']);
});

test('domain change is still noticed after the service worker restarts', async () => {
  store.settings = { ...store.settings, enabled: true, delaySec: 0, cleanOnDomainChange: true };
  store.lists = [];
  tabs = [{ id: 70, url: 'https://before.com/' }];
  cookies = [ck('.before.com', 'a')];
  await fire('tabs.onUpdated', 70, { url: 'https://before.com/' }, tabs[0]); await tick();
  // Chrome stops an idle worker; the module is evaluated again with empty memory.
  for (const k of Object.keys(listeners)) delete listeners[k];
  await import('../src/background.js?restart=1');
  tabs = [{ id: 70, url: 'https://after.com/' }];
  await fire('tabs.onUpdated', 70, { url: 'https://after.com/' }, tabs[0]); await tick();
  assert.equal(cookies.length, 0);
});

test('hosts visited at the same time are all remembered for site-data cleanup', async () => {
  store.visited = [];
  tabs = [];
  const loads = Array.from({ length: 20 }, (_, i) => {
    const tab = { id: 200 + i, url: `https://site${i}.org/` };
    return fire('tabs.onUpdated', tab.id, { url: tab.url }, tab);
  });
  await Promise.all(loads); await tick();
  assert.equal(store.visited.filter((h) => h.startsWith('site')).length, 20);
});

test('incognito browsing leaves no host names in persistent storage', async () => {
  store.settings = { ...store.settings, enabled: true, delaySec: 0, cleanSiteData: true };
  store.lists = [];
  store.visited = [];
  const tab = { id: 300, url: 'https://secret.com/', incognito: true };
  tabs = [tab];
  await fire('tabs.onUpdated', 300, { url: tab.url }, tab); await tick();
  assert.ok(!store.visited.includes('secret.com'), 'not written to visited');
  cookies = [ck('.secret.com', 's', { storeId: '1' }), ck('.public.com', 'p')];
  tabs = [{ id: 301, url: 'about:blank', incognito: true }];
  const removedBefore = removedOrigins.length;
  await fire('tabs.onRemoved', 300); await tick();
  assert.equal(cookies.length, 0, 'incognito cookies are still cleaned');
  assert.deepEqual(store.log[0].sites, ['public.com']);
  assert.equal(store.log[0].cookies, 2);
  assert.ok(!removedOrigins.slice(removedBefore).some((o) => o.includes('secret.com')));
});

test('messages from other senders or with bad input are rejected', async () => {
  store.settings = { ...store.settings, enabled: false };
  tabs = [];
  cookies = [ck('.victim.com', 'a')];
  assert.equal(await send({ type: 'clean-now' }, { id: 'some-other-extension' }), null);
  assert.equal(await send({ type: 'clean-site', host: 42 }), null, 'no silent fallback to a full clean');
  assert.equal(await send({ type: 'clean-site' }), null);
  assert.equal(await send({ type: 'site-info', host: 'x'.repeat(300) }), null);
  assert.equal(await send({ type: 'site-info', host: 'bad host!' }), null);
  assert.equal(await send({ type: 'toString' }), null);
  assert.equal(await send(null), null);
  assert.equal(cookies.length, 1);
  assert.equal((await send({ type: 'site-info', host: 'victim.com' })).cookies, 1);
  store.settings = { ...store.settings, enabled: true };
});

test('one origin Chrome rejects does not stop site data cleanup for the rest', async () => {
  store.settings = { ...store.settings, enabled: true, delaySec: 0, cleanSiteData: true };
  store.lists = [];
  tabs = [];
  cookies = [ck('.good-one.com', 'a'), ck('.odd-one.com', 'b')];
  fail.badOrigins = ['https://odd-one.com'];
  const before = removedOrigins.length;
  await fire('tabs.onRemoved', 400); await tick();
  fail.badOrigins = [];
  assert.ok(removedOrigins.slice(before).includes('https://good-one.com'));
  assert.ok(removedOrigins.slice(before).includes('http://odd-one.com'));
});

test('a failing storage write neither crashes nor blocks later cleans; log entries stay small', async () => {
  store.settings = { ...store.settings, enabled: true, delaySec: 0 };
  store.lists = [];
  tabs = [];
  const unhandled = [];
  const onUnhandled = (e) => unhandled.push(e);
  process.on('unhandledRejection', onUnhandled);
  cookies = [ck('.first.com', 'a')];
  fail.storageSet = true;
  await fire('tabs.onRemoved', 500); await tick();
  fail.storageSet = false;
  cookies = Array.from({ length: 300 }, (_, i) => ck(`.many${i}.com`, 'a'));
  await fire('tabs.onRemoved', 501); await tick(); await tick();
  process.off('unhandledRejection', onUnhandled);
  assert.deepEqual(unhandled, []);
  assert.equal(cookies.length, 0, 'next clean still ran');
  assert.equal(store.log[0].siteCount, 300);
  assert.ok(store.log[0].sites.length <= 50);
});

test('update keeps settings and lists, records the schema version, opens no page', async () => {
  store.settings = { ...store.settings, delaySec: 300, enabled: false };
  store.lists = [{ expression: 'mine.com', list: 'keep' }];
  let opened = 0;
  chrome.runtime.openOptionsPage = () => { opened++; };
  await fire('runtime.onInstalled', { reason: 'update', previousVersion: '1.0.0' });
  assert.equal(store.settings.delaySec, 300);
  assert.equal(store.settings.enabled, false);
  assert.deepEqual(store.lists, [{ expression: 'mine.com', list: 'keep' }]);
  assert.equal(store.schemaVersion, 1);
  assert.equal(opened, 0);
  store.settings = { ...store.settings, enabled: true };
});

test('fresh install: auto-clean off, setup pending, sign-in services kept', async () => {
  const saved = { store, cookies, tabs };
  store = {}; tabs = []; cookies = [ck('.shop.com', 'cart'), ck('.google.com', 'SID')];
  let opened = 0;
  chrome.runtime.openOptionsPage = () => { opened++; };
  await fire('runtime.onInstalled', { reason: 'install' });
  assert.equal(store.settings.enabled, false);
  assert.equal(store.settings.needsSetup, true);
  assert.equal(store.settings.cleanOnDomainChange, false);
  assert.deepEqual(store.lists, ['accounts.google.com', 'accounts.youtube.com', 'login.microsoftonline.com', 'login.live.com',
    'appleid.apple.com', 'github.com', 'okta.com'].map((expression) => ({ expression, list: 'keep' })));
  assert.equal(opened, 1, 'options page opened for setup');
  await fire('tabs.onRemoved', 9); await tick();
  await fire('alarms.onAlarm', { name: 'crumbclear-clean' }); await tick();
  assert.equal(cookies.length, 2, 'nothing cleaned before setup');
  // Once enabled, the Google sign-in cookie survives through the accounts.google.com rule.
  store.settings = { ...store.settings, enabled: true, needsSetup: false, delaySec: 0 };
  await fire('tabs.onRemoved', 9); await tick();
  assert.deepEqual(cookies.map((c) => c.domain), ['.google.com']);
  ({ store, cookies, tabs } = saved);
});

test('update keeps the user\'s settings and lists', async () => {
  const saved = { store };
  store = { settings: { enabled: true, cleanOnDomainChange: true, delaySec: 60 }, lists: [{ expression: 'a.com', list: 'keep' }] };
  await fire('runtime.onInstalled', { reason: 'update', previousVersion: '1.0.0' });
  assert.equal(store.settings.enabled, true);
  assert.equal(store.settings.needsSetup, false);
  assert.equal(store.settings.cleanOnDomainChange, true);
  assert.deepEqual(store.lists, [{ expression: 'a.com', list: 'keep' }]);
  ({ store } = saved);
});

test('tabs closed within the delay are cleaned together in one run', async () => {
  store.settings = { ...store.settings, enabled: true, delaySec: 60 };
  store.lists = [];
  tabs = [];
  cookies = [ck('.first-closed.com', 'a'), ck('.second-closed.com', 'b')];
  const logBefore = store.log.length;
  await fire('tabs.onRemoved', 600); await tick();
  const firstDue = alarms['crumbclear-clean'].when;
  await new Promise((r) => setTimeout(r, 5));
  await fire('tabs.onRemoved', 601); await tick();
  assert.ok(alarms['crumbclear-clean'].when > firstDue, 'second close pushes the alarm back');
  assert.equal(cookies.length, 2);
  await fire('alarms.onAlarm', { name: 'crumbclear-clean' }); await tick();
  assert.equal(cookies.length, 0);
  assert.equal(store.log.length, Math.min(logBefore + 1, 100));
  assert.deepEqual(store.log[0].sites, ['first-closed.com', 'second-closed.com']);
});

test('incognito host names stay out of storage after the last private tab has closed', async () => {
  store.settings = { ...store.settings, enabled: true, delaySec: 0, cleanSiteData: true };
  store.lists = [];
  store.visited = [];
  // The private cookie store can outlive its last tab for a moment.
  tabs = [];
  cookies = [ck('.private-only.com', 's', { storeId: '1' })];
  await fire('tabs.onRemoved', 310); await tick();
  assert.equal(cookies.length, 0, 'incognito cookies are still cleaned');
  assert.ok(!JSON.stringify(store).includes('private-only'), JSON.stringify(store.log[0]));
});

test('a failing storage write while a page loads is caught and the tab is still tracked', async () => {
  store.settings = { ...store.settings, enabled: true, delaySec: 0, cleanOnDomainChange: true };
  store.lists = [];
  store.visited = [];
  tabs = [{ id: 80, url: 'https://quota-first.com/' }];
  cookies = [ck('.quota-first.com', 'a')];
  fail.storageSet = true;
  try {
    await assert.doesNotReject(fire('tabs.onUpdated', 80, { url: tabs[0].url }, tabs[0]));
  } finally {
    fail.storageSet = false;
  }
  tabs = [{ id: 80, url: 'https://quota-second.com/' }];
  await fire('tabs.onUpdated', 80, { url: tabs[0].url }, tabs[0]); await tick();
  assert.equal(cookies.length, 0, 'the domain change after the failed write is still noticed');
});

test('domain change does not clean while the setting is off (the default)', async () => {
  store.settings = { ...store.settings, enabled: true, delaySec: 0, cleanOnDomainChange: false };
  store.lists = [];
  tabs = [{ id: 81, url: 'https://stay-a.com/' }];
  cookies = [ck('.stay-a.com', 'a')];
  await fire('tabs.onUpdated', 81, { url: tabs[0].url }, tabs[0]); await tick();
  tabs = [{ id: 81, url: 'https://stay-b.com/' }];
  await fire('tabs.onUpdated', 81, { url: tabs[0].url }, tabs[0]); await tick();
  assert.equal(cookies.length, 1);
});

// Runs last: by now every code path above has written its keys.
test('stored keys are exactly the ones privacy.html describes', () => {
  const policy = readFileSync(new URL('../privacy.html', import.meta.url), 'utf8');
  const described = {
    settings: 'Your settings', lists: 'Your lists', visited: 'Host names of sites you visited',
    log: 'history of the last 100 cleanups', stats: 'Totals of cookies removed', schemaVersion: 'version number of this storage format',
  };
  assert.deepEqual(Object.keys(store).sort(), Object.keys(described).sort());
  for (const phrase of Object.values(described)) assert.ok(policy.includes(phrase), phrase);
  for (const key of Object.keys(session)) assert.match(key, /^(ready|pendingSince|tabHost\.\d+)$/);
  assert.ok(policy.includes('the host name currently shown in each tab') && policy.includes('finished restoring tabs'));
  assert.ok(policy.includes('when the first tab waiting for cleanup was closed'));
});
