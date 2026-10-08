import assert from 'node:assert/strict';
import { test } from 'node:test';
import { siteOf, compileExpression, cleanExpression, listStatus, decideCookie, parseImport, cookieUrl, mergeLists, originsFor, plural, ruleFor, isPublicSuffixExpression } from '../src/lib.js';

test('siteOf groups subdomains and respects private suffixes', () => {
  assert.equal(siteOf('mail.google.com'), 'google.com');
  assert.equal(siteOf('.accounts.google.com'), 'google.com');
  assert.equal(siteOf('a.b.co.uk'), 'b.co.uk');
  assert.equal(siteOf('foo.github.io'), 'foo.github.io');
  assert.equal(siteOf('localhost'), 'localhost');
  assert.equal(siteOf('192.168.0.1'), '192.168.0.1');
});

test('expressions match domain + subdomains, not lookalikes', () => {
  const re = compileExpression('example.com');
  assert.ok(re.test('example.com'));
  assert.ok(re.test('www.example.com'));
  assert.ok(!re.test('badexample.com'));
  assert.ok(compileExpression('*.example.com').test('example.com'));
  assert.ok(compileExpression('https://Example.com/path').test('a.example.com'));
  assert.ok(compileExpression('shop.example.*').test('shop.example.de'));
  assert.equal(compileExpression('not a domain'), null);
});

test('keep wins over session', () => {
  const lists = [{ expression: 'google.com', list: 'session' }, { expression: 'mail.google.com', list: 'keep' }];
  assert.equal(listStatus('mail.google.com', lists), 'keep');
  assert.equal(listStatus('drive.google.com', lists), 'session');
  assert.equal(listStatus('bing.com', lists), null);
});

const ctx = (o = {}) => ({ openSites: new Set(['google.com']), lists: [], startup: false, ...o });

test('cookies of open sites survive, even other subdomains of the same site', () => {
  assert.equal(decideCookie({ domain: '.accounts.google.com' }, ctx()).remove, false);
  assert.equal(decideCookie({ domain: '.ads.example.net' }, ctx()).remove, true);
});

test('lists: keep always, session only until startup', () => {
  const lists = [{ expression: 'github.com', list: 'keep' }, { expression: 'reddit.com', list: 'session' }];
  assert.equal(decideCookie({ domain: 'github.com' }, ctx({ lists })).remove, false);
  assert.equal(decideCookie({ domain: 'github.com' }, ctx({ lists, startup: true })).remove, false);
  assert.equal(decideCookie({ domain: '.reddit.com' }, ctx({ lists })).remove, false);
  assert.equal(decideCookie({ domain: '.reddit.com' }, ctx({ lists, startup: true })).remove, true);
});

test('partitioned cookies follow their top-level site', () => {
  const pc = { domain: '.tracker.io', partitionKey: { topLevelSite: 'https://google.com' } };
  assert.equal(decideCookie(pc, ctx()).remove, false);
  const closed = { domain: '.tracker.io', partitionKey: { topLevelSite: 'https://news.site' } };
  assert.equal(decideCookie(closed, ctx()).remove, true);
  const kept = { domain: '.tracker.io', partitionKey: { topLevelSite: 'https://news.site' } };
  assert.equal(decideCookie(kept, ctx({ lists: [{ expression: 'news.site', list: 'keep' }] })).remove, false);
});

test('clean-this-site removes only that site, including kept ones', () => {
  const lists = [{ expression: 'google.com', list: 'keep' }];
  assert.equal(decideCookie({ domain: '.google.com' }, ctx({ lists, onlySite: 'google.com' })).remove, true);
  assert.equal(decideCookie({ domain: '.bing.com' }, ctx({ onlySite: 'google.com' })).remove, false);
});

test('cookie url', () => {
  assert.equal(cookieUrl({ domain: '.a.com', path: '/x', secure: true }), 'https://a.com/x');
  assert.equal(cookieUrl({ domain: 'a.com', secure: false }), 'http://a.com/');
});

test('imports Cookie AutoDelete export', () => {
  const cad = JSON.stringify({ default: [
    { expression: '*.github.com', listType: 'WHITE', storeId: 'default' },
    { expression: 'youtube.com', listType: 'GREY' },
  ], 'firefox-container-1': [{ expression: 'github.com', listType: 'WHITE' }] });
  const r = parseImport(cad);
  assert.deepEqual(r.map((x) => [x.expression, x.list]), [['*.github.com', 'keep'], ['youtube.com', 'session'], ['github.com', 'keep']]);
});

test('imports own export and plain text', () => {
  assert.equal(parseImport(JSON.stringify({ crumbclear: 1, lists: [{ expression: 'a.com', list: 'session' }] }))[0].list, 'session');
  assert.deepEqual(parseImport('a.com\nb.org\n\nnot valid!').map((x) => x.expression), ['a.com', 'b.org']);
});

test('merge dedupes and upgrades to keep', () => {
  const { lists, added } = mergeLists([{ expression: 'a.com', list: 'session' }], [{ expression: 'A.com', list: 'keep' }, { expression: 'b.com', list: 'keep' }]);
  assert.equal(added.length, 1);
  assert.equal(lists.find((x) => x.expression === 'a.com').list, 'keep');
});

test('wildcard expressions cannot cause catastrophic backtracking', () => {
  const host = 'a'.repeat(253);
  const t = performance.now();
  for (const expr of ['*a*a*a*a*a*b', '*.*.*.*.*a', '*' + 'a*'.repeat(100) + 'q']) {
    assert.equal(compileExpression(expr).test(host), false);
    assert.equal(compileExpression(expr).test('a.'.repeat(126) + 'c'), false);
  }
  assert.ok(performance.now() - t < 200, `took ${performance.now() - t} ms`);
  assert.ok(compileExpression('*a*b').test('xab.c.ab'));
  assert.ok(compileExpression('shop.*.de').test('www.shop.example.de'));
  assert.ok(!compileExpression('shop.*.de').test('myshop.example.de'));
  assert.equal(compileExpression('a'.repeat(254)), null, 'longer than a hostname');
});

test('Unicode domains are matched in punycode, like cookies and tab URLs', () => {
  assert.equal(cleanExpression('Пример.РФ'), 'xn--e1afmkfd.xn--p1ai');
  assert.ok(compileExpression('пример.рф').test('www.xn--e1afmkfd.xn--p1ai'));
  assert.ok(compileExpression('*.пример.рф').test('xn--e1afmkfd.xn--p1ai'));
  assert.deepEqual(parseImport('münchen.de').map((x) => x.expression), ['xn--mnchen-3ya.de']);
});

test('import survives hostile files', () => {
  let deep = '"a.com"';
  for (let i = 0; i < 5000; i++) deep = `[${deep}]`;
  assert.doesNotThrow(() => parseImport(deep));
  const many = Array.from({ length: 20000 }, (_, i) => `s${i}.com`).join('\n');
  assert.equal(parseImport(many).length, 5000);
  const evil = '{"__proto__": {"polluted": 1, "expression": "evil.com"}, "constructor": {"prototype": {"x": 1}}, "lists": [{"expression": {"toString": 1}}, {"expression": "ok.com", "list": "__proto__"}]}';
  assert.deepEqual(parseImport(evil), [{ expression: 'ok.com', list: 'keep' }]);
  assert.equal({}.polluted, undefined);
  assert.equal(Object.prototype.x, undefined);
  assert.deepEqual(parseImport('123'), []);
  assert.deepEqual(parseImport('  A.com  \r\n a.com,\tb.com '), [{ expression: 'a.com', list: 'keep' }, { expression: 'b.com', list: 'keep' }]);
});

test('a rule for a subdomain keeps the parent-domain cookies that subdomain uses', () => {
  const lists = [{ expression: 'mail.google.com', list: 'keep' }, { expression: 'www.youtube.com', list: 'session' }];
  const c = ctx({ openSites: new Set(), lists });
  assert.equal(decideCookie({ domain: '.google.com', hostOnly: false }, c).remove, false, 'sent to mail.google.com');
  assert.equal(decideCookie({ domain: 'google.com', hostOnly: true }, c).remove, true, 'host-only: never sent to mail.');
  assert.equal(decideCookie({ domain: '.drive.google.com', hostOnly: false }, c).remove, true, 'sibling, not a parent');
  assert.equal(decideCookie({ domain: '.youtube.com', hostOnly: false }, c).remove, false);
  assert.equal(decideCookie({ domain: '.youtube.com', hostOnly: false }, { ...c, startup: true }).remove, true, 'session rules still end at startup');
  assert.equal(decideCookie({ domain: '.ads.net', partitionKey: { topLevelSite: 'https://youtube.com' } }, c).remove, false);
});

test('originsFor yields only valid origins, IPv6 in brackets', () => {
  assert.deepEqual(originsFor(['[::1]', '.a.com', 'bad host', '']), ['https://[::1]', 'http://[::1]', 'https://a.com', 'http://a.com']);
});

test('indexed list lookup agrees with a plain scan and stays fast at the list limit', () => {
  const naive = (host, lists) => {
    let st = null;
    for (const i of lists) {
      const m = compileExpression(i.expression);
      if (m && m.test(host)) { if (i.list === 'keep') return 'keep'; st = 'session'; }
    }
    return st;
  };
  const labels = ['a', 'b', 'co', 'uk', 'x-y'];
  const rnd = (n) => Array.from({ length: n }, () => labels[Math.floor(Math.random() * labels.length)]);
  for (let k = 0; k < 2000; k++) {
    const lists = Array.from({ length: 4 }, () => ({
      expression: (Math.random() < 0.3 ? '*.' : '') + rnd(1 + Math.floor(Math.random() * 3)).join('.').replace(/^a$/, 'a*'),
      list: Math.random() < 0.5 ? 'keep' : 'session',
    }));
    const host = rnd(1 + Math.floor(Math.random() * 4)).join('.');
    assert.equal(listStatus(host, lists), naive(host, lists), JSON.stringify({ host, lists }));
  }
  const lists = Array.from({ length: 5000 }, (_, i) => ({ expression: `${i % 10 ? '' : '*.'}site${i}.com`, list: 'keep' }));
  const t = performance.now();
  for (let i = 0; i < 3300; i++) decideCookie({ domain: `.s${i}.example.com` }, ctx({ openSites: new Set(), lists }));
  assert.ok(performance.now() - t < 500, `took ${performance.now() - t} ms`);
});

test('UI helpers: plural and the rule behind a status', () => {
  assert.equal(plural(1, 'cookie'), '1 cookie');
  assert.equal(plural(0, 'cookie'), '0 cookies');
  assert.equal(plural(1200, 'site'), '1,200 sites');
  const lists = [{ expression: '*.google.com', list: 'keep' }, { expression: 'mail.google.com', list: 'session' }];
  assert.equal(ruleFor('mail.google.com', lists).expression, '*.google.com');
  assert.equal(ruleFor('bing.com', lists), null);
});

test('public-suffix expressions are recognised for a warning', () => {
  for (const e of ['com', '*.co.uk', 'github.io', '.рф']) assert.equal(isPublicSuffixExpression(e), true, e);
  for (const e of ['example.com', 'localhost', 'intranet', 'shop.*', '192.168.0.1']) assert.equal(isPublicSuffixExpression(e), false, e);
});
