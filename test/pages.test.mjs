// Runs the real options page and popup scripts against a fake DOM and chrome API.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DEFAULT_SETTINGS, LOGIN_PROVIDERS } from '../src/lib.js';
import { fakeDocument, fakeChrome, settle } from './fake-dom.mjs';

let runs = 0;
async function open(page, setup) {
  globalThis.chrome = fakeChrome(setup);
  globalThis.document = fakeDocument(readFileSync(new URL(`../src/${page}.html`, import.meta.url), 'utf8'));
  await import(`../src/${page}.js?run=${++runs}`);
  await settle();
  const $ = (id) => document.getElementById(id);
  return { $, store: setup.store };
}

const ck = (domain, name, extra = {}) => ({ domain, name, path: '/', secure: true, storeId: '0', ...extra });
const freshStore = () => ({
  settings: { ...DEFAULT_SETTINGS, enabled: false, needsSetup: true },
  lists: LOGIN_PROVIDERS.map((expression) => ({ expression, list: 'keep' })),
});
const sitesShown = ($) => $('setupSites').querySelectorAll('input').map((b) => [b.value, b.checked]);

test('first run: lists sites with cookies, most cookies first, without already kept ones', async () => {
  const cookies = [
    ck('.google.com', 'SID'), ck('github.com', 'user', { hostOnly: true }),
    ck('.shop.com', 'a'), ck('.shop.com', 'b'), ck('www.news.site', 'c', { hostOnly: true }), ck('.bank.example', 'd'),
  ];
  const { $ } = await open('options', { store: freshStore(), cookies });
  assert.equal($('setup').hidden, false);
  assert.deepEqual(sitesShown($), [['shop.com', false], ['bank.example', false], ['news.site', false]]);
  assert.equal($('setupSites').children[0].textContent, 'shop.com2 cookies');
  assert.equal($('setupEmpty').hidden, true);
});

test('first run: filter, Select all, then keep the picked sites and turn auto-clean on', async () => {
  const cookies = [ck('.shop.com', 'a'), ck('.shopping.net', 'b'), ck('.news.site', 'c')];
  const { $, store } = await open('options', { store: freshStore(), cookies });
  $('setupFilter').value = 'shop';
  await $('setupFilter').dispatch('input');
  assert.deepEqual(sitesShown($).map(([s]) => s), ['shop.com', 'shopping.net']);
  await $('setupAll').click();
  $('setupFilter').value = '';
  await $('setupFilter').dispatch('input');
  assert.deepEqual(sitesShown($), [['news.site', false], ['shop.com', true], ['shopping.net', true]]);

  await $('setupDone').click(); await settle();
  assert.equal(store.settings.enabled, true);
  assert.equal(store.settings.needsSetup, false);
  const kept = store.lists.filter((i) => i.list === 'keep').map((i) => i.expression);
  assert.deepEqual(kept, [...LOGIN_PROVIDERS, 'shop.com', 'shopping.net']);
  assert.equal($('setup').hidden, true);
  assert.equal($('addMsg').textContent, 'Auto-clean is on. Kept 2 sites.');
});

test('first run with no cookies shows the empty note, and with many sites lists them all', async () => {
  let { $ } = await open('options', { store: freshStore(), cookies: [] });
  assert.equal($('setup').hidden, false);
  assert.equal($('setupEmpty').hidden, false);
  assert.equal(sitesShown($).length, 0);

  const many = Array.from({ length: 300 }, (_, i) => ck(`.site${i}.com`, 'a'));
  ({ $ } = await open('options', { store: freshStore(), cookies: many }));
  assert.equal(sitesShown($).length, 300);
  assert.equal($('setupEmpty').hidden, true);
});

test('setup block hides when auto-clean is turned on in the popup or the options toggle', async () => {
  let { $, store } = await open('options', { store: freshStore(), cookies: [ck('.a.com', 'x')] });
  assert.equal($('setup').hidden, false);
  // The popup writes settings; the open options page follows.
  await chrome.storage.local.set({ settings: { ...store.settings, enabled: true, needsSetup: false } }); await settle();
  assert.equal($('setup').hidden, true);

  ({ $, store } = await open('options', { store: freshStore(), cookies: [ck('.a.com', 'x')] }));
  const toggle = document.querySelectorAll('[data-setting]').find((e) => e.dataset.setting === 'enabled');
  toggle.checked = true;
  await toggle.dispatch('change'); await settle();
  assert.equal(store.settings.enabled, true);
  assert.equal(store.settings.needsSetup, false);
  assert.equal($('setup').hidden, true);
  // Pausing later does not bring the setup block back.
  toggle.checked = false;
  await toggle.dispatch('change'); await settle();
  assert.equal($('setup').hidden, true);
});

test('after an update (no setup pending) the setup block stays hidden', async () => {
  const { $ } = await open('options', {
    store: { settings: { enabled: true, delaySec: 60 }, lists: [{ expression: 'a.com', list: 'keep' }] },
    cookies: [ck('.b.com', 'x')],
  });
  assert.equal($('setup').hidden, true);
});

test('options: delay choices, default 30 s, domain-change off, named Remove buttons', async () => {
  const { $ } = await open('options', { store: freshStore() });
  const setting = (k) => document.querySelectorAll('[data-setting]').find((e) => e.dataset.setting === k);
  const delays = document.all.filter((e) => e.tagName === 'OPTION' && /^\d+$/.test(e.value)).map((e) => Number(e.value));
  assert.deepEqual(delays, [0, 30, 60, 300, 900]);
  assert.equal(setting('delaySec').value, '30');
  assert.equal(setting('cleanOnDomainChange').checked, false);
  const removes = $('lists').querySelectorAll('button');
  assert.equal(removes.length, LOGIN_PROVIDERS.length);
  assert.ok(removes.some((b) => b.getAttribute('aria-label') === 'Remove okta.com'));
});

test('popup while setup is pending: paused state, toggling on clears needsSetup', async () => {
  const { $, store } = await open('popup', {
    store: freshStore(),
    tab: { id: 1, url: 'https://www.shop.com/cart' },
    replies: { 'site-info': { site: 'shop.com', cookies: 2, partitioned: 0 } },
  });
  assert.equal($('enabled').checked, false);
  assert.equal($('enabledLabel').textContent, 'Auto-clean off');
  assert.equal($('host').textContent, 'shop.com');
  assert.equal($('statusPill').textContent, 'Auto-clean paused');
  assert.equal($('count').textContent, '2 cookies');

  $('enabled').checked = true;
  await $('enabled').dispatch('change'); await settle();
  assert.equal(store.settings.enabled, true);
  assert.equal(store.settings.needsSetup, false);
  assert.equal($('enabledLabel').textContent, 'Auto-clean on');
  assert.equal($('statusPill').textContent, 'Cleaned on close');
});

test('popup shows a default sign-in service as kept', async () => {
  const { $ } = await open('popup', { store: freshStore(), tab: { id: 1, url: 'https://github.com/' } });
  assert.equal($('statusPill').textContent, 'Kept');
  const pressed = document.querySelectorAll('.seg button').filter((b) => b.getAttribute('aria-pressed') === 'true');
  assert.deepEqual(pressed.map((b) => b.dataset.list), ['keep']);
});

test('popup: "Clean closed tabs" is unavailable until setup is finished', async () => {
  const pending = await open('popup', { store: freshStore(), tab: { id: 1, url: 'https://www.shop.com/' } });
  assert.equal(pending.$('cleanNow').disabled, true);
  assert.equal(pending.$('stats').textContent, 'Finish setup in Settings to start');
  pending.$('enabled').checked = true;
  await pending.$('enabled').dispatch('change'); await settle();
  assert.equal(pending.$('cleanNow').disabled, false);
  assert.equal(pending.$('stats').textContent, '0 cookies cleaned');

  const done = await open('popup', { store: { settings: { ...DEFAULT_SETTINGS, enabled: false }, lists: [] }, tab: { id: 1, url: 'https://www.shop.com/' } });
  assert.equal(done.$('cleanNow').disabled, false, 'a paused but set-up extension can still clean by hand');
});

test('popup: Until restart hint names the setting it depends on', async () => {
  const { $ } = await open('popup', { store: { settings: { ...DEFAULT_SETTINGS }, lists: [{ expression: 'shop.com', list: 'session' }] }, tab: { id: 1, url: 'https://www.shop.com/' } });
  assert.match($('hint').textContent, /Clean on browser start/);
});
