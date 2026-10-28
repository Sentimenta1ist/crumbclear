// Strings come from _locales/<lang>/messages.json; the English text in the
// HTML is only a fallback. Pages mark translatable parts with data-i18n
// (text), data-i18n-placeholder, data-i18n-aria-label and data-i18n-title.

const lang = () => {
  try { return chrome.i18n.getUILanguage(); } catch { return 'en'; }
};

export function t(key, ...subs) {
  let text = '';
  try { text = chrome.i18n.getMessage(key, subs.map(String)); } catch { /* not in an extension page */ }
  return text || key;
}

export function num(n) {
  return Number(n).toLocaleString(lang());
}

// Plural form: messages "key_one", "key_few", "key_many", "key_other";
// languages without a form fall back to "key_other".
export function tn(key, n) {
  let cat = 'other';
  try { cat = new Intl.PluralRules(lang()).select(n); } catch { /* keep other */ }
  for (const k of [`${key}_${cat}`, `${key}_other`]) {
    let text = '';
    try { text = chrome.i18n.getMessage(k, [num(n)]); } catch { /* fall through */ }
    if (text) return text;
  }
  return `${num(n)} ${key}`;
}

export function localize(doc = document) {
  try { doc.documentElement.lang = lang(); } catch { /* fake DOM */ }
  for (const [attr, apply] of [
    ['data-i18n', (el, s) => { el.textContent = s; }],
    ['data-i18n-placeholder', (el, s) => el.setAttribute('placeholder', s)],
    ['data-i18n-aria-label', (el, s) => el.setAttribute('aria-label', s)],
    ['data-i18n-title', (el, s) => el.setAttribute('title', s)],
  ]) {
    for (const el of doc.querySelectorAll(`[${attr}]`)) {
      const text = chrome.i18n.getMessage(el.getAttribute(attr));
      if (text) apply(el, text);
    }
  }
}
