// Fixlytools - Word Counter
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

  function analyzeText() {
    const text = textInput.value;

    // Characters
    const charWithSpaces = text.length;
    const charNoSpaces = text.replace(/\s+/g, '').length;

    // Words
    const words = text.trim().match(/\b\S+\b/g) || [];
    const wordCount = words.length;

    // Sentences
    const sentences = text.trim().split(/[.!?]+/).filter(s => s.trim().length > 0);
    const sentenceCount = sentences.length;

    // Paragraphs
    const paragraphs = text.split(/\n+/).filter(p => p.trim().length > 0);
    const paragraphCount = paragraphs.length;

    // Reading & Speaking times
    const readMinutes = Math.ceil(wordCount / 200);
    const speakMinutes = Math.ceil(wordCount / 130);

    // Update UI
    wordCountElem.textContent = wordCount.toLocaleString();
    charWithSpaceElem.textContent = charWithSpaces.toLocaleString();
    charNoSpaceElem.textContent = charNoSpaces.toLocaleString();
    sentenceCountElem.textContent = sentenceCount.toLocaleString();
    paragraphCountElem.textContent = paragraphCount.toLocaleString();
    readingTimeElem.textContent = wordCount > 0 ? `${readMinutes} min read` : '0 min';
    speakingTimeElem.textContent = wordCount > 0 ? `${speakMinutes} min speak` : '0 min';

    // Top Keywords Density
    updateKeywordDensity(words);
  }

  function updateKeywordDensity(words) {
    if (!densityContainer) return;
    if (words.length === 0) {
      densityContainer.innerHTML = '<span class="text-xs text-slate-400">Type or paste text to see keyword density.</span>';
      return;
    }

    const stopWords = new Set(['the', 'and', 'a', 'to', 'of', 'in', 'is', 'it', 'you', 'that', 'he', 'was', 'for', 'on', 'are', 'as', 'with', 'his', 'they', 'at', 'be', 'this', 'have', 'from', 'or', 'one', 'had', 'by', 'word', 'but', 'not', 'what', 'all', 'were', 'we', 'when', 'your', 'can', 'said', 'there', 'use', 'an', 'each', 'which', 'she', 'do', 'how', 'their', 'if']);
    const freq = {};

    words.forEach(w => {
      const clean = w.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (clean.length > 2 && !stopWords.has(clean)) {
        freq[clean] = (freq[clean] || 0) + 1;
      }
    });

    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5);

    if (sorted.length === 0) {
      densityContainer.innerHTML = '<span class="text-xs text-slate-400">No recurring keywords found.</span>';
      return;
    }

    densityContainer.innerHTML = sorted.map(([word, count]) => {
      const pct = ((count / words.length) * 100).toFixed(1);
      return `
        <div class="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-700">
          <span class="font-medium text-slate-700 dark:text-slate-300">${word}</span>
          <span class="text-slate-400">${count} (${pct}%)</span>
        </div>
      `;
    }).join('');
  }

  textInput.addEventListener('input', analyzeText);

  copyBtn.addEventListener('click', () => {
    if (!textInput.value) return;
    navigator.clipboard.writeText(textInput.value).then(() => {
      showToast('Text copied to clipboard!', 'success');
    });
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
});
