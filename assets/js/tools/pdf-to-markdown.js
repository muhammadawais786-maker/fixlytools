// Fixlytools - PDF to Markdown / Text (reads the text layer with pdf.js and guesses headings, lists and paragraphs)

const PMD_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const PMD_BULLET_RE = /^\s*[\u2022\u25CF\u25AA\u25E6\u2023\u2219\u00B7\u25AB\u25A0\u25A1\-\u2013\u2014*]\s+/;
const PMD_NUM_RE = /^\s*(\d{1,3})[.)]\s+/;

// "1-3, 7, 10-" -> zero-based page indices. An empty string means every page.
function pmdParsePages(str, maxPages) {
  const trimmed = (str || '').trim();
  if (!trimmed) return { indices: Array.from({ length: maxPages }, (_, i) => i), invalid: [] };
  const indices = new Set();
  const invalid = [];
  for (const part of trimmed.split(',').map(p => p.trim()).filter(Boolean)) {
    let m;
    if ((m = /^(\d+)$/.exec(part))) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= maxPages) indices.add(n - 1); else invalid.push(part);
    } else if ((m = /^(\d+)\s*-\s*(\d*)$/.exec(part))) {
      const start = parseInt(m[1], 10);
      const end = m[2] === '' ? maxPages : parseInt(m[2], 10);
      const from = Math.min(start, end), to = Math.max(start, end);
      if (to < 1 || from > maxPages) { invalid.push(part); continue; }
      for (let i = Math.max(1, from); i <= Math.min(maxPages, to); i++) indices.add(i - 1);
    } else {
      invalid.push(part);
    }
  }
  return { indices: Array.from(indices).sort((a, b) => a - b), invalid };
}

// pdf.js text item -> plain object (null for items without text)
function pmdNormalizeItem(raw) {
  if (!raw || typeof raw.str !== 'string' || raw.str.length === 0 || !Array.isArray(raw.transform)) return null;
  const size = Math.abs(raw.transform[3]) || Math.abs(raw.height) || 10;
  return { str: raw.str, x: raw.transform[4], y: raw.transform[5], width: Math.abs(raw.width) || 0, size };
}

// Text items -> lines in reading order: [{ text, x, y, size }]. size = font size that covers most characters of the line.
function pmdItemsToLines(items) {
  const list = (items || []).filter(it => it && typeof it.str === 'string' && it.str.length > 0);
  list.sort((a, b) => b.y - a.y || a.x - b.x);
  const groups = [];
  let cur = null;
  for (const it of list) {
    const tol = Math.max(1.5, 0.45 * it.size);
    if (cur && Math.abs(it.y - cur.y) <= tol) cur.items.push(it);
    else { cur = { y: it.y, items: [it] }; groups.push(cur); }
  }
  const out = [];
  for (const g of groups) {
    g.items.sort((a, b) => a.x - b.x);
    let text = '', prevEnd = null;
    const bySize = new Map();
    for (const it of g.items) {
      if (prevEnd !== null) {
        const gap = it.x - prevEnd;
        if (gap > it.size * 0.15 && !/\s$/.test(text) && !/^\s/.test(it.str)) text += ' ';
      }
      text += it.str;
      prevEnd = it.x + it.width;
      const s = Math.round(it.size * 2) / 2;
      bySize.set(s, (bySize.get(s) || 0) + it.str.trim().length);
    }
    text = text.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    let size = 0, best = -1;
    for (const [s, n] of bySize) if (n > best) { best = n; size = s; }
    out.push({ text, x: g.items[0].x, y: g.y, size });
  }
  return out;
}

// Most common font size of the document (counted by characters)
function pmdBodySize(pagesLines) {
  const counts = new Map();
  for (const lines of pagesLines) for (const l of lines) counts.set(l.size, (counts.get(l.size) || 0) + l.text.length);
  let size = 10, best = -1;
  for (const [s, n] of counts) if (n > best) { best = n; size = s; }
  return size;
}

// Typical distance between two lines of one paragraph (median of the gaps between body lines)
function pmdMedianGap(pagesLines, body) {
  const gaps = [];
  for (const lines of pagesLines) {
    for (let i = 1; i < lines.length; i++) {
      const a = lines[i - 1], b = lines[i];
      if (Math.abs(a.size - body) > 0.6 || Math.abs(b.size - body) > 0.6) continue;
      const g = a.y - b.y;
      if (g >= body * 0.8 && g <= body * 2.2) gaps.push(g);
    }
  }
  if (!gaps.length) return body * 1.25;
  gaps.sort((x, y) => x - y);
  return gaps[Math.floor(gaps.length / 2)];
}

// Sizes clearly larger than the body text become heading levels (largest = 1, at most 4 levels)
function pmdHeadingLevels(pagesLines, body) {
  const sizes = new Set();
  for (const lines of pagesLines) for (const l of lines) if (l.size >= body * 1.12 && l.size - body >= 1) sizes.add(l.size);
  const sorted = Array.from(sizes).sort((a, b) => b - a);
  const map = new Map();
  sorted.forEach((s, i) => map.set(s, Math.min(i + 1, 4)));
  return map;
}

function pmdRepeatKey(text) {
  return text.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();
}

// Lines at the very top or bottom of a page that are clearly separated from the body text (a gap of 2.5 body lines or more).
// Looks at most 2 lines deep. Text that sits tight against the body is never treated as a header or footer.
function pmdEdgeIndices(lines, body) {
  const idx = new Set();
  const gapMin = body * 2.5;
  for (let i = 0; i < Math.min(2, lines.length - 1); i++) {
    if (lines[i].y - lines[i + 1].y >= gapMin) { for (let k = 0; k <= i; k++) idx.add(k); break; }
  }
  for (let i = lines.length - 1; i >= Math.max(1, lines.length - 2); i--) {
    if (lines[i - 1].y - lines[i].y >= gapMin) { for (let k = lines.length - 1; k >= i; k--) idx.add(k); break; }
  }
  return idx;
}

// Removes lines that repeat in the top or bottom margin of many pages (running headers, footers, page numbers).
// Needs at least 3 pages. Returns new arrays; the input is not changed.
function pmdRemoveRepeated(pagesLines) {
  const n = pagesLines.length;
  if (n < 3) return pagesLines.map(l => l.slice());
  const body = pmdBodySize(pagesLines);
  const edges = pagesLines.map(lines => pmdEdgeIndices(lines, body));
  const counts = new Map();
  pagesLines.forEach((lines, p) => {
    const seen = new Set();
    edges[p].forEach(i => seen.add(pmdRepeatKey(lines[i].text)));
    seen.forEach(k => counts.set(k, (counts.get(k) || 0) + 1));
  });
  const need = Math.max(3, Math.ceil(n * 0.5));
  return pagesLines.map((lines, p) => lines.filter((l, i) => !(edges[p].has(i) && counts.get(pmdRepeatKey(l.text)) >= need)));
}

// Joins wrapped lines into one paragraph; a word split with a hyphen at the line end is put back together.
function pmdJoinLines(lines) {
  let out = lines[0] || '';
  for (let i = 1; i < lines.length; i++) {
    const next = lines[i];
    if (/[A-Za-z]-$/.test(out) && /^[a-z]/.test(next)) out = out.slice(0, -1) + next;
    else out += ' ' + next;
  }
  return out;
}

// One page of lines -> blocks: { type: 'h'|'p'|'li', level?, num?, lines: [text] }
function pmdBuildBlocks(lines, ctx) {
  const blocks = [];
  let cur = null, prev = null;
  for (const l of lines) {
    const gap = prev ? prev.y - l.y : 0;
    const level = ctx.headingLevels.get(l.size);
    const isHeading = !!level && l.text.length <= 140 && !/[,;]$/.test(l.text);
    let m;
    const bullet = !isHeading && PMD_BULLET_RE.test(l.text);
    const numbered = !isHeading && !bullet && (m = PMD_NUM_RE.exec(l.text));
    const tight = prev && gap <= ctx.medianGap * 1.5;

    if (isHeading) {
      if (cur && cur.type === 'h' && cur.level === level && prev && gap <= l.size * 1.6) cur.lines.push(l.text);
      else { cur = { type: 'h', level, lines: [l.text] }; blocks.push(cur); }
    } else if (bullet) {
      cur = { type: 'li', x: l.x, lines: [l.text.replace(PMD_BULLET_RE, '')] };
      blocks.push(cur);
    } else if (numbered) {
      cur = { type: 'li', x: l.x, num: parseInt(m[1], 10), lines: [l.text.replace(PMD_NUM_RE, '')] };
      blocks.push(cur);
    } else if (cur && cur.type === 'li' && tight && l.x >= cur.x - 1) {
      cur.lines.push(l.text);
    } else if (cur && cur.type === 'p' && tight) {
      cur.lines.push(l.text);
    } else {
      cur = { type: 'p', lines: [l.text] };
      blocks.push(cur);
    }
    prev = l;
  }
  return blocks;
}

// Joins the last paragraph of a page with the first paragraph of the next page when a sentence continues
function pmdMergePages(pagesBlocks) {
  const out = [];
  pagesBlocks.forEach((blocks, i) => {
    const copy = blocks.map(b => Object.assign({}, b, { lines: b.lines.slice() }));
    const last = out[out.length - 1];
    if (i > 0 && last && copy.length && last.type === 'p' && copy[0].type === 'p' && !/[.!?:;"\u201D)\]]$/.test(last.lines[last.lines.length - 1]) && /^[a-z]/.test(copy[0].lines[0])) {
      last.lines.push(...copy.shift().lines);
    }
    copy.forEach(b => out.push(b));
  });
  return out;
}

// Backslash-escapes characters that Markdown would treat as formatting
function pmdEscapeMd(text) {
  let t = text.replace(/([\\`*_\[\]<])/g, '\\$1');
  t = t.replace(/^(#{1,6})(\s)/, '\\$1$2').replace(/^>/, '\\>').replace(/^(\d+)\.(\s)/, '$1\\.$2').replace(/^([-+])(\s)/, '\\$1$2');
  return t;
}

function pmdBlockText(block, joinLines, sep) {
  return joinLines ? pmdJoinLines(block.lines) : block.lines.join(sep);
}

function pmdRender(blocks, opts) {
  const md = opts.format === 'md';
  const parts = [];
  let prevType = null;
  blocks.forEach(b => {
    let text;
    if (b.type === 'h') {
      const t = pmdJoinLines(b.lines);
      text = md ? '#'.repeat(b.level) + ' ' + pmdEscapeMd(t) : t;
    } else if (b.type === 'li') {
      const t = pmdBlockText(b, opts.joinLines, '\n  ');
      const marker = b.num ? b.num + '. ' : '- ';
      text = marker + (md ? pmdEscapeMd(t) : t);
    } else {
      const t = pmdBlockText(b, opts.joinLines, md ? '  \n' : '\n');
      text = md ? pmdEscapeMd(t) : t;
    }
    const joiner = prevType === 'li' && b.type === 'li' ? '\n' : '\n\n';
    parts.push(prevType === null ? text : joiner + text);
    prevType = b.type;
  });
  return parts.join('');
}

// Everything after reading: pages (already filtered by page range) -> { text, stats }
// pagesLines: array of line arrays (one per selected page), pageNumbers: their numbers in the PDF
function pmdConvert(pagesLines, pageNumbers, opts) {
  const prepared = opts.removeRepeated ? pmdRemoveRepeated(pagesLines) : pagesLines.map(l => l.slice());
  const body = pmdBodySize(prepared);
  const ctx = {
    body,
    medianGap: pmdMedianGap(prepared, body),
    headingLevels: pmdHeadingLevels(prepared, body)
  };
  const perPage = prepared.map(lines => pmdBuildBlocks(lines, ctx));
  let text;
  if (opts.pageMarks) {
    text = perPage.map((blocks, i) => {
      const mark = opts.format === 'md' ? `<!-- Page ${pageNumbers[i]} -->` : `--- Page ${pageNumbers[i]} ---`;
      return mark + '\n\n' + pmdRender(blocks, opts);
    }).join('\n\n');
  } else {
    text = pmdRender(pmdMergePages(perPage), opts);
  }
  const all = perPage.flat();
  const words = (text.match(/\S+/g) || []).length;
  return {
    text: text.trim(),
    stats: {
      words,
      headings: all.filter(b => b.type === 'h').length,
      listItems: all.filter(b => b.type === 'li').length,
      paragraphs: all.filter(b => b.type === 'p').length
    }
  };
}

function pmdOutputName(originalName, format) {
  const base = String(originalName || 'document').replace(/\.[^/.]+$/, '') || 'document';
  return format === 'md' ? `fixlytools-${base}-markdown.md` : `fixlytools-${base}-text.txt`;
}

if (typeof module !== 'undefined') {
  module.exports = {
    pmdParsePages, pmdNormalizeItem, pmdItemsToLines, pmdBodySize, pmdMedianGap, pmdHeadingLevels,
    pmdEdgeIndices, pmdRemoveRepeated, pmdJoinLines, pmdBuildBlocks, pmdMergePages, pmdEscapeMd, pmdRender, pmdConvert, pmdOutputName
  };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const workspace = document.getElementById('workspace');
    const pdfInfo = document.getElementById('pdf-info');
    const resetBtn = document.getElementById('reset-btn');
    const formatSelect = document.getElementById('opt-format');
    const rangeInput = document.getElementById('opt-range');
    const rangeNote = document.getElementById('range-note');
    const removeBox = document.getElementById('opt-remove-repeated');
    const joinBox = document.getElementById('opt-join');
    const marksBox = document.getElementById('opt-marks');
    const progress = document.getElementById('progress-text');
    const outputWrap = document.getElementById('output-wrap');
    const output = document.getElementById('output-text');
    const statsBox = document.getElementById('output-stats');
    const copyBtn = document.getElementById('copy-btn');
    const downloadBtn = document.getElementById('download-btn');

    let currentFile = null;
    let pagesLines = [];
    let loadToken = 0;
    let timer = null;

    function ensurePdfJs() {
      if (typeof pdfjsLib === 'undefined') return false;
      if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) pdfjsLib.GlobalWorkerOptions.workerSrc = PMD_WORKER_URL;
      return true;
    }

    function showWorkspace(show) {
      workspace.classList.toggle('hidden', !show);
      dropzone.classList.toggle('hidden', show);
    }

    function setOutputEnabled(on) {
      copyBtn.disabled = !on;
      downloadBtn.disabled = !on;
    }

    function currentOptions() {
      return {
        format: formatSelect.value === 'txt' ? 'txt' : 'md',
        removeRepeated: removeBox.checked,
        joinLines: joinBox.checked,
        pageMarks: marksBox.checked
      };
    }

    function refresh() {
      if (!pagesLines.length) return;
      const sel = pmdParsePages(rangeInput.value, pagesLines.length);
      if (sel.invalid.length) rangeNote.textContent = `Ignored: ${sel.invalid.join(', ')} (pages must be between 1 and ${pagesLines.length}).`;
      else rangeNote.textContent = '';
      if (!sel.indices.length) {
        output.value = '';
        statsBox.textContent = 'No valid pages selected.';
        setOutputEnabled(false);
        return;
      }
      const result = pmdConvert(sel.indices.map(i => pagesLines[i]), sel.indices.map(i => i + 1), currentOptions());
      output.value = result.text;
      if (!result.text) {
        statsBox.textContent = 'No selectable text was found on the chosen pages. This PDF may be a scan or an image.';
        setOutputEnabled(false);
        return;
      }
      const s = result.stats;
      statsBox.textContent = `${sel.indices.length} page${sel.indices.length === 1 ? '' : 's'}, ${s.words} words, ${s.headings} heading${s.headings === 1 ? '' : 's'}, ${s.listItems} list item${s.listItems === 1 ? '' : 's'}.`;
      setOutputEnabled(true);
    }

    async function loadFile(file) {
      if (!ensurePdfJs()) {
        showToast('The PDF reader could not be loaded. Please check your internet connection and reload.', 'error');
        return;
      }
      const token = ++loadToken;
      showWorkspace(true);
      pdfInfo.textContent = `${file.name} (${formatBytes(file.size)})`;
      outputWrap.classList.add('hidden');
      setOutputEnabled(false);
      pagesLines = [];
      let pdf;
      try {
        const data = new Uint8Array(await file.arrayBuffer());
        pdf = await pdfjsLib.getDocument({ data }).promise;
        const lines = [];
        for (let p = 1; p <= pdf.numPages; p++) {
          if (token !== loadToken) return;
          progress.textContent = `Reading page ${p} of ${pdf.numPages}...`;
          const page = await pdf.getPage(p);
          const content = await page.getTextContent();
          lines.push(pmdItemsToLines(content.items.map(pmdNormalizeItem).filter(Boolean)));
          page.cleanup();
          if (p % 3 === 0) await new Promise(r => setTimeout(r, 0));
        }
        if (token !== loadToken) return;
        currentFile = file;
        pagesLines = lines;
        pdfInfo.textContent = `${file.name} (${formatBytes(file.size)}, ${lines.length} page${lines.length === 1 ? '' : 's'})`;
        progress.textContent = '';
        outputWrap.classList.remove('hidden');
        refresh();
        if (!lines.some(l => l.length)) showToast('No selectable text found. This PDF may be a scan or an image.', 'warning');
      } catch (err) {
        console.error(err);
        if (token !== loadToken) return;
        if (err && err.name === 'PasswordException') showToast('This PDF is password-protected. Remove the password first and try again.', 'error');
        else showToast('Could not read this PDF. It may be damaged or is not a valid PDF.', 'error');
        resetAll();
      } finally {
        if (pdf) { try { pdf.destroy(); } catch (e) { /* ignore */ } }
      }
    }

    function resetAll() {
      loadToken++;
      currentFile = null;
      pagesLines = [];
      output.value = '';
      progress.textContent = '';
      rangeInput.value = '';
      rangeNote.textContent = '';
      showWorkspace(false);
    }

    setupDropzone(dropzone, fileInput, (files) => {
      const file = files.find(isPdfFile);
      if (!file) { showToast('Please choose a PDF file.', 'warning'); return; }
      loadFile(file);
    });
    resetBtn.addEventListener('click', resetAll);

    [formatSelect, removeBox, joinBox, marksBox].forEach(el => el.addEventListener('change', refresh));
    rangeInput.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(refresh, 250); });

    copyBtn.addEventListener('click', () => {
      if (!output.value) return;
      copyText(output.value).then(() => showToast('Copied to clipboard.', 'success'), () => showToast('Could not copy. Select the text and copy it manually.', 'error'));
    });
    downloadBtn.addEventListener('click', () => {
      if (!output.value || !currentFile) return;
      const fmt = currentOptions().format;
      const type = fmt === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8';
      downloadBlob(new Blob([output.value], { type }), pmdOutputName(currentFile.name, fmt));
    });
  });
}
