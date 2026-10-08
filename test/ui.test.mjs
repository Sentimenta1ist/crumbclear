// Static checks of the UI files: accessible names, contrast, no unsafe DOM APIs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');

test('every form control has an accessible name', () => {
  for (const file of ['popup.html', 'options.html']) {
    const html = read(file);
    for (const [tag] of html.matchAll(/<(input|select)\b[^>]*>/g)) {
      if (/type="file"/.test(tag)) continue;
      const id = (tag.match(/id="([^"]+)"/) || [])[1];
      const labelled = /aria-label(ledby)?="[^"]+"/.test(tag) ||
        (id && new RegExp(`<label[^>]*>(?:(?!</label>)[\\s\\S])*id="${id}"`).test(html));
      assert.ok(labelled, `${file}: ${tag}`);
    }
  }
});

const luminance = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test('text and badge colours meet WCAG AA (4.5:1)', () => {
  const css = read('ui.css');
  const [light, dark] = css.split('@media (prefers-color-scheme: dark)');
  const tokens = (block) => Object.fromEntries([...block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})/g)].map((m) => [m[1], m[2]]));
  const L = tokens(light);
  const D = { ...L, ...tokens(dark) };
  for (const [name, t] of [['light', L], ['dark', D]]) {
    for (const [fg, bg] of [['ink', 'bg'], ['muted', 'bg'], ['muted', 'panel'], ['keep', 'keep-bg'], ['session', 'session-bg'], ['accent-ink', 'accent'], ['accent', 'bg']]) {
      assert.ok(ratio(t[fg], t[bg]) >= 4.5, `${name}: --${fg} on --${bg} = ${ratio(t[fg], t[bg]).toFixed(2)}`);
    }
  }
  const bg = read('background.js');
  const badge = bg.match(/const color = [^;]+;/)[0].match(/#[0-9a-f]{6}/g);
  assert.equal(badge.length, 4);
  for (const c of badge) assert.ok(ratio(c, '#ffffff') >= 4.5, `badge ${c}`);
});

test('no unsafe DOM or code-loading APIs in extension code', () => {
  for (const file of ['popup.js', 'options.js', 'background.js', 'lib.js', 'popup.html', 'options.html']) {
    const src = read(file);
    for (const bad of [/innerHTML/, /outerHTML/, /insertAdjacentHTML/, /document\.write/, /\beval\(/, /new Function/, /\bfetch\(/, /XMLHttpRequest/, /importScripts/, /WebSocket/, /\bon[a-z]+="/, /<script>(?!<\/script>)/]) {
      assert.ok(!bad.test(src), `${file} uses ${bad}`);
    }
  }
});

test('vendored tldts is the readable build with its license', () => {
  const src = readFileSync(new URL('../src/vendor/tldts.js', import.meta.url), 'utf8');
  for (const bad of [/\beval\(/, /new Function/, /\bfetch\(/, /XMLHttpRequest/, /importScripts/, /WebSocket/, /sendBeacon/, /\bimport\(/]) {
    assert.ok(!bad.test(src), `tldts.js uses ${bad}`);
  }
  assert.match(src.split('\n')[0], /^\/\/ tldts 7\.4\.18/);
  // The exact command, so reviewers can rebuild the file from npm and diff it.
  assert.match(src.split('\n')[2], /esbuild \d+\.\d+\.\d+: .*--bundle --format=esm --platform=neutral --charset=utf8$/);
  assert.ok(!/sourceMappingURL/.test(src), 'no reference to a source map that is not shipped');
  assert.ok(src.split('\n').length > 500, 'not minified');
  assert.match(readFileSync(new URL('../src/vendor/tldts-LICENSE.txt', import.meta.url), 'utf8'), /MIT|Permission is hereby granted/);
});

test('status messages are announced and copy matches the listing', () => {
  const html = read('options.html');
  for (const id of ['setupMsg', 'addMsg', 'importMsg']) assert.match(html, new RegExp(`id="${id}" role="status"`), id);
  const listing = readFileSync(new URL('../LISTING.md', import.meta.url), 'utf8');
  for (const text of [html, listing]) assert.match(text, /Google, Microsoft, Apple, GitHub and Okta sign-in/);
  // One legend entry per badge colour (kept, until restart, cleaned, paused).
  assert.match(html, /Green: kept\. Amber: kept until restart\. Orange: will be cleaned\. Grey: auto-clean is paused\./);
});
