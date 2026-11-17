// Fixlytools - Scan to PDF (camera or photos -> scanner-style pages -> one PDF, built with pdf-lib)

const SCPDF_A4_W = 595.28;
const SCPDF_A4_H = 841.89;
const SCPDF_LETTER_W = 612;
const SCPDF_LETTER_H = 792;
const SCPDF_MAX_PAGES = 50;
const SCPDF_MAX_PIXELS = 16000000;
const SCPDF_MAX_SIDE = 8000;
const SCPDF_THUMB = 200;

// ---------- pure helpers ----------

// Size of the image that goes into the PDF: never larger than the source, never above the side / pixel limits
function scpdfOutputSize(w, h, maxSide) {
  let scale = Math.min(1, maxSide / Math.max(w, h), SCPDF_MAX_SIDE / Math.max(w, h));
  const px = w * h * scale * scale;
  if (px > SCPDF_MAX_PIXELS) scale *= Math.sqrt(SCPDF_MAX_PIXELS / px);
  return { w: Math.max(1, Math.floor(w * scale)), h: Math.max(1, Math.floor(h * scale)) };
}

// Page size and image position in PDF points. A4 / Letter pages turn to landscape for wide pictures.
// mode: 'a4' | 'letter' | 'fit'. margin in points (ignored for 'fit').
function scpdfLayout(imgW, imgH, mode, margin) {
  if (mode === 'fit') {
    const s = SCPDF_A4_H / Math.max(imgW, imgH);
    const w = imgW * s, h = imgH * s;
    return { pageW: w, pageH: h, x: 0, y: 0, w, h };
  }
  const base = mode === 'letter' ? [SCPDF_LETTER_W, SCPDF_LETTER_H] : [SCPDF_A4_W, SCPDF_A4_H];
  const landscape = imgW > imgH;
  const pageW = landscape ? base[1] : base[0];
  const pageH = landscape ? base[0] : base[1];
  const m = Math.max(0, margin || 0);
  const s = Math.min((pageW - 2 * m) / imgW, (pageH - 2 * m) / imgH);
  const w = imgW * s, h = imgH * s;
  return { pageW, pageH, x: (pageW - w) / 2, y: (pageH - h) / 2, w, h };
}

function scpdfRotatedSize(w, h, rotation) {
  return rotation % 180 === 0 ? { w, h } : { w: h, h: w };
}

function scpdfNextRotation(rotation, delta) {
  return (((rotation + delta) % 360) + 360) % 360;
}

// Moves an item inside an array (returns a new array; out-of-range moves leave it unchanged)
function scpdfMove(list, index, delta) {
  const to = index + delta;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return list.slice();
  const copy = list.slice();
  const [item] = copy.splice(index, 1);
  copy.splice(to, 0, item);
  return copy;
}


// Minimal store-only ZIP writer (no compression; JPG/PNG are already compressed).
function scpdfCrcTable() {
  const t = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
}
function scpdfCrc32(bytes, table) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = table[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function scpdfZip(files) { // files: [{name, data:Uint8Array}]
  const table = scpdfCrcTable(), enc = new TextEncoder(), parts = [], central = [];
  let offset = 0;
  files.forEach((f) => {
    const nm = enc.encode(f.name), crc = scpdfCrc32(f.data, table), size = f.data.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true); lh.setUint32(18, size, true); lh.setUint32(22, size, true);
    lh.setUint16(26, nm.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), nm, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, crc, true); ch.setUint32(20, size, true); ch.setUint32(24, size, true);
    ch.setUint16(28, nm.length, true); ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), nm);
    offset += 30 + nm.length + size;
  });
  let cdSize = 0; central.forEach((c) => { cdSize += c.length; });
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), { type: 'application/zip' });
}
function scpdfImageName(firstName, index, total, ext) {
  const base = String(firstName || '').replace(/\.[^/.]+$/, '');
  const stem = (!base || /^camera-\d+$/.test(base)) ? 'fixlytools-scan' : `fixlytools-${base}-scan`;
  return total > 1 ? `${stem}-${index + 1}.${ext}` : `${stem}.${ext}`;
}

function scpdfOutputName(firstName) {
  const base = String(firstName || '').replace(/\.[^/.]+$/, '');
  if (!base || /^camera-\d+$/.test(base)) return 'fixlytools-scan.pdf';
  return `fixlytools-${base}-scan.pdf`;
}

// ---------- pure image filters (work on RGBA data of an ImageData) ----------

function scpdfLuma(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function scpdfToGray(data) {
  for (let i = 0; i < data.length; i += 4) {
    const v = scpdfLuma(data[i], data[i + 1], data[i + 2]) + 0.5;
    data[i] = data[i + 1] = data[i + 2] = v;
  }
}

// Stretches the levels so the paper becomes white (low = 2nd percentile, high = 90th percentile of brightness)
function scpdfAutoLevels(data) {
  const hist = new Uint32Array(256);
  const total = data.length / 4;
  if (!total) return;
  for (let i = 0; i < data.length; i += 4) hist[Math.min(255, Math.round(scpdfLuma(data[i], data[i + 1], data[i + 2])))]++;
  const pick = (frac) => {
    let acc = 0;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= total * frac) return v; }
    return 255;
  };
  const lo = pick(0.02), hi = pick(0.9);
  if (hi - lo < 40) return;   // flat picture: stretching would only add noise
  const k = 255 / (hi - lo);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = (data[i] - lo) * k;
    data[i + 1] = (data[i + 1] - lo) * k;
    data[i + 2] = (data[i + 2] - lo) * k;
  }
}

// Black and white by comparing every pixel with the average of its neighbourhood (handles uneven light and shadows)
function scpdfAdaptiveBW(data, w, h) {
  const gray = new Uint8Array(w * h);
  for (let i = 0, p = 0; p < w * h; i += 4, p++) gray[p] = scpdfLuma(data[i], data[i + 1], data[i + 2]);
  const iw = w + 1;
  const integral = new Uint32Array(iw * (h + 1));   // sums stay below 2^32 up to 16 million pixels
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += gray[y * w + x];
      integral[(y + 1) * iw + x + 1] = integral[y * iw + x + 1] + row;
    }
  }
  const half = Math.max(4, Math.round(Math.min(w, h) / 24));
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - half), y1 = Math.min(h, y + half + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - half), x1 = Math.min(w, x + half + 1);
      const sum = integral[y1 * iw + x1] - integral[y0 * iw + x1] - integral[y1 * iw + x0] + integral[y0 * iw + x0];
      const mean = sum / ((x1 - x0) * (y1 - y0));
      const g = gray[y * w + x];
      const v = (g < mean * 0.9 || g < 45) ? 0 : 255;
      const i = (y * w + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
    }
  }
}

// mode: 'original' | 'clean' | 'gray' | 'bw'. Changes data in place.
function scpdfApplyFilter(data, w, h, mode) {
  if (typeof seApplyFilter === 'function') {
    seApplyFilter({ data, width: w, height: h }, mode === 'clean' ? 'enhance' : mode);
    return;
  }
  if (mode === 'gray') { scpdfToGray(data); scpdfAutoLevels(data); }
  else if (mode === 'clean') scpdfAutoLevels(data);
  else if (mode === 'bw') scpdfAdaptiveBW(data, w, h);
}

if (typeof module !== 'undefined') {
  module.exports = {
    scpdfOutputSize, scpdfLayout, scpdfRotatedSize, scpdfNextRotation, scpdfMove, scpdfOutputName,
    scpdfToGray, scpdfAutoLevels, scpdfAdaptiveBW, scpdfApplyFilter
  };
}

// ---------- page wiring ----------

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    const dropzone = $('dropzone');
    const fileInput = $('file-input');
    const captureInput = $('capture-input');
    const chooseBtn = $('choose-btn');
    const photoBtn = $('photo-btn');
    const cameraBtn = $('camera-btn');
    const cameraPanel = $('camera-panel');
    const video = $('camera-video');
    const snapBtn = $('snap-btn');
    const closeCameraBtn = $('close-camera-btn');
    const cameraStatus = $('camera-status');
    const workspace = $('workspace');
    const grid = $('page-grid');
    const countText = $('page-count');
    const filterSelect = $('opt-filter');
    const autoCrop = $('opt-autocrop');
    const sizeSelect = $('opt-size');
    const marginSelect = $('opt-margin');
    const qualitySelect = $('opt-quality');
    const clearBtn = $('clear-btn');
    const createBtn = $('create-btn');
    const formatSelect = $('opt-format');
    const progress = $('progress-text');

    // editor elements
    const editor = $('editor');
    const edTitle = $('ed-title');
    const edCanvas = $('ed-canvas');
    const edOverlay = $('ed-overlay');
    const edStage = $('ed-stage');
    const edFilters = $('ed-filters');
    const edBright = $('ed-bright');
    const edContrast = $('ed-contrast');
    const edCropBtn = $('ed-crop');
    const edAutoBtn = $('ed-auto');
    const edFullBtn = $('ed-full');
    const edRotateBtn = $('ed-rotate');
    const edApplyAll = $('ed-apply-all');
    const edDone = $('ed-done');
    const edCropTools = $('ed-crop-tools');
    const edLooks = $('ed-looks');

    let pages = [];          // { id, file, name, rotation, base: canvas, corners, filter, brightness, contrast }
    let nextId = 1;
    let cameraCount = 0;
    let stream = null;
    let busy = false;

    function ctx2d(canvas, readback) {
      return canvas.getContext('2d', readback ? { willReadFrequently: true } : undefined);
    }

    // working copy of the picture (EXIF orientation already applied by the browser), used for previews and edge detection
    function makeBase(img) {
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      const s = Math.min(1, 1100 / Math.max(iw, ih));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(iw * s));
      c.height = Math.max(1, Math.round(ih * s));
      ctx2d(c, true).drawImage(img, 0, 0, c.width, c.height);
      return c;
    }

    function detectFor(base) {
      const s = Math.min(1, 480 / Math.max(base.width, base.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(base.width * s));
      c.height = Math.max(1, Math.round(base.height * s));
      const x = ctx2d(c, true);
      x.drawImage(base, 0, 0, c.width, c.height);
      try { return seDetectCorners(x.getImageData(0, 0, c.width, c.height)); }
      catch (e) { return { found: false, corners: seFullFrame() }; }
    }

    function cornersPx(corners, w, h) { return corners.map((p) => ({ x: p.x * w, y: p.y * h })); }

    // straightened page (no filter) from the working copy, limited to maxSide pixels on the long side
    function warpedBase(page, maxSide) {
      const bx = ctx2d(page.base, true);
      const src = bx.getImageData(0, 0, page.base.width, page.base.height);
      const px = cornersPx(page.corners, page.base.width, page.base.height);
      const sz = seQuadSize(px, maxSide);
      return seWarp(src, px, sz.w, sz.h);
    }

    function imgToCanvas(im, rotation) {
      const c = document.createElement('canvas');
      const dims = scpdfRotatedSize(im.width, im.height, rotation);
      const tmp = document.createElement('canvas');
      tmp.width = im.width; tmp.height = im.height;
      ctx2d(tmp).putImageData(new ImageData(im.data, im.width, im.height), 0, 0);
      c.width = dims.w; c.height = dims.h;
      const x = ctx2d(c);
      x.translate(c.width / 2, c.height / 2);
      x.rotate(rotation * Math.PI / 180);
      x.drawImage(tmp, -im.width / 2, -im.height / 2);
      tmp.width = tmp.height = 0;
      return c;
    }

    // finished look of a page as a canvas (crop + filter + brightness/contrast + rotation)
    function renderPage(page, maxSide) {
      const im = warpedBase(page, maxSide);
      seApplyFilter(im, page.filter);
      seAdjust(im, page.brightness, page.contrast);
      return imgToCanvas(im, page.rotation);
    }

    function paintThumb(canvas, page) {
      const r = renderPage(page, 420);
      canvas.width = r.width; canvas.height = r.height;
      ctx2d(canvas).drawImage(r, 0, 0);
      r.width = r.height = 0;
    }

    function render() {
      const has = pages.length > 0;
      workspace.classList.toggle('hidden', !has);
      dropzone.classList.toggle('hidden', has);
      countText.textContent = `${pages.length} page${pages.length === 1 ? '' : 's'}`;
      grid.textContent = '';
      pages.forEach((p, i) => {
        const card = document.createElement('div');
        card.className = 'scn-card';
        card.innerHTML = `
          <span class="scn-num">${i + 1}</span>
          <canvas class="scn-thumb" role="img" aria-label="Page ${i + 1}: ${escapeHtml(p.name)}" data-act="edit"></canvas>
          <div class="scn-tools">
            <button type="button" class="scn-icon" data-act="left" aria-label="Move page ${i + 1} earlier"${i === 0 ? ' disabled' : ''}><i class="fa-solid fa-chevron-left"></i></button>
            <button type="button" class="scn-icon" data-act="edit" aria-label="Crop and enhance page ${i + 1}"><i class="fa-solid fa-wand-magic-sparkles"></i></button>
            <button type="button" class="scn-icon" data-act="rotate" aria-label="Rotate page ${i + 1}"><i class="fa-solid fa-rotate-right"></i></button>
            <button type="button" class="scn-icon" data-act="delete" aria-label="Delete page ${i + 1}"><i class="fa-solid fa-trash"></i></button>
            <button type="button" class="scn-icon" data-act="right" aria-label="Move page ${i + 1} later"${i === pages.length - 1 ? ' disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button>
          </div>`;
        card.dataset.id = String(p.id);
        grid.appendChild(card);
        paintThumb(card.querySelector('canvas'), p);
      });
      createBtn.disabled = busy || !has;
    }

    async function addFiles(files) {
      const images = files.filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(f.name));
      if (images.length < files.length) showToast('Some files were skipped because they are not images.', 'warning');
      const failed = [];
      for (const file of images) {
        if (pages.length >= SCPDF_MAX_PAGES) { showToast(`A scan can have up to ${SCPDF_MAX_PAGES} pages. Extra images were not added.`, 'warning'); break; }
        try {
          const img = await loadImageFile(file);
          const base = makeBase(img);
          img.src = '';
          const det = autoCrop.checked ? detectFor(base) : { found: false, corners: seFullFrame() };
          pages.push({ id: nextId++, file, name: file.name, rotation: 0, base, corners: det.corners, filter: filterSelect.value, brightness: 0, contrast: 0 });
        } catch (err) {
          failed.push(file.name);
        }
      }
      if (failed.length) showToast(`Could not read: ${failed.join(', ')}. The format may not be supported by this browser (for example HEIC). Convert it to JPG first.`, 'error');
      render();
    }

    setupDropzone(dropzone, fileInput, addFiles);
    chooseBtn.addEventListener('click', () => fileInput.click());
    photoBtn.addEventListener('click', () => captureInput.click());
    captureInput.addEventListener('change', () => {
      const files = Array.from(captureInput.files || []);
      captureInput.value = '';
      if (files.length) addFiles(files);
    });

    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn || busy) return;
      const card = btn.closest('.scn-card');
      const idx = pages.findIndex(p => String(p.id) === card.dataset.id);
      if (idx < 0) return;
      const act = btn.dataset.act;
      if (act === 'edit') { openEditor(idx); return; }
      if (act === 'left') pages = scpdfMove(pages, idx, -1);
      else if (act === 'right') pages = scpdfMove(pages, idx, 1);
      else if (act === 'rotate') pages[idx].rotation = scpdfNextRotation(pages[idx].rotation, 90);
      else if (act === 'delete') pages.splice(idx, 1);
      render();
    });

    // the default look: sets the look of every page
    filterSelect.addEventListener('change', () => { pages.forEach((p) => { p.filter = filterSelect.value; }); render(); });
    clearBtn.addEventListener('click', () => { if (busy) return; pages = []; render(); });

    // ----- page editor: look, brightness / contrast, crop with four corners -----
    let ed = null;   // { page, cropMode, corners (working copy while cropping), drag, strip }
    const HANDLE_HIT = 30;

    function fillFilterStrip(page) {
      const small = warpedBase(page, 120);
      edFilters.textContent = '';
      SE_FILTERS.forEach((f) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'scn-look' + (page.filter === f.id ? ' scn-look-on' : '');
        b.dataset.filter = f.id;
        b.setAttribute('aria-label', 'Look: ' + f.label);
        const c = document.createElement('canvas');
        const copy = { data: new Uint8ClampedArray(small.data), width: small.width, height: small.height };
        seApplyFilter(copy, f.id);
        c.width = copy.width; c.height = copy.height;
        ctx2d(c).putImageData(new ImageData(copy.data, copy.width, copy.height), 0, 0);
        const span = document.createElement('span');
        span.textContent = f.label;
        b.appendChild(c); b.appendChild(span);
        edFilters.appendChild(b);
      });
    }

    function paintEditor() {
      if (!ed) return;
      const page = ed.page;
      if (ed.cropMode) {
        // show the whole picture with the four corner handles
        const s = Math.min(1, 900 / Math.max(page.base.width, page.base.height));
        edCanvas.width = Math.round(page.base.width * s); edCanvas.height = Math.round(page.base.height * s);
        ctx2d(edCanvas).drawImage(page.base, 0, 0, edCanvas.width, edCanvas.height);
        edOverlay.width = edCanvas.width; edOverlay.height = edCanvas.height;
        drawCropOverlay();
      } else {
        const r = renderPage(page, 900);
        edCanvas.width = r.width; edCanvas.height = r.height;
        ctx2d(edCanvas).drawImage(r, 0, 0);
        r.width = r.height = 0;
        edOverlay.width = edCanvas.width; edOverlay.height = edCanvas.height;
        ctx2d(edOverlay).clearRect(0, 0, edOverlay.width, edOverlay.height);
      }
    }

    function drawCropOverlay() {
      const w = edOverlay.width, h = edOverlay.height, x = ctx2d(edOverlay);
      x.clearRect(0, 0, w, h);
      const pts = ed.corners.map((p) => ({ x: p.x * w, y: p.y * h }));
      x.fillStyle = 'rgba(15,23,42,0.55)';
      x.beginPath(); x.rect(0, 0, w, h);
      x.moveTo(pts[0].x, pts[0].y);
      for (let i = 3; i >= 0; i--) x.lineTo(pts[i].x, pts[i].y);
      x.closePath(); x.fill('evenodd');
      x.strokeStyle = '#22d3ee'; x.lineWidth = Math.max(2, w / 300);
      x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y))); x.closePath(); x.stroke();
      const r = Math.max(9, w / 55);
      pts.forEach((p) => {
        x.fillStyle = '#fff'; x.strokeStyle = '#0891b2'; x.lineWidth = Math.max(3, w / 240);
        x.beginPath(); x.arc(p.x, p.y, r, 0, Math.PI * 2); x.fill(); x.stroke();
      });
    }

    function setCropMode(on) {
      ed.cropMode = on;
      edCropTools.classList.toggle('hidden', !on);
      edLooks.classList.toggle('hidden', on);
      edCropBtn.innerHTML = on ? '<i class="fa-solid fa-check"></i> Apply crop' : '<i class="fa-solid fa-crop-simple"></i> Crop';
      edRotateBtn.disabled = on;
      if (on) ed.corners = ed.page.corners.map((p) => ({ x: p.x, y: p.y }));
      else { fillFilterStrip(ed.page); }
      paintEditor();
    }

    function openEditor(idx) {
      const page = pages[idx];
      ed = { page, cropMode: false, corners: null, drag: -1 };
      edTitle.textContent = `Page ${idx + 1}`;
      edBright.value = String(page.brightness);
      edContrast.value = String(page.contrast);
      editor.classList.remove('hidden');
      document.body.classList.add('scn-noscroll');
      setCropMode(false);
      edDone.focus();
    }

    function closeEditor() {
      if (!ed) return;
      if (ed.cropMode) applyCrop();
      ed = null;
      editor.classList.add('hidden');
      document.body.classList.remove('scn-noscroll');
      render();
    }

    function applyCrop() {
      if (!ed || !ed.cropMode) return;
      if (!seIsConvex(ed.corners.map((p) => ({ x: p.x * 100, y: p.y * 100 })))) {
        showToast('The four corners cross each other. Move them so they outline the page.', 'warning');
        return false;
      }
      ed.page.corners = ed.corners.map((p) => ({ x: p.x, y: p.y }));
      return true;
    }

    edCropBtn.addEventListener('click', () => {
      if (!ed) return;
      if (ed.cropMode) { if (applyCrop()) setCropMode(false); }
      else setCropMode(true);
    });
    edAutoBtn.addEventListener('click', () => {
      if (!ed || !ed.cropMode) return;
      const det = detectFor(ed.page.base);
      ed.corners = det.corners.map((p) => ({ x: p.x, y: p.y }));
      if (!det.found) showToast('No clear page edges were found. Drag the corners to outline the page.', 'info');
      paintEditor();
    });
    edFullBtn.addEventListener('click', () => {
      if (!ed || !ed.cropMode) return;
      ed.corners = seFullFrame();
      paintEditor();
    });
    edRotateBtn.addEventListener('click', () => {
      if (!ed || ed.cropMode) return;
      ed.page.rotation = scpdfNextRotation(ed.page.rotation, 90);
      paintEditor();
    });
    edDone.addEventListener('click', closeEditor);
    editor.addEventListener('click', (e) => { if (e.target === editor) closeEditor(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ed) closeEditor(); });

    edFilters.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-filter]');
      if (!b || !ed) return;
      ed.page.filter = b.dataset.filter;
      edFilters.querySelectorAll('.scn-look').forEach((x) => x.classList.toggle('scn-look-on', x === b));
      paintEditor();
    });
    let sliderTimer = null;
    function onSlider() {
      if (!ed) return;
      ed.page.brightness = parseInt(edBright.value, 10) || 0;
      ed.page.contrast = parseInt(edContrast.value, 10) || 0;
      clearTimeout(sliderTimer);
      sliderTimer = setTimeout(paintEditor, 40);
    }
    edBright.addEventListener('input', onSlider);
    edContrast.addEventListener('input', onSlider);
    $('ed-reset').addEventListener('click', () => { edBright.value = '0'; edContrast.value = '0'; onSlider(); });
    edApplyAll.addEventListener('click', () => {
      if (!ed) return;
      const src = ed.page;
      pages.forEach((p) => { p.filter = src.filter; p.brightness = src.brightness; p.contrast = src.contrast; });
      filterSelect.value = SE_FILTERS.some((f) => f.id === src.filter) ? src.filter : filterSelect.value;
      showToast('This look was applied to all pages.', 'success');
    });

    // dragging the corner handles (mouse, touch and pen)
    function pointerPos(e) {
      const r = edOverlay.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, rw: r.width, rh: r.height };
    }
    edOverlay.addEventListener('pointerdown', (e) => {
      if (!ed || !ed.cropMode) return;
      const p = pointerPos(e);
      let best = -1, bd = Infinity;
      ed.corners.forEach((c, i) => {
        const d = Math.hypot((c.x - p.x) * p.rw, (c.y - p.y) * p.rh);
        if (d < bd) { bd = d; best = i; }
      });
      if (bd <= HANDLE_HIT * 1.6) {
        ed.drag = best;
        edOverlay.setPointerCapture(e.pointerId);
        e.preventDefault();
      }
    });
    edOverlay.addEventListener('pointermove', (e) => {
      if (!ed || ed.drag < 0) return;
      const p = pointerPos(e);
      ed.corners[ed.drag] = { x: Math.max(0, Math.min(1, p.x)), y: Math.max(0, Math.min(1, p.y)) };
      drawCropOverlay();
    });
    const endDrag = () => { if (ed) ed.drag = -1; };
    edOverlay.addEventListener('pointerup', endDrag);
    edOverlay.addEventListener('pointercancel', endDrag);

    // ----- live camera -----
    function stopCamera() {
      if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
      video.srcObject = null;
      cameraPanel.classList.add('hidden');
    }

    cameraBtn.addEventListener('click', async () => {
      if (stream) return;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('Live camera is not available here (it needs a secure https page and a supported browser). Use "Take photo" or "Choose images" instead.', 'warning');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1440 } }, audio: false });
        video.srcObject = stream;
        await video.play();
        cameraPanel.classList.remove('hidden');
        cameraStatus.textContent = 'Camera is on. Point it at the page and press Capture.';
      } catch (err) {
        stopCamera();
        if (err && err.name === 'NotAllowedError') showToast('Camera permission was denied. Allow camera access in your browser settings, or use "Take photo" / "Choose images".', 'error');
        else if (err && err.name === 'NotFoundError') showToast('No camera was found on this device.', 'error');
        else showToast('The camera could not be started. Try "Take photo" or "Choose images" instead.', 'error');
      }
    });

    closeCameraBtn.addEventListener('click', stopCamera);
    window.addEventListener('pagehide', stopCamera);

    snapBtn.addEventListener('click', async () => {
      if (!stream || !video.videoWidth) { showToast('The camera is not ready yet. Wait a moment and try again.', 'warning'); return; }
      const c = document.createElement('canvas');
      c.width = video.videoWidth;
      c.height = video.videoHeight;
      ctx2d(c).drawImage(video, 0, 0, c.width, c.height);
      const blob = await canvasToBlob(c, 'image/jpeg', 0.92);
      c.width = c.height = 0;
      if (!blob) { showToast('Could not capture the picture.', 'error'); return; }
      cameraCount++;
      await addFiles([new File([blob], `camera-${cameraCount}.jpg`, { type: 'image/jpeg' })]);
      cameraStatus.textContent = `Captured. ${pages.length} page${pages.length === 1 ? '' : 's'} so far. Press Capture for the next page or Close camera when done.`;
    });

    // ----- build the PDF, one page at a time -----
    async function buildPdf(format) {
      const maxSide = parseInt(qualitySelect.value, 10) || 2000;
      const jpegQuality = maxSide >= 3000 ? 0.9 : 0.82;
      const margin = parseInt(marginSelect.value, 10) || 0;
      const asImage = format === 'jpg' || format === 'png';
      const images = [];
      const pdfDoc = asImage ? null : await PDFLib.PDFDocument.create();
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        progress.textContent = `Processing page ${i + 1} of ${pages.length}...`;
        let img;
        try { img = await loadImageFile(p.file); }
        catch (err) { throw new Error(`Could not read ${p.name}.`); }
        const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
        // source copy for cutting out the page (kept below 3500 px so memory stays reasonable)
        const s = Math.min(1, 3500 / Math.max(iw, ih));
        const src = document.createElement('canvas');
        src.width = Math.max(1, Math.round(iw * s)); src.height = Math.max(1, Math.round(ih * s));
        const sx = ctx2d(src, true);
        sx.drawImage(img, 0, 0, src.width, src.height);
        img.src = '';
        let work;
        if (seIsFullFrame(p.corners)) {
          const out = scpdfOutputSize(iw, ih, maxSide);
          const c = document.createElement('canvas');
          c.width = out.w; c.height = out.h;
          const cx = ctx2d(c, true);
          cx.drawImage(src, 0, 0, out.w, out.h);
          work = cx.getImageData(0, 0, out.w, out.h);
          c.width = c.height = 0;
        } else {
          const px = cornersPx(p.corners, src.width, src.height);
          const sz = seQuadSize(px, maxSide);
          const o = scpdfOutputSize(sz.w, sz.h, maxSide);
          work = seWarp(sx.getImageData(0, 0, src.width, src.height), px, o.w, o.h);
        }
        src.width = src.height = 0;
        seApplyFilter(work, p.filter);
        seAdjust(work, p.brightness, p.contrast);
        const canvas = imgToCanvas(work, p.rotation);
        const blob = asImage
          ? await canvasToBlob(canvas, format === 'png' ? 'image/png' : 'image/jpeg', 0.93)
          : await canvasToBlob(canvas, 'image/jpeg', jpegQuality);
        const outW = canvas.width, outH = canvas.height;
        canvas.width = canvas.height = 0;
        if (!blob) throw new Error(`Could not process ${p.name}.`);
        if (asImage) { images.push({ blob, name: p.name }); await new Promise(r => setTimeout(r, 0)); continue; }
        const jpg = await pdfDoc.embedJpg(new Uint8Array(await blob.arrayBuffer()));
        const L = scpdfLayout(outW, outH, sizeSelect.value, margin);
        const page = pdfDoc.addPage([L.pageW, L.pageH]);
        page.drawImage(jpg, { x: L.x, y: L.y, width: L.w, height: L.h });
        await new Promise(r => setTimeout(r, 0));
      }
      return asImage ? images : pdfDoc.save();
    }

    function updateFormatUi() {
      const img = formatSelect.value !== 'pdf';
      document.querySelectorAll('.scn-pdf-only').forEach((l) => { if (l.parentElement) l.parentElement.hidden = img; });
      createBtn.innerHTML = img ? '<i class="fa-solid fa-image"></i> Save enhanced image' : '<i class="fa-solid fa-file-pdf"></i> Create PDF';
    }
    formatSelect.addEventListener('change', updateFormatUi);
    updateFormatUi();

    createBtn.addEventListener('click', async () => {
      if (busy || !pages.length) return;
      const format = formatSelect.value;
      if (format === 'pdf' && typeof PDFLib === 'undefined') {
        showToast('The PDF library could not be loaded. Please check your internet connection and reload.', 'error');
        return;
      }
      busy = true;
      createBtn.disabled = true;
      createBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Working...';
      try {
        const result = await buildPdf(format);
        if (format === 'pdf') {
          downloadBlob(new Blob([result], { type: 'application/pdf' }), scpdfOutputName(pages[0].name));
          showToast('Your scan PDF is ready.', 'success');
        } else {
          const ext = format === 'png' ? 'png' : 'jpg';
          if (result.length === 1) {
            downloadBlob(result[0].blob, scpdfImageName(result[0].name, 0, 1, ext));
          } else {
            const files = [];
            for (let i = 0; i < result.length; i++) {
              files.push({ name: scpdfImageName(result[i].name, i, result.length, ext), data: new Uint8Array(await result[i].blob.arrayBuffer()) });
            }
            downloadBlob(scpdfZip(files), 'fixlytools-scans.zip');
          }
          showToast(result.length > 1 ? 'Your enhanced images are ready (ZIP).' : 'Your enhanced image is ready.', 'success');
        }
      } catch (err) {
        console.error(err);
        showToast(err && err.message ? err.message + ' Remove that page and try again.' : 'Could not create the file. Please try again.', 'error');
      } finally {
        busy = false;
        progress.textContent = '';
        updateFormatUi();
        createBtn.disabled = pages.length === 0;
      }
    });

    render();
  });
}
