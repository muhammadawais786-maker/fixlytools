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
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const captureInput = document.getElementById('capture-input');
    const chooseBtn = document.getElementById('choose-btn');
    const photoBtn = document.getElementById('photo-btn');
    const cameraBtn = document.getElementById('camera-btn');
    const cameraPanel = document.getElementById('camera-panel');
    const video = document.getElementById('camera-video');
    const snapBtn = document.getElementById('snap-btn');
    const closeCameraBtn = document.getElementById('close-camera-btn');
    const cameraStatus = document.getElementById('camera-status');
    const workspace = document.getElementById('workspace');
    const grid = document.getElementById('page-grid');
    const countText = document.getElementById('page-count');
    const filterSelect = document.getElementById('opt-filter');
    const sizeSelect = document.getElementById('opt-size');
    const marginSelect = document.getElementById('opt-margin');
    const qualitySelect = document.getElementById('opt-quality');
    const clearBtn = document.getElementById('clear-btn');
    const createBtn = document.getElementById('create-btn');
    const progress = document.getElementById('progress-text');

    let pages = [];          // { id, file, name, rotation, base: canvas }
    let nextId = 1;
    let cameraCount = 0;
    let stream = null;
    let busy = false;

    function ctx2d(canvas, readback) {
      return canvas.getContext('2d', readback ? { willReadFrequently: true } : undefined);
    }

    // small copy of the picture (EXIF orientation already applied by the browser) used for the page cards
    function makeBase(img) {
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      const s = Math.min(1, (SCPDF_THUMB * 2) / Math.max(iw, ih));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(iw * s));
      c.height = Math.max(1, Math.round(ih * s));
      ctx2d(c).drawImage(img, 0, 0, c.width, c.height);
      return c;
    }

    function paintThumb(canvas, page) {
      const rot = page.rotation;
      const dims = scpdfRotatedSize(page.base.width, page.base.height, rot);
      const s = Math.min(1, SCPDF_THUMB / Math.max(dims.w, dims.h));
      canvas.width = Math.max(1, Math.round(dims.w * s));
      canvas.height = Math.max(1, Math.round(dims.h * s));
      const ctx = ctx2d(canvas, true);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rot * Math.PI / 180);
      const dw = Math.round(page.base.width * s), dh = Math.round(page.base.height * s);
      ctx.drawImage(page.base, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
      const mode = filterSelect.value;
      if (mode !== 'original') {
        const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
        scpdfApplyFilter(id.data, id.width, id.height, mode);
        ctx.putImageData(id, 0, 0);
      }
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
          <canvas class="scn-thumb" role="img" aria-label="Page ${i + 1}: ${escapeHtml(p.name)}"></canvas>
          <div class="scn-tools">
            <button type="button" class="scn-icon" data-act="left" aria-label="Move page ${i + 1} earlier"${i === 0 ? ' disabled' : ''}><i class="fa-solid fa-chevron-left"></i></button>
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
          pages.push({ id: nextId++, file, name: file.name, rotation: 0, base: makeBase(img) });
          img.src = '';
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
      const btn = e.target.closest('button[data-act]');
      if (!btn || busy) return;
      const card = btn.closest('.scn-card');
      const idx = pages.findIndex(p => String(p.id) === card.dataset.id);
      if (idx < 0) return;
      const act = btn.dataset.act;
      if (act === 'left') pages = scpdfMove(pages, idx, -1);
      else if (act === 'right') pages = scpdfMove(pages, idx, 1);
      else if (act === 'rotate') pages[idx].rotation = scpdfNextRotation(pages[idx].rotation, 90);
      else if (act === 'delete') pages.splice(idx, 1);
      render();
    });

    filterSelect.addEventListener('change', render);
    clearBtn.addEventListener('click', () => { if (busy) return; pages = []; render(); });

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
    async function buildPdf() {
      const mode = filterSelect.value;
      const maxSide = parseInt(qualitySelect.value, 10) || 2000;
      const jpegQuality = maxSide >= 3000 ? 0.9 : 0.82;
      const margin = parseInt(marginSelect.value, 10) || 0;
      const pdfDoc = await PDFLib.PDFDocument.create();
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        progress.textContent = `Processing page ${i + 1} of ${pages.length}...`;
        let img;
        try { img = await loadImageFile(p.file); }
        catch (err) { throw new Error(`Could not read ${p.name}.`); }
        const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
        const rotated = p.rotation % 180 !== 0;
        const src = scpdfRotatedSize(iw, ih, p.rotation);
        const out = scpdfOutputSize(src.w, src.h, maxSide);
        const canvas = document.createElement('canvas');
        canvas.width = out.w;
        canvas.height = out.h;
        const ctx = ctx2d(canvas, true);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, out.w, out.h);
        ctx.save();
        ctx.translate(out.w / 2, out.h / 2);
        ctx.rotate(p.rotation * Math.PI / 180);
        const dw = rotated ? out.h : out.w, dh = rotated ? out.w : out.h;
        ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
        ctx.restore();
        img.src = '';
        if (mode !== 'original') {
          const id = ctx.getImageData(0, 0, out.w, out.h);
          scpdfApplyFilter(id.data, out.w, out.h, mode);
          ctx.putImageData(id, 0, 0);
        }
        const blob = await canvasToBlob(canvas, 'image/jpeg', jpegQuality);
        canvas.width = canvas.height = 0;
        if (!blob) throw new Error(`Could not process ${p.name}.`);
        const jpg = await pdfDoc.embedJpg(new Uint8Array(await blob.arrayBuffer()));
        const L = scpdfLayout(out.w, out.h, sizeSelect.value, margin);
        const page = pdfDoc.addPage([L.pageW, L.pageH]);
        page.drawImage(jpg, { x: L.x, y: L.y, width: L.w, height: L.h });
        await new Promise(r => setTimeout(r, 0));
      }
      return pdfDoc.save();
    }

    createBtn.addEventListener('click', async () => {
      if (busy || !pages.length) return;
      if (typeof PDFLib === 'undefined') {
        showToast('The PDF library could not be loaded. Please check your internet connection and reload.', 'error');
        return;
      }
      busy = true;
      createBtn.disabled = true;
      createBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating PDF...';
      try {
        const bytes = await buildPdf();
        downloadBlob(new Blob([bytes], { type: 'application/pdf' }), scpdfOutputName(pages[0].name));
        showToast('Your scan PDF is ready.', 'success');
      } catch (err) {
        console.error(err);
        showToast(err && err.message ? err.message + ' Remove that page and try again.' : 'Could not create the PDF. Please try again.', 'error');
      } finally {
        busy = false;
        progress.textContent = '';
        createBtn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Create PDF';
        createBtn.disabled = pages.length === 0;
      }
    });

    render();
  });
}
