// Fixlytools - Meme Generator (canvas only, runs in the browser)

const MEMEGEN_FONT = 'Impact, "Arial Black", "Arial Narrow Bold", sans-serif';

function memegenClamp01(v) {
  const n = Number(v);
  if (!isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

// Largest size that stays inside the browser canvas limits (8000 px longest side, 16 million pixels).
function memegenCanvasSize(w, h, maxSide, maxPixels) {
  const side = maxSide || 8000;
  const pixels = maxPixels || 16000000;
  const scale = Math.min(1, side / Math.max(w, h), Math.sqrt(pixels / (w * h)));
  if (scale >= 1) return { width: w, height: h, scaled: false };
  return { width: Math.max(1, Math.floor(w * scale)), height: Math.max(1, Math.floor(h * scale)), scaled: true };
}

// Greedy word wrap. measure(str) returns the width of str at the current font size.
// A single word wider than maxWidth is split by characters so nothing runs off the picture.
function memegenWrapLines(text, maxWidth, measure) {
  const lines = [];
  String(text || '').split('\n').forEach(paragraph => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) return;
    let current = '';
    const pushWord = (word) => {
      if (measure(word) <= maxWidth) { current = word; return; }
      let chunk = '';
      for (const ch of word) {
        if (chunk && measure(chunk + ch) > maxWidth) { lines.push(chunk); chunk = ch; } else chunk += ch;
      }
      current = chunk;
    };
    words.forEach(word => {
      if (!current) { pushWord(word); return; }
      if (measure(current + ' ' + word) <= maxWidth) { current += ' ' + word; return; }
      lines.push(current);
      current = '';
      pushWord(word);
    });
    if (current) lines.push(current);
  });
  return lines;
}

// Shrinks the font until the text fits inside maxWidth x maxHeight (or reaches minSize).
// opts: { maxWidth, maxHeight, startSize, minSize, lineHeight, maxLines, measure(str, size) }
function memegenLayoutText(text, opts) {
  const lineHeight = opts.lineHeight || 1.08;
  const maxLines = opts.maxLines || 4;
  let size = Math.max(opts.minSize, opts.startSize);
  for (;;) {
    const lines = memegenWrapLines(text, opts.maxWidth, (s) => opts.measure(s, size));
    const fits = lines.length <= maxLines && lines.length * size * lineHeight <= opts.maxHeight;
    if (fits || size <= opts.minSize) return { size, lines, fits };
    size = Math.max(opts.minSize, size - Math.max(1, size * 0.06));
  }
}

// rects: [{ id, x, y, w, h }] in 0..1 units, later items are on top. Returns an id or null.
function memegenHitTest(rects, px, py) {
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return r.id;
  }
  return null;
}

// Arrow-key nudge for a text box centre (0..1 units). Shift moves in bigger steps.
function memegenNudge(box, key, big) {
  const step = big ? 0.05 : 0.01;
  let x = box.x;
  let y = box.y;
  if (key === 'ArrowLeft') x -= step;
  else if (key === 'ArrowRight') x += step;
  else if (key === 'ArrowUp') y -= step;
  else if (key === 'ArrowDown') y += step;
  else return null;
  return { x: memegenClamp01(x), y: memegenClamp01(y) };
}

// Draws the picture and all text. Returns hit rectangles (0..1 units) for the draggable boxes.
// state: { top, bottom, upper, size, fill, stroke, boxes: [{ id, text, x, y, size }] } (sizes are fractions of image height)
function memegenDraw(ctx, img, W, H, state, opaque) {
  ctx.clearRect(0, 0, W, H);
  if (opaque) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); }
  ctx.drawImage(img, 0, 0, W, H);

  const fontFor = (size) => 'bold ' + Math.round(size) + 'px ' + MEMEGEN_FONT;
  const measure = (str, size) => { ctx.font = fontFor(size); return ctx.measureText(str).width; };
  const fixCase = (s) => (state.upper ? String(s || '').toUpperCase() : String(s || ''));
  const hits = [];

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.fillStyle = state.fill;
  ctx.strokeStyle = state.stroke;

  function drawLines(lines, size, cx, y0) {
    ctx.font = fontFor(size);
    ctx.lineWidth = Math.max(2, size * 0.14);
    ctx.fillStyle = state.fill;
    ctx.strokeStyle = state.stroke;
    lines.forEach((line, i) => {
      const y = y0 + i * size * 1.08;
      ctx.strokeText(line, cx, y);
      ctx.fillText(line, cx, y);
    });
  }

  const startSize = state.size * H;
  const minSize = Math.max(8, H * 0.025);
  const pad = H * 0.03;

  const top = memegenLayoutText(fixCase(state.top), { maxWidth: W * 0.94, maxHeight: H * 0.3, startSize, minSize, measure });
  if (top.lines.length) drawLines(top.lines, top.size, W / 2, pad);

  const bottom = memegenLayoutText(fixCase(state.bottom), { maxWidth: W * 0.94, maxHeight: H * 0.3, startSize, minSize, measure });
  if (bottom.lines.length) {
    const blockH = bottom.lines.length * bottom.size * 1.08;
    drawLines(bottom.lines, bottom.size, W / 2, H - pad - blockH);
  }

  state.boxes.forEach(box => {
    const text = fixCase(box.text);
    const laid = memegenLayoutText(text, {
      maxWidth: W * 0.9, maxHeight: H * 0.5, startSize: box.size * H, minSize: Math.max(8, H * 0.02), measure
    });
    if (!laid.lines.length) return;
    const blockH = laid.lines.length * laid.size * 1.08;
    const cx = box.x * W;
    const y0 = box.y * H - blockH / 2;
    drawLines(laid.lines, laid.size, cx, y0);
    ctx.font = fontFor(laid.size);
    const widest = Math.max.apply(null, laid.lines.map(l => ctx.measureText(l).width));
    hits.push({ id: box.id, x: (cx - widest / 2) / W, y: y0 / H, w: widest / W, h: blockH / H });
  });
  return hits;
}

function memegenLoadErrorMessage() {
  return 'This image could not be read. It may be damaged or in a format your browser cannot open. Try a JPG, PNG or WebP file.';
}

if (typeof module !== 'undefined') {
  module.exports = {
    memegenClamp01, memegenCanvasSize, memegenWrapLines, memegenLayoutText,
    memegenHitTest, memegenNudge, memegenLoadErrorMessage, memegenDraw
  };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const workspace = document.getElementById('workspace');
    const imgInfo = document.getElementById('img-info');
    const canvas = document.getElementById('memegen-canvas');
    const topInput = document.getElementById('memegen-top');
    const bottomInput = document.getElementById('memegen-bottom');
    const upperCheck = document.getElementById('memegen-upper');
    const sizeInput = document.getElementById('memegen-size');
    const fillInput = document.getElementById('memegen-fill');
    const strokeInput = document.getElementById('memegen-stroke');
    const addBtn = document.getElementById('memegen-add');
    const boxPanel = document.getElementById('memegen-box-panel');
    const boxText = document.getElementById('memegen-box-text');
    const boxSize = document.getElementById('memegen-box-size');
    const boxDelete = document.getElementById('memegen-box-delete');
    const formatSelect = document.getElementById('memegen-format');
    const sizeNote = document.getElementById('memegen-size-note');
    const downloadBtn = document.getElementById('memegen-btn');
    const resetBtn = document.getElementById('reset-btn');
    const BTN_HTML = '<i class="fa-solid fa-download"></i> Download Meme';
    const PREVIEW_MAX = 1000;
    const MAX_BOXES = 10;

    let currentFile = null;
    let image = null;
    let boxes = [];
    let nextId = 1;
    let selectedId = null;
    let lastHits = [];
    let drag = null;
    let queued = false;

    function state() {
      return {
        top: topInput.value, bottom: bottomInput.value, upper: upperCheck.checked,
        size: Number(sizeInput.value) / 100, fill: fillInput.value, stroke: strokeInput.value, boxes
      };
    }

    function paint() {
      queued = false;
      if (!image) return;
      const ctx = canvas.getContext('2d');
      lastHits = memegenDraw(ctx, image, canvas.width, canvas.height, state(), false);
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

    function selectBox(id) {
      selectedId = id;
      const box = boxes.find(b => b.id === id);
      boxPanel.classList.toggle('hidden', !box);
      if (box) {
        boxText.value = box.text;
        boxSize.value = Math.round(box.size * 100);
      }
      schedulePaint();
    }

    function updateSizeNote() {
      const out = memegenCanvasSize(image.naturalWidth || image.width, image.naturalHeight || image.height, 8000, 16000000);
      sizeNote.textContent = out.scaled
        ? 'Large image: the download will be scaled down to ' + out.width + ' x ' + out.height + ' px.'
        : 'Download size: ' + out.width + ' x ' + out.height + ' px.';
    }

    async function handleFiles(files) {
      const file = files.find(f => f.type.startsWith('image/'));
      if (!file) { showToast('Please choose an image file (JPG, PNG or WebP).', 'warning'); return; }
      let img;
      try {
        img = await loadImageFile(file);
      } catch (err) {
        showToast(memegenLoadErrorMessage(), 'error');
        return;
      }
      currentFile = file;
      image = img;
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      const preview = memegenCanvasSize(iw, ih, PREVIEW_MAX, PREVIEW_MAX * PREVIEW_MAX);
      canvas.width = preview.width;
      canvas.height = preview.height;
      boxes = [];
      selectedId = null;
      boxPanel.classList.add('hidden');
      imgInfo.textContent = file.name + ' (' + formatBytes(file.size) + ', ' + iw + ' x ' + ih + ' px)';
      updateSizeNote();
      dropzone.classList.add('hidden');
      workspace.classList.remove('hidden');
      paint();
    }

    setupDropzone(dropzone, fileInput, handleFiles);
    [topInput, bottomInput, upperCheck, sizeInput, fillInput, strokeInput].forEach(el => {
      el.addEventListener('input', schedulePaint);
      el.addEventListener('change', schedulePaint);
    });

    addBtn.addEventListener('click', () => {
      if (!image) return;
      if (boxes.length >= MAX_BOXES) { showToast('You can add up to ' + MAX_BOXES + ' extra text boxes.', 'info'); return; }
      const box = { id: nextId++, text: 'NEW TEXT', x: 0.5, y: 0.5, size: 0.08 };
      boxes.push(box);
      selectBox(box.id);
    });

    boxText.addEventListener('input', () => {
      const box = boxes.find(b => b.id === selectedId);
      if (box) { box.text = boxText.value; schedulePaint(); }
    });
    boxSize.addEventListener('input', () => {
      const box = boxes.find(b => b.id === selectedId);
      if (box) { box.size = Number(boxSize.value) / 100; schedulePaint(); }
    });
    boxDelete.addEventListener('click', () => {
      boxes = boxes.filter(b => b.id !== selectedId);
      selectBox(null);
    });

    function pointerToUnits(e) {
      const rect = canvas.getBoundingClientRect();
      return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
    }

    canvas.addEventListener('pointerdown', (e) => {
      if (!image) return;
      const p = pointerToUnits(e);
      const id = memegenHitTest(lastHits, p.x, p.y);
      selectBox(id);
      if (id !== null) {
        const box = boxes.find(b => b.id === id);
        drag = { id, dx: box.x - p.x, dy: box.y - p.y };
        canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const p = pointerToUnits(e);
      const box = boxes.find(b => b.id === drag.id);
      if (!box) return;
      box.x = memegenClamp01(p.x + drag.dx);
      box.y = memegenClamp01(p.y + drag.dy);
      schedulePaint();
    });
    const endDrag = () => { drag = null; };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    canvas.addEventListener('keydown', (e) => {
      const box = boxes.find(b => b.id === selectedId);
      if (!box) return;
      const moved = memegenNudge(box, e.key, e.shiftKey);
      if (moved) { box.x = moved.x; box.y = moved.y; schedulePaint(); e.preventDefault(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { boxDelete.click(); e.preventDefault(); }
    });

    downloadBtn.addEventListener('click', async () => {
      if (!image) return;
      downloadBtn.disabled = true;
      downloadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparing...';
      let out = null;
      try {
        const size = memegenCanvasSize(image.naturalWidth || image.width, image.naturalHeight || image.height, 8000, 16000000);
        out = document.createElement('canvas');
        out.width = size.width;
        out.height = size.height;
        const type = formatSelect.value === 'image/jpeg' ? 'image/jpeg' : 'image/png';
        memegenDraw(out.getContext('2d'), image, size.width, size.height, state(), type === 'image/jpeg');
        const blob = await canvasToBlob(out, type, 0.92);
        if (!blob) { showToast('Could not create the image. Try a smaller picture.', 'error'); return; }
        const ext = blob.type === 'image/jpeg' ? 'jpg' : 'png';
        downloadBlob(blob, 'fixlytools-' + baseName(currentFile.name) + '-meme.' + ext);
        showToast('Meme downloaded. Your original image was not changed.', 'success');
      } catch (err) {
        console.error(err);
        showToast('Something went wrong while creating the meme.', 'error');
      } finally {
        if (out) { out.width = 0; out.height = 0; }
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = BTN_HTML;
      }
    });

    resetBtn.addEventListener('click', () => {
      currentFile = null;
      image = null;
      boxes = [];
      selectedId = null;
      canvas.width = 1;
      canvas.height = 1;
      workspace.classList.add('hidden');
      dropzone.classList.remove('hidden');
    });
  });
}
