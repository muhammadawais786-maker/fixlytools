// Fixlytools - Watermark Image (text or logo watermark on several images, live preview, ZIP download)

const WMI_MAX_PIXELS = 16000000;
const WMI_MAX_SIDE = 8000;
const WMI_MAX_IMAGES = 50;
const WMI_PREVIEW_SIDE = 640;
const WMI_MAX_TILES = 1500;
const WMI_FONT = 'Arial, Helvetica, sans-serif';

// ---------- pure helpers ----------

function wmiClamp(v, lo, hi) {
  return Math.min(Math.max(v, lo), hi);
}

// Font size in pixels from "percent of the image width"
function wmiFontSize(imgW, sizePct) {
  return Math.max(8, Math.round(imgW * wmiClamp(sizePct, 1, 40) / 100));
}

// Width and height of a logo drawn at "percent of the image width"
function wmiLogoSize(imgW, logoW, logoH, scalePct) {
  const w = Math.max(4, imgW * wmiClamp(scalePct, 2, 100) / 100);
  return { w, h: w * (logoH / logoW) };
}

// Size of the box that holds a w x h rectangle turned by deg degrees
function wmiRotatedBounds(w, h, deg) {
  const t = deg * Math.PI / 180;
  const c = Math.abs(Math.cos(t)), s = Math.abs(Math.sin(t));
  return { w: w * c + h * s, h: w * s + h * c };
}

// Where the watermark centres go. pos: tl tc tr ml mc mr bl bc br, or 'tiled'.
// Returns [{ cx, cy }]. The watermark (ww x wh before turning) is rotated by deg around each centre.
function wmiPlacements(W, H, ww, wh, deg, pos, margin) {
  const b = wmiRotatedBounds(ww, wh, deg);
  if (pos === 'tiled') {
    let stepX = ww * 1.5, stepY = wh * 2;
    const R = Math.hypot(W, H) / 2 + Math.max(ww, wh);
    const estimate = (2 * Math.ceil(R / stepX) + 1) * (2 * Math.ceil(R / stepY) + 1);
    if (estimate > WMI_MAX_TILES * 4) {
      const f = Math.sqrt(estimate / (WMI_MAX_TILES * 4));
      stepX *= f; stepY *= f;
    }
    const t = deg * Math.PI / 180, cos = Math.cos(t), sin = Math.sin(t);
    const nI = Math.ceil(R / stepX), nJ = Math.ceil(R / stepY);
    const out = [];
    for (let j = -nJ; j <= nJ; j++) {
      for (let i = -nI; i <= nI; i++) {
        const lx = i * stepX + (Math.abs(j) % 2 ? stepX / 2 : 0);
        const ly = j * stepY;
        const cx = W / 2 + lx * cos - ly * sin;
        const cy = H / 2 + lx * sin + ly * cos;
        if (cx + b.w / 2 > 0 && cx - b.w / 2 < W && cy + b.h / 2 > 0 && cy - b.h / 2 < H) out.push({ cx, cy });
      }
    }
    return out;
  }
  const v = pos && pos[0] ? pos[0] : 'm', hz = pos && pos[1] ? pos[1] : 'c';
  const left = margin + b.w / 2, right = W - margin - b.w / 2;
  const top = margin + b.h / 2, bottom = H - margin - b.h / 2;
  let cx = W / 2, cy = H / 2;
  if (hz === 'l' && left <= right) cx = left;
  else if (hz === 'r' && left <= right) cx = right;
  if (v === 't' && top <= bottom) cy = top;
  else if (v === 'b' && top <= bottom) cy = bottom;
  return [{ cx, cy }];
}

// "#RRGGBB" -> "rgb(r, g, b)"; anything else becomes white
function wmiColor(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return 'rgb(255, 255, 255)';
  const n = parseInt(m[1], 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

// Text split into at most 5 lines of at most 100 characters
function wmiTextLines(text) {
  return String(text || '').replace(/\r\n?/g, '\n').split('\n').map(l => l.trim().slice(0, 100)).filter(Boolean).slice(0, 5);
}

// Scale (<= 1) that keeps the output canvas inside the browser-safe limits
function wmiLimitScale(w, h) {
  let k = Math.min(1, WMI_MAX_SIDE / Math.max(w, h));
  if (w * h * k * k > WMI_MAX_PIXELS) k = Math.sqrt(WMI_MAX_PIXELS / (w * h));
  return k;
}

function wmiExt(type) {
  return type === 'image/jpeg' ? 'jpg' : 'png';
}

function wmiOutputName(original, ext) {
  const base = String(original || 'image').replace(/\.[^/.]+$/, '') || 'image';
  return `fixlytools-${base}-watermarked.${ext}`;
}

function wmiUniqueName(name, used) {
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

// Draws the watermark on a W x H canvas. Every size is relative to W, so a small preview looks like the full-size result.
// o = { mode: 'text'|'logo', text, sizePct, color, opacity (0-1), rotation (deg), position, marginPct, logoPct, shadow }
// Returns false when there was nothing to draw.
function wmiDraw(ctx, W, H, o, logo) {
  let ww, wh, drawOne;
  ctx.save();
  ctx.globalAlpha = wmiClamp(o.opacity, 0, 1);
  if (o.mode === 'logo') {
    if (!logo || !(logo.naturalWidth > 0)) { ctx.restore(); return false; }
    const s = wmiLogoSize(W, logo.naturalWidth, logo.naturalHeight, o.logoPct);
    ww = s.w; wh = s.h;
    drawOne = () => ctx.drawImage(logo, -ww / 2, -wh / 2, ww, wh);
  } else {
    const lines = wmiTextLines(o.text);
    if (!lines.length) { ctx.restore(); return false; }
    const fs = wmiFontSize(W, o.sizePct);
    ctx.font = `bold ${fs}px ${WMI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = wmiColor(o.color);
    ww = Math.max(...lines.map(l => ctx.measureText(l).width));
    wh = lines.length * fs * 1.2;
    if (o.shadow) { ctx.shadowColor = 'rgba(0, 0, 0, 0.55)'; ctx.shadowBlur = fs * 0.12; ctx.shadowOffsetX = fs * 0.03; ctx.shadowOffsetY = fs * 0.03; }
    drawOne = () => lines.forEach((l, i) => ctx.fillText(l, 0, (i - (lines.length - 1) / 2) * fs * 1.2));
  }
  const margin = W * wmiClamp(o.marginPct, 0, 30) / 100;
  const rot = o.rotation * Math.PI / 180;
  for (const p of wmiPlacements(W, H, ww, wh, o.rotation, o.position, margin)) {
    ctx.save();
    ctx.translate(p.cx, p.cy);
    ctx.rotate(rot);
    drawOne();
    ctx.restore();
  }
  ctx.restore();
  return true;
}

// ---- tiny ZIP writer (store only, no compression: JPG/PNG are already compressed) ----
let wmiCrcTable = null;
function wmiCrc32(bytes) {
  if (!wmiCrcTable) {
    wmiCrcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      wmiCrcTable[n] = c >>> 0;
    }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) crc = wmiCrcTable[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// files: [{ name, data: Uint8Array }] -> Uint8Array of a .zip archive
function wmiBuildZip(files) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const crc = wmiCrc32(f.data);
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
    wmiClamp, wmiFontSize, wmiLogoSize, wmiRotatedBounds, wmiPlacements, wmiColor, wmiTextLines, wmiLimitScale,
    wmiExt, wmiOutputName, wmiUniqueName, wmiDraw, wmiCrc32, wmiBuildZip
  };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    const dropzone = $('dropzone'), fileInput = $('file-input'), workspace = $('workspace');
    const fileList = $('file-list'), countText = $('image-count');
    const addMoreBtn = $('add-more-btn'), clearBtn = $('clear-btn');
    const preview = $('preview-canvas'), previewNote = $('preview-note');
    const modeSelect = $('mode-select'), textWrap = $('text-wrap'), logoWrap = $('logo-wrap');
    const textInput = $('wm-text'), sizeRange = $('wm-size'), colorInput = $('wm-color'), shadowBox = $('wm-shadow');
    const logoInput = $('logo-input'), logoBtn = $('logo-btn'), logoName = $('logo-name'), logoRange = $('wm-logo-size');
    const opacityRange = $('wm-opacity'), rotationRange = $('wm-rotation'), positionSelect = $('wm-position'), marginRange = $('wm-margin');
    const formatSelect = $('format-select'), qualityWrap = $('quality-wrap'), qualityRange = $('quality-range');
    const downloadBtn = $('download-btn'), progress = $('progress-text');
    const outputs = { size: $('wm-size-out'), logo: $('wm-logo-out'), opacity: $('wm-opacity-out'), rotation: $('wm-rotation-out'), margin: $('wm-margin-out'), quality: $('quality-out') };

    let items = [];   // { id, file, name }
    let nextId = 1;
    let logo = null;
    let previewBase = null;   // downscaled first image
    let previewToken = 0;
    let frame = 0;
    let busy = false;

    function options() {
      return {
        mode: modeSelect.value === 'logo' ? 'logo' : 'text',
        text: textInput.value,
        sizePct: parseFloat(sizeRange.value),
        color: colorInput.value,
        opacity: parseFloat(opacityRange.value) / 100,
        rotation: parseFloat(rotationRange.value),
        position: positionSelect.value,
        marginPct: parseFloat(marginRange.value),
        logoPct: parseFloat(logoRange.value),
        shadow: shadowBox.checked
      };
    }

    function syncLabels() {
      outputs.size.textContent = sizeRange.value + '%';
      outputs.logo.textContent = logoRange.value + '%';
      outputs.opacity.textContent = opacityRange.value + '%';
      outputs.rotation.textContent = rotationRange.value + '°';
      outputs.margin.textContent = marginRange.value + '%';
      outputs.quality.textContent = Math.round(qualityRange.value * 100) + '%';
      const logoMode = modeSelect.value === 'logo';
      textWrap.classList.toggle('hidden', logoMode);
      logoWrap.classList.toggle('hidden', !logoMode);
      qualityWrap.classList.toggle('hidden', formatSelect.value !== 'image/jpeg');
    }

    function drawPreview() {
      frame = 0;
      if (!previewBase) return;
      preview.width = previewBase.width;
      preview.height = previewBase.height;
      const ctx = preview.getContext('2d');
      ctx.drawImage(previewBase, 0, 0);
      const o = options();
      const drawn = wmiDraw(ctx, preview.width, preview.height, o, logo);
      if (!drawn) previewNote.textContent = o.mode === 'logo' ? 'Choose a logo image to see the watermark.' : 'Type some text to see the watermark.';
      else previewNote.textContent = 'Preview of the first image. All images get the same relative size and position.';
    }

    function schedulePreview() {
      syncLabels();
      if (!frame) frame = requestAnimationFrame(drawPreview);
    }

    async function loadPreviewBase() {
      const token = ++previewToken;
      if (!items.length) { previewBase = null; return; }
      try {
        const img = await loadImageFile(items[0].file);
        if (token !== previewToken) return;
        const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
        const k = Math.min(1, WMI_PREVIEW_SIDE / Math.max(iw, ih));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(iw * k));
        c.height = Math.max(1, Math.round(ih * k));
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        img.src = '';
        previewBase = c;
        schedulePreview();
      } catch (err) {
        previewBase = null;
      }
    }

    function renderList() {
      const has = items.length > 0;
      workspace.classList.toggle('hidden', !has);
      dropzone.classList.toggle('hidden', has);
      countText.textContent = `${items.length} image${items.length === 1 ? '' : 's'}`;
      downloadBtn.innerHTML = items.length > 1 ? '<i class="fa-solid fa-file-zipper"></i> Download all (ZIP)' : '<i class="fa-solid fa-download"></i> Download image';
      fileList.textContent = '';
      items.forEach((it, i) => {
        const li = document.createElement('li');
        li.className = 'wmi-file';
        li.dataset.id = String(it.id);
        li.innerHTML = `<span class="wmi-file-name">${i + 1}. ${escapeHtml(it.name)}</span><span class="wmi-file-size">${formatBytes(it.file.size)}</span><button type="button" class="wmi-x" data-act="remove" aria-label="Remove ${escapeHtml(it.name)}"><i class="fa-solid fa-xmark"></i></button>`;
        fileList.appendChild(li);
      });
    }

    async function addFiles(files) {
      const images = files.filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name));
      if (images.length < files.length) showToast('Some files were skipped because they are not images.', 'warning');
      const failed = [];
      for (const file of images) {
        if (items.length >= WMI_MAX_IMAGES) { showToast(`You can watermark up to ${WMI_MAX_IMAGES} images at once.`, 'warning'); break; }
        try { const img = await loadImageFile(file); img.src = ''; items.push({ id: nextId++, file, name: file.name }); }
        catch (err) { failed.push(file.name); }
      }
      if (failed.length) showToast(`Could not read: ${failed.join(', ')}. The file may be damaged or in a format this browser cannot open.`, 'error');
      renderList();
      loadPreviewBase();
    }

    setupDropzone(dropzone, fileInput, addFiles);
    addMoreBtn.addEventListener('click', () => fileInput.click());
    clearBtn.addEventListener('click', () => { if (busy) return; items = []; renderList(); loadPreviewBase(); });
    fileList.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-act="remove"]');
      if (!btn || busy) return;
      const id = parseInt(btn.closest('li').dataset.id, 10);
      items = items.filter(x => x.id !== id);
      renderList();
      loadPreviewBase();
    });

    logoBtn.addEventListener('click', () => logoInput.click());
    logoInput.addEventListener('change', async () => {
      const f = (logoInput.files || [])[0];
      logoInput.value = '';
      if (!f) return;
      if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { showToast('Please choose a PNG, JPG or WebP logo.', 'warning'); return; }
      try {
        const img = await loadImageFile(f);
        if (!(img.naturalWidth > 0)) throw new Error('empty');
        logo = img;
        logoName.textContent = f.name;
        schedulePreview();
      } catch (err) {
        showToast('This logo could not be read. Try a PNG or JPG file.', 'error');
      }
    });

    [modeSelect, textInput, sizeRange, colorInput, shadowBox, logoRange, opacityRange, rotationRange, positionSelect, marginRange, formatSelect, qualityRange].forEach(el => {
      el.addEventListener('input', schedulePreview);
      el.addEventListener('change', schedulePreview);
    });

    async function renderBlob(item, o) {
      const img = await loadImageFile(item.file);
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      const k = wmiLimitScale(iw, ih);
      const W = Math.max(1, Math.round(iw * k)), H = Math.max(1, Math.round(ih * k));
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      const type = formatSelect.value;
      if (type === 'image/jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); }
      ctx.drawImage(img, 0, 0, W, H);
      img.src = '';
      wmiDraw(ctx, W, H, o, logo);
      const blob = await canvasToBlob(canvas, type, parseFloat(qualityRange.value));
      canvas.width = canvas.height = 0;
      if (!blob) throw new Error(`Could not save ${item.name}. The picture may be too large for this browser.`);
      return { blob, reduced: k < 1 };
    }

    downloadBtn.addEventListener('click', async () => {
      if (busy || !items.length) return;
      const o = options();
      if (o.mode === 'text' && !wmiTextLines(o.text).length) { showToast('Please type the watermark text first.', 'warning'); return; }
      if (o.mode === 'logo' && !logo) { showToast('Please choose a logo image first.', 'warning'); return; }
      busy = true;
      downloadBtn.disabled = true;
      let reduced = 0;
      try {
        const files = [];
        const used = new Set();
        for (let i = 0; i < items.length; i++) {
          progress.textContent = `Processing ${i + 1} of ${items.length}...`;
          const res = await renderBlob(items[i], o);
          if (res.reduced) reduced++;
          files.push({ name: wmiUniqueName(wmiOutputName(items[i].name, wmiExt(res.blob.type)), used), blob: res.blob });
          await new Promise(r => setTimeout(r, 0));
        }
        if (files.length === 1) downloadBlob(files[0].blob, files[0].name);
        else {
          const zipFiles = [];
          for (const f of files) zipFiles.push({ name: f.name, data: new Uint8Array(await f.blob.arrayBuffer()) });
          downloadBlob(new Blob([wmiBuildZip(zipFiles)], { type: 'application/zip' }), 'fixlytools-watermarked-images.zip');
        }
        showToast(files.length === 1 ? 'Image downloaded.' : `${files.length} images downloaded as a ZIP file.`, 'success');
        if (reduced) showToast(`${reduced} very large image${reduced === 1 ? ' was' : 's were'} slightly reduced to fit browser limits.`, 'info');
      } catch (err) {
        console.error(err);
        showToast(err && err.message ? err.message : 'Could not create the image. Please try again.', 'error');
      } finally {
        busy = false;
        progress.textContent = '';
        downloadBtn.disabled = false;
      }
    });

    syncLabels();
    renderList();
  });
}
