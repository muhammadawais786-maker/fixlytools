// Fixlytools - PDF to JPG (renders PDF pages to images in the browser with pdf.js)

const PJ_MAX_PIXELS = 16000000;   // keeps one page canvas within what phones can handle
const PJ_MAX_SIDE = 8000;

// "1-3, 7, 10-" -> zero-based page indices. An empty string means every page.
function pjParsePages(str, maxPages) {
  const trimmed = (str || '').trim();
  if (!trimmed) return { indices: Array.from({ length: maxPages }, (_, i) => i), invalid: [] };
  const indices = new Set();
  const invalid = [];
  for (const part of trimmed.split(',').map(p => p.trim()).filter(Boolean)) {
    let m;
    if ((m = /^(\d+)$/.exec(part))) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= maxPages) indices.add(n - 1); else invalid.push(part);
    } else if ((m = /^(\d+)\s*-\s*(\d*)$/.exec(part))) {
      const start = parseInt(m[1], 10);
      const end = m[2] === '' ? maxPages : parseInt(m[2], 10);
      const from = Math.min(start, end), to = Math.max(start, end);
      if (to < 1 || from > maxPages) { invalid.push(part); continue; }
      for (let i = Math.max(1, from); i <= Math.min(maxPages, to); i++) indices.add(i - 1);
    } else {
      invalid.push(part);
    }
  }
  return { indices: Array.from(indices).sort((a, b) => a - b), invalid };
}

// PDF pages are 72 points per inch; the scale is chosen from the wanted DPI but capped for huge pages.
function pjScaleFor(dpi, widthPt, heightPt) {
  let scale = dpi / 72;
  const w = widthPt * scale, h = heightPt * scale;
  const byPixels = Math.sqrt(PJ_MAX_PIXELS / (w * h));
  const bySide = PJ_MAX_SIDE / Math.max(w, h);
  const limit = Math.min(1, byPixels, bySide);
  return scale * limit;
}

// ---- tiny ZIP writer (store only, no compression: JPG/PNG are already compressed) ----
let pjCrcTable = null;
function pjCrc32(bytes) {
  if (!pjCrcTable) {
    pjCrcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      pjCrcTable[n] = c >>> 0;
    }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) crc = pjCrcTable[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// files: [{ name, data: Uint8Array }] -> Uint8Array of a .zip archive
function pjBuildZip(files) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const crc = pjCrc32(f.data);
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
  module.exports = { pjParsePages, pjScaleFor, pjCrc32, pjBuildZip };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const workspace = document.getElementById('workspace');
    const pdfInfo = document.getElementById('pdf-info');
    const pagesInput = document.getElementById('pages-input');
    const dpiSelect = document.getElementById('dpi-select');
    const formatSelect = document.getElementById('format-select');
    const convertBtn = document.getElementById('convert-btn');
    const resetBtn = document.getElementById('reset-btn');
    const progress = document.getElementById('progress');
    const results = document.getElementById('results');
    const grid = document.getElementById('result-grid');
    const zipBtn = document.getElementById('zip-btn');
    const resultCount = document.getElementById('result-count');

    let pdf = null;
    let currentFile = null;
    let outputs = [];   // { name, blob, url }

    function clearOutputs() {
      outputs.forEach(o => URL.revokeObjectURL(o.url));
      outputs = [];
      grid.innerHTML = '';
      results.classList.add('hidden');
    }

    function setupWorker() {
      if (typeof pdfjsLib === 'undefined') return false;
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      return true;
    }

    async function handleFiles(files) {
      const file = files.find(isPdfFile);
      if (!file) { showToast('Please choose a PDF file.', 'warning'); return; }
      if (!setupWorker()) {
        showToast('The PDF library could not be loaded. Please check your internet connection and reload.', 'error');
        return;
      }
      try {
        const data = new Uint8Array(await file.arrayBuffer());
        pdf = await pdfjsLib.getDocument({ data }).promise;
        currentFile = file;
        clearOutputs();
        pdfInfo.textContent = `${file.name} (${formatBytes(file.size)}, ${pdf.numPages} page${pdf.numPages === 1 ? '' : 's'})`;
        pagesInput.value = '';
        pagesInput.placeholder = `All ${pdf.numPages} pages (or e.g. 1-3, 5)`;
        dropzone.classList.add('hidden');
        workspace.classList.remove('hidden');
      } catch (err) {
        console.error(err);
        const msg = err && err.name === 'PasswordException'
          ? 'This PDF is password-protected. Remove the password first.'
          : 'Could not open this PDF. It may be corrupted.';
        showToast(msg, 'error');
      }
    }

    setupDropzone(dropzone, fileInput, handleFiles);

    convertBtn.addEventListener('click', async () => {
      if (!pdf) return;
      const { indices, invalid } = pjParsePages(pagesInput.value, pdf.numPages);
      if (indices.length === 0) {
        showToast(`Please enter valid page numbers between 1 and ${pdf.numPages}.`, 'warning');
        return;
      }
      if (invalid.length) showToast(`Ignored invalid part(s): ${invalid.join(', ')}`, 'warning');

      const dpi = parseInt(dpiSelect.value, 10);
      const isPng = formatSelect.value === 'png';
      const mime = isPng ? 'image/png' : 'image/jpeg';
      const ext = isPng ? 'png' : 'jpg';
      const stem = baseName(currentFile.name);
      const digits = String(pdf.numPages).length;

      clearOutputs();
      convertBtn.disabled = true;
      let done = 0;

      try {
        for (const idx of indices) {
          progress.textContent = `Converting page ${idx + 1} (${done + 1} of ${indices.length})...`;
          progress.classList.remove('hidden');
          const page = await pdf.getPage(idx + 1);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: pjScaleFor(dpi, base.width, base.height) });
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.floor(viewport.width));
          canvas.height = Math.max(1, Math.floor(viewport.height));
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport }).promise;
          const blob = await canvasToBlob(canvas, mime, 0.92);
          canvas.width = canvas.height = 0;   // free the memory right away
          page.cleanup();
          if (!blob) throw new Error('Image encoding failed');

          const name = `${stem}-page-${String(idx + 1).padStart(digits, '0')}.${ext}`;
          const url = URL.createObjectURL(blob);
          outputs.push({ name, blob, url });

          const card = document.createElement('div');
          card.className = 'pj-card';
          card.innerHTML = `<img alt="" loading="lazy"><div class="pj-meta"><span class="pj-name"></span><span class="pj-size"></span></div><a class="pj-dl">Download</a>`;
          card.querySelector('img').src = url;
          card.querySelector('img').alt = `Page ${idx + 1}`;
          card.querySelector('.pj-name').textContent = `Page ${idx + 1}`;
          card.querySelector('.pj-size').textContent = formatBytes(blob.size);
          const a = card.querySelector('.pj-dl');
          a.href = url;
          a.download = name;
          grid.appendChild(card);
          done++;
          results.classList.remove('hidden');
        }
        resultCount.textContent = `${done} image${done === 1 ? '' : 's'} ready`;
        zipBtn.classList.toggle('hidden', done < 2);
        showToast(`Converted ${done} page${done === 1 ? '' : 's'}!`, 'success');
      } catch (err) {
        console.error(err);
        showToast('Something went wrong while converting. Try a lower quality setting.', 'error');
      } finally {
        progress.classList.add('hidden');
        convertBtn.disabled = false;
      }
    });

    zipBtn.addEventListener('click', async () => {
      if (!outputs.length) return;
      zipBtn.disabled = true;
      try {
        const files = [];
        for (const o of outputs) files.push({ name: o.name, data: new Uint8Array(await o.blob.arrayBuffer()) });
        const zip = pjBuildZip(files);
        downloadBlob(new Blob([zip], { type: 'application/zip' }), `fixlytools-${baseName(currentFile.name)}-images.zip`);
      } catch (err) {
        showToast('Could not create the ZIP file.', 'error');
      } finally {
        zipBtn.disabled = false;
      }
    });

    resetBtn.addEventListener('click', () => {
      clearOutputs();
      pdf = null; currentFile = null;
      workspace.classList.add('hidden');
      dropzone.classList.remove('hidden');
    });
  });
}
