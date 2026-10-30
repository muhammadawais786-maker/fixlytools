// Fixlytools - Photo Editor (canvas only, runs in the browser)
// All text, stickers and brush strokes are stored in 0..1 units, so the small preview and the full-size download match.

const PHOTOED_TEXT_FONT = 'system-ui, "Segoe UI", Roboto, Arial, sans-serif';
const PHOTOED_EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

function photoedClamp01(v) {
  const n = Number(v);
  if (!isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

function photoedCanvasSize(w, h, maxSide, maxPixels) {
  const side = maxSide || 8000;
  const pixels = maxPixels || 16000000;
  const scale = Math.min(1, side / Math.max(w, h), Math.sqrt(pixels / (w * h)));
  if (scale >= 1) return { width: w, height: h, scaled: false };
  return { width: Math.max(1, Math.floor(w * scale)), height: Math.max(1, Math.floor(h * scale)), scaled: true };
}

// ---------- orientation (rotate / flip) ----------
// orient = { rot: 0|90|180|270, flip: boolean }. The picture is flipped left-right first (if flip), then turned clockwise by rot.

function photoedOutputSize(iw, ih, rot) {
  return rot % 180 === 0 ? { width: iw, height: ih } : { width: ih, height: iw };
}

// What the user sees after pressing a button, as a new orientation.
// op: 'rotateRight' | 'rotateLeft' | 'flipH' | 'flipV'
function photoedApplyOrientation(orient, op) {
  const rot = orient.rot;
  const flip = orient.flip;
  if (op === 'rotateRight') return { rot: (rot + 90) % 360, flip };
  if (op === 'rotateLeft') return { rot: (rot + 270) % 360, flip };
  if (op === 'flipH') return { rot: (360 - rot) % 360, flip: !flip };
  if (op === 'flipV') return { rot: (540 - rot) % 360, flip: !flip };
  return { rot, flip };
}

// Moves a point (0..1 units, y pointing down) the same way the picture moves for one button press.
function photoedMapPoint(p, op) {
  if (op === 'rotateRight') return { x: 1 - p.y, y: p.x };
  if (op === 'rotateLeft') return { x: p.y, y: 1 - p.x };
  if (op === 'flipH') return { x: 1 - p.x, y: p.y };
  if (op === 'flipV') return { x: p.x, y: 1 - p.y };
  return { x: p.x, y: p.y };
}

// Where a point of the original picture ends up for a given orientation.
function photoedOrientationMap(p, orient) {
  let q = orient.flip ? { x: 1 - p.x, y: p.y } : { x: p.x, y: p.y };
  if (orient.rot === 90) q = { x: 1 - q.y, y: q.x };
  else if (orient.rot === 180) q = { x: 1 - q.x, y: 1 - q.y };
  else if (orient.rot === 270) q = { x: q.y, y: 1 - q.x };
  return q;
}

// ---------- pixel maths (work on ImageData.data) ----------

// opts: { brightness: -100..100, contrast: -100..100, saturation: -100..100, preset: 'none'|'grayscale'|'sepia'|'warm'|'cool' }
function photoedApplyColor(data, opts) {
  const preset = opts.preset || 'none';
  const brightness = Number(opts.brightness) || 0;
  const contrast = Number(opts.contrast) || 0;
  const saturation = Number(opts.saturation) || 0;
  if (preset === 'none' && brightness === 0 && contrast === 0 && saturation === 0) return false;

  const add = brightness * 2.55;
  const c255 = contrast * 2.55;
  const cf = (259 * (c255 + 255)) / (255 * (259 - c255));
  const sat = 1 + saturation / 100;
  const cl = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    if (preset === 'grayscale') {
      r = g = b = 0.299 * r + 0.587 * g + 0.114 * b;
    } else if (preset === 'sepia') {
      const nr = 0.393 * r + 0.769 * g + 0.189 * b;
      const ng = 0.349 * r + 0.686 * g + 0.168 * b;
      const nb = 0.272 * r + 0.534 * g + 0.131 * b;
      r = cl(nr); g = cl(ng); b = cl(nb);
    } else if (preset === 'warm') {
      r = cl(r * 1.08 + 6); g = cl(g * 1.02); b = cl(b * 0.88);
    } else if (preset === 'cool') {
      r = cl(r * 0.88); g = cl(g * 1.02); b = cl(b * 1.08 + 6);
    }

    r = cl(r + add); g = cl(g + add); b = cl(b + add);
    if (contrast !== 0) {
      r = cl(cf * (r - 128) + 128); g = cl(cf * (g - 128) + 128); b = cl(cf * (b - 128) + 128);
    }
    if (saturation !== 0) {
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat;
    }
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
  return true;
}

function photoedBlurPass(src, dst, w, h, r, horizontal) {
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

// Soft blur: three box-blur passes in each direction (close to a Gaussian blur). Changes data in place.
function photoedBoxBlur(data, w, h, radius) {
  const r = Math.floor(radius);
  if (!(r >= 1) || w < 1 || h < 1) return;
  let a = new Uint8ClampedArray(data);
  let b = new Uint8ClampedArray(data.length);
  for (let pass = 0; pass < 3; pass++) {
    photoedBlurPass(a, b, w, h, r, true);
    photoedBlurPass(b, a, w, h, r, false);
  }
  data.set(a);
}

// Slider 0..100 -> blur radius in pixels for a picture whose shorter side is unit pixels.
function photoedBlurRadius(value, unit) {
  const v = Number(value);
  if (!(v > 0)) return 0;
  return Math.max(1, Math.round((Math.min(100, v) / 100) * 0.02 * unit));
}

// ---------- undo ----------
function photoedPushHistory(stack, snapshot, max) {
  const next = stack.concat([snapshot]);
  const limit = max || 40;
  return next.length > limit ? next.slice(next.length - limit) : next;
}

// ---------- hit testing and keyboard ----------
function photoedHitTest(rects, px, py) {
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return r.id;
  }
  return null;
}

function photoedNudge(item, key, big) {
  const step = big ? 0.05 : 0.01;
  let x = item.x;
  let y = item.y;
  if (key === 'ArrowLeft') x -= step;
  else if (key === 'ArrowRight') x += step;
  else if (key === 'ArrowUp') y -= step;
  else if (key === 'ArrowDown') y += step;
  else return null;
  return { x: photoedClamp01(x), y: photoedClamp01(y) };
}

// ---------- drawing ----------
// state: { orient, adj: { brightness, contrast, saturation, blur }, preset, strokes: [{ color, size, points: [{x,y}] }],
//          items: [{ id, kind: 'text'|'emoji', text, color, x, y, size }] }  (sizes are fractions of the shorter side)
function photoedRender(ctx, img, W, H, state, opaque) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (opaque) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); }

  const o = state.orient;
  const dw = o.rot % 180 === 0 ? W : H;
  const dh = o.rot % 180 === 0 ? H : W;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate((o.rot * Math.PI) / 180);
  ctx.scale(o.flip ? -1 : 1, 1);
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();

  const unit = Math.min(W, H);
  const radius = photoedBlurRadius(state.adj.blur, unit);
  const colorOpts = { brightness: state.adj.brightness, contrast: state.adj.contrast, saturation: state.adj.saturation, preset: state.preset };
  const needsColor = state.preset !== 'none' || colorOpts.brightness !== 0 || colorOpts.contrast !== 0 || colorOpts.saturation !== 0;
  if (needsColor || radius > 0) {
    const id = ctx.getImageData(0, 0, W, H);
    if (needsColor) photoedApplyColor(id.data, colorOpts);
    if (radius > 0) photoedBoxBlur(id.data, W, H, radius);
    ctx.putImageData(id, 0, 0);
  }

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  state.strokes.forEach(stroke => {
    const pts = stroke.points;
    if (!pts.length) return;
    const width = Math.max(1, stroke.size * unit);
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.lineWidth = width;
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0].x * W, pts[0].y * H, width / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(pts[0].x * W, pts[0].y * H);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * W, pts[i].y * H);
    ctx.stroke();
  });

  const hits = [];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  state.items.forEach(item => {
    const px = Math.max(6, item.size * unit);
    const cx = item.x * W;
    const cy = item.y * H;
    ctx.save();
    if (item.kind === 'emoji') {
      ctx.font = Math.round(px) + 'px ' + PHOTOED_EMOJI_FONT;
    } else {
      ctx.font = 'bold ' + Math.round(px) + 'px ' + PHOTOED_TEXT_FONT;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = px * 0.12;
      ctx.fillStyle = item.color;
    }
    ctx.fillText(item.text, cx, cy);
    const w = ctx.measureText(item.text).width;
    ctx.restore();
    const h = px * 1.2;
    hits.push({ id: item.id, x: (cx - w / 2) / W, y: (cy - h / 2) / H, w: w / W, h: h / H });
  });
  return hits;
}

function photoedLoadErrorMessage() {
  return 'This image could not be read. It may be damaged or in a format your browser cannot open. Try a JPG, PNG or WebP file.';
}

if (typeof module !== 'undefined') {
  module.exports = {
    photoedClamp01, photoedCanvasSize, photoedOutputSize, photoedApplyOrientation, photoedMapPoint,
    photoedOrientationMap, photoedApplyColor, photoedBoxBlur, photoedBlurRadius, photoedPushHistory,
    photoedHitTest, photoedNudge, photoedLoadErrorMessage, photoedRender
  };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const workspace = document.getElementById('workspace');
    const imgInfo = document.getElementById('img-info');
    const canvas = document.getElementById('photoed-canvas');
    const brightness = document.getElementById('photoed-brightness');
    const contrast = document.getElementById('photoed-contrast');
    const saturation = document.getElementById('photoed-saturation');
    const blur = document.getElementById('photoed-blur');
    const presetSelect = document.getElementById('photoed-preset');
    const rotLeft = document.getElementById('photoed-rot-left');
    const rotRight = document.getElementById('photoed-rot-right');
    const flipH = document.getElementById('photoed-flip-h');
    const flipV = document.getElementById('photoed-flip-v');
    const modeSelect = document.getElementById('photoed-mode');
    const brushColor = document.getElementById('photoed-brush-color');
    const brushSize = document.getElementById('photoed-brush-size');
    const textInput = document.getElementById('photoed-text-input');
    const textColor = document.getElementById('photoed-text-color');
    const textSize = document.getElementById('photoed-text-size');
    const addText = document.getElementById('photoed-add-text');
    const stickers = document.getElementById('photoed-stickers');
    const itemPanel = document.getElementById('photoed-item-panel');
    const itemSmaller = document.getElementById('photoed-item-smaller');
    const itemLarger = document.getElementById('photoed-item-larger');
    const itemDelete = document.getElementById('photoed-item-delete');
    const undoBtn = document.getElementById('photoed-undo');
    const resetAllBtn = document.getElementById('photoed-reset-all');
    const formatSelect = document.getElementById('photoed-format');
    const sizeNote = document.getElementById('photoed-size-note');
    const downloadBtn = document.getElementById('photoed-btn');
    const resetBtn = document.getElementById('reset-btn');
    const BTN_HTML = '<i class="fa-solid fa-download"></i> Download Photo';
    const PREVIEW_MAX = 1000;
    const MAX_ITEMS = 30;
    const MAX_STROKES = 200;
    const STICKERS = [
      ['\u{1F600}', 'Smile'], ['\u{1F602}', 'Laughing'], ['\u{1F60D}', 'Heart eyes'], ['\u{1F60E}', 'Cool face'],
      ['\u2764\uFE0F', 'Heart'], ['\u2B50', 'Star'], ['\u{1F525}', 'Fire'], ['\u{1F44D}', 'Thumbs up'],
      ['\u{1F389}', 'Party popper'], ['\u2705', 'Check mark'], ['\u274C', 'Cross mark'], ['\u{1F4AF}', 'Hundred points']
    ];

    let currentFile = null;
    let image = null;
    let state = null;
    let undoStack = [];
    let committed = '';
    let selectedId = null;
    let nextId = 1;
    let lastHits = [];
    let drag = null;
    let drawing = null;
    let queued = false;

    function freshState() {
      return {
        orient: { rot: 0, flip: false },
        adj: { brightness: 0, contrast: 0, saturation: 0, blur: 0 },
        preset: 'none', strokes: [], items: []
      };
    }
    const snap = () => JSON.stringify(state);

    function syncControls() {
      brightness.value = state.adj.brightness;
      contrast.value = state.adj.contrast;
      saturation.value = state.adj.saturation;
      blur.value = state.adj.blur;
      presetSelect.value = state.preset;
      if (!state.items.some(i => i.id === selectedId)) selectedId = null;
      itemPanel.classList.toggle('hidden', selectedId === null);
      undoBtn.disabled = undoStack.length === 0;
      document.querySelectorAll('.photoed-out').forEach(o => {
        const input = document.getElementById(o.getAttribute('data-for'));
        if (input) o.textContent = input.value;
      });
    }

    // Call after a finished change: remembers the previous state so Undo can go back to it.
    function commit() {
      const now = snap();
      if (now === committed) { syncControls(); return; }
      undoStack = photoedPushHistory(undoStack, committed, 40);
      committed = now;
      syncControls();
      updateSizeNote();
      schedulePaint();
    }

    function ensureCanvasSize() {
      const out = photoedOutputSize(image.naturalWidth || image.width, image.naturalHeight || image.height, state.orient.rot);
      const p = photoedCanvasSize(out.width, out.height, PREVIEW_MAX, PREVIEW_MAX * PREVIEW_MAX);
      if (canvas.width !== p.width || canvas.height !== p.height) { canvas.width = p.width; canvas.height = p.height; }
    }

    function paint() {
      queued = false;
      if (!image) return;
      ensureCanvasSize();
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      lastHits = photoedRender(ctx, image, canvas.width, canvas.height, state, false);
      const sel = lastHits.find(h => h.id === selectedId);
      if (sel) {
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#10b981';
        ctx.strokeRect(sel.x * canvas.width - 4, sel.y * canvas.height - 4, sel.w * canvas.width + 8, sel.h * canvas.height + 8);
        ctx.restore();
      }
    }
    function schedulePaint() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(paint);
    }

    function updateSizeNote() {
      if (!image) return;
      const out = photoedOutputSize(image.naturalWidth || image.width, image.naturalHeight || image.height, state.orient.rot);
      const size = photoedCanvasSize(out.width, out.height, 8000, 16000000);
      sizeNote.textContent = size.scaled
        ? 'Large photo: the download will be scaled down to ' + size.width + ' x ' + size.height + ' px.'
        : 'Download size: ' + size.width + ' x ' + size.height + ' px.';
    }

    async function handleFiles(files) {
      const file = files.find(f => f.type.startsWith('image/'));
      if (!file) { showToast('Please choose an image file (JPG, PNG or WebP).', 'warning'); return; }
      let img;
      try {
        img = await loadImageFile(file);
      } catch (err) {
        showToast(photoedLoadErrorMessage(), 'error');
        return;
      }
      currentFile = file;
      image = img;
      state = freshState();
      undoStack = [];
      committed = snap();
      selectedId = null;
      imgInfo.textContent = file.name + ' (' + formatBytes(file.size) + ', ' + (img.naturalWidth || img.width) + ' x ' + (img.naturalHeight || img.height) + ' px)';
      dropzone.classList.add('hidden');
      workspace.classList.remove('hidden');
      syncControls();
      updateSizeNote();
      paint();
    }

    setupDropzone(dropzone, fileInput, handleFiles);

    // sliders: live update while dragging, remember one undo step when released
    [[brightness, 'brightness'], [contrast, 'contrast'], [saturation, 'saturation'], [blur, 'blur']].forEach(([el, key]) => {
      el.addEventListener('input', () => {
        if (!state) return;
        state.adj[key] = Number(el.value);
        const out = document.querySelector('.photoed-out[data-for="' + el.id + '"]');
        if (out) out.textContent = el.value;
        schedulePaint();
      });
      el.addEventListener('change', () => { if (state) commit(); });
    });
    presetSelect.addEventListener('change', () => { state.preset = presetSelect.value; commit(); });

    function orientOp(op) {
      if (!image) return;
      state.orient = photoedApplyOrientation(state.orient, op);
      state.strokes.forEach(s => { s.points = s.points.map(p => photoedMapPoint(p, op)); });
      state.items.forEach(it => { const p = photoedMapPoint(it, op); it.x = p.x; it.y = p.y; });
      commit();
    }
    rotLeft.addEventListener('click', () => orientOp('rotateLeft'));
    rotRight.addEventListener('click', () => orientOp('rotateRight'));
    flipH.addEventListener('click', () => orientOp('flipH'));
    flipV.addEventListener('click', () => orientOp('flipV'));

    function addItem(kind, text, size, color) {
      if (state.items.length >= MAX_ITEMS) { showToast('You can add up to ' + MAX_ITEMS + ' texts and stickers.', 'info'); return; }
      const item = { id: nextId++, kind, text, color, x: 0.5, y: 0.5, size };
      state.items.push(item);
      selectedId = item.id;
      commit();
    }
    addText.addEventListener('click', () => {
      const text = textInput.value.trim();
      if (!text) { showToast('Type some text first.', 'warning'); return; }
      addItem('text', text, Number(textSize.value) / 100, textColor.value);
    });
    STICKERS.forEach(([emoji, name]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'photoed-sticker';
      b.textContent = emoji;
      b.setAttribute('aria-label', 'Add ' + name + ' sticker');
      b.addEventListener('click', () => addItem('emoji', emoji, 0.12, '#000000'));
      stickers.appendChild(b);
    });

    function selectedItem() { return state.items.find(i => i.id === selectedId); }
    itemSmaller.addEventListener('click', () => { const it = selectedItem(); if (it) { it.size = Math.max(0.02, it.size * 0.85); commit(); } });
    itemLarger.addEventListener('click', () => { const it = selectedItem(); if (it) { it.size = Math.min(0.6, it.size * 1.18); commit(); } });
    itemDelete.addEventListener('click', () => {
      state.items = state.items.filter(i => i.id !== selectedId);
      selectedId = null;
      commit();
    });

    undoBtn.addEventListener('click', () => {
      if (!undoStack.length) return;
      committed = undoStack[undoStack.length - 1];
      undoStack = undoStack.slice(0, -1);
      state = JSON.parse(committed);
      syncControls();
      updateSizeNote();
      schedulePaint();
    });
    resetAllBtn.addEventListener('click', () => {
      if (!image) return;
      const wasEmpty = snap() === JSON.stringify(freshState());
      state = freshState();
      selectedId = null;
      if (!wasEmpty) commit(); else syncControls();
      schedulePaint();
    });

    function pointerToUnits(e) {
      const rect = canvas.getBoundingClientRect();
      return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
    }

    canvas.addEventListener('pointerdown', (e) => {
      if (!image) return;
      const p = pointerToUnits(e);
      if (modeSelect.value === 'draw') {
        if (state.strokes.length >= MAX_STROKES) { showToast('That is the most brush strokes this editor keeps. Undo some or download first.', 'info'); return; }
        drawing = { color: brushColor.value, size: Number(brushSize.value) / 1000, points: [{ x: photoedClamp01(p.x), y: photoedClamp01(p.y) }] };
        state.strokes.push(drawing);
        canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
        schedulePaint();
        return;
      }
      const id = photoedHitTest(lastHits, p.x, p.y);
      selectedId = id;
      itemPanel.classList.toggle('hidden', id === null);
      if (id !== null) {
        const it = state.items.find(i => i.id === id);
        drag = { id, dx: it.x - p.x, dy: it.y - p.y, moved: false };
        canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
      }
      schedulePaint();
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = pointerToUnits(e);
      if (drawing) {
        if (drawing.points.length < 5000) drawing.points.push({ x: photoedClamp01(p.x), y: photoedClamp01(p.y) });
        schedulePaint();
      } else if (drag) {
        const it = state.items.find(i => i.id === drag.id);
        if (!it) return;
        it.x = photoedClamp01(p.x + drag.dx);
        it.y = photoedClamp01(p.y + drag.dy);
        drag.moved = true;
        schedulePaint();
      }
    });
    const endPointer = () => {
      const changed = drawing !== null || (drag !== null && drag.moved);
      drawing = null;
      drag = null;
      if (changed) commit();
    };
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);

    canvas.addEventListener('keydown', (e) => {
      const it = selectedItem();
      if (!it) return;
      const moved = photoedNudge(it, e.key, e.shiftKey);
      if (moved) { it.x = moved.x; it.y = moved.y; commit(); e.preventDefault(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { itemDelete.click(); e.preventDefault(); }
    });

    downloadBtn.addEventListener('click', async () => {
      if (!image) return;
      downloadBtn.disabled = true;
      downloadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparing...';
      await new Promise(r => setTimeout(r, 30)); // let the button update before the heavy work
      let out = null;
      try {
        const dims = photoedOutputSize(image.naturalWidth || image.width, image.naturalHeight || image.height, state.orient.rot);
        const size = photoedCanvasSize(dims.width, dims.height, 8000, 16000000);
        out = document.createElement('canvas');
        out.width = size.width;
        out.height = size.height;
        const type = formatSelect.value === 'image/png' ? 'image/png' : 'image/jpeg';
        photoedRender(out.getContext('2d', { willReadFrequently: true }), image, size.width, size.height, state, type === 'image/jpeg');
        const blob = await canvasToBlob(out, type, 0.92);
        if (!blob) { showToast('Could not create the image. Try a smaller photo.', 'error'); return; }
        const ext = blob.type === 'image/jpeg' ? 'jpg' : 'png';
        downloadBlob(blob, 'fixlytools-' + baseName(currentFile.name) + '-edited.' + ext);
        showToast('Photo downloaded. Your original file was not changed.', 'success');
      } catch (err) {
        console.error(err);
        showToast('Something went wrong while saving the photo. Try a smaller image.', 'error');
      } finally {
        if (out) { out.width = 0; out.height = 0; }
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = BTN_HTML;
      }
    });

    resetBtn.addEventListener('click', () => {
      currentFile = null;
      image = null;
      state = null;
      undoStack = [];
      selectedId = null;
      canvas.width = 1;
      canvas.height = 1;
      workspace.classList.add('hidden');
      dropzone.classList.remove('hidden');
    });
  });
}
