// Fixlytools - Remove PDF Pages (pdf-lib only, runs in the browser)

// Turns "2, 5-7, 9-" into zero-based page indices. "9-" means page 9 to the last page.
function rmpgParsePageRange(rangeStr, maxPages) {
  const indices = new Set();
  const invalid = [];
  const parts = String(rangeStr || '').split(',').map(p => p.trim()).filter(Boolean);

  for (const part of parts) {
    let m;
    if ((m = /^(\d+)$/.exec(part))) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= maxPages) indices.add(n - 1); else invalid.push(part);
    } else if ((m = /^(\d+)\s*-\s*(\d*)$/.exec(part))) {
      const start = parseInt(m[1], 10);
      const end = m[2] === '' ? maxPages : parseInt(m[2], 10);
      const from = Math.min(start, end);
      const to = Math.max(start, end);
      if (to < 1 || from > maxPages) { invalid.push(part); continue; }
      for (let i = Math.max(1, from); i <= Math.min(maxPages, to); i++) indices.add(i - 1);
    } else {
      invalid.push(part);
    }
  }
  return { indices: Array.from(indices).sort((a, b) => a - b), invalid };
}

// [2,5,6,7] (one-based, sorted) -> "2, 5-7"
function rmpgFormatRanges(nums) {
  const out = [];
  let i = 0;
  while (i < nums.length) {
    let j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    out.push(j > i ? nums[i] + '-' + nums[j] : String(nums[i]));
    i = j + 1;
  }
  return out.join(', ');
}

// Decides what to do with the user's text. Never allows deleting every page.
function rmpgPlan(rangeStr, total) {
  const fail = (error) => ({ ok: false, error, remove: [], keep: [] });
  const text = String(rangeStr || '').trim();
  if (!text) return fail('Type the pages you want to delete, for example 2, 5-7.');
  const { indices, invalid } = rmpgParsePageRange(text, total);
  if (invalid.length > 0) {
    return fail('This PDF has ' + total + ' page' + (total === 1 ? '' : 's') + '. Cannot use: ' + invalid.join(', '));
  }
  if (indices.length === 0) return fail('No valid page numbers found. Use numbers like 2, 5-7 or 9-.');
  if (indices.length >= total) return fail('You cannot delete every page. Leave at least one page in the PDF.');
  const removeSet = new Set(indices);
  const keep = [];
  for (let i = 0; i < total; i++) if (!removeSet.has(i)) keep.push(i);
  return { ok: true, error: '', remove: indices, keep };
}

function rmpgLoadErrorMessage(err) {
  const msg = err && err.message ? String(err.message) : '';
  if (/encrypt/i.test(msg)) return 'This PDF is password-protected. Remove the password first, then try again.';
  return 'Could not read this PDF. It may be damaged or not a valid PDF file.';
}

if (typeof module !== 'undefined') {
  module.exports = { rmpgParsePageRange, rmpgFormatRanges, rmpgPlan, rmpgLoadErrorMessage };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const workspace = document.getElementById('workspace');
    const pdfInfo = document.getElementById('pdf-info');
    const rangeInput = document.getElementById('rmpg-range');
    const summary = document.getElementById('rmpg-summary');
    const removeBtn = document.getElementById('rmpg-btn');
    const resetBtn = document.getElementById('reset-btn');
    const BTN_HTML = '<i class="fa-solid fa-trash-can"></i> Remove Pages & Download';

    let currentFile = null;
    let pdfDoc = null;
    let totalPages = 0;

    function updateSummary() {
      if (!pdfDoc) return;
      const text = rangeInput.value.trim();
      summary.classList.remove('rmpg-error', 'rmpg-ok');
      if (!text) { summary.textContent = ''; return; }
      const plan = rmpgPlan(text, totalPages);
      if (!plan.ok) {
        summary.textContent = plan.error;
        summary.classList.add('rmpg-error');
      } else {
        const n = plan.remove.length;
        summary.textContent = 'Will delete ' + n + ' page' + (n === 1 ? '' : 's') + ' (' +
          rmpgFormatRanges(plan.remove.map(i => i + 1)) + '). ' + plan.keep.length + ' will remain.';
        summary.classList.add('rmpg-ok');
      }
    }

    async function handleFiles(files) {
      const file = files.find(isPdfFile);
      if (!file) { showToast('Please choose a PDF file.', 'warning'); return; }
      if (typeof PDFLib === 'undefined') {
        showToast('The PDF library could not be loaded. Please check your internet connection and reload.', 'error');
        return;
      }
      try {
        const buf = await file.arrayBuffer();
        pdfDoc = await PDFLib.PDFDocument.load(buf);
        currentFile = file;
        totalPages = pdfDoc.getPageCount();
        pdfInfo.textContent = file.name + ' (' + formatBytes(file.size) + ', ' + totalPages + ' page' + (totalPages === 1 ? '' : 's') + ')';
        rangeInput.value = '';
        rangeInput.placeholder = totalPages > 1 ? 'e.g. 2, 5-' + Math.min(totalPages, 7) : 'This PDF has only one page';
        summary.textContent = '';
        dropzone.classList.add('hidden');
        workspace.classList.remove('hidden');
      } catch (err) {
        pdfDoc = null;
        showToast(rmpgLoadErrorMessage(err), 'error');
      }
    }

    setupDropzone(dropzone, fileInput, handleFiles);
    rangeInput.addEventListener('input', updateSummary);

    removeBtn.addEventListener('click', async () => {
      if (!pdfDoc) return;
      const plan = rmpgPlan(rangeInput.value, totalPages);
      if (!plan.ok) { showToast(plan.error, 'warning'); return; }

      removeBtn.disabled = true;
      removeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Working...';
      try {
        // Copying only the kept pages into a new file means the deleted pages are really gone, not just hidden.
        const out = await PDFLib.PDFDocument.create();
        const pages = await out.copyPages(pdfDoc, plan.keep);
        pages.forEach(p => out.addPage(p));
        const bytes = await out.save();
        downloadBlob(new Blob([bytes], { type: 'application/pdf' }), 'fixlytools-' + baseName(currentFile.name) + '-removed.pdf');
        showToast('Removed ' + plan.remove.length + ' page' + (plan.remove.length === 1 ? '' : 's') + '. Your original file was not changed.', 'success');
      } catch (err) {
        console.error(err);
        showToast('Something went wrong while building the new PDF. The file may be damaged.', 'error');
      } finally {
        removeBtn.disabled = false;
        removeBtn.innerHTML = BTN_HTML;
      }
    });

    resetBtn.addEventListener('click', () => {
      currentFile = null;
      pdfDoc = null;
      rangeInput.value = '';
      summary.textContent = '';
      workspace.classList.add('hidden');
      dropzone.classList.remove('hidden');
    });
  });
}
