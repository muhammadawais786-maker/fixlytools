// Fixlytools - Compare PDF (compares the text of two PDF files in the browser, text is read with pdf.js)

const CMPDF_MAX_CELLS = 16000000;   // size limit of the exact comparison table (rows x rows)
const CMPDF_MAX_ROWS = 4000;        // how many result rows are drawn on the page
const CMPDF_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ---------- reading text ----------

// pdf.js text item -> plain object (null for items without text)
function cmpdfNormalizeItem(raw) {
  if (!raw || typeof raw.str !== 'string' || raw.str.length === 0 || !Array.isArray(raw.transform)) return null;
  const height = Math.abs(raw.height) || Math.abs(raw.transform[3]) || 10;
  return { str: raw.str, x: raw.transform[4], y: raw.transform[5], width: Math.abs(raw.width) || 0, height };
}

// Groups text items into lines (top to bottom, left to right). Returns an array of strings.
function cmpdfItemsToLines(items) {
  const list = (items || []).filter(it => it && typeof it.str === 'string' && it.str.length > 0);
  list.sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  let current = null;
  for (const it of list) {
    const tol = Math.max(1.5, 0.45 * (it.height || 10));
    if (current && Math.abs(it.y - current.y) <= tol) {
      current.items.push(it);
    } else {
      current = { y: it.y, items: [it] };
      lines.push(current);
    }
  }
  const out = [];
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
    let text = '';
    let prevEnd = null;
    for (const it of line.items) {
      if (prevEnd !== null) {
        const gap = it.x - prevEnd;
        if (gap > (it.height || 10) * 0.15 && !/\s$/.test(text) && !/^\s/.test(it.str)) text += ' ';
      }
      text += it.str;
      prevEnd = it.x + (it.width || 0);
    }
    text = text.replace(/\s+/g, ' ').trim();
    if (text) out.push(text);
  }
  return out;
}

// ---------- preparing the two texts ----------

// The comparison key of a piece of text. The shown text is never changed, only the key.
function cmpdfNormalize(text, opts) {
  let t = String(text).normalize('NFKC').replace(/\u00ad/g, '');   // NFKC turns ligatures such as "ﬁ" into "fi"
  t = t.replace(/\s+/g, ' ').trim();
  if (opts && opts.ignoreWhitespace) t = t.replace(/\s/g, '');
  if (opts && opts.ignoreCase) t = t.toLowerCase();
  return t;
}

// pages: [{ page: 1, lines: ['text', ...] }]  ->  [{ text, key, page }]
function cmpdfBuildLines(pages, opts) {
  const out = [];
  for (const p of pages) {
    for (const line of p.lines) {
      const key = cmpdfNormalize(line, opts);
      if (key) out.push({ text: line, key, page: p.page });
    }
  }
  return out;
}

function cmpdfBuildWords(pages, opts) {
  const out = [];
  for (const p of pages) {
    for (const line of p.lines) {
      for (const word of line.split(/\s+/)) {
        if (!word) continue;
        const key = cmpdfNormalize(word, opts);
        if (key) out.push({ text: word, key, page: p.page });
      }
    }
  }
  return out;
}

// ---------- the diff (longest common subsequence on the keys) ----------

// a, b: arrays of { key, ... }. Returns { ops: [{ type: 'eq'|'del'|'add', a, b }], truncated }.
// "truncated" is true when the middle part was too large for an exact comparison and is shown as replaced.
function cmpdfDiff(a, b, maxCells) {
  const limit = maxCells || CMPDF_MAX_CELLS;
  let start = 0;
  while (start < a.length && start < b.length && a[start].key === b[start].key) start++;
  let endA = a.length - 1, endB = b.length - 1;
  while (endA >= start && endB >= start && a[endA].key === b[endB].key) { endA--; endB--; }

  const ops = [];
  for (let i = 0; i < start; i++) ops.push({ type: 'eq', a: a[i], b: b[i] });

  const mid1 = a.slice(start, endA + 1);
  const mid2 = b.slice(start, endB + 1);
  const n = mid1.length, m = mid2.length;
  let truncated = false;

  if (n * m > limit) {
    truncated = true;
    mid1.forEach(x => ops.push({ type: 'del', a: x, b: null }));
    mid2.forEach(x => ops.push({ type: 'add', a: null, b: x }));
  } else if (n === 0 || m === 0) {
    mid1.forEach(x => ops.push({ type: 'del', a: x, b: null }));
    mid2.forEach(x => ops.push({ type: 'add', a: null, b: x }));
  } else {
    const w = m + 1;
    const table = Math.min(n, m) < 65535 ? new Uint16Array((n + 1) * w) : new Uint32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        table[i * w + j] = mid1[i].key === mid2[j].key
          ? table[(i + 1) * w + j + 1] + 1
          : Math.max(table[(i + 1) * w + j], table[i * w + j + 1]);
      }
    }
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (mid1[i].key === mid2[j].key) { ops.push({ type: 'eq', a: mid1[i], b: mid2[j] }); i++; j++; }
      else if (table[(i + 1) * w + j] >= table[i * w + j + 1]) { ops.push({ type: 'del', a: mid1[i], b: null }); i++; }
      else { ops.push({ type: 'add', a: null, b: mid2[j] }); j++; }
    }
    while (i < n) { ops.push({ type: 'del', a: mid1[i], b: null }); i++; }
    while (j < m) { ops.push({ type: 'add', a: null, b: mid2[j] }); j++; }
  }

  for (let k = 1; endA + k < a.length; k++) ops.push({ type: 'eq', a: a[endA + k], b: b[endB + k] });
  return { ops, truncated };
}

// Counts, match ratio and the pages that contain differences
function cmpdfSummary(ops) {
  let added = 0, removed = 0, same = 0;
  const pagesA = new Set(), pagesB = new Set();
  for (const op of ops) {
    if (op.type === 'add') { added++; pagesB.add(op.b.page); }
    else if (op.type === 'del') { removed++; pagesA.add(op.a.page); }
    else same++;
  }
  const total = same * 2 + added + removed;
  const match = total === 0 ? 100 : Math.round((same * 2 / total) * 1000) / 10;
  const sortNum = (s) => Array.from(s).sort((x, y) => x - y);
  return { added, removed, same, match, pagesA: sortNum(pagesA), pagesB: sortNum(pagesB), identical: added === 0 && removed === 0 };
}

// Keeps only the changed items plus "context" unchanged items around them; the rest becomes { type: 'skip', count }
function cmpdfCollapse(ops, context) {
  const keep = new Array(ops.length).fill(false);
  ops.forEach((op, i) => {
    if (op.type === 'eq') return;
    for (let k = Math.max(0, i - context); k <= Math.min(ops.length - 1, i + context); k++) keep[k] = true;
  });
  const out = [];
  let skipped = 0;
  ops.forEach((op, i) => {
    if (keep[i]) {
      if (skipped) { out.push({ type: 'skip', count: skipped }); skipped = 0; }
      out.push(op);
    } else skipped++;
  });
  if (skipped) out.push({ type: 'skip', count: skipped });
  return out;
}

// Turns ops into display rows. With merge = true (word mode) neighbours of the same type and page become one row.
function cmpdfRows(ops, merge) {
  const rows = [];
  for (const op of ops) {
    if (op.type === 'skip') { rows.push({ type: 'skip', count: op.count }); continue; }
    const pa = op.a ? op.a.page : null;
    const pb = op.b ? op.b.page : null;
    const text = op.type === 'add' ? op.b.text : op.a.text;
    const last = rows[rows.length - 1];
    if (merge && last && last.type === op.type && last.pa === pa && last.pb === pb) last.text += ' ' + text;
    else rows.push({ type: op.type, pa, pb, text });
  }
  return rows;
}

function cmpdfPageList(pages) {
  return pages.length ? pages.join(', ') : 'none';
}

if (typeof module !== 'undefined') {
  module.exports = {
    cmpdfNormalizeItem, cmpdfItemsToLines, cmpdfNormalize, cmpdfBuildLines, cmpdfBuildWords,
    cmpdfDiff, cmpdfSummary, cmpdfCollapse, cmpdfRows, cmpdfPageList
  };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const slots = {
      a: { drop: document.getElementById('dropzone-a'), input: document.getElementById('file-input-a'), info: document.getElementById('info-a'), file: null, data: null },
      b: { drop: document.getElementById('dropzone-b'), input: document.getElementById('file-input-b'), info: document.getElementById('info-b'), file: null, data: null }
    };
    const modeSelect = document.getElementById('compare-mode');
    const ignoreSpaceBox = document.getElementById('opt-ignore-space');
    const ignoreCaseBox = document.getElementById('opt-ignore-case');
    const onlyDiffBox = document.getElementById('opt-only-diff');
    const compareBtn = document.getElementById('compare-btn');
    const swapBtn = document.getElementById('swap-btn');
    const resetBtn = document.getElementById('reset-btn');
    const progress = document.getElementById('progress-text');
    const resultBox = document.getElementById('result');
    const statsBox = document.getElementById('result-stats');
    const notesBox = document.getElementById('result-notes');
    const diffOutput = document.getElementById('diff-output');

    let busy = false;
    let shown = false;   // true once a result is on the page, so changing an option can refresh it

    function ensurePdfJs() {
      if (typeof pdfjsLib === 'undefined') return false;
      if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) pdfjsLib.GlobalWorkerOptions.workerSrc = CMPDF_WORKER_URL;
      return true;
    }

    function tick() { return new Promise(r => setTimeout(r, 0)); }

    async function extractText(file, label) {
      const data = new Uint8Array(await file.arrayBuffer());
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      const pages = [];
      let chars = 0;
      try {
        for (let p = 1; p <= pdf.numPages; p++) {
          progress.textContent = `Reading ${label}: page ${p} of ${pdf.numPages}...`;
          const page = await pdf.getPage(p);
          const content = await page.getTextContent();
          const lines = cmpdfItemsToLines(content.items.map(cmpdfNormalizeItem).filter(Boolean));
          chars += lines.join('').length;
          pages.push({ page: p, lines });
          page.cleanup();
          if (p % 3 === 0) await tick();
        }
      } finally {
        try { pdf.destroy(); } catch (e) { /* ignore */ }
      }
      return { pages, chars, numPages: pages.length };
    }

    function updateButtons() {
      compareBtn.disabled = busy || !(slots.a.file && slots.b.file);
      swapBtn.disabled = busy || !(slots.a.file || slots.b.file);
      resetBtn.disabled = busy;
    }

    function showInfo(key) {
      const s = slots[key];
      if (s.file) s.info.textContent = `${key.toUpperCase()}: ${s.file.name} (${formatBytes(s.file.size)})`;
      else s.info.textContent = 'No file chosen';
    }

    function setFile(key, file) {
      slots[key].file = file;
      slots[key].data = null;
      showInfo(key);
      updateButtons();
    }

    function clearResult() {
      shown = false;
      resultBox.classList.add('hidden');
      diffOutput.innerHTML = '';
    }

    function pickPdfs(files) {
      const pdfs = files.filter(isPdfFile);
      if (pdfs.length < files.length) showToast('Only PDF files can be compared. Other files were ignored.', 'warning');
      return pdfs;
    }

    setupDropzone(slots.a.drop, slots.a.input, (files) => {
      const pdfs = pickPdfs(files);
      if (!pdfs.length) { if (!files.length) return; showToast('Please choose a PDF file.', 'warning'); return; }
      setFile('a', pdfs[0]);
      if (pdfs[1] && !slots.b.file) setFile('b', pdfs[1]);
      clearResult();
    });
    setupDropzone(slots.b.drop, slots.b.input, (files) => {
      const pdfs = pickPdfs(files);
      if (!pdfs.length) { showToast('Please choose a PDF file.', 'warning'); return; }
      setFile('b', pdfs[0]);
      clearResult();
    });

    swapBtn.addEventListener('click', () => {
      const fa = slots.a.file, da = slots.a.data;
      slots.a.file = slots.b.file; slots.a.data = slots.b.data;
      slots.b.file = fa; slots.b.data = da;
      showInfo('a'); showInfo('b');
      updateButtons();
      if (shown && slots.a.data && slots.b.data) runDiff(); else clearResult();
    });

    resetBtn.addEventListener('click', () => {
      setFile('a', null);
      setFile('b', null);
      progress.textContent = '';
      clearResult();
    });

    function currentOptions() {
      return { ignoreWhitespace: ignoreSpaceBox.checked, ignoreCase: ignoreCaseBox.checked };
    }

    function chip(cls, text) {
      return `<span class="cmp-chip ${cls}">${escapeHtml(text)}</span>`;
    }

    function runDiff() {
      const opts = currentOptions();
      let wordMode = modeSelect.value === 'word';
      const notes = [];
      let a, b;
      if (wordMode) {
        a = cmpdfBuildWords(slots.a.data.pages, opts);
        b = cmpdfBuildWords(slots.b.data.pages, opts);
        if (a.length * b.length > CMPDF_MAX_CELLS * 4) {
          wordMode = false;
          notes.push('These documents have too many words for a word-by-word comparison on this device, so the line-by-line comparison was used instead.');
        }
      }
      if (!wordMode) {
        a = cmpdfBuildLines(slots.a.data.pages, opts);
        b = cmpdfBuildLines(slots.b.data.pages, opts);
      }
      const unit = wordMode ? 'words' : 'lines';
      const result = cmpdfDiff(a, b, wordMode ? CMPDF_MAX_CELLS * 4 : CMPDF_MAX_CELLS);
      const sum = cmpdfSummary(result.ops);

      if (result.truncated) notes.push('The changed middle section is very large, so it is shown as fully replaced instead of a detailed comparison.');
      notes.push('Only the text is compared. Layout, fonts, colours and images are not checked.');

      statsBox.innerHTML = [
        chip('cmp-chip-add', `+${sum.added} ${unit} added`),
        chip('cmp-chip-del', `-${sum.removed} ${unit} removed`),
        chip('cmp-chip-eq', `${sum.same} ${unit} unchanged`),
        chip('cmp-chip-eq', `${sum.match}% text match`)
      ].join('');

      let html = '';
      if (sum.identical) {
        html = '<p class="cmp-ok">No text differences were found with the current options.</p>';
      } else {
        notes.unshift(`Differences are on pages: first PDF - ${cmpdfPageList(sum.pagesA)}; second PDF - ${cmpdfPageList(sum.pagesB)}.`);
        const ops = onlyDiffBox.checked ? cmpdfCollapse(result.ops, wordMode ? 8 : 1) : result.ops;
        const rows = cmpdfRows(ops, wordMode);
        const shownRows = rows.slice(0, CMPDF_MAX_ROWS);
        html += '<div class="cmp-head" aria-hidden="true"><span>A</span><span>B</span><span></span><span>Text (A = first PDF, B = second PDF, page numbers)</span></div>';
        html += shownRows.map(r => {
          if (r.type === 'skip') return `<div class="cmp-row cmp-skip"><span></span><span></span><span></span><span class="cmp-text">... ${r.count} unchanged ${unit} ...</span></div>`;
          const sign = r.type === 'add' ? '+' : r.type === 'del' ? '-' : '';
          const word = r.type === 'add' ? 'Added: ' : r.type === 'del' ? 'Removed: ' : '';
          return `<div class="cmp-row cmp-${r.type}"><span class="cmp-pg">${r.pa ?? ''}</span><span class="cmp-pg">${r.pb ?? ''}</span><span class="cmp-sign" aria-hidden="true">${sign}</span><span class="cmp-text"><span class="cmp-sr">${word}</span>${escapeHtml(r.text)}</span></div>`;
        }).join('');
        if (rows.length > CMPDF_MAX_ROWS) html += `<p class="cmp-note">Only the first ${CMPDF_MAX_ROWS} rows are shown (${rows.length} in total).</p>`;
      }
      diffOutput.innerHTML = html;
      notesBox.innerHTML = notes.map(n => `<li>${escapeHtml(n)}</li>`).join('');
      resultBox.classList.remove('hidden');
      shown = true;
    }

    async function ensureExtracted(key, label) {
      const s = slots[key];
      if (s.data) return true;
      try {
        s.data = await extractText(s.file, label);
        return true;
      } catch (err) {
        console.error(err);
        if (err && err.name === 'PasswordException') showToast(`${label} is password-protected. Remove the password first and try again.`, 'error');
        else showToast(`Could not read ${label}. The file may be damaged or is not a valid PDF.`, 'error');
        return false;
      }
    }

    compareBtn.addEventListener('click', async () => {
      if (busy || !slots.a.file || !slots.b.file) return;
      if (!ensurePdfJs()) {
        showToast('The PDF reader could not be loaded. Please check your internet connection and reload.', 'error');
        return;
      }
      busy = true;
      updateButtons();
      compareBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Comparing...';
      try {
        if (!(await ensureExtracted('a', 'the first PDF'))) return;
        if (!(await ensureExtracted('b', 'the second PDF'))) return;
        const emptyA = slots.a.data.chars < 20, emptyB = slots.b.data.chars < 20;
        if (emptyA && emptyB) {
          clearResult();
          showToast('Neither PDF has selectable text. They may be scans, so there is nothing to compare.', 'warning');
          return;
        }
        if (emptyA || emptyB) showToast(`The ${emptyA ? 'first' : 'second'} PDF has almost no selectable text. It may be a scan, so the result will show large differences.`, 'warning');
        progress.textContent = '';
        runDiff();
      } catch (err) {
        console.error(err);
        showToast('Something went wrong while comparing. Please try again.', 'error');
      } finally {
        busy = false;
        progress.textContent = '';
        compareBtn.innerHTML = '<i class="fa-solid fa-code-compare"></i> Compare PDFs';
        updateButtons();
      }
    });

    [modeSelect, ignoreSpaceBox, ignoreCaseBox, onlyDiffBox].forEach(el => {
      el.addEventListener('change', () => { if (shown && slots.a.data && slots.b.data && !busy) runDiff(); });
    });

    showInfo('a'); showInfo('b');
    updateButtons();
  });
}
