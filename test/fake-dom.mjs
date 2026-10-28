import { readFileSync } from 'node:fs';

// A tiny stand-in for the DOM, just enough to run src/popup.js and
// src/options.js in Node. Elements come from the page's HTML as a flat list
// (no tree); elements the scripts create get real children.

class FakeElement {
  constructor(tag, attrs = {}) {
    this.tagName = tag.toUpperCase();
    this.attrs = { ...attrs };
    this.children = [];
    this.listeners = {};
    this.id = attrs.id || '';
    this.type = attrs.type || '';
    this.value = attrs.value ?? '';
    this.className = attrs.class || '';
    this.hidden = 'hidden' in attrs;
    this.checked = 'checked' in attrs;
    this.selected = 'selected' in attrs;
    this.disabled = false;
    this.dataset = {};
    for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
    }
    this.ownText = '';
  }

  get textContent() { return this.ownText + this.children.map((c) => c.textContent).join(''); }
  set textContent(text) { this.ownText = String(text); this.children = []; }
  append(...nodes) { this.children.push(...nodes); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  dispatch(type, extra = {}) {
    const event = { type, target: this, preventDefault() {}, ...extra };
    return Promise.all((this.listeners[type] || []).map((fn) => fn(event)));
  }
  click() { return this.dispatch('click'); }
  get descendants() { return this.children.flatMap((c) => [c, ...c.descendants]); }
  querySelectorAll(sel) {
    if (/^[a-z]+$/.test(sel)) return this.descendants.filter((e) => e.tagName === sel.toUpperCase());
    throw new Error(`fake-dom: unsupported selector ${sel}`);
  }
}

export function fakeDocument(html) {
  const all = [];
  for (const [, tag, rest] of html.matchAll(/<([a-z][a-z0-9]*)\b([^>]*)>/gi)) {
    const attrs = {};
    for (const [, k, v] of rest.matchAll(/([a-z][a-z0-9-]*)(?:="([^"]*)")?/gi)) attrs[k.toLowerCase()] = v ?? '';
    all.push(new FakeElement(tag, attrs));
  }
  return {
    all,
    documentElement: { lang: 'en' },
    getElementById: (id) => all.find((e) => e.id === id) || null,
    createElement: (tag) => new FakeElement(tag),
    querySelectorAll(sel) {
      if (sel === '[data-setting]') return all.filter((e) => 'data-setting' in e.attrs);
      if (sel === '.seg button') return all.filter((e) => e.tagName === 'BUTTON' && 'data-list' in e.attrs);
      const attr = /^\[([a-z0-9-]+)\]$/.exec(sel);
      if (attr) return all.filter((e) => attr[1] in e.attrs);
      throw new Error(`fake-dom: unsupported selector ${sel}`);
    },
  };
}

// chrome.i18n over a real messages.json, with Chrome's $NAME$ placeholders.
export function fakeI18n(lang = 'en') {
  const messages = JSON.parse(readFileSync(new URL(`../_locales/${lang}/messages.json`, import.meta.url), 'utf8'));
  return {
    getUILanguage: () => lang.replace('_', '-'),
    getMessage(key, subs = []) {
      const entry = messages[key];
      if (!entry) return '';
      return entry.message.replace(/\$([A-Za-z0-9_]+)\$/g, (_, name) => {
        const content = entry.placeholders[name.toLowerCase()].content;
        return content.replace(/\$(\d)/g, (__, i) => [].concat(subs)[i - 1] ?? '');
      });
    },
  };
}

// chrome.* as the popup and options page use it, backed by a plain object.
export function fakeChrome({ store, cookies = [], tab = null, replies = {}, lang = 'en' }) {
  const changed = [];
  const created = [];
  const pick = (keys) => {
    const ks = keys == null ? Object.keys(store) : [].concat(keys);
    return Object.fromEntries(ks.filter((k) => k in store).map((k) => [k, structuredClone(store[k])]));
  };
  return {
    storage: {
      local: {
        get: async (keys) => pick(keys),
        set: async (o) => {
          Object.assign(store, structuredClone(o));
          for (const fn of changed) fn(Object.fromEntries(Object.keys(o).map((k) => [k, {}])), 'local');
        },
      },
      onChanged: { addListener: (fn) => changed.push(fn) },
    },
    cookies: { getAll: async () => structuredClone(cookies) },
    tabs: { query: async () => (tab ? [tab] : []), create: (o) => { created.push(o); } },
    runtime: { id: 'crumbclear-test-id', sendMessage: async (msg) => replies[msg.type] ?? null, openOptionsPage: () => {} },
    i18n: fakeI18n(lang),
    created,
  };
}

// Let pending promise chains and storage.onChanged re-renders finish.
export async function settle() {
  for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
}
