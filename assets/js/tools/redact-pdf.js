// Fixlytools - Redact PDF (black out areas for good: redacted pages become flat images)

const RD_MAX_PIXELS = 16000000;    // keeps one page canvas within what phones can handle
const RD_MAX_SIDE = 8000;
const RD_PREVIEW_MAX = 720;        // CSS pixels
const RD_MIN_SIZE = 0.006;         // smallest usable box side as a fraction of the page
const RD_STEP = 0.01;

function rdClamp01(n) { return Math.min(1, Math.max(0, n)); }

// Two corner points (fractions of the page, any order) -> normalized rectangle inside the page
function rdRectFromPoints(a, b) {
  const x0 = rdClamp01(Math.min(a.x, b.x)), x1 = rdClamp01(Math.max(a.x, b.x));
  const y0 = rdClamp01(Math.min(a.y, b.y)), y1 = rdClamp01(Math.max(a.y, b.y));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function rdIsUsable(rect) {
  return !!rect && rect.w >= RD_MIN_SIZE && rect.h >= RD_MIN_SIZE;
}

// Move a rectangle by a fraction of the page without letting it leave the page
function rdMoveRect(rect, dx, dy) {
  return {
    x: Math.min(Math.max(0, rect.x + dx), 1 - rect.w),
    y: Math.min(Math.max(0, rect.y + dy), 1 - rect.h),
    w: rect.w, h: rect.h
  };
}

// Grow or shrink a rectangle around its top-left corner, staying inside the page and above the minimum size
function rdResizeRect(rect, dw, dh) {
  return {
    x: rect.x, y: rect.y,
    w: Math.min(Math.max(RD_MIN_SIZE, rect.w + dw), 1 - rect.x),
    h: Math.min(Math.max(RD_MIN_SIZE, rect.h + dh), 1 - rect.y)
  };
}

// Scale for rendering a page at the wanted DPI (72 points per inch), limited for huge pages.
// Returns the scale, the DPI really used and whether the limit applied.
function rdScaleFor(dpi, widthPt, heightPt) {
  const wanted = dpi / 72;
  const w = widthPt * wanted, h = heightPt * wanted;
  const byPixels = Math.sqrt(RD_MAX_PIXELS / (w * h));
  const bySide = RD_MAX_SIDE / Math.max(w, h);
  const limit = Math.min(1, byPixels, bySide);
  return { scale: wanted * limit, dpi: dpi * limit, capped: limit < 1 };
}

// Rectangle in canvas pixels. It is rounded outwards and padded so no edge pixel of the hidden area survives.
function rdRectToPixels(rect, canvasW, canvasH, pad) {
  const p = pad === undefined ? 1 : pad;
  const x0 = Math.max(0, Math.floor(rect.x * canvasW) - p);
  const y0 = Math.max(0, Math.floor(rect.y * canvasH) - p);
  const x1 = Math.min(canvasW, Math.ceil((rect.x + rect.w) * canvasW) + p);
  const y1 = Math.min(canvasH, Math.ceil((rect.y + rect.h) * canvasH) + p);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

// boxes: { pageIndex: [rect, ...] } -> how many pages and boxes
function rdCountBoxes(boxes) {
  let pages = 0, count = 0;
  Object.keys(boxes).forEach(k => {
    const n = boxes[k].length;
    if (n > 0) { pages++; count += n; }
  });
  return { pages, boxes: count };
}

function rdPageIndexes(boxes) {
  return Object.keys(boxes).filter(k => boxes[k].length > 0).map(Number).sort((a, b) => a - b);
}

// Builds the output document. Pages without boxes are copied unchanged (one batch, so shared fonts stay shared);
// pages with boxes are replaced by the flattened image. redacted: Map pageIndex -> { bytes, png, widthPt, heightPt }.
async function rdBuildRedactedPdf(PDFLibRef, srcDoc, redacted, total) {
  const out = await PDFLibRef.PDFDocument.create();
  const keep = [];
  for (let i = 0; i < total; i++) if (!redacted.has(i)) keep.push(i);
  const copied = keep.length ? await out.copyPages(srcDoc, keep) : [];
  const copiedMap = new Map();
  keep.forEach((idx, k) => copiedMap.set(idx, copied[k]));
  for (let i = 0; i < total; i++) {
    if (redacted.has(i)) {
      const r = redacted.get(i);
      const img = r.png ? await out.embedPng(r.bytes) : await out.embedJpg(r.bytes);
      const page = out.addPage([r.widthPt, r.heightPt]);
      page.drawImage(img, { x: 0, y: 0, width: r.widthPt, height: r.heightPt });
    } else {
      out.addPage(copiedMap.get(i));
    }
  }
  out.setProducer('Fixlytools');
  out.setCreator('Fixlytools');
  return out;
}

if (typeof module !== 'undefined') {
  module.exports = {
    rdClamp01, rdRectFromPoints, rdIsUsable, rdMoveRect, rdResizeRect, rdScaleFor,
    rdRectToPixels, rdCountBoxes, rdPageIndexes, rdBuildRedactedPdf
  };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    const dropzone = $('dropzone'), fileInput = $('file-input'), workspace = $('workspace');
    const pdfInfo = $('pdf-info'), resetBtn = $('reset-btn'), redactBtn = $('redact-btn'), progress = $('progress');
    const prevBtn = $('rd-prev'), nextBtn = $('rd-next'), pageNum = $('rd-page-num'), pageTotal = $('rd-page-total');
    const stage = $('rd-stage'), pageCanvas = $('rd-page-canvas'), layer = $('rd-layer');
    const drawToggle = $('rd-draw-toggle'), addCenter = $('rd-add-center'), undoBtn = $('rd-undo');
    const clearPageBtn = $('rd-clear-page'), clearAllBtn = $('rd-clear-all');
    const listEl = $('rd-list'), countEl = $('rd-count'), dpiSelect = $('rd-dpi'), formatSelect = $('rd-format');
    const resultEl = $('rd-result'), status = $('rd-status');

    const REDACT_HTML = '<i class="fa-solid fa-eye-slash"></i> Redact & Download PDF';

    let bytes = null, fileName = '', fileSize = 0, pdfjsDoc = null, totalPages = 0, current = 1;
    let renderTask = null, renderToken = 0;
    let boxes = {};                // pageIndex -> [{ id, x, y, w, h }]
    let nextId = 1;
    let undoStack = [];
    let lastMoveSnapshot = 0;
    let drawEnabled = true;
    let draft = null;              // { startX, startY, el }
    let focusBoxId = null;

    const say = (msg) => { status.textContent = msg; };
    function setupWorker() {
      if (typeof pdfjsLib === 'undefined') return false;
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      return true;
    }

    const pageBoxes = () => boxes[current - 1] || (boxes[current - 1] = []);

    function snapshot() {
      undoStack.push(JSON.stringify(boxes));
      if (undoStack.length > 100) undoStack.shift();
      undoBtn.disabled = false;
    }

    // ---- boxes on the page ----
    function boxLabel(i) { return 'Redaction box ' + (i + 1) + ' on page ' + current; }

    function drawBoxes() {
      layer.querySelectorAll('.rd-box').forEach(el => el.remove());
      const list = pageBoxes();
      list.forEach((b, i) => {
        const el = document.createElement('div');
        el.className = 'rd-box';
        el.tabIndex = 0;
        el.dataset.id = String(b.id);
        el.setAttribute('role', 'group');
        el.setAttribute('aria-label', boxLabel(i) + '. Arrow keys move it, plus and minus resize it, Delete removes it.');
        el.style.left = (b.x * 100) + '%';
        el.style.top = (b.y * 100) + '%';
        el.style.width = (b.w * 100) + '%';
        el.style.height = (b.h * 100) + '%';
        layer.appendChild(el);
      });
      if (focusBoxId !== null) {
        const el = layer.querySelector('.rd-box[data-id="' + focusBoxId + '"]');
        if (el) el.focus();
        focusBoxId = null;
      }
      renderList();
    }

    function renderList() {
      const list = pageBoxes();
      listEl.innerHTML = '';
      if (list.length === 0) {
        const li = document.createElement('li');
        li.className = 'rd-list-empty';
        li.textContent = 'No boxes on this page yet.';
        listEl.appendChild(li);
      }
      list.forEach((b, i) => {
        const li = document.createElement('li');
        li.className = 'rd-list-item';
        const span = document.createElement('span');
        span.textContent = 'Box ' + (i + 1) + ' (' + Math.round(b.w * 100) + '% x ' + Math.round(b.h * 100) + '% of the page)';
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'rd-btn rd-btn-small';
        del.dataset.del = String(b.id);
        del.setAttribute('aria-label', 'Delete ' + boxLabel(i).toLowerCase());
        del.innerHTML = '<i class="fa-solid fa-trash" aria-hidden="true"></i>';
        li.appendChild(span);
        li.appendChild(del);
        listEl.appendChild(li);
      });
      const c = rdCountBoxes(boxes);
      countEl.textContent = c.boxes === 0
        ? 'Nothing selected yet'
        : c.boxes + ' box' + (c.boxes === 1 ? '' : 'es') + ' on ' + c.pages + ' page' + (c.pages === 1 ? '' : 's');
      redactBtn.disabled = !(pdfjsDoc && c.boxes > 0);
      clearPageBtn.disabled = list.length === 0;
      clearAllBtn.disabled = c.boxes === 0;
      undoBtn.disabled = undoStack.length === 0;
    }

    function addBox(rect) {
      snapshot();
      const box = { id: nextId++, x: rect.x, y: rect.y, w: rect.w, h: rect.h };
      pageBoxes().push(box);
      focusBoxId = null;
      drawBoxes();
      say('Box added on page ' + current + '.');
      return box;
    }

    // drawing with the pointer
    layer.addEventListener('pointerdown', (e) => {
      if (!drawEnabled || e.target !== layer) return;
      e.preventDefault();
      const r = layer.getBoundingClientRect();
      const startX = rdClamp01((e.clientX - r.left) / r.width);
      const startY = rdClamp01((e.clientY - r.top) / r.height);
      const el = document.createElement('div');
      el.className = 'rd-draft';
      layer.appendChild(el);
      draft = { startX, startY, el, rect: null };
      layer.setPointerCapture(e.pointerId);
    });
    layer.addEventListener('pointermove', (e) => {
      if (!draft) return;
      const r = layer.getBoundingClientRect();
      const p = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
      draft.rect = rdRectFromPoints({ x: draft.startX, y: draft.startY }, p);
      draft.el.style.left = (draft.rect.x * 100) + '%';
      draft.el.style.top = (draft.rect.y * 100) + '%';
      draft.el.style.width = (draft.rect.w * 100) + '%';
      draft.el.style.height = (draft.rect.h * 100) + '%';
    });
    const finishDraft = (cancel) => {
      if (!draft) return;
      const { el, rect } = draft;
      draft = null;
      el.remove();
      if (!cancel && rdIsUsable(rect)) addBox(rect);
    };
    layer.addEventListener('pointerup', () => finishDraft(false));
    layer.addEventListener('pointercancel', () => finishDraft(true));

    // keyboard on a box
    layer.addEventListener('keydown', (e) => {
      const el = e.target.closest && e.target.closest('.rd-box');
      if (!el) return;
      const id = parseInt(el.dataset.id, 10);
      const list = pageBoxes();
      const i = list.findIndex(b => b.id === id);
      if (i < 0) return;
      const big = e.shiftKey ? 5 : 1;
      const step = RD_STEP * big;
      let next = null;
      if (e.key === 'ArrowLeft') next = rdMoveRect(list[i], -step, 0);
      else if (e.key === 'ArrowRight') next = rdMoveRect(list[i], step, 0);
      else if (e.key === 'ArrowUp') next = rdMoveRect(list[i], 0, -step);
      else if (e.key === 'ArrowDown') next = rdMoveRect(list[i], 0, step);
      else if (e.key === '+' || e.key === '=') next = rdResizeRect(list[i], step, step);
      else if (e.key === '-' || e.key === '_') next = rdResizeRect(list[i], -step, -step);
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        snapshot();
        list.splice(i, 1);
        const neighbour = list[i] || list[i - 1];
        focusBoxId = neighbour ? neighbour.id : null;
        drawBoxes();
        say('Box deleted.');
        return;
      } else return;
      e.preventDefault();
      const now = Date.now();
      if (now - lastMoveSnapshot > 800) snapshot();
      lastMoveSnapshot = now;
      list[i] = Object.assign({ id }, next);
      focusBoxId = id;
      drawBoxes();
    });

    listEl.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-del]');
      if (!btn) return;
      const id = parseInt(btn.dataset.del, 10);
      const list = pageBoxes();
      const i = list.findIndex(b => b.id === id);
      if (i < 0) return;
      snapshot();
      list.splice(i, 1);
      drawBoxes();
      say('Box deleted.');
    });

    drawToggle.addEventListener('click', () => {
      drawEnabled = !drawEnabled;
      drawToggle.setAttribute('aria-pressed', drawEnabled ? 'true' : 'false');
      drawToggle.querySelector('span').textContent = drawEnabled ? 'Drawing on' : 'Drawing off (scroll mode)';
      layer.classList.toggle('rd-scroll', !drawEnabled);
    });
    addCenter.addEventListener('click', () => {
      const rect = { x: 0.3, y: 0.45, w: 0.4, h: 0.08 };
      const box = addBox(rect);
      focusBoxId = box.id;
      drawBoxes();
    });
    undoBtn.addEventListener('click', () => {
      if (!undoStack.length) return;
      boxes = JSON.parse(undoStack.pop());
      drawBoxes();
      say('Last change undone.');
    });
    clearPageBtn.addEventListener('click', () => {
      if (pageBoxes().length === 0) return;
      snapshot();
      boxes[current - 1] = [];
      drawBoxes();
    });
    clearAllBtn.addEventListener('click', () => {
      snapshot();
      boxes = {};
      drawBoxes();
    });

    // ---- page preview ----
    async function renderPage() {
      if (!pdfjsDoc) return;
      const token = ++renderToken;
      if (renderTask) { try { renderTask.cancel(); } catch (e) { /* ignore */ } }
      const page = await pdfjsDoc.getPage(current);
      if (token !== renderToken) return;
      const base = page.getViewport({ scale: 1 });
      const fitHeight = Math.round(window.innerHeight * 0.78 * (base.width / base.height));   // the whole page should fit on screen
      const cssW = Math.max(200, Math.min(stage.parentElement.clientWidth || RD_PREVIEW_MAX, RD_PREVIEW_MAX, Math.max(280, fitHeight)));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: (cssW * dpr) / base.width });
      pageCanvas.width = Math.floor(viewport.width);
      pageCanvas.height = Math.floor(viewport.height);
      pageCanvas.style.width = cssW + 'px';
      pageCanvas.style.height = Math.round(cssW * base.height / base.width) + 'px';
      const ctx = pageCanvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      try {
        renderTask = page.render({ canvasContext: ctx, viewport });
        await renderTask.promise;
      } catch (err) {
        if (!err || err.name !== 'RenderingCancelledException') console.error(err);
      }
    }

    function goTo(n) {
      if (!pdfjsDoc) return;
      current = Math.min(Math.max(1, n), totalPages);
      pageNum.value = String(current);
      prevBtn.disabled = current <= 1;
      nextBtn.disabled = current >= totalPages;
      drawBoxes();
      renderPage();
    }
    prevBtn.addEventListener('click', () => goTo(current - 1));
    nextBtn.addEventListener('click', () => goTo(current + 1));
    pageNum.addEventListener('change', () => goTo(parseInt(pageNum.value, 10) || current));
    window.addEventListener('resize', () => { if (pdfjsDoc) renderPage(); });

    // ---- loading a PDF ----
    async function handleFiles(files) {
      const file = files.find(isPdfFile);
      if (!file) { showToast('Please choose a PDF file.', 'warning'); return; }
      if (!setupWorker() || typeof PDFLib === 'undefined') {
        showToast('The PDF libraries could not be loaded. Please check your internet connection and reload.', 'error');
        return;
      }
      try {
        const data = new Uint8Array(await file.arrayBuffer());
        const doc = await pdfjsLib.getDocument({ data: data.slice() }).promise;
        if (pdfjsDoc) { try { pdfjsDoc.destroy(); } catch (e) { /* ignore */ } }
        pdfjsDoc = doc;
        bytes = data;
        fileName = file.name;
        fileSize = file.size;
        totalPages = doc.numPages;
        boxes = {};
        undoStack = [];
        resultEl.classList.add('hidden');
        pdfInfo.textContent = file.name + ' (' + formatBytes(file.size) + ', ' + totalPages + ' page' + (totalPages === 1 ? '' : 's') + ')';
        pageTotal.textContent = String(totalPages);
        pageNum.max = String(totalPages);
        dropzone.classList.add('hidden');
        workspace.classList.remove('hidden');
        goTo(1);
      } catch (err) {
        console.error(err);
        const msg = err && err.name === 'PasswordException'
          ? 'This PDF is password-protected. Remove the password first.'
          : 'Could not open this PDF. It may be corrupted.';
        showToast(msg, 'error');
      }
    }
    setupDropzone(dropzone, fileInput, handleFiles);

    resetBtn.addEventListener('click', () => {
      renderToken++;
      if (renderTask) { try { renderTask.cancel(); } catch (e) { /* ignore */ } }
      if (pdfjsDoc) { try { pdfjsDoc.destroy(); } catch (e) { /* ignore */ } }
      pdfjsDoc = null; bytes = null; boxes = {}; undoStack = [];
      workspace.classList.add('hidden');
      dropzone.classList.remove('hidden');
    });

    // ---- redact and download ----
    redactBtn.addEventListener('click', async () => {
      if (!bytes || !pdfjsDoc) return;
      const indexes = rdPageIndexes(boxes);
      if (indexes.length === 0) { showToast('Draw at least one box over the text you want to hide.', 'warning'); return; }
      const dpi = parseInt(dpiSelect.value, 10);
      const isPng = formatSelect.value === 'png';
      redactBtn.disabled = true;
      redactBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Redacting...';
      progress.classList.remove('hidden');
      resultEl.classList.add('hidden');
      let anyCapped = false;
      try {
        const redacted = new Map();
        let done = 0;
        for (const idx of indexes) {
          progress.textContent = 'Redacting page ' + (idx + 1) + ' (' + (done + 1) + ' of ' + indexes.length + ')...';
          const page = await pdfjsDoc.getPage(idx + 1);
          const base = page.getViewport({ scale: 1 });
          const fit = rdScaleFor(dpi, base.width, base.height);
          if (fit.capped) anyCapped = true;
          const viewport = page.getViewport({ scale: fit.scale });
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.floor(viewport.width));
          canvas.height = Math.max(1, Math.floor(viewport.height));
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport }).promise;
          ctx.fillStyle = '#000000';
          boxes[idx].forEach(b => {
            const px = rdRectToPixels(b, canvas.width, canvas.height, 1);
            ctx.fillRect(px.x, px.y, px.w, px.h);
          });
          const blob = await canvasToBlob(canvas, isPng ? 'image/png' : 'image/jpeg', 0.9);
          canvas.width = canvas.height = 0;
          page.cleanup();
          if (!blob) throw new Error('Image encoding failed');
          redacted.set(idx, { bytes: new Uint8Array(await blob.arrayBuffer()), png: isPng, widthPt: base.width, heightPt: base.height });
          done++;
        }

        progress.textContent = 'Building the new PDF...';
        let srcDoc;
        try {
          srcDoc = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
        } catch (err) {
          const encrypted = err && /encrypt/i.test(String(err.message || err.name));
          showToast(encrypted ? 'This PDF is password-protected. Remove the password first.' : 'This PDF could not be processed. It may be corrupted.', 'error');
          return;
        }
        const out = await rdBuildRedactedPdf(PDFLib, srcDoc, redacted, totalPages);
        const outBytes = await out.save();
        downloadBlob(new Blob([outBytes], { type: 'application/pdf' }), 'fixlytools-' + baseName(fileName) + '-redacted.pdf');

        const c = rdCountBoxes(boxes);
        resultEl.textContent = 'Done: ' + c.boxes + ' box' + (c.boxes === 1 ? '' : 'es') + ' on ' + c.pages + ' page' + (c.pages === 1 ? '' : 's') +
          ' blacked out. Size: ' + formatBytes(fileSize) + ' to ' + formatBytes(outBytes.length) + '. ' +
          (anyCapped ? 'Some very large pages were rendered at a lower resolution to fit your device. ' : '') +
          'Open the new file and try to select or search the hidden text to confirm it is gone.';
        resultEl.classList.remove('hidden');
        showToast('Redacted PDF saved.', 'success');
      } catch (err) {
        console.error(err);
        showToast('Something went wrong while redacting. Try a lower resolution.', 'error');
      } finally {
        progress.classList.add('hidden');
        redactBtn.innerHTML = REDACT_HTML;
        redactBtn.disabled = rdCountBoxes(boxes).boxes === 0;
      }
    });
  });
}
