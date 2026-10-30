// Fixlytools - Rotate Image (several images, rotate / flip / fine angle, download one or all as ZIP)

const ROI_MAX_PIXELS = 16000000;   // keeps one canvas within what phones can handle
const ROI_MAX_SIDE = 8000;
const ROI_MAX_IMAGES = 50;
const ROI_PREVIEW = 220;

// ---------- pure helpers ----------

// state = { rotation: 0|90|180|270, angle: -45..45 (degrees), flipH, flipV }
function roiTotalAngle(state) {
  return (state.rotation || 0) + (state.angle || 0);
}

function roiNextRotation(rotation, delta) {
  return (((rotation + delta) % 360) + 360) % 360;
}

// Size of the canvas that holds the turned picture (all of it, nothing cut off)
function roiTransformSize(w, h, state) {
  const angle = state.angle || 0;
  const rot = ((state.rotation || 0) % 360 + 360) % 360;
  if (angle === 0) return rot % 180 === 0 ? { w, h } : { w: h, h: w };
  const t = roiTotalAngle(state) * Math.PI / 180;
  const c = Math.abs(Math.cos(t)), s = Math.abs(Math.sin(t));
  return { w: Math.max(1, Math.ceil(w * c + h * s - 1e-6)), h: Math.max(1, Math.ceil(w * s + h * c - 1e-6)) };
}

// Factor (<= 1) that brings a canvas size within the pixel and side limits
function roiLimitScale(w, h) {
  let k = Math.min(1, ROI_MAX_SIDE / Math.max(w, h));
  if (w * h * k * k > ROI_MAX_PIXELS) k = Math.sqrt(ROI_MAX_PIXELS / (w * h));
  return k;
}

function roiIsReset(state) {
  return !state.rotation && !state.angle && !state.flipH && !state.flipV;
}

function roiExt(type) {
  return type === 'image/jpeg' ? 'jpg' : type === 'image/webp' ? 'webp' : 'png';
}

function roiOutputName(original, ext) {
  const base = String(original || 'image').replace(/\.[^/.]+$/, '') || 'image';
  return `fixlytools-${base}-rotated.${ext}`;
}

// Makes a file name unique inside one ZIP: a.jpg, a-2.jpg, a-3.jpg ...
function roiUniqueName(name, used) {
  if (!used.has(name)) { used.add(name); return name; }
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let n = 2;
  while (used.has(`${stem}-${n}${ext}`)) n++;
  const out = `${stem}-${n}${ext}`;
  used.add(out);
  return out;
}

// Draws `source` (w x h) turned as described by state onto ctx, filling an outW x outH canvas.
// Order: the picture is rotated first, then mirrored, so "flip horizontal" always mirrors what you see.
function roiDraw(ctx, source, w, h, state, outW, outH) {
  const full = roiTransformSize(w, h, state);
  const k = outW / full.w;
  ctx.save();
  ctx.translate(outW / 2, outH / 2);
  ctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);
  ctx.rotate(roiTotalAngle(state) * Math.PI / 180);
  ctx.drawImage(source, -w * k / 2, -h * k / 2, w * k, h * k);
  ctx.restore();
}

// ---- tiny ZIP writer (store only, no compression: JPG/PNG are already compressed) ----
let roiCrcTable = null;
function roiCrc32(bytes) {
  if (!roiCrcTable) {
    roiCrcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      roiCrcTable[n] = c >>> 0;
    }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) crc = roiCrcTable[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// files: [{ name, data: Uint8Array }] -> Uint8Array of a .zip archive
function roiBuildZip(files) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const crc = roiCrc32(f.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);          // UTF-8 names
    local.setUint16(8, 0, true);               // stored
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, f.data.length, true);
    local.setUint32(22, f.data.length, true);
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true);
    chunks.push(new Uint8Array(local.buffer), nameBytes, f.data);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, dosTime, true);
    cd.setUint16(14, dosDate, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, f.data.length, true);
    cd.setUint32(24, f.data.length, true);
    cd.setUint16(28, nameBytes.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), nameBytes);

    offset += 30 + nameBytes.length + f.data.length;
  }

  let centralSize = 0;
  central.forEach(c => { centralSize += c.length; });
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  const all = [...chunks, ...central, new Uint8Array(end.buffer)];
  const total = all.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  all.forEach(c => { out.set(c, pos); pos += c.length; });
  return out;
}


if (typeof module !== 'undefined') {
  module.exports = {
    roiTotalAngle, roiNextRotation, roiTransformSize, roiLimitScale, roiIsReset, roiExt, roiOutputName,
    roiUniqueName, roiCrc32, roiBuildZip
  };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const workspace = document.getElementById('workspace');
    const grid = document.getElementById('image-grid');
    const countText = document.getElementById('image-count');
    const addMoreBtn = document.getElementById('add-more-btn');
    const clearBtn = document.getElementById('clear-btn');
    const allLeftBtn = document.getElementById('all-left-btn');
    const allRightBtn = document.getElementById('all-right-btn');
    const allFlipBtn = document.getElementById('all-flip-btn');
    const allResetBtn = document.getElementById('all-reset-btn');
    const formatSelect = document.getElementById('format-select');
    const fillSelect = document.getElementById('fill-select');
    const fillNote = document.getElementById('fill-note');
    const qualityWrap = document.getElementById('quality-wrap');
    const qualityRange = document.getElementById('quality-range');
    const qualityValue = document.getElementById('quality-value');
    const downloadBtn = document.getElementById('download-btn');
    const progress = document.getElementById('progress-text');

    let items = [];   // { id, file, name, w, h, base, rotation, angle, flipH, flipV }
    let nextId = 1;
    let busy = false;

    function whiteFill() {
      return formatSelect.value === 'image/jpeg' || fillSelect.value === 'white';
    }

    function syncOptions() {
      const jpg = formatSelect.value === 'image/jpeg';
      qualityWrap.classList.toggle('hidden', !jpg);
      qualityValue.textContent = Math.round(qualityRange.value * 100) + '%';
      fillNote.textContent = jpg ? 'JPG cannot be transparent, so empty corners are filled white.' : '';
      fillSelect.disabled = jpg;
    }

    function paintCard(item) {
      const card = grid.querySelector(`[data-id="${item.id}"]`);
      if (!card) return;
      const canvas = card.querySelector('canvas');
      const size = roiTransformSize(item.base.width, item.base.height, item);
      const k = Math.min(1, ROI_PREVIEW / Math.max(size.w, size.h));
      canvas.width = Math.max(1, Math.round(size.w * k));
      canvas.height = Math.max(1, Math.round(size.h * k));
      const ctx = canvas.getContext('2d');
      if (whiteFill()) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      const tmp = { rotation: item.rotation, angle: item.angle, flipH: item.flipH, flipV: item.flipV };
      roiDraw(ctx, item.base, item.base.width, item.base.height, tmp, canvas.width, canvas.height);
      card.querySelector('.roi-angle-label').textContent = `${item.angle}°`;
      card.querySelector('.roi-angle').value = item.angle;
      card.querySelector('.roi-size').textContent = `${item.w} × ${item.h} px`;
    }

    function paintAll() { items.forEach(paintCard); }

    function renderGrid() {
      const has = items.length > 0;
      workspace.classList.toggle('hidden', !has);
      dropzone.classList.toggle('hidden', has);
      countText.textContent = `${items.length} image${items.length === 1 ? '' : 's'}`;
      downloadBtn.innerHTML = items.length > 1 ? '<i class="fa-solid fa-file-zipper"></i> Download all (ZIP)' : '<i class="fa-solid fa-download"></i> Download image';
      grid.textContent = '';
      items.forEach((it, i) => {
        const card = document.createElement('div');
        card.className = 'roi-card';
        card.dataset.id = String(it.id);
        card.innerHTML = `
          <p class="roi-name" title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</p>
          <div class="roi-view"><canvas role="img" aria-label="Preview of ${escapeHtml(it.name)}"></canvas></div>
          <p class="roi-size"></p>
          <div class="roi-tools">
            <button type="button" class="roi-icon" data-act="left" aria-label="Rotate ${escapeHtml(it.name)} left"><i class="fa-solid fa-rotate-left"></i></button>
            <button type="button" class="roi-icon" data-act="right" aria-label="Rotate ${escapeHtml(it.name)} right"><i class="fa-solid fa-rotate-right"></i></button>
            <button type="button" class="roi-icon" data-act="fliph" aria-label="Flip ${escapeHtml(it.name)} horizontally"><i class="fa-solid fa-left-right"></i></button>
            <button type="button" class="roi-icon" data-act="flipv" aria-label="Flip ${escapeHtml(it.name)} vertically"><i class="fa-solid fa-up-down"></i></button>
            <button type="button" class="roi-icon" data-act="reset" aria-label="Reset ${escapeHtml(it.name)}"><i class="fa-solid fa-arrow-rotate-left"></i></button>
            <button type="button" class="roi-icon" data-act="remove" aria-label="Remove ${escapeHtml(it.name)}"><i class="fa-solid fa-trash"></i></button>
          </div>
          <label class="roi-angle-row" for="roi-angle-${it.id}"><span>Fine angle</span><span class="roi-angle-label">0°</span></label>
          <input type="range" class="roi-angle" id="roi-angle-${it.id}" min="-45" max="45" step="0.5" value="0">
          <button type="button" class="roi-one" data-act="download">Download this image</button>`;
        grid.appendChild(card);
        paintCard(it);
      });
    }

    function makeBase(img) {
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      const k = Math.min(1, (ROI_PREVIEW * 2) / Math.max(iw, ih));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(iw * k));
      c.height = Math.max(1, Math.round(ih * k));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c;
    }

    async function addFiles(files) {
      const images = files.filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name));
      if (images.length < files.length) showToast('Some files were skipped because they are not images.', 'warning');
      const failed = [];
      for (const file of images) {
        if (items.length >= ROI_MAX_IMAGES) { showToast(`You can rotate up to ${ROI_MAX_IMAGES} images at once.`, 'warning'); break; }
        try {
          const img = await loadImageFile(file);
          items.push({ id: nextId++, file, name: file.name, w: img.naturalWidth || img.width, h: img.naturalHeight || img.height, base: makeBase(img), rotation: 0, angle: 0, flipH: false, flipV: false });
          img.src = '';
        } catch (err) {
          failed.push(file.name);
        }
      }
      if (failed.length) showToast(`Could not read: ${failed.join(', ')}. The file may be damaged or in a format this browser cannot open.`, 'error');
      renderGrid();
    }

    function applyAct(item, act) {
      if (act === 'left') item.rotation = roiNextRotation(item.rotation, -90);
      else if (act === 'right') item.rotation = roiNextRotation(item.rotation, 90);
      else if (act === 'fliph') item.flipH = !item.flipH;
      else if (act === 'flipv') item.flipV = !item.flipV;
      else if (act === 'reset') { item.rotation = 0; item.angle = 0; item.flipH = false; item.flipV = false; }
    }

    // ----- exporting (one picture at a time, so memory stays low) -----
    async function renderBlob(item) {
      const img = await loadImageFile(item.file);
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      const full = roiTransformSize(iw, ih, item);
      const k = roiLimitScale(full.w, full.h);
      const outW = Math.max(1, Math.round(full.w * k)), outH = Math.max(1, Math.round(full.h * k));
      const canvas = document.createElement('canvas');
      canvas.width = outW; canvas.height = outH;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      if (whiteFill()) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, outW, outH); }
      roiDraw(ctx, img, iw, ih, item, outW, outH);
      img.src = '';
      const type = formatSelect.value;
      const blob = await canvasToBlob(canvas, type, parseFloat(qualityRange.value));
      canvas.width = canvas.height = 0;
      if (!blob) throw new Error(`Could not save ${item.name}. The picture may be too large for this browser.`);
      return { blob, reduced: k < 1 };
    }

    async function downloadItems(list) {
      if (busy || !list.length) return;
      busy = true;
      downloadBtn.disabled = true;
      let reducedCount = 0;
      try {
        const files = [];
        const used = new Set();
        for (let i = 0; i < list.length; i++) {
          progress.textContent = `Processing ${i + 1} of ${list.length}...`;
          const { blob, reduced } = await renderBlob(list[i]);
          if (reduced) reducedCount++;
          const name = roiUniqueName(roiOutputName(list[i].name, roiExt(blob.type)), used);
          files.push({ name, blob });
          await new Promise(r => setTimeout(r, 0));
        }
        if (files.length === 1) downloadBlob(files[0].blob, files[0].name);
        else {
          const zipFiles = [];
          for (const f of files) zipFiles.push({ name: f.name, data: new Uint8Array(await f.blob.arrayBuffer()) });
          downloadBlob(new Blob([roiBuildZip(zipFiles)], { type: 'application/zip' }), 'fixlytools-rotated-images.zip');
        }
        showToast(files.length === 1 ? 'Image downloaded.' : `${files.length} images downloaded as a ZIP file.`, 'success');
        if (reducedCount) showToast(`${reducedCount} very large image${reducedCount === 1 ? ' was' : 's were'} slightly reduced to fit browser limits.`, 'info');
      } catch (err) {
        console.error(err);
        showToast(err && err.message ? err.message : 'Could not create the image. Please try again.', 'error');
      } finally {
        busy = false;
        progress.textContent = '';
        downloadBtn.disabled = false;
      }
    }

    // ----- events -----
    setupDropzone(dropzone, fileInput, addFiles);
    addMoreBtn.addEventListener('click', () => fileInput.click());

    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-act]');
      if (!btn || busy) return;
      const id = parseInt(btn.closest('.roi-card').dataset.id, 10);
      const item = items.find(x => x.id === id);
      if (!item) return;
      if (btn.dataset.act === 'remove') { items = items.filter(x => x !== item); renderGrid(); return; }
      if (btn.dataset.act === 'download') { downloadItems([item]); return; }
      applyAct(item, btn.dataset.act);
      paintCard(item);
    });

    grid.addEventListener('input', (e) => {
      if (!e.target.classList.contains('roi-angle')) return;
      const id = parseInt(e.target.closest('.roi-card').dataset.id, 10);
      const item = items.find(x => x.id === id);
      if (!item) return;
      item.angle = parseFloat(e.target.value) || 0;
      paintCard(item);
    });

    allLeftBtn.addEventListener('click', () => { items.forEach(i => applyAct(i, 'left')); paintAll(); });
    allRightBtn.addEventListener('click', () => { items.forEach(i => applyAct(i, 'right')); paintAll(); });
    allFlipBtn.addEventListener('click', () => { items.forEach(i => applyAct(i, 'fliph')); paintAll(); });
    allResetBtn.addEventListener('click', () => { items.forEach(i => applyAct(i, 'reset')); paintAll(); });
    clearBtn.addEventListener('click', () => { if (busy) return; items = []; renderGrid(); });

    [formatSelect, fillSelect].forEach(el => el.addEventListener('change', () => { syncOptions(); paintAll(); }));
    qualityRange.addEventListener('input', syncOptions);

    downloadBtn.addEventListener('click', () => downloadItems(items.slice()));

    syncOptions();
    renderGrid();
  });
}
