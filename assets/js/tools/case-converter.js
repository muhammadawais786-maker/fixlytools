// Fixlytools - Case Converter. Pure functions first so they can be tested.

const CC_SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of', 'on', 'or', 'per', 'the', 'to', 'up', 'via', 'vs']);

function ccUpper(s) { return s.toUpperCase(); }
function ccLower(s) { return s.toLowerCase(); }

// Capitalize every word
function ccCapitalize(s) {
  return s.toLowerCase().replace(/(^|[\s"'(\[{\-\/])(\p{L})/gu, (m, pre, ch) => pre + ch.toUpperCase());
}

// Title case: small words (a, the, of ...) stay lower case unless first or last
function ccTitle(s) {
  const lower = s.toLowerCase();
  const tokens = lower.split(/(\s+)/);
  const wordIdx = [];
  tokens.forEach((t, i) => { if (/\p{L}/u.test(t)) wordIdx.push(i); });
  const first = wordIdx[0], last = wordIdx[wordIdx.length - 1];
  return tokens.map((t, i) => {
    if (!/\p{L}/u.test(t)) return t;
    const bare = t.replace(/[^\p{L}\p{N}']/gu, '');
    if (i !== first && i !== last && CC_SMALL.has(bare)) return t;
    return t.replace(/(\p{L})/u, (c) => c.toUpperCase());
  }).join('');
}

// Sentence case: first letter of each sentence in capitals, the rest lower, standalone "i" becomes "I"
function ccSentence(s) {
  let out = s.toLowerCase();
  out = out.replace(/(^\s*|[.!?؟۔…]\s+|\n\s*)(\p{L})/gu, (m, pre, ch) => pre + ch.toUpperCase());
  out = out.replace(/\bi\b(?=['\s.,!?;:]|$)/g, 'I');
  return out;
}

function ccWords(s) {
  return s
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1 $2')
    .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, '$1 $2')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

function ccCamel(s) {
  return ccWords(s).map((w, i) => {
    const l = w.toLowerCase();
    return i === 0 ? l : l.charAt(0).toUpperCase() + l.slice(1);
  }).join('');
}
function ccPascal(s) { return ccWords(s).map((w) => { const l = w.toLowerCase(); return l.charAt(0).toUpperCase() + l.slice(1); }).join(''); }
function ccSnake(s) { return ccWords(s).map((w) => w.toLowerCase()).join('_'); }
function ccKebab(s) { return ccWords(s).map((w) => w.toLowerCase()).join('-'); }
function ccConstant(s) { return ccWords(s).map((w) => w.toUpperCase()).join('_'); }

function ccAlternating(s) {
  let i = 0;
  return Array.from(s).map((ch) => {
    if (!/\p{L}/u.test(ch)) return ch;
    const out = i % 2 === 0 ? ch.toLowerCase() : ch.toUpperCase();
    i++;
    return out;
  }).join('');
}

function ccInverse(s) {
  return Array.from(s).map((ch) => {
    const u = ch.toUpperCase(), l = ch.toLowerCase();
    if (u === l) return ch;
    return ch === u ? l : u;
  }).join('');
}

// tidy helpers
function ccTrimSpaces(s) { return s.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim(); }
function ccRemoveBreaks(s) { return s.replace(/\s*\n+\s*/g, ' ').replace(/ {2,}/g, ' ').trim(); }

if (typeof module !== 'undefined') {
  module.exports = { ccUpper, ccLower, ccCapitalize, ccTitle, ccSentence, ccCamel, ccPascal, ccSnake, ccKebab, ccConstant, ccAlternating, ccInverse, ccTrimSpaces, ccRemoveBreaks };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    const ta = $('cc-text');
    const stats = $('cc-stats');
    let history = [];

    const actions = {
      upper: ccUpper, lower: ccLower, sentence: ccSentence, capitalize: ccCapitalize, title: ccTitle,
      camel: ccCamel, pascal: ccPascal, snake: ccSnake, kebab: ccKebab, constant: ccConstant,
      alternating: ccAlternating, inverse: ccInverse, trim: ccTrimSpaces, breaks: ccRemoveBreaks
    };

    function updateStats() {
      const t = ta.value;
      const words = t.split(/\s+/).filter((x) => /[\p{L}\p{N}]/u.test(x)).length;
      stats.textContent = `${t.length.toLocaleString('en-US')} characters, ${words.toLocaleString('en-US')} words`;
      $('cc-undo').disabled = history.length === 0;
    }

    document.querySelectorAll('[data-case]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const fn = actions[btn.dataset.case];
        if (!fn) return;
        if (!ta.value) { showToast('Type or paste some text first.', 'warning'); return; }
        history.push(ta.value);
        if (history.length > 20) history.shift();
        ta.value = fn(ta.value);
        updateStats();
      });
    });
    $('cc-undo').addEventListener('click', () => { if (history.length) { ta.value = history.pop(); updateStats(); } });
    $('cc-copy').addEventListener('click', () => ntCopyWithToast(ta.value, 'Text copied.'));
    $('cc-download').addEventListener('click', () => {
      if (!ta.value) { showToast('There is no text to download.', 'warning'); return; }
      ntDownload(ta.value, 'fixlytools-text.txt', 'text/plain');
    });
    $('cc-clear').addEventListener('click', () => { if (ta.value) history.push(ta.value); ta.value = ''; updateStats(); });
    ta.addEventListener('input', updateStats);
    updateStats();
  });
}
