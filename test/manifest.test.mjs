// Manifest checks against Chrome Web Store limits and the permissions the code uses.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const m = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));
const code = readdirSync(new URL('src/', root)).filter((f) => f.endsWith('.js'))
  .map((f) => readFileSync(new URL(`src/${f}`, root), 'utf8')).join('\n');

test('manifest fields fit store limits', () => {
  assert.equal(m.manifest_version, 3);
  assert.match(m.version, /^\d+(\.\d+){0,3}$/);
  assert.ok(m.name.length <= 75);
  assert.ok(m.description.length <= 132, `description is ${m.description.length} chars`);
  assert.ok(!/cookie autodelete/i.test(m.name + m.description), 'no third-party product names in name/summary');
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
  assert.deepEqual(m.host_permissions, ['<all_urls>']);
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
