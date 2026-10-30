// Fixlytools - Crop Image (drag a crop box on the picture, all geometry is in image pixels)

const CRI_MIN = 8;                 // smallest crop side in pixels when dragging
const CRI_MAX_PIXELS = 100000000;  // refuse absurdly large outputs

// ---------- pure geometry (box = { x, y, w, h } in image pixels) ----------

function criClamp(v, lo, hi) {
  return Math.min(Math.max(v, lo), Math.max(lo, hi));
}

// width / height for a preset name, or null for "free"
function criRatio(preset) {
  switch (preset) {
    case '1:1': return 1;
    case '4:3': return 4 / 3;
    case '3:2': return 3 / 2;
    case '16:9': return 16 / 9;
    case 'passport': return 35 / 45;   // 35 x 45 mm photo
    default: return null;
  }
}

// Rounds the box and keeps it fully inside the image
function criClampBox(b, W, H, min) {
  const m = min || 1;
  const w = criClamp(Math.round(b.w), Math.min(m, W), W);
  const h = criClamp(Math.round(b.h), Math.min(m, H), H);
  return { x: criClamp(Math.round(b.x), 0, W - w), y: criClamp(Math.round(b.y), 0, H - h), w, h };
}

// Largest box with the given ratio that fits in the image, centred on (cx, cy) as far as possible
function criBoxForRatio(ratio, W, H, cx, cy) {
  if (!ratio) return { x: 0, y: 0, w: W, h: H };
  const w = Math.min(W, H * ratio);
  const h = w / ratio;
  return criClampBox({ x: cx - w / 2, y: cy - h / 2, w, h }, W, H, 1);
}

function criMove(b, dx, dy, W, H) {
  return { x: criClamp(Math.round(b.x + dx), 0, W - b.w), y: criClamp(Math.round(b.y + dy), 0, H - b.h), w: b.w, h: b.h };
}

// Dragging a handle ('n','s','e','w','ne','nw','se','sw') by (dx, dy) image pixels, starting from box b.
// With a ratio the box keeps its shape; corners stay anchored at the opposite corner, edges grow around the centre of the other axis.
function criResize(b, handle, dx, dy, ratio, W, H, min) {
  const mn = min || CRI_MIN;
  const hasW = handle.includes('w'), hasE = handle.includes('e'), hasN = handle.includes('n'), hasS = handle.includes('s');
  let L = b.x, R = b.x + b.w, T = b.y, B = b.y + b.h;

  if (!ratio) {
    if (hasW) L = criClamp(L + dx, 0, R - mn);
    if (hasE) R = criClamp(R + dx, L + mn, W);
    if (hasN) T = criClamp(T + dy, 0, B - mn);
    if (hasS) B = criClamp(B + dy, T + mn, H);
    return criClampBox({ x: L, y: T, w: R - L, h: B - T }, W, H, 1);
  }

  const minW = Math.max(mn, mn * ratio);
  if ((hasW || hasE) && (hasN || hasS)) {
    const ax = hasE ? L : R, ay = hasS ? T : B;           // the fixed corner
    const sx = hasE ? 1 : -1, sy = hasS ? 1 : -1;
    let w = Math.max(b.w + sx * dx, (b.h + sy * dy) * ratio);
    const maxW = Math.min(sx > 0 ? W - ax : ax, (sy > 0 ? H - ay : ay) * ratio);
    w = criClamp(Math.min(w, maxW), minW, Infinity);
    const h = w / ratio;
    return criClampBox({ x: sx > 0 ? ax : ax - w, y: sy > 0 ? ay : ay - h, w, h }, W, H, 1);
  }
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  if (hasW || hasE) {
    const maxW = Math.min(hasE ? W - L : R, 2 * Math.min(cy, H - cy) * ratio);
    const w = criClamp(Math.min(b.w + (hasE ? dx : -dx), maxW), minW, Infinity);
    const h = w / ratio;
    return criClampBox({ x: hasE ? L : R - w, y: cy - h / 2, w, h }, W, H, 1);
  }
  const maxH = Math.min(hasS ? H - T : B, 2 * Math.min(cx, W - cx) / ratio);
  const h = criClamp(Math.min(b.h + (hasS ? dy : -dy), maxH), minW / ratio, Infinity);
  const w = h * ratio;
  return criClampBox({ x: cx - w / 2, y: hasS ? T : B - h, w, h }, W, H, 1);
}

// Typing a value into the X / Y / width / height boxes. With a ratio, the other side follows.
function criSetField(b, field, value, ratio, W, H) {
  const v = Math.round(Number(value));
  if (!isFinite(v)) return b;
  let { x, y, w, h } = b;
  if (field === 'x') x = v;
  else if (field === 'y') y = v;
  else if (field === 'w') {
    w = criClamp(v, 1, W);
    if (ratio) { h = Math.round(w / ratio); if (h > H) { h = H; w = Math.round(h * ratio); } }
  } else if (field === 'h') {
    h = criClamp(v, 1, H);
    if (ratio) { w = Math.round(h * ratio); if (w > W) { w = W; h = Math.round(w / ratio); } }
  }
  return criClampBox({ x, y, w: Math.max(1, w), h: Math.max(1, h) }, W, H, 1);
}

// Keeps the box on a new image size is not needed; this converts a screen distance to image pixels
function criToImage(screenPx, displayWidth, naturalWidth) {
  return displayWidth > 0 ? screenPx * (naturalWidth / displayWidth) : 0;
}

function criOutputName(original, w, h, ext) {
  const base = String(original || 'image').replace(/\.[^/.]+$/, '') || 'image';
  return `fixlytools-${base}-cropped-${w}x${h}.${ext}`;
}

if (typeof module !== 'undefined') {
  module.exports = { criClamp, criRatio, criClampBox, criBoxForRatio, criMove, criResize, criSetField, criToImage, criOutputName };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const workspace = document.getElementById('workspace');
    const stage = document.getElementById('crop-stage');
    const imgEl = document.getElementById('crop-img');
    const boxEl = document.getElementById('crop-box');
    const aspectSelect = document.getElementById('aspect-select');
    const passportHint = document.getElementById('passport-hint');
    const inputs = { x: document.getElementById('crop-x'), y: document.getElementById('crop-y'), w: document.getElementById('crop-w'), h: document.getElementById('crop-h') };
    const formatSelect = document.getElementById('format-select');
    const qualityWrap = document.getElementById('quality-wrap');
    const qualityRange = document.getElementById('quality-range');
    const qualityValue = document.getElementById('quality-value');
    const outputInfo = document.getElementById('output-info');
    const downloadBtn = document.getElementById('download-btn');
    const resetBtn = document.getElementById('reset-btn');

    let file = null, img = null, previewUrl = null;
    let W = 0, H = 0;
    let box = { x: 0, y: 0, w: 0, h: 0 };
    let drag = null;

    const ratio = () => criRatio(aspectSelect.value);
    const scale = () => (imgEl.clientWidth > 0 && W > 0 ? imgEl.clientWidth / W : 1);

    function paint() {
      const s = scale();
      boxEl.style.left = box.x * s + 'px';
      boxEl.style.top = box.y * s + 'px';
      boxEl.style.width = box.w * s + 'px';
      boxEl.style.height = box.h * s + 'px';
      inputs.x.value = box.x; inputs.y.value = box.y; inputs.w.value = box.w; inputs.h.value = box.h;
      outputInfo.textContent = `Output: ${box.w} × ${box.h} px (original ${W} × ${H} px)`;
    }

    function setBox(b) { box = b; paint(); }

    async function handleFiles(files) {
      const f = files.find(x => /^image\//.test(x.type) || /\.(jpe?g|png|webp|gif|bmp)$/i.test(x.name));
      if (!f) { showToast('Please choose an image file (JPG, PNG or WebP).', 'warning'); return; }
      let loaded;
      try { loaded = await loadImageFile(f); }
      catch (err) { showToast('This image could not be read. It may be damaged or in an unsupported format.', 'error'); return; }
      file = f; img = loaded;
      W = img.naturalWidth || img.width; H = img.naturalHeight || img.height;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(f);
      dropzone.classList.add('hidden');
      workspace.classList.remove('hidden');
      imgEl.onload = () => {
        aspectSelect.value = 'free';
        passportHint.classList.add('hidden');
        const m = Math.round(Math.min(W, H) * 0.1);
        setBox(criClampBox({ x: m, y: m, w: W - 2 * m, h: H - 2 * m }, W, H, 1));
      };
      imgEl.src = previewUrl;
    }

    setupDropzone(dropzone, fileInput, handleFiles);

    // ----- dragging with mouse, pen or finger -----
    boxEl.addEventListener('pointerdown', (e) => {
      if (!W) return;
      e.preventDefault();
      const handle = e.target.dataset ? e.target.dataset.h : null;
      drag = { handle: handle || null, sx: e.clientX, sy: e.clientY, start: Object.assign({}, box), id: e.pointerId };
      try { boxEl.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
    });
    boxEl.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const s = scale();
      const dx = (e.clientX - drag.sx) / s, dy = (e.clientY - drag.sy) / s;
      if (drag.handle) setBox(criResize(drag.start, drag.handle, dx, dy, ratio(), W, H, CRI_MIN));
      else setBox(criMove(drag.start, dx, dy, W, H));
    });
    const endDrag = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
    boxEl.addEventListener('pointerup', endDrag);
    boxEl.addEventListener('pointercancel', endDrag);

    // keyboard: arrows move the box, shift = 10 px
    boxEl.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 10 : 1;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (!d) return;
      e.preventDefault();
      setBox(criMove(box, d[0], d[1], W, H));
    });

    window.addEventListener('resize', () => { if (W) paint(); });

    // ----- numbers and presets -----
    Object.keys(inputs).forEach(k => {
      inputs[k].addEventListener('change', () => { if (W) setBox(criSetField(box, k, inputs[k].value, ratio(), W, H)); });
    });

    aspectSelect.addEventListener('change', () => {
      passportHint.classList.toggle('hidden', aspectSelect.value !== 'passport');
      if (!W) return;
      const r = ratio();
      if (r) setBox(criBoxForRatio(r, W, H, box.x + box.w / 2, box.y + box.h / 2));
    });

    function syncFormat() {
      const jpg = formatSelect.value === 'image/jpeg';
      qualityWrap.classList.toggle('hidden', !jpg);
      qualityValue.textContent = Math.round(qualityRange.value * 100) + '%';
    }
    formatSelect.addEventListener('change', syncFormat);
    qualityRange.addEventListener('input', syncFormat);
    syncFormat();

    downloadBtn.addEventListener('click', async () => {
      if (!img) return;
      if (box.w * box.h > CRI_MAX_PIXELS) { showToast('The crop is too large for this browser. Please choose a smaller area.', 'warning'); return; }
      const canvas = document.createElement('canvas');
      canvas.width = box.w; canvas.height = box.h;
      const ctx = canvas.getContext('2d');
      const type = formatSelect.value;
      if (type === 'image/jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, box.w, box.h); }   // JPG has no transparency
      ctx.drawImage(img, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
      const blob = await canvasToBlob(canvas, type, parseFloat(qualityRange.value));
      canvas.width = canvas.height = 0;
      if (!blob) { showToast('Could not create the cropped image. Try a smaller area.', 'error'); return; }
      const ext = blob.type === 'image/jpeg' ? 'jpg' : 'png';
      downloadBlob(blob, criOutputName(file.name, box.w, box.h, ext));
      showToast('Cropped image downloaded.', 'success');
    });

    resetBtn.addEventListener('click', () => {
      file = null; img = null; W = H = 0;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = null;
      imgEl.removeAttribute('src');
      workspace.classList.add('hidden');
      dropzone.classList.remove('hidden');
    });
  });
}
