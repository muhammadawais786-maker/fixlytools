// Fixlytools - Word Counter (works with any language, including Urdu, Hindi and Arabic scripts)

const WC_STOP_WORDS = new Set(['the', 'and', 'a', 'to', 'of', 'in', 'is', 'it', 'you', 'that', 'he', 'was', 'for', 'on', 'are', 'as', 'with', 'his', 'they', 'at', 'be', 'this', 'have', 'from', 'or', 'one', 'had', 'by', 'word', 'but', 'not', 'what', 'all', 'were', 'we', 'when', 'your', 'can', 'said', 'there', 'use', 'an', 'each', 'which', 'she', 'do', 'how', 'their', 'if']);

// A "word" is any whitespace-separated token that contains at least one letter or digit (any script)
function wcGetWords(text) {
  return text.split(/\s+/).filter(token => /[\p{L}\p{N}]/u.test(token));
}

// Sentences end with . ! ? … or the Urdu/Arabic full stop and question mark, followed by space or end of text
function wcCountSentences(text) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/[.!?…۔؟]+(?:\s+|$)/).filter(s => s.trim().length > 0).length;
}

function wcCountParagraphs(text) {
  return text.split(/\n+/).filter(p => p.trim().length > 0).length;
}

function wcTopKeywords(words, limit = 5) {
  const freq = new Map();
  words.forEach(w => {
    const clean = w.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    const isLatin = /^[\x00-\x7f]+$/.test(clean);
    const longEnough = isLatin ? clean.length > 2 : clean.length > 1;
    if (clean && longEnough && !WC_STOP_WORDS.has(clean)) {
      freq.set(clean, (freq.get(clean) || 0) + 1);
    }
  });
  return Array.from(freq.entries())
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function wcAnalyze(text) {
  const words = wcGetWords(text);
  return {
    words,
    wordCount: words.length,
    charWithSpaces: text.length,
    charNoSpaces: text.replace(/\s+/g, '').length,
    sentenceCount: wcCountSentences(text),
    paragraphCount: wcCountParagraphs(text),
    readMinutes: Math.ceil(words.length / 200),
    speakMinutes: Math.ceil(words.length / 130)
  };
}

if (typeof module !== 'undefined') {
  module.exports = { wcGetWords, wcCountSentences, wcCountParagraphs, wcTopKeywords, wcAnalyze };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const textInput = document.getElementById('text-input');
    const wordCountElem = document.getElementById('word-count');
    const charWithSpaceElem = document.getElementById('char-count');
    const charNoSpaceElem = document.getElementById('char-no-space');
    const sentenceCountElem = document.getElementById('sentence-count');
    const paragraphCountElem = document.getElementById('paragraph-count');
    const readingTimeElem = document.getElementById('reading-time');
    const speakingTimeElem = document.getElementById('speaking-time');
    const densityContainer = document.getElementById('keyword-density');

    const copyBtn = document.getElementById('copy-btn');
    const clearBtn = document.getElementById('clear-btn');
    const uppercaseBtn = document.getElementById('uppercase-btn');
    const lowercaseBtn = document.getElementById('lowercase-btn');

    function updateKeywordDensity(words) {
      if (!densityContainer) return;
      if (words.length === 0) {
        densityContainer.innerHTML = '<span class="text-xs text-slate-400">Type or paste text to see keyword density.</span>';
        return;
      }
      const top = wcTopKeywords(words);
      if (top.length === 0) {
        densityContainer.innerHTML = '<span class="text-xs text-slate-400">No recurring keywords found.</span>';
        return;
      }
      densityContainer.innerHTML = top.map(([word, count]) => {
        const pct = ((count / words.length) * 100).toFixed(1);
        return `
          <div class="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-700">
            <span class="font-medium text-slate-700 dark:text-slate-300">${escapeHtml(word)}</span>
            <span class="text-slate-400">${count} (${pct}%)</span>
          </div>
        `;
      }).join('');
    }

    function analyzeText() {
      const r = wcAnalyze(textInput.value);
      wordCountElem.textContent = r.wordCount.toLocaleString();
      charWithSpaceElem.textContent = r.charWithSpaces.toLocaleString();
      charNoSpaceElem.textContent = r.charNoSpaces.toLocaleString();
      sentenceCountElem.textContent = r.sentenceCount.toLocaleString();
      paragraphCountElem.textContent = r.paragraphCount.toLocaleString();
      readingTimeElem.textContent = r.wordCount > 0 ? `${r.readMinutes} min read` : '0 min';
      speakingTimeElem.textContent = r.wordCount > 0 ? `${r.speakMinutes} min speak` : '0 min';
      updateKeywordDensity(r.words);
    }

    textInput.addEventListener('input', analyzeText);

    copyBtn.addEventListener('click', () => {
      if (!textInput.value) return;
      copyText(textInput.value)
        .then(() => showToast('Text copied to clipboard!', 'success'))
        .catch(() => showToast('Could not copy. Please select the text and copy it manually.', 'error'));
    });

    clearBtn.addEventListener('click', () => {
      textInput.value = '';
      analyzeText();
    });

    uppercaseBtn.addEventListener('click', () => {
      textInput.value = textInput.value.toUpperCase();
      analyzeText();
    });

    lowercaseBtn.addEventListener('click', () => {
      textInput.value = textInput.value.toLowerCase();
      analyzeText();
    });

    analyzeText();
  });
}
