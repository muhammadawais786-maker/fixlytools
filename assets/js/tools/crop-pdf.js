// Fixlytools - Crop PDF (pdf-lib sets the page boxes, pdf.js draws the page 1 preview)

function croppdfParsePageRange(rangeStr, maxPages) {
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

function croppdfNormalizeRotation(deg) {
  const n = Number(deg);
  if (!isFinite(n)) return 0;
  return ((Math.round(n / 90) * 90 % 360) + 360) % 360;
}

// Size of the page as the reader sees it (sideways pages swap width and height).
function croppdfVisualSize(box, rot) {
  const r = croppdfNormalizeRotation(rot);
  return r % 180 === 0 ? { width: box.width, height: box.height } : { width: box.height, height: box.width };
}

function croppdfMmToPt(mm) {
  return mm * 72 / 25.4;
}

// value in mm or %, dimPt = length of the matching page side in points. Negative or broken input -> 0.
function croppdfMarginPoints(value, unit, dimPt) {
  const n = Number(value);
  if (!isFinite(n) || n < 0) return 0;
  return unit === 'percent' ? (n / 100) * dimPt : croppdfMmToPt(n);
}

// Margins are typed as the reader sees the page. Pages with /Rotate store their box turned,
// so the four margins are re-assigned to the sides of the stored page.
// vm = { top, right, bottom, left } as seen; returns the same keys for the stored page.
function croppdfMapMargins(vm, rot) {
  const r = croppdfNormalizeRotation(rot);
  if (r === 90) return { left: vm.top, right: vm.bottom, bottom: vm.left, top: vm.right };
  if (r === 180) return { left: vm.right, right: vm.left, bottom: vm.top, top: vm.bottom };
  if (r === 270) return { left: vm.bottom, right: vm.top, bottom: vm.right, top: vm.left };
  return { left: vm.left, right: vm.right, bottom: vm.bottom, top: vm.top };
}

// box = the page's current visible box { x, y, width, height }. vm = margins in points as seen.
// Fails when too little would be left (minSize points on either side).
function croppdfComputeBox(box, vm, rot, minSize) {
  const min = minSize || 10;
  const m = croppdfMapMargins(vm, rot);
  const width = box.width - m.left - m.right;
  const height = box.height - m.bottom - m.top;
  if (!(width >= min) || !(height >= min)) {
    return { ok: false, box: null, reason: 'These margins leave almost nothing of the page.' };
  }
  return { ok: true, box: { x: box.x + m.left, y: box.y + m.bottom, width, height }, reason: '' };
}

// Margins typed in mm or %, for one page, as visual points.
function croppdfVisualMargins(raw, unit, visual) {
  return {
    top: croppdfMarginPoints(raw.top, unit, visual.height),
    bottom: croppdfMarginPoints(raw.bottom, unit, visual.height),
    left: croppdfMarginPoints(raw.left, unit, visual.width),
    right: croppdfMarginPoints(raw.right, unit, visual.width)
  };
}

// Percent of the preview covered by each margin, for drawing the crop frame. Clamped so it never inverts.
function croppdfOverlayPercent(vm, vw, vh) {
  const clamp = (v) => Math.min(100, Math.max(0, v));
  let left = clamp((vm.left / vw) * 100);
  let right = clamp((vm.right / vw) * 100);
  let top = clamp((vm.top / vh) * 100);
  let bottom = clamp((vm.bottom / vh) * 100);
  if (left + right > 99) { const k = 99 / (left + right); left *= k; right *= k; }
  if (top + bottom > 99) { const k = 99 / (top + bottom); top *= k; bottom *= k; }
  return { left, right, top, bottom };
}

function croppdfLoadErrorMessage(err) {
  const msg = err && err.message ? String(err.message) : '';
  if (/encrypt/i.test(msg)) return 'This PDF is password-protected. Remove the password first, then try again.';
  return 'Could not read this PDF. It may be damaged or not a valid PDF file.';
}

if (typeof module !== 'undefined') {
  module.exports = {
    croppdfParsePageRange, croppdfNormalizeRotation, croppdfVisualSize, croppdfMmToPt, croppdfMarginPoints,
    croppdfMapMargins, croppdfComputeBox, croppdfVisualMargins, croppdfOverlayPercent, croppdfLoadErrorMessage
  };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const workspace = document.getElementById('workspace');
    const pdfInfo = document.getElementById('pdf-info');
    const unitSelect = document.getElementById('croppdf-unit');
    const topInput = document.getElementById('croppdf-top');
    const rightInput = document.getElementById('croppdf-right');
    const bottomInput = document.getElementById('croppdf-bottom');
    const leftInput = document.getElementById('croppdf-left');
    const scopeAll = document.getElementById('croppdf-scope-all');
    const scopeSome = document.getElementById('croppdf-scope-some');
    const rangeInput = document.getElementById('croppdf-range');
    const mediaCheck = document.getElementById('croppdf-media');
    const previewHost = document.getElementById('croppdf-preview');
    const previewNote = document.getElementById('croppdf-preview-note');
    const applyBtn = document.getElementById('croppdf-btn');
    const resetBtn = document.getElementById('reset-btn');
    const BTN_HTML = '<i class="fa-solid fa-crop-simple"></i> Crop & Download';
    const marginInputs = [topInput, rightInput, bottomInput, leftInput];

    let currentFile = null;
    let pdfDoc = null;
    let totalPages = 0;
    let previewSize = null;      // page 1 as the reader sees it, in points
    let frame = null;            // the crop frame element on top of the preview
    let canvas = null;

    function rawMargins() {
      return { top: topInput.value, right: rightInput.value, bottom: bottomInput.value, left: leftInput.value };
    }

    function maxFor(unit) { return unit === 'percent' ? 49 : 1000; }

    function updateUnitLimits() {
      const unit = unitSelect.value;
      marginInputs.forEach(i => {
        i.max = maxFor(unit);
        i.step = unit === 'percent' ? '0.5' : '1';
      });
    }

    function selectedIndices() {
      if (scopeAll.checked) return { indices: Array.from({ length: totalPages }, (_, i) => i), invalid: [] };
      return croppdfParsePageRange(rangeInput.value, totalPages);
    }

    function updateFrame() {
      if (!frame || !previewSize) return;
      const sel = selectedIndices();
      const page1Selected = sel.indices.indexOf(0) !== -1;
      frame.classList.toggle('hidden', !page1Selected);
      previewNote.textContent = page1Selected
        ? 'The preview shows page 1. The darkened area will be removed.'
        : 'The preview shows page 1, which is not in the selected pages.';
      if (!page1Selected) return;
      const vm = croppdfVisualMargins(rawMargins(), unitSelect.value, previewSize);
      const pct = croppdfOverlayPercent(vm, previewSize.width, previewSize.height);
      frame.style.left = pct.left + '%';
      frame.style.right = pct.right + '%';
      frame.style.top = pct.top + '%';
      frame.style.bottom = pct.bottom + '%';
    }

    function clearPreview() {
      if (canvas) { canvas.width = 0; canvas.height = 0; }
      previewHost.innerHTML = '';
      canvas = null;
      frame = null;
      previewSize = null;
    }

    async function renderPreview(buf) {
      clearPreview();
      previewNote.textContent = '';
      if (typeof pdfjsLib === 'undefined') {
        previewNote.textContent = 'Preview is not available because the preview library did not load. Cropping still works.';
        return;
      }
      let doc = null;
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        // pdf.js takes ownership of the bytes it is given, so it gets its own copy.
        doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
        const page = await doc.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const available = Math.max(180, Math.min(440, (previewHost.parentElement.clientWidth || 320) - 8));
        const cssScale = available / base.width;
        let dpr = Math.min(window.devicePixelRatio || 1, 2);
        while (dpr > 0.5 && (base.width * cssScale * dpr * base.height * cssScale * dpr > 16000000 ||
               Math.max(base.width, base.height) * cssScale * dpr > 8000)) dpr -= 0.25;
        const viewport = page.getViewport({ scale: cssScale * dpr });

        canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = Math.floor(base.width * cssScale) + 'px';
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', 'Preview of page 1 with the crop frame');
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

        frame = document.createElement('div');
        frame.className = 'croppdf-frame';
        previewHost.appendChild(canvas);
        previewHost.appendChild(frame);
        previewSize = { width: base.width, height: base.height };
        page.cleanup();
        updateFrame();
      } catch (err) {
        console.error(err);
        clearPreview();
        previewNote.textContent = 'Could not draw a preview for this PDF. Cropping may still work.';
      } finally {
        if (doc) { try { doc.destroy(); } catch (e) { /* ignore */ } }
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
        scopeAll.checked = true;
        dropzone.classList.add('hidden');
        workspace.classList.remove('hidden');
        updateUnitLimits();
        renderPreview(buf);
      } catch (err) {
        pdfDoc = null;
        showToast(croppdfLoadErrorMessage(err), 'error');
      }
    }

    setupDropzone(dropzone, fileInput, handleFiles);
    marginInputs.forEach(i => i.addEventListener('input', updateFrame));
    unitSelect.addEventListener('change', () => { updateUnitLimits(); updateFrame(); });
    [scopeAll, scopeSome].forEach(el => el.addEventListener('change', updateFrame));
    rangeInput.addEventListener('input', () => {
      if (rangeInput.value.trim() !== '') scopeSome.checked = true;
      updateFrame();
    });

    applyBtn.addEventListener('click', async () => {
      if (!pdfDoc) return;
      const unit = unitSelect.value;
      const raw = rawMargins();
      const values = [raw.top, raw.right, raw.bottom, raw.left].map(Number);
      if (values.some(v => !isFinite(v) || v < 0)) {
        showToast('Margins must be numbers that are zero or higher.', 'warning');
        return;
      }
      if (values.every(v => v === 0)) {
        showToast('Enter a margin on at least one side to crop.', 'warning');
        return;
      }
      if (values.some(v => v > maxFor(unit))) {
        showToast('A margin is too large for the chosen unit.', 'warning');
        return;
      }
      const sel = selectedIndices();
      if (sel.invalid.length > 0) {
        showToast('This PDF has ' + totalPages + ' page' + (totalPages === 1 ? '' : 's') + '. Cannot use: ' + sel.invalid.join(', '), 'warning');
        return;
      }
      if (sel.indices.length === 0) { showToast('No pages are selected.', 'warning'); return; }

      applyBtn.disabled = true;
      applyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cropping...';
      try {
        const bytesIn = await pdfDoc.save();
        const work = await PDFLib.PDFDocument.load(bytesIn);

        // Work out every page first, so a bad page stops the job before anything is changed.
        const plans = [];
        for (const i of sel.indices) {
          const page = work.getPage(i);
          const box = page.getCropBox();
          const rot = croppdfNormalizeRotation(page.getRotation().angle);
          const vm = croppdfVisualMargins(raw, unit, croppdfVisualSize(box, rot));
          const result = croppdfComputeBox(box, vm, rot, 10);
          if (!result.ok) {
            showToast('Page ' + (i + 1) + ': ' + result.reason + ' Use smaller margins.', 'warning');
            return;
          }
          plans.push({ page, box: result.box });
        }

        const resizeMedia = mediaCheck.checked;
        plans.forEach(({ page, box }) => {
          page.setCropBox(box.x, box.y, box.width, box.height);
          if (resizeMedia) page.setMediaBox(box.x, box.y, box.width, box.height);
        });

        const bytes = await work.save();
        downloadBlob(new Blob([bytes], { type: 'application/pdf' }), 'fixlytools-' + baseName(currentFile.name) + '-cropped.pdf');
        showToast('Cropped ' + plans.length + ' page' + (plans.length === 1 ? '' : 's') + '. Your original file was not changed.', 'success');
      } catch (err) {
        console.error(err);
        showToast('Something went wrong while cropping. The file may be damaged.', 'error');
      } finally {
        applyBtn.disabled = false;
        applyBtn.innerHTML = BTN_HTML;
      }
    });

    resetBtn.addEventListener('click', () => {
      currentFile = null;
      pdfDoc = null;
      clearPreview();
      previewNote.textContent = '';
      workspace.classList.add('hidden');
      dropzone.classList.remove('hidden');
    });
  });
}
