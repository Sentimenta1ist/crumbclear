// Manifest checks against Chrome Web Store limits and the permissions the code uses.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const m = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));
const code = readdirSync(new URL('src/', root)).filter((f) => f.endsWith('.js'))
  .map((f) => readFileSync(new URL(`src/${f}`, root), 'utf8')).join('\n');

const locales = readdirSync(new URL('_locales/', root));
const messages = (lang) => JSON.parse(readFileSync(new URL(`_locales/${lang}/messages.json`, root), 'utf8'));

test('manifest fields fit store limits in every language', () => {
  assert.equal(m.manifest_version, 3);
  assert.match(m.version, /^\d+(\.\d+){0,3}$/);
  assert.equal(m.default_locale, 'en');
  assert.equal(m.name, '__MSG_extName__');
  assert.equal(m.description, '__MSG_extDescription__');
  assert.ok(m.short_name.length <= 12);
  assert.deepEqual([...locales].sort(), ['de', 'en', 'ja', 'pl', 'zh_CN', 'zh_TW']);
  for (const lang of locales) {
    const msg = messages(lang);
    const name = msg.extName.message;
    const description = msg.extDescription.message;
    assert.ok(name.length <= 75, `${lang} name`);
    assert.ok(description.length <= 132, `${lang} description is ${description.length} chars`);
    assert.ok(/^CrumbClear/.test(name), `${lang} name starts with the brand`);
    assert.ok(!/cookie autodelete/i.test(name + description), `${lang}: no third-party product names in name/summary`);
  }
  assert.equal(m.incognito, 'spanning');
  assert.equal(m.minimum_chrome_version, '120', 'cookies.getAll with partitionKey needs 119+, 30 s alarms 120+');
  for (const key of ['content_scripts', 'web_accessible_resources', 'externally_connectable']) assert.ok(!(key in m), key);
});

// Pages load only packaged scripts, styles and images: no remote code, no
// network requests, no plugins, even if a bug ever let markup into a page.
test('extension pages have a strict CSP with no network access', () => {
  assert.deepEqual(Object.keys(m.content_security_policy), ['extension_pages']);
  const csp = Object.fromEntries(m.content_security_policy.extension_pages.split(';')
    .map((d) => d.trim().split(/\s+/)).filter((d) => d[0]).map(([k, ...v]) => [k, v]));
  assert.deepEqual(csp['default-src'], ["'none'"]);
  assert.deepEqual(csp['script-src'], ["'self'"]);
  assert.deepEqual(csp['img-src'], ["'self'"]);
  assert.deepEqual(csp['object-src'], ["'none'"]);
  assert.deepEqual(csp['base-uri'], ["'none'"]);
  assert.ok(!('connect-src' in csp), 'connect-src falls back to default-src none');
  assert.ok(!/unsafe-eval|wasm-unsafe-eval|https?:|\*/.test(m.content_security_policy.extension_pages));
});

test('every permission is used and every used API is permitted', () => {
  const apis = { cookies: /chrome\.cookies\./, storage: /chrome\.storage\./, alarms: /chrome\.alarms\./, browsingData: /chrome\.browsingData\./ };
  assert.deepEqual([...m.permissions].sort(), Object.keys(apis).sort());
  for (const [perm, re] of Object.entries(apis)) assert.match(code, re, perm);
  assert.deepEqual(m.host_permissions, ['*://*/*'], 'http and https only');
});

test('declared icons are PNGs of the declared size', () => {
  for (const [size, path] of Object.entries({ ...m.icons, ...m.action.default_icon })) {
    const png = readFileSync(new URL(path, root));
    assert.equal(png.toString('latin1', 1, 4), 'PNG', path);
    assert.equal(png.readUInt32BE(16), Number(size), `${path} width`);
    assert.equal(png.readUInt32BE(20), Number(size), `${path} height`);
    assert.equal(png[25], 6, `${path} is RGBA`);
  }
});

test('every language has every message, with matching placeholders', () => {
  const en = messages('en');
  const base = (k) => k.replace(/_(zero|one|two|few|many|other)$/, '');
  const enBases = new Set(Object.keys(en).map(base));
  const used = [...code.matchAll(/\bt\('([A-Za-z0-9]+)'|\btn\('([A-Za-z0-9]+)'|data-i18n(?:-[a-z-]+)?="([A-Za-z0-9]+)"/g)].map((x) => x[1] || x[2] || x[3]);
  const html = ['popup.html', 'options.html'].map((f) => readFileSync(new URL(`src/${f}`, root), 'utf8')).join('\n');
  for (const [, key] of html.matchAll(/data-i18n(?:-[a-z-]+)?="([A-Za-z0-9]+)"/g)) used.push(key);
  for (const key of used) assert.ok(enBases.has(key), `missing English message ${key}`);
  for (const key of ['extName', 'extDescription', 'actionTitle']) assert.ok(key in en, key);
  for (const lang of locales) {
    const msg = messages(lang);
    assert.deepEqual(new Set(Object.keys(msg).map(base)), enBases, lang);
    for (const [key, entry] of Object.entries(msg)) {
      assert.ok(entry.message && !/\{\d\}/.test(entry.message), `${lang}.${key}`);
      for (const p of entry.message.match(/\$[A-Za-z0-9_]+\$/g) || []) {
        assert.ok(entry.placeholders && entry.placeholders[p.slice(1, -1).toLowerCase()], `${lang}.${key} placeholder ${p}`);
      }
      const enEntry = en[key] || en[`${base(key)}_other`];
      assert.equal(Object.keys(entry.placeholders || {}).length, Object.keys(enEntry.placeholders || {}).length, `${lang}.${key} placeholder count`);
    }
  }
});
