// Fixlytools - Text Diff Checker (line-by-line, longest-common-subsequence based)

function tdSplitLines(text) {
  return text.replace(/\r\n?/g, '\n').split('\n');
}

// Returns a list of {type: 'eq' | 'del' | 'add', text, oldNo, newNo}
function tdDiffLines(oldLines, newLines) {
  // 1. trim common beginning and end so the expensive part works on the changed middle only
  let start = 0;
  while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) start++;
  let endOld = oldLines.length - 1;
  let endNew = newLines.length - 1;
  while (endOld >= start && endNew >= start && oldLines[endOld] === newLines[endNew]) { endOld--; endNew--; }

  const ops = [];
  for (let i = 0; i < start; i++) ops.push({ type: 'eq', text: oldLines[i], oldNo: i + 1, newNo: i + 1 });

  const a = oldLines.slice(start, endOld + 1);
  const b = newLines.slice(start, endNew + 1);
  const n = a.length, m = b.length;

  if (n * m > 25000000) {
    // very large input: fall back to "remove all old, add all new" for the middle block
    a.forEach((t, i) => ops.push({ type: 'del', text: t, oldNo: start + i + 1, newNo: null }));
    b.forEach((t, j) => ops.push({ type: 'add', text: t, oldNo: null, newNo: start + j + 1 }));
  } else {
    // 2. LCS table
    const w = m + 1;
    const table = new Uint32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        table[i * w + j] = a[i] === b[j]
          ? table[(i + 1) * w + j + 1] + 1
          : Math.max(table[(i + 1) * w + j], table[i * w + j + 1]);
      }
    }
    // 3. walk the table
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) {
        ops.push({ type: 'eq', text: a[i], oldNo: start + i + 1, newNo: start + j + 1 });
        i++; j++;
      } else if (table[(i + 1) * w + j] >= table[i * w + j + 1]) {
        ops.push({ type: 'del', text: a[i], oldNo: start + i + 1, newNo: null });
        i++;
      } else {
        ops.push({ type: 'add', text: b[j], oldNo: null, newNo: start + j + 1 });
        j++;
      }
    }
    while (i < n) { ops.push({ type: 'del', text: a[i], oldNo: start + i + 1, newNo: null }); i++; }
    while (j < m) { ops.push({ type: 'add', text: b[j], oldNo: null, newNo: start + j + 1 }); j++; }
  }

  const tailOld = endOld + 1, tailNew = endNew + 1;
  for (let k = 0; tailOld + k < oldLines.length; k++) {
    ops.push({ type: 'eq', text: oldLines[tailOld + k], oldNo: tailOld + k + 1, newNo: tailNew + k + 1 });
  }
  return ops;
}

function tdStats(ops) {
  return {
    additions: ops.filter(o => o.type === 'add').length,
    deletions: ops.filter(o => o.type === 'del').length,
    unchanged: ops.filter(o => o.type === 'eq').length
  };
}

if (typeof module !== 'undefined') {
  module.exports = { tdSplitLines, tdDiffLines, tdStats };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const originalText = document.getElementById('original-text');
    const modifiedText = document.getElementById('modified-text');
    const compareBtn = document.getElementById('compare-btn');
    const sampleBtn = document.getElementById('sample-btn');
    const clearBtn = document.getElementById('clear-btn');
    const diffOutput = document.getElementById('diff-output');
    const diffStats = document.getElementById('diff-stats');

    const ROW = {
      add: ['bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-500', '+', 'text-emerald-600 font-bold'],
      del: ['bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-500', '-', 'text-rose-600 font-bold'],
      eq: ['text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800', '&nbsp;', 'text-slate-300']
    };

    function render(ops) {
      diffOutput.innerHTML = ops.map(op => {
        const [rowCls, sign, signCls] = ROW[op.type];
        return `
          <div class="flex items-start px-3 py-1 font-mono text-xs border-l-4 ${rowCls}">
            <span class="w-8 shrink-0 text-slate-400 select-none">${op.oldNo ?? ''}</span>
            <span class="w-8 shrink-0 text-slate-400 select-none">${op.newNo ?? ''}</span>
            <span class="w-6 shrink-0 select-none ${signCls}">${sign}</span>
            <span class="break-all whitespace-pre-wrap">${escapeHtml(op.text)}</span>
          </div>`;
      }).join('');
    }

    function compare() {
      if (!originalText.value && !modifiedText.value) {
        showToast('Please enter text in both boxes first.', 'warning');
        return;
      }
      const ops = tdDiffLines(tdSplitLines(originalText.value), tdSplitLines(modifiedText.value));
      const st = tdStats(ops);
      render(ops);
      diffStats.innerHTML = `
        <span class="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">+${st.additions} Added</span>
        <span class="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-xs font-semibold">-${st.deletions} Removed</span>
        <span class="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold">${st.unchanged} Unchanged</span>
        ${st.additions === 0 && st.deletions === 0 ? '<span class="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-semibold">Texts are identical</span>' : ''}
      `;
      diffStats.classList.remove('hidden');
    }

    compareBtn.addEventListener('click', compare);

    sampleBtn.addEventListener('click', () => {
      originalText.value = "Fixlytools is an online tools platform.\nIt features 10 tools.\nServer uploads are slow.\nFree for everyone.";
      modifiedText.value = "Welcome to Fixlytools.\nFixlytools is an online tools platform.\nIt features 15 free client-side tools.\nServer uploads are slow.\nFree for everyone with 100% privacy.";
      compare();
    });

    clearBtn.addEventListener('click', () => {
      originalText.value = '';
      modifiedText.value = '';
      diffOutput.innerHTML = '<div class="p-8 text-center text-slate-400 text-xs">Enter text in both boxes above and click "Compare Texts" to see difference.</div>';
      diffStats.classList.add('hidden');
    });
  });
}
