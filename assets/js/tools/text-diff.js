// Fixlytools - Text Diff Checker
document.addEventListener('DOMContentLoaded', () => {
  const originalText = document.getElementById('original-text');
  const modifiedText = document.getElementById('modified-text');
  const compareBtn = document.getElementById('compare-btn');
  const sampleBtn = document.getElementById('sample-btn');
  const clearBtn = document.getElementById('clear-btn');
  const diffOutput = document.getElementById('diff-output');
  const diffStats = document.getElementById('diff-stats');

  function computeDiff(original, modified) {
    const origLines = original.split('\n');
    const modLines = modified.split('\n');

    let additions = 0;
    let deletions = 0;
    let unchanged = 0;

    let outputHtml = '';

    const maxLen = Math.max(origLines.length, modLines.length);

    for (let i = 0; i < maxLen; i++) {
      const o = origLines[i];
      const m = modLines[i];

      if (o === undefined) {
        // Line added
        additions++;
        outputHtml += `
          <div class="flex items-start bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 px-3 py-1 font-mono text-xs border-l-4 border-emerald-500">
            <span class="w-8 shrink-0 text-slate-400 select-none">${i + 1}</span>
            <span class="w-6 shrink-0 text-emerald-600 font-bold select-none">+</span>
            <span class="break-all">${escapeHtml(m)}</span>
          </div>
        `;
      } else if (m === undefined) {
        // Line deleted
        deletions++;
        outputHtml += `
          <div class="flex items-start bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 px-3 py-1 font-mono text-xs border-l-4 border-rose-500">
            <span class="w-8 shrink-0 text-slate-400 select-none">${i + 1}</span>
            <span class="w-6 shrink-0 text-rose-600 font-bold select-none">-</span>
            <span class="break-all">${escapeHtml(o)}</span>
          </div>
        `;
      } else if (o !== m) {
        // Line modified
        deletions++;
        additions++;
        outputHtml += `
          <div class="flex items-start bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 px-3 py-1 font-mono text-xs border-l-4 border-rose-500">
            <span class="w-8 shrink-0 text-slate-400 select-none">${i + 1}</span>
            <span class="w-6 shrink-0 text-rose-600 font-bold select-none">-</span>
            <span class="break-all">${escapeHtml(o)}</span>
          </div>
          <div class="flex items-start bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 px-3 py-1 font-mono text-xs border-l-4 border-emerald-500">
            <span class="w-8 shrink-0 text-slate-400 select-none">${i + 1}</span>
            <span class="w-6 shrink-0 text-emerald-600 font-bold select-none">+</span>
            <span class="break-all">${escapeHtml(m)}</span>
          </div>
        `;
      } else {
        // Unchanged
        unchanged++;
        outputHtml += `
          <div class="flex items-start text-slate-600 dark:text-slate-400 px-3 py-1 font-mono text-xs border-l-4 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800">
            <span class="w-8 shrink-0 text-slate-400 select-none">${i + 1}</span>
            <span class="w-6 shrink-0 text-slate-300 select-none">&nbsp;</span>
            <span class="break-all">${escapeHtml(o)}</span>
          </div>
        `;
      }
    }

    diffOutput.innerHTML = outputHtml;
    diffStats.innerHTML = `
      <span class="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">+${additions} Added</span>
      <span class="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-xs font-semibold">-${deletions} Removed</span>
      <span class="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold">${unchanged} Unchanged</span>
    `;
    diffStats.classList.remove('hidden');
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  compareBtn.addEventListener('click', () => {
    computeDiff(originalText.value, modifiedText.value);
  });

  sampleBtn.addEventListener('click', () => {
    originalText.value = "Fixlytools is an online tools platform.\nIt features 10 tools.\nServer uploads are slow.\nFree for everyone.";
    modifiedText.value = "Fixlytools is an online tools platform.\nIt features 15 free client-side tools.\nZero server uploads required.\nFree for everyone with 100% privacy.";
    computeDiff(originalText.value, modifiedText.value);
  });

  clearBtn.addEventListener('click', () => {
    originalText.value = '';
    modifiedText.value = '';
    diffOutput.innerHTML = '<div class="p-8 text-center text-slate-400 text-xs">Enter text in both boxes above and click "Compare Texts" to see difference.</div>';
    diffStats.classList.add('hidden');
  });
});
