// Fixlytools - Add Page Numbers (pdf-lib only, runs in the browser)

function pgnumParsePageRange(rangeStr, maxPages) {
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

function pgnumClampInt(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (!isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// format: 'plain' -> "3", 'page' -> "Page 3", 'pageOf' -> "Page 3 of 12"
function pgnumFormatLabel(format, number, lastNumber) {
  if (format === 'page') return 'Page ' + number;
  if (format === 'pageOf') return 'Page ' + number + ' of ' + lastNumber;
  return String(number);
}

// Which pages get a number, and which number each gets.
// Numbering follows the real page position: page i (zero-based) shows start + i.
// Skipping the first page does not shift the numbers, so page 2 shows start + 1.
function pgnumPlan(total, opts) {
  const start = opts && isFinite(opts.start) ? Math.trunc(opts.start) : 1;
  const text = String((opts && opts.rangeStr) || '').trim();
  let indices;
  let invalid = [];
  if (text === '') {
    indices = Array.from({ length: total }, (_, i) => i);
  } else {
    const parsed = pgnumParsePageRange(text, total);
    indices = parsed.indices;
    invalid = parsed.invalid;
  }
  if (opts && opts.skipFirst) indices = indices.filter(i => i !== 0);
  return {
    items: indices.map(i => ({ index: i, number: start + i })),
    lastNumber: start + total - 1,
    invalid
  };
}

function pgnumNormalizeRotation(deg) {
  const n = Number(deg);
  if (!isFinite(n)) return 0;
  return ((Math.round(n / 90) * 90 % 360) + 360) % 360;
}

// box = visible area of the page as stored in the file { x, y, width, height }.
// rot = the page's /Rotate value. Returns the size of the page as the reader sees it.
function pgnumVisualSize(box, rot) {
  const r = pgnumNormalizeRotation(rot);
  return r % 180 === 0 ? { width: box.width, height: box.height } : { width: box.height, height: box.width };
}

// Converts a point measured on the page as displayed (origin bottom-left of what the reader sees)
// into coordinates in the file's own page space. Also returns the text angle that keeps it upright.
function pgnumMapVisualPoint(vx, vy, box, rot) {
  const r = pgnumNormalizeRotation(rot);
  const W = box.width;
  const H = box.height;
  let x;
  let y;
  if (r === 0) { x = vx; y = vy; }
  else if (r === 90) { x = W - vy; y = vx; }
  else if (r === 180) { x = W - vx; y = H - vy; }
  else { x = vy; y = H - vx; }
  return { x: box.x + x, y: box.y + y, angle: r };
}

// Where to draw the number. pos: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
function pgnumPlacement(pos, box, rot, textWidth, fontSize, marginPt) {
  const v = pgnumVisualSize(box, rot);
  const parts = String(pos).split('-');
  const vertical = parts[0] === 'top' ? 'top' : 'bottom';
  const horizontal = parts[1] === 'left' ? 'left' : (parts[1] === 'right' ? 'right' : 'center');

  let vx;
  if (horizontal === 'left') vx = marginPt;
  else if (horizontal === 'right') vx = v.width - marginPt - textWidth;
  else vx = (v.width - textWidth) / 2;
  vx = Math.max(0, vx);

  const capHeight = fontSize * 0.72;
  const vy = vertical === 'top' ? v.height - marginPt - capHeight : marginPt;
  return pgnumMapVisualPoint(vx, Math.max(0, vy), box, rot);
}

function pgnumLoadErrorMessage(err) {
  const msg = err && err.message ? String(err.message) : '';
  if (/encrypt/i.test(msg)) return 'This PDF is password-protected. Remove the password first, then try again.';
  return 'Could not read this PDF. It may be damaged or not a valid PDF file.';
}

if (typeof module !== 'undefined') {
  module.exports = {
    pgnumParsePageRange, pgnumClampInt, pgnumFormatLabel, pgnumPlan, pgnumNormalizeRotation,
    pgnumVisualSize, pgnumMapVisualPoint, pgnumPlacement, pgnumLoadErrorMessage
  };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const workspace = document.getElementById('workspace');
    const pdfInfo = document.getElementById('pdf-info');
    const posSelect = document.getElementById('pgnum-position');
    const formatSelect = document.getElementById('pgnum-format');
    const startInput = document.getElementById('pgnum-start');
    const sizeInput = document.getElementById('pgnum-size');
    const marginInput = document.getElementById('pgnum-margin');
    const rangeInput = document.getElementById('pgnum-range');
    const skipFirst = document.getElementById('pgnum-skip-first');
    const sample = document.getElementById('pgnum-sample');
    const applyBtn = document.getElementById('pgnum-btn');
    const resetBtn = document.getElementById('reset-btn');
    const BTN_HTML = '<i class="fa-solid fa-list-ol"></i> Add Numbers & Download';
    const MM_TO_PT = 72 / 25.4;

    let currentFile = null;
    let pdfDoc = null;
    let totalPages = 0;

    function readOptions(writeBack) {
      const start = pgnumClampInt(startInput.value, 0, 99999, 1);
      const size = pgnumClampInt(sizeInput.value, 6, 72, 11);
      const margin = pgnumClampInt(marginInput.value, 3, 50, 10);
      if (writeBack) {
        startInput.value = start;
        sizeInput.value = size;
        marginInput.value = margin;
      }
      return { start, size, margin };
    }

    function updateSample() {
      const o = readOptions(false);
      const last = o.start + Math.max(totalPages, 1) - 1;
      sample.textContent = 'Preview text: ' + pgnumFormatLabel(formatSelect.value, o.start, last);
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
        updateSample();
        dropzone.classList.add('hidden');
        workspace.classList.remove('hidden');
      } catch (err) {
        pdfDoc = null;
        showToast(pgnumLoadErrorMessage(err), 'error');
      }
    }

    setupDropzone(dropzone, fileInput, handleFiles);
    [formatSelect, startInput].forEach(el => el.addEventListener('input', updateSample));

    applyBtn.addEventListener('click', async () => {
      if (!pdfDoc) return;
      const o = readOptions(true);
      const plan = pgnumPlan(totalPages, { rangeStr: rangeInput.value, skipFirst: skipFirst.checked, start: o.start });
      if (plan.invalid.length > 0) {
        showToast('This PDF has ' + totalPages + ' page' + (totalPages === 1 ? '' : 's') + '. Cannot use: ' + plan.invalid.join(', '), 'warning');
        return;
      }
      if (plan.items.length === 0) {
        showToast('No pages are selected for numbering.', 'warning');
        return;
      }

      applyBtn.disabled = true;
      applyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Adding numbers...';
      try {
        const bytesIn = await pdfDoc.save();
        const work = await PDFLib.PDFDocument.load(bytesIn);
        const font = await work.embedFont(PDFLib.StandardFonts.Helvetica);
        const color = PDFLib.rgb(0.15, 0.15, 0.15);
        const marginPt = o.margin * MM_TO_PT;

        for (const item of plan.items) {
          const page = work.getPage(item.index);
          const box = page.getCropBox();
          const rot = pgnumNormalizeRotation(page.getRotation().angle);
          const label = pgnumFormatLabel(formatSelect.value, item.number, plan.lastNumber);
          const textWidth = font.widthOfTextAtSize(label, o.size);
          const at = pgnumPlacement(posSelect.value, box, rot, textWidth, o.size, marginPt);
          page.drawText(label, { x: at.x, y: at.y, size: o.size, font, color, rotate: PDFLib.degrees(at.angle) });
        }

        const bytes = await work.save();
        downloadBlob(new Blob([bytes], { type: 'application/pdf' }), 'fixlytools-' + baseName(currentFile.name) + '-numbered.pdf');
        showToast('Numbered ' + plan.items.length + ' page' + (plan.items.length === 1 ? '' : 's') + '. Your original file was not changed.', 'success');
      } catch (err) {
        console.error(err);
        showToast('Something went wrong while adding page numbers. The file may be damaged.', 'error');
      } finally {
        applyBtn.disabled = false;
        applyBtn.innerHTML = BTN_HTML;
      }
    });

    resetBtn.addEventListener('click', () => {
      currentFile = null;
      pdfDoc = null;
      totalPages = 0;
      workspace.classList.add('hidden');
      dropzone.classList.remove('hidden');
    });
  });
}
