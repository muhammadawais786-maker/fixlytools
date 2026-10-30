// Fixlytools - Blur Image / Hide Faces (canvas only, runs in the browser)
// You choose the areas by hand. Nothing here detects faces or text automatically.
// Areas are stored in 0..1 units, so the small preview and the full-size download match.

function blurimgClamp01(v) {
  const n = Number(v);
  if (!isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

function blurimgCanvasSize(w, h, maxSide, maxPixels) {
  const side = maxSide || 8000;
  const pixels = maxPixels || 16000000;
  const scale = Math.min(1, side / Math.max(w, h), Math.sqrt(pixels / (w * h)));
  if (scale >= 1) return { width: w, height: h, scaled: false };
  return { width: Math.max(1, Math.floor(w * scale)), height: Math.max(1, Math.floor(h * scale)), scaled: true };
}

// Two corners (0..1 units, any order) -> ordered rectangle. Returns null when it is too small to be on purpose.
function blurimgNormRect(x0, y0, x1, y1, minSize) {
  const min = minSize === undefined ? 0.01 : minSize;
  const ax = blurimgClamp01(Math.min(x0, x1));
  const bx = blurimgClamp01(Math.max(x0, x1));
  const ay = blurimgClamp01(Math.min(y0, y1));
  const by = blurimgClamp01(Math.max(y0, y1));
  if (bx - ax < min || by - ay < min) return null;
  return { x: ax, y: ay, w: bx - ax, h: by - ay };
}

// Blur radius in pixels for strength 1..100 on a picture whose shorter side is unit pixels.
function blurimgBlurRadius(strength, unit) {
  const s = Math.min(100, Math.max(1, Number(strength) || 1));
  return Math.max(2, Math.round((s / 100) * 0.06 * unit));
}

// Size of the mosaic squares, in pixels.
function blurimgBlockSize(strength, unit) {
  const s = Math.min(100, Math.max(1, Number(strength) || 1));
  return Math.max(3, Math.round((s / 100) * 0.08 * unit));
}

// Short plain-English hint for the strength slider.
function blurimgStrengthHint(strength, mode) {
  if (mode === 'solid') return 'A solid box hides everything underneath it.';
  const s = Number(strength) || 0;
  if (s < 40) return 'Low strength: small text and faces may still be recognisable. Increase it until nothing can be made out.';
  if (s < 70) return 'Medium strength: fine for backgrounds. For faces, plates or text, use a high strength.';
  return 'High strength: best for hiding faces, number plates and text.';
}

// Mosaic: every block x block square is replaced by its average colour. Changes data in place.
function blurimgPixelate(data, w, h, block) {
  const b = Math.max(1, Math.floor(block));
  if (b < 2) return;
  for (let by = 0; by < h; by += b) {
    for (let bx = 0; bx < w; bx += b) {
      const x1 = Math.min(w, bx + b);
      const y1 = Math.min(h, by + b);
      let r = 0; let g = 0; let bl = 0; let a = 0; let n = 0;
      for (let y = by; y < y1; y++) {
        for (let x = bx; x < x1; x++) {
          const i = (y * w + x) * 4;
          r += data[i]; g += data[i + 1]; bl += data[i + 2]; a += data[i + 3]; n++;
        }
      }
      r = Math.round(r / n); g = Math.round(g / n); bl = Math.round(bl / n); a = Math.round(a / n);
      for (let y = by; y < y1; y++) {
        for (let x = bx; x < x1; x++) {
          const i = (y * w + x) * 4;
          data[i] = r; data[i + 1] = g; data[i + 2] = bl; data[i + 3] = a;
        }
      }
    }
  }
}

function blurimgBlurPass(src, dst, w, h, r, horizontal) {
  const len = horizontal ? w : h;
  const lines = horizontal ? h : w;
  const stride = horizontal ? 4 : w * 4;
  const lineStep = horizontal ? w * 4 : 4;
  const win = 2 * r + 1;
  const edge = (i) => (i < 0 ? 0 : i > len - 1 ? len - 1 : i);
  for (let line = 0; line < lines; line++) {
    const base = line * lineStep;
    for (let ch = 0; ch < 4; ch++) {
      let sum = 0;
      for (let i = -r; i <= r; i++) sum += src[base + edge(i) * stride + ch];
      for (let i = 0; i < len; i++) {
        dst[base + i * stride + ch] = sum / win;
        sum += src[base + edge(i + r + 1) * stride + ch] - src[base + edge(i - r) * stride + ch];
      }
    }
  }
}

// Soft blur: three box-blur passes in each direction. Changes data in place.
function blurimgBoxBlur(data, w, h, radius) {
  const r = Math.floor(radius);
  if (!(r >= 1) || w < 1 || h < 1) return;
  let a = new Uint8ClampedArray(data);
  let b = new Uint8ClampedArray(data.length);
  for (let pass = 0; pass < 3; pass++) {
    blurimgBlurPass(a, b, w, h, r, true);
    blurimgBlurPass(b, a, w, h, r, false);
  }
  data.set(a);
}

// Box that contains a region (0..1 units). Brush regions include half the brush width on every side.
// region: { shape: 'rect', x, y, w, h } or { shape: 'brush', size, points: [{x,y}] } (size is a fraction of the shorter side)
function blurimgRegionBounds(region, W, H) {
  const unit = Math.min(W, H);
  let x0; let y0; let x1; let y1;
  if (region.shape === 'rect') {
    x0 = region.x * W; y0 = region.y * H; x1 = (region.x + region.w) * W; y1 = (region.y + region.h) * H;
  } else {
    const half = (region.size * unit) / 2;
    x0 = Infinity; y0 = Infinity; x1 = -Infinity; y1 = -Infinity;
    region.points.forEach(p => {
      x0 = Math.min(x0, p.x * W - half); x1 = Math.max(x1, p.x * W + half);
      y0 = Math.min(y0, p.y * H - half); y1 = Math.max(y1, p.y * H + half);
    });
  }
  // the small offset stops floating point noise (e.g. 300.00000000000006) from adding a stray pixel
  const left = Math.max(0, Math.floor(x0 + 1e-6));
  const top = Math.max(0, Math.floor(y0 + 1e-6));
  const right = Math.min(W, Math.ceil(x1 - 1e-6));
  const bottom = Math.min(H, Math.ceil(y1 - 1e-6));
  if (right <= left || bottom <= top) return null;
  return { x: left, y: top, w: right - left, h: bottom - top };
}

// Draws the shape of a region as white on a transparent canvas, with (offX, offY) as the canvas origin.
function blurimgDrawMask(mctx, region, W, H, offX, offY) {
  const unit = Math.min(W, H);
  mctx.fillStyle = '#ffffff';
  mctx.strokeStyle = '#ffffff';
  if (region.shape === 'rect') {
    mctx.fillRect(region.x * W - offX, region.y * H - offY, region.w * W, region.h * H);
    return;
  }
  const width = Math.max(2, region.size * unit);
  mctx.lineCap = 'round';
  mctx.lineJoin = 'round';
  mctx.lineWidth = width;
  const pts = region.points;
  if (pts.length === 1) {
    mctx.beginPath();
    mctx.arc(pts[0].x * W - offX, pts[0].y * H - offY, width / 2, 0, Math.PI * 2);
    mctx.fill();
    return;
  }
  mctx.beginPath();
  mctx.moveTo(pts[0].x * W - offX, pts[0].y * H - offY);
  for (let i = 1; i < pts.length; i++) mctx.lineTo(pts[i].x * W - offX, pts[i].y * H - offY);
  mctx.stroke();
}

// Applies one region to the picture already drawn on ctx.
// region.mode: 'blur' | 'pixelate' | 'solid', region.strength: 1..100
function blurimgApplyRegion(ctx, region, W, H) {
  const bounds = blurimgRegionBounds(region, W, H);
  if (!bounds) return;
  const unit = Math.min(W, H);

  const mask = document.createElement('canvas');
  const effect = document.createElement('canvas');
  try {
    if (region.mode === 'solid') {
      mask.width = bounds.w;
      mask.height = bounds.h;
      const mctx = mask.getContext('2d');
      blurimgDrawMask(mctx, region, W, H, bounds.x, bounds.y);
      mctx.globalCompositeOperation = 'source-in';
      mctx.fillStyle = '#000000';
      mctx.fillRect(0, 0, bounds.w, bounds.h);
      ctx.drawImage(mask, bounds.x, bounds.y);
      return;
    }

    // blur reads a little outside the area so its edges are not dark or smeared
    const pad = region.mode === 'blur' ? blurimgBlurRadius(region.strength, unit) * 3 : 0;
    const px = Math.max(0, bounds.x - pad);
    const py = Math.max(0, bounds.y - pad);
    const pw = Math.min(W, bounds.x + bounds.w + pad) - px;
    const ph = Math.min(H, bounds.y + bounds.h + pad) - py;

    const id = ctx.getImageData(px, py, pw, ph);
    if (region.mode === 'blur') blurimgBoxBlur(id.data, pw, ph, blurimgBlurRadius(region.strength, unit));
    else blurimgPixelate(id.data, pw, ph, blurimgBlockSize(region.strength, unit));

    effect.width = pw;
    effect.height = ph;
    effect.getContext('2d').putImageData(id, 0, 0);

    mask.width = pw;
    mask.height = ph;
    const mctx = mask.getContext('2d');
    blurimgDrawMask(mctx, region, W, H, px, py);
    mctx.globalCompositeOperation = 'source-in';
    mctx.drawImage(effect, 0, 0);
    ctx.drawImage(mask, px, py);
  } finally {
    mask.width = 0; mask.height = 0; effect.width = 0; effect.height = 0;
  }
}

// Draws the picture and every region. Used for both the preview and the download.
function blurimgRender(ctx, img, W, H, regions, opaque) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (opaque) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); }
  ctx.drawImage(img, 0, 0, W, H);
  regions.forEach(region => blurimgApplyRegion(ctx, region, W, H));
}

function blurimgLoadErrorMessage() {
  return 'This image could not be read. It may be damaged or in a format your browser cannot open. Try a JPG, PNG or WebP file.';
}

if (typeof module !== 'undefined') {
  module.exports = {
    blurimgClamp01, blurimgCanvasSize, blurimgNormRect, blurimgBlurRadius, blurimgBlockSize, blurimgStrengthHint,
    blurimgPixelate, blurimgBoxBlur, blurimgRegionBounds, blurimgLoadErrorMessage, blurimgRender
  };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const workspace = document.getElementById('workspace');
    const imgInfo = document.getElementById('img-info');
    const canvas = document.getElementById('blurimg-canvas');
    const toolSelect = document.getElementById('blurimg-tool');
    const modeSelect = document.getElementById('blurimg-mode');
    const strengthInput = document.getElementById('blurimg-strength');
    const strengthOut = document.getElementById('blurimg-strength-out');
    const hint = document.getElementById('blurimg-hint');
    const brushRow = document.getElementById('blurimg-brush-row');
    const brushSize = document.getElementById('blurimg-brush-size');
    const countText = document.getElementById('blurimg-count');
    const undoBtn = document.getElementById('blurimg-undo');
    const clearBtn = document.getElementById('blurimg-clear');
    const formatSelect = document.getElementById('blurimg-format');
    const sizeNote = document.getElementById('blurimg-size-note');
    const downloadBtn = document.getElementById('blurimg-btn');
    const resetBtn = document.getElementById('reset-btn');
    const BTN_HTML = '<i class="fa-solid fa-download"></i> Download Image';
    const PREVIEW_MAX = 1000;
    const MAX_REGIONS = 100;

    let currentFile = null;
    let image = null;
    let regions = [];
    let work = null;          // canvas holding the picture with all finished regions
    let current = null;       // region being drawn right now
    let start = null;
    let queued = false;

    function updateUi() {
      strengthOut.textContent = strengthInput.value;
      hint.textContent = blurimgStrengthHint(Number(strengthInput.value), modeSelect.value);
      brushRow.classList.toggle('hidden', toolSelect.value !== 'brush');
      strengthInput.disabled = modeSelect.value === 'solid';
      countText.textContent = regions.length + (regions.length === 1 ? ' area hidden' : ' areas hidden');
      undoBtn.disabled = regions.length === 0;
      clearBtn.disabled = regions.length === 0;
    }

    function rebuildWork() {
      if (!image) return;
      if (!work) work = document.createElement('canvas');
      work.width = canvas.width;
      work.height = canvas.height;
      blurimgRender(work.getContext('2d', { willReadFrequently: true }), image, work.width, work.height, regions, false);
    }

    function paint() {
      queued = false;
      if (!image || !work) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(work, 0, 0);
      const W = canvas.width;
      const H = canvas.height;
      if (current) {
        ctx.save();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#10b981';
        ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
        if (current.shape === 'rect') {
          ctx.setLineDash([6, 4]);
          ctx.fillRect(current.x * W, current.y * H, current.w * W, current.h * H);
          ctx.strokeRect(current.x * W, current.y * H, current.w * W, current.h * H);
        } else {
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)';
          ctx.lineWidth = Math.max(2, current.size * Math.min(W, H));
          ctx.beginPath();
          current.points.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x * W, p.y * H); else ctx.lineTo(p.x * W, p.y * H); });
          if (current.points.length === 1) ctx.lineTo(current.points[0].x * W + 0.01, current.points[0].y * H);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    function schedulePaint() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(paint);
    }

    function updateSizeNote() {
      const size = blurimgCanvasSize(image.naturalWidth || image.width, image.naturalHeight || image.height, 8000, 16000000);
      sizeNote.textContent = size.scaled
        ? 'Large image: the download will be scaled down to ' + size.width + ' x ' + size.height + ' px.'
        : 'Download size: ' + size.width + ' x ' + size.height + ' px.';
    }

    async function handleFiles(files) {
      const file = files.find(f => f.type.startsWith('image/'));
      if (!file) { showToast('Please choose an image file (JPG, PNG or WebP).', 'warning'); return; }
      let img;
      try {
        img = await loadImageFile(file);
      } catch (err) {
        showToast(blurimgLoadErrorMessage(), 'error');
        return;
      }
      currentFile = file;
      image = img;
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      const preview = blurimgCanvasSize(iw, ih, PREVIEW_MAX, PREVIEW_MAX * PREVIEW_MAX);
      canvas.width = preview.width;
      canvas.height = preview.height;
      regions = [];
      current = null;
      imgInfo.textContent = file.name + ' (' + formatBytes(file.size) + ', ' + iw + ' x ' + ih + ' px)';
      updateSizeNote();
      updateUi();
      dropzone.classList.add('hidden');
      workspace.classList.remove('hidden');
      rebuildWork();
      paint();
    }

    setupDropzone(dropzone, fileInput, handleFiles);
    [toolSelect, modeSelect, strengthInput].forEach(el => {
      el.addEventListener('input', updateUi);
      el.addEventListener('change', updateUi);
    });

    function pointerToUnits(e) {
      const rect = canvas.getBoundingClientRect();
      return { x: blurimgClamp01((e.clientX - rect.left) / rect.width), y: blurimgClamp01((e.clientY - rect.top) / rect.height) };
    }

    canvas.addEventListener('pointerdown', (e) => {
      if (!image) return;
      if (regions.length >= MAX_REGIONS) { showToast('That is the most areas this tool keeps. Download the image or undo some areas.', 'info'); return; }
      const p = pointerToUnits(e);
      const base = { mode: modeSelect.value, strength: Number(strengthInput.value) };
      if (toolSelect.value === 'brush') {
        current = Object.assign({ shape: 'brush', size: Number(brushSize.value) / 100, points: [p] }, base);
      } else {
        current = Object.assign({ shape: 'rect', x: p.x, y: p.y, w: 0, h: 0 }, base);
        start = p;
      }
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
      schedulePaint();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!current) return;
      const p = pointerToUnits(e);
      if (current.shape === 'brush') {
        if (current.points.length < 5000) current.points.push(p);
      } else {
        current.x = Math.min(start.x, p.x);
        current.y = Math.min(start.y, p.y);
        current.w = Math.abs(p.x - start.x);
        current.h = Math.abs(p.y - start.y);
      }
      schedulePaint();
    });
    function finish() {
      if (!current) return;
      let region = null;
      if (current.shape === 'brush') {
        region = current;
      } else {
        const r = blurimgNormRect(current.x, current.y, current.x + current.w, current.y + current.h, 0.01);
        if (r) region = Object.assign({}, current, r);
      }
      current = null;
      if (region) { regions.push(region); rebuildWork(); updateUi(); }
      schedulePaint();
    }
    canvas.addEventListener('pointerup', finish);
    canvas.addEventListener('pointercancel', finish);

    undoBtn.addEventListener('click', () => {
      if (!regions.length) return;
      regions.pop();
      rebuildWork();
      updateUi();
      schedulePaint();
    });
    clearBtn.addEventListener('click', () => {
      regions = [];
      rebuildWork();
      updateUi();
      schedulePaint();
    });
    canvas.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' || e.key === 'Delete' || (e.key === 'z' && (e.ctrlKey || e.metaKey))) { undoBtn.click(); e.preventDefault(); }
    });

    downloadBtn.addEventListener('click', async () => {
      if (!image) return;
      if (regions.length === 0) {
        showToast('Draw over at least one area first. Nothing is hidden yet.', 'warning');
        return;
      }
      downloadBtn.disabled = true;
      downloadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparing...';
      await new Promise(r => setTimeout(r, 30)); // let the button update before the heavy work
      let out = null;
      try {
        const size = blurimgCanvasSize(image.naturalWidth || image.width, image.naturalHeight || image.height, 8000, 16000000);
        out = document.createElement('canvas');
        out.width = size.width;
        out.height = size.height;
        const type = formatSelect.value === 'image/png' ? 'image/png' : 'image/jpeg';
        blurimgRender(out.getContext('2d', { willReadFrequently: true }), image, size.width, size.height, regions, type === 'image/jpeg');
        const blob = await canvasToBlob(out, type, 0.92);
        if (!blob) { showToast('Could not create the image. Try a smaller picture.', 'error'); return; }
        const ext = blob.type === 'image/jpeg' ? 'jpg' : 'png';
        downloadBlob(blob, 'fixlytools-' + baseName(currentFile.name) + '-blurred.' + ext);
        showToast('Image downloaded. Check that nothing sensitive can still be read. Your original was not changed.', 'success');
      } catch (err) {
        console.error(err);
        showToast('Something went wrong while saving the image. Try a smaller picture.', 'error');
      } finally {
        if (out) { out.width = 0; out.height = 0; }
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = BTN_HTML;
      }
    });

    resetBtn.addEventListener('click', () => {
      currentFile = null;
      image = null;
      regions = [];
      current = null;
      if (work) { work.width = 0; work.height = 0; work = null; }
      canvas.width = 1;
      canvas.height = 1;
      workspace.classList.add('hidden');
      dropzone.classList.remove('hidden');
    });
  });
}
