// Fixlytools - Sign PDF (draw, type or upload a signature and place it on a page)

const SG_MAX_SIG_WIDTH = 1000;     // pixels; keeps the embedded signature image small
const SG_PREVIEW_MAX = 720;        // CSS pixels
const SG_MIN_FW = 0.04;            // smallest signature width as a fraction of the page width
const SG_DEFAULT_FW = 0.28;

const SG_FONTS = {
  script: { css: 'italic 400 {S}px "Segoe Script","Brush Script MT","Snell Roundhand","Lucida Handwriting","Apple Chancery","URW Chancery L",cursive', label: 'Script' },
  classic: { css: 'italic 400 {S}px Georgia,"Times New Roman","DejaVu Serif",serif', label: 'Classic' },
  print: { css: 'italic 500 {S}px "Segoe Print","Bradley Hand","Chalkboard SE","Comic Sans MS","Comic Neue",cursive', label: 'Casual' }
};

function sgNormRotation(angle) {
  const n = Math.round((Number(angle) || 0) / 90) * 90;
  return ((n % 360) + 360) % 360;
}

// Bounding box of the pixels whose alpha is above alphaMin. data is RGBA. Returns null for an empty image.
function sgTrimBounds(data, width, height, alphaMin) {
  const min = alphaMin === undefined ? 8 : alphaMin;
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > min) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// Makes near-white pixels transparent (soft edge between lo and hi). Changes data in place and returns it.
function sgRemoveWhite(data, lo, hi) {
  const low = lo === undefined ? 200 : lo;
  const high = hi === undefined ? 245 : hi;
  for (let i = 0; i < data.length; i += 4) {
    const m = (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (m >= high) data[i + 3] = 0;
    else if (m > low) data[i + 3] = Math.round(data[i + 3] * (high - m) / (high - low));
  }
  return data;
}

// Size after scaling down so the width is at most maxW (never scales up)
function sgFitSize(w, h, maxW) {
  if (w <= maxW) return { w, h };
  return { w: maxW, h: Math.max(1, Math.round(h * maxW / w)) };
}

function sgPagesForScope(scope, current, total) {
  if (total < 1) return [];
  if (scope === 'all') return Array.from({ length: total }, (_, i) => i);
  if (scope === 'first') return [0];
  if (scope === 'last') return [total - 1];
  const c = Math.min(Math.max(1, current), total);
  return [c - 1];
}

// Signature box as fractions of the displayed page (top-left origin), kept fully inside the page.
// state: { fx, fy, fw, aspect } where aspect = signature width / height. pageAspect = displayed page width / height.
function sgBoxFor(state, pageAspect) {
  let fw = Math.min(1, Math.max(SG_MIN_FW, state.fw));
  let fh = fw * pageAspect / state.aspect;
  if (fh > 1) { fh = 1; fw = fh * state.aspect / pageAspect; }
  const fx = Math.min(Math.max(0, state.fx), 1 - fw);
  const fy = Math.min(Math.max(0, state.fy), 1 - fh);
  return { fx, fy, fw, fh };
}

// Converts a display-space point (u right, v down, in points, origin = top-left of the page as shown)
// into PDF user space. page = { x0, y0, x1, y1, rotation } (the visible page box and its /Rotate value).
function sgDisplayToUser(u, v, page) {
  const R = sgNormRotation(page.rotation);
  if (R === 0) return { x: page.x0 + u, y: page.y1 - v };
  if (R === 90) return { x: page.x0 + v, y: page.y0 + u };
  if (R === 180) return { x: page.x1 - u, y: page.y0 + v };
  return { x: page.x1 - v, y: page.y1 - u };
}

// Where to draw the image in PDF user space so that it appears at the given box of the displayed page.
// Returns what pdf-lib's drawImage needs: x, y (bottom-left of the image), width, height, rotate (degrees, counter-clockwise).
function sgViewToPdf(box, page) {
  const R = sgNormRotation(page.rotation);
  const W = page.x1 - page.x0;
  const H = page.y1 - page.y0;
  const dispW = (R === 90 || R === 270) ? H : W;
  const dispH = (R === 90 || R === 270) ? W : H;
  const u0 = box.fx * dispW;
  const v0 = box.fy * dispH;
  const width = box.fw * dispW;
  const height = box.fh * dispH;
  const origin = sgDisplayToUser(u0, v0 + height, page);   // bottom-left of the signature as the reader sees it
  return { x: origin.x, y: origin.y, width, height, rotate: R };
}

// Adds the signature (PNG bytes) to the chosen pages. pages: [{ index, page: {x0,y0,x1,y1,rotation}, pageAspect }]
async function sgApplySignature(PDFLibRef, pdfDoc, pngBytes, state, pages) {
  const image = await pdfDoc.embedPng(pngBytes);
  for (const item of pages) {
    const box = sgBoxFor(state, item.pageAspect);
    const spot = sgViewToPdf(box, item.page);
    pdfDoc.getPage(item.index).drawImage(image, {
      x: spot.x, y: spot.y, width: spot.width, height: spot.height, rotate: PDFLibRef.degrees(spot.rotate)
    });
  }
  return pdfDoc;
}

if (typeof module !== 'undefined') {
  module.exports = {
    sgNormRotation, sgTrimBounds, sgRemoveWhite, sgFitSize, sgPagesForScope,
    sgBoxFor, sgDisplayToUser, sgViewToPdf, sgApplySignature
  };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    const dropzone = $('dropzone'), fileInput = $('file-input'), workspace = $('workspace');
    const pdfInfo = $('pdf-info'), resetBtn = $('reset-btn'), signBtn = $('sign-btn'), progress = $('progress');
    const drawCanvas = $('sg-draw'), clearBtn = $('sg-clear');
    const typeInput = $('sg-type-input');
    const uploadInput = $('sg-upload-input'), uploadBtn = $('sg-upload-btn'), whiteBox = $('sg-white'), uploadName = $('sg-upload-name');
    const sigPreview = $('sg-sig-preview'), sigPreviewImg = $('sg-sig-preview-img'), sigRemove = $('sg-remove'), sigNone = $('sg-sig-none');
    const stage = $('sg-stage'), pageCanvas = $('sg-page-canvas'), overlay = $('sg-overlay'), overlayImg = $('sg-img'), handle = $('sg-handle');
    const prevBtn = $('sg-prev'), nextBtn = $('sg-next'), pageNum = $('sg-page-num'), pageTotal = $('sg-page-total');
    const sizeInput = $('sg-size'), scopeSelect = $('sg-scope'), status = $('sg-status');
    const tabs = Array.from(document.querySelectorAll('.sg-tab'));
    const panels = Array.from(document.querySelectorAll('.sg-panel'));
    const colorRadios = Array.from(document.querySelectorAll('input[name="sg-color"]'));
    const styleBtns = Array.from(document.querySelectorAll('.sg-style-btn'));

    const SIGN_HTML = '<i class="fa-solid fa-file-signature"></i> Sign & Download PDF';

    let bytes = null, fileName = '', pdfjsDoc = null, totalPages = 0, current = 1;
    let renderTask = null, renderToken = 0, pageAspect = 0.77;
    let sigCanvas = null;                         // trimmed signature (transparent PNG source)
    let sigState = { fx: 0.55, fy: 0.78, fw: SG_DEFAULT_FW, aspect: 3 };
    let activeTab = 'draw';
    let fontKey = 'script';
    let uploadedImage = null;

    function setupWorker() {
      if (typeof pdfjsLib === 'undefined') return false;
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      return true;
    }
    const say = (msg) => { status.textContent = msg; };
    const penColor = () => { const r = colorRadios.find(x => x.checked); return r ? r.value : '#111827'; };

    // ---- signature creation ----
    function trimToSignature(src) {
      const ctx = src.getContext('2d');
      const img = ctx.getImageData(0, 0, src.width, src.height);
      const b = sgTrimBounds(img.data, src.width, src.height);
      if (!b) return null;
      const pad = Math.round(Math.max(b.w, b.h) * 0.03) + 2;
      const out = document.createElement('canvas');
      out.width = b.w + pad * 2;
      out.height = b.h + pad * 2;
      out.getContext('2d').drawImage(src, b.x, b.y, b.w, b.h, pad, pad, b.w, b.h);
      const fit = sgFitSize(out.width, out.height, SG_MAX_SIG_WIDTH);
      if (fit.w === out.width) return out;
      const small = document.createElement('canvas');
      small.width = fit.w; small.height = fit.h;
      const sctx = small.getContext('2d');
      sctx.imageSmoothingQuality = 'high';
      sctx.drawImage(out, 0, 0, fit.w, fit.h);
      out.width = out.height = 0;
      return small;
    }

    function setSignature(canvas) {
      sigCanvas = canvas;
      if (!canvas) {
        overlay.classList.add('hidden');
        sigPreview.classList.add('hidden');
        sigNone.classList.remove('hidden');
        updateSignButton();
        return;
      }
      const url = canvas.toDataURL('image/png');
      overlayImg.src = url;
      sigPreviewImg.src = url;
      sigState.aspect = canvas.width / canvas.height;
      overlay.classList.remove('hidden');
      sigPreview.classList.remove('hidden');
      sigNone.classList.add('hidden');
      positionOverlay();
      updateSignButton();
      say('Signature ready. Drag it to the right place on the page.');
    }

    function updateSignButton() {
      signBtn.disabled = !(sigCanvas && pdfjsDoc);
    }

    // drawing pad
    const dctx = drawCanvas.getContext('2d');
    let drawing = false, last = null, drewSomething = false;
    function padPoint(e) {
      const r = drawCanvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * drawCanvas.width / r.width, y: (e.clientY - r.top) * drawCanvas.height / r.height };
    }
    drawCanvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      drawing = true;
      try { drawCanvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      last = padPoint(e);
      dctx.fillStyle = penColor();
      dctx.beginPath();
      dctx.arc(last.x, last.y, 2.2, 0, Math.PI * 2);
      dctx.fill();
      drewSomething = true;
    });
    drawCanvas.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      const p = padPoint(e);
      const mid = { x: (last.x + p.x) / 2, y: (last.y + p.y) / 2 };
      dctx.strokeStyle = penColor();
      dctx.lineWidth = 4.4;
      dctx.lineCap = 'round';
      dctx.lineJoin = 'round';
      dctx.beginPath();
      dctx.moveTo(last.x, last.y);
      dctx.quadraticCurveTo(last.x, last.y, mid.x, mid.y);
      dctx.lineTo(p.x, p.y);
      dctx.stroke();
      last = p;
    });
    const endDraw = () => {
      if (!drawing) return;
      drawing = false;
      if (drewSomething) setSignature(trimToSignature(drawCanvas));
    };
    drawCanvas.addEventListener('pointerup', endDraw);
    drawCanvas.addEventListener('pointercancel', endDraw);
    clearBtn.addEventListener('click', () => {
      dctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
      drewSomething = false;
      if (activeTab === 'draw') setSignature(null);
    });

    // typed signature
    function renderTyped() {
      const text = typeInput.value.trim();
      if (!text) { if (activeTab === 'type') setSignature(null); return; }
      const size = 120;
      const c = document.createElement('canvas');
      const ctx = c.getContext('2d');
      const font = SG_FONTS[fontKey].css.replace('{S}', String(size));
      ctx.font = font;
      const w = Math.ceil(ctx.measureText(text).width) + 80;
      c.width = Math.min(w, 4000);
      c.height = size * 2;
      const ctx2 = c.getContext('2d');
      ctx2.font = font;
      ctx2.fillStyle = penColor();
      ctx2.textBaseline = 'middle';
      ctx2.fillText(text, 40, size);
      const trimmed = trimToSignature(c);
      c.width = c.height = 0;
      setSignature(trimmed);
    }
    typeInput.addEventListener('input', renderTyped);
    styleBtns.forEach(b => b.addEventListener('click', () => {
      fontKey = b.dataset.style;
      styleBtns.forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
      if (typeInput.value.trim()) renderTyped();
    }));

    // uploaded signature
    function renderUploaded() {
      if (!uploadedImage) return;
      const fit = sgFitSize(uploadedImage.naturalWidth, uploadedImage.naturalHeight, SG_MAX_SIG_WIDTH);
      const c = document.createElement('canvas');
      c.width = fit.w; c.height = fit.h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(uploadedImage, 0, 0, fit.w, fit.h);
      if (whiteBox.checked) {
        const data = ctx.getImageData(0, 0, c.width, c.height);
        sgRemoveWhite(data.data);
        ctx.putImageData(data, 0, 0);
      }
      const trimmed = trimToSignature(c);
      c.width = c.height = 0;
      if (!trimmed) { showToast('The image looks empty or fully white.', 'warning'); setSignature(null); return; }
      setSignature(trimmed);
    }
    uploadBtn.addEventListener('click', () => uploadInput.click());
    uploadInput.addEventListener('change', async () => {
      const file = uploadInput.files && uploadInput.files[0];
      uploadInput.value = '';
      if (!file) return;
      if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type) && !/\.(png|jpe?g|webp|gif)$/i.test(file.name)) {
        showToast('Please choose a PNG, JPG or WEBP image.', 'warning');
        return;
      }
      try {
        uploadedImage = await loadImageFile(file);
        uploadName.textContent = file.name;
        renderUploaded();
      } catch (err) {
        showToast('Could not read this image.', 'error');
      }
    });
    whiteBox.addEventListener('change', renderUploaded);

    colorRadios.forEach(r => r.addEventListener('change', () => { if (activeTab === 'type' && typeInput.value.trim()) renderTyped(); }));

    // tabs
    function selectTab(name) {
      activeTab = name;
      tabs.forEach(t => {
        const on = t.dataset.tab === name;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
      });
      panels.forEach(p => p.classList.toggle('hidden', p.dataset.panel !== name));
    }
    tabs.forEach(t => {
      t.addEventListener('click', () => selectTab(t.dataset.tab));
      t.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const i = tabs.indexOf(t);
        const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        next.focus();
        selectTab(next.dataset.tab);
      });
    });

    sigRemove.addEventListener('click', () => {
      dctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
      drewSomething = false;
      typeInput.value = '';
      uploadedImage = null;
      uploadName.textContent = '';
      setSignature(null);
      say('Signature removed.');
    });

    // ---- page preview and overlay ----
    function positionOverlay() {
      if (!sigCanvas) return;
      const box = sgBoxFor(sigState, pageAspect);
      sigState.fx = box.fx; sigState.fy = box.fy; sigState.fw = box.fw;
      overlay.style.left = (box.fx * 100) + '%';
      overlay.style.top = (box.fy * 100) + '%';
      overlay.style.width = (box.fw * 100) + '%';
      overlay.style.height = (box.fh * 100) + '%';
      sizeInput.value = String(Math.round(box.fw * 100));
    }

    async function renderPage() {
      if (!pdfjsDoc) return;
      const token = ++renderToken;
      if (renderTask) { try { renderTask.cancel(); } catch (e) { /* ignore */ } }
      const page = await pdfjsDoc.getPage(current);
      if (token !== renderToken) return;
      const base = page.getViewport({ scale: 1 });
      pageAspect = base.width / base.height;
      const fitHeight = Math.round(window.innerHeight * 0.78 * (base.width / base.height));   // the whole page should fit on screen
      const cssW = Math.max(200, Math.min(stage.parentElement.clientWidth || SG_PREVIEW_MAX, SG_PREVIEW_MAX, Math.max(280, fitHeight)));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: (cssW * dpr) / base.width });
      pageCanvas.width = Math.floor(viewport.width);
      pageCanvas.height = Math.floor(viewport.height);
      pageCanvas.style.width = cssW + 'px';
      pageCanvas.style.height = Math.round(cssW / pageAspect) + 'px';
      const ctx = pageCanvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      positionOverlay();
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
      renderPage();
    }
    prevBtn.addEventListener('click', () => goTo(current - 1));
    nextBtn.addEventListener('click', () => goTo(current + 1));
    pageNum.addEventListener('change', () => goTo(parseInt(pageNum.value, 10) || current));

    // moving and resizing the signature
    let drag = null;
    overlay.addEventListener('pointerdown', (e) => {
      if (e.target === handle) return;
      e.preventDefault();
      overlay.focus();
      const r = stage.getBoundingClientRect();
      drag = { mode: 'move', x: e.clientX, y: e.clientY, fx: sigState.fx, fy: sigState.fy, w: r.width, h: r.height };
      overlay.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const r = stage.getBoundingClientRect();
      drag = { mode: 'resize', x: e.clientX, fw: sigState.fw, w: r.width };
      handle.setPointerCapture(e.pointerId);
    });
    const onMove = (e) => {
      if (!drag) return;
      if (drag.mode === 'move') {
        sigState.fx = drag.fx + (e.clientX - drag.x) / drag.w;
        sigState.fy = drag.fy + (e.clientY - drag.y) / drag.h;
      } else {
        sigState.fw = drag.fw + (e.clientX - drag.x) / drag.w;
      }
      positionOverlay();
    };
    const onUp = () => { drag = null; };
    [overlay, handle].forEach(el => {
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
    });
    overlay.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 0.05 : 0.01;
      let handled = true;
      if (e.key === 'ArrowLeft') sigState.fx -= step;
      else if (e.key === 'ArrowRight') sigState.fx += step;
      else if (e.key === 'ArrowUp') sigState.fy -= step;
      else if (e.key === 'ArrowDown') sigState.fy += step;
      else if (e.key === '+' || e.key === '=') sigState.fw += step;
      else if (e.key === '-' || e.key === '_') sigState.fw -= step;
      else handled = false;
      if (handled) { e.preventDefault(); positionOverlay(); }
    });
    sizeInput.addEventListener('input', () => {
      sigState.fw = (parseInt(sizeInput.value, 10) || 28) / 100;
      positionOverlay();
    });

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
        totalPages = doc.numPages;
        pdfInfo.textContent = file.name + ' (' + formatBytes(file.size) + ', ' + totalPages + ' page' + (totalPages === 1 ? '' : 's') + ')';
        pageTotal.textContent = String(totalPages);
        pageNum.max = String(totalPages);
        dropzone.classList.add('hidden');
        workspace.classList.remove('hidden');
        updateSignButton();
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
      pdfjsDoc = null; bytes = null;
      workspace.classList.add('hidden');
      dropzone.classList.remove('hidden');
      updateSignButton();
    });

    window.addEventListener('resize', () => { if (pdfjsDoc) renderPage(); });

    // ---- sign and download ----
    signBtn.addEventListener('click', async () => {
      if (!bytes || !sigCanvas || !pdfjsDoc) return;
      const targets = sgPagesForScope(scopeSelect.value, current, totalPages);
      signBtn.disabled = true;
      signBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Adding signature...';
      progress.textContent = 'Adding your signature...';
      progress.classList.remove('hidden');
      try {
        let doc;
        try {
          doc = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
        } catch (err) {
          const encrypted = err && /encrypt/i.test(String(err.message || err.name));
          showToast(encrypted ? 'This PDF is password-protected. Remove the password first.' : 'This PDF could not be processed. It may be corrupted.', 'error');
          return;
        }
        const pngBlob = await canvasToBlob(sigCanvas, 'image/png');
        const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
        const items = [];
        for (const index of targets) {
          const pg = await pdfjsDoc.getPage(index + 1);
          const view = pg.view;
          const rotation = sgNormRotation(pg.rotate);
          const w = view[2] - view[0], h = view[3] - view[1];
          const swap = rotation === 90 || rotation === 270;
          items.push({
            index,
            page: { x0: view[0], y0: view[1], x1: view[2], y1: view[3], rotation },
            pageAspect: swap ? h / w : w / h
          });
          pg.cleanup();
        }
        await sgApplySignature(PDFLib, doc, pngBytes, sigState, items);
        const out = await doc.save();
        downloadBlob(new Blob([out], { type: 'application/pdf' }), 'fixlytools-' + baseName(fileName) + '-signed.pdf');
        showToast('Signed ' + items.length + ' page' + (items.length === 1 ? '' : 's') + '.', 'success');
      } catch (err) {
        console.error(err);
        showToast('Something went wrong while adding the signature.', 'error');
      } finally {
        progress.classList.add('hidden');
        signBtn.innerHTML = SIGN_HTML;
        updateSignButton();
      }
    });
  });
}
