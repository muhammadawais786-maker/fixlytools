// Fixlytools - Add Watermark to PDF (pdf-lib only, runs in the browser)

function wmpdfParsePageRange(rangeStr, maxPages) {
  const indices = new Set();
  const invalid = [];
  const parts = String(rangeStr || '').split(',').map(p => p.trim()).filter(Boolean);

  for (const part of parts) {
    let m;
    if ((m = /^(\d+)$/.exec(part))) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= maxPages) indices.add(n - 1); else invalid.push(part);
    } else if ((m = /^(\d+)\s*-\s*(\d*)$/.exec(part))) {
      const start = parseInt(m[1], 10);
      const end = m[2] === '' ? maxPages : parseInt(m[2], 10);
      const from = Math.min(start, end);
      const to = Math.max(start, end);
      if (to < 1 || from > maxPages) { invalid.push(part); continue; }
      for (let i = Math.max(1, from); i <= Math.min(maxPages, to); i++) indices.add(i - 1);
    } else {
      invalid.push(part);
    }
  }
  return { indices: Array.from(indices).sort((a, b) => a - b), invalid };
}

function wmpdfClamp(value, min, max, fallback) {
  const n = Number(value);
  if (!isFinite(n) || value === '' || value === null) return fallback;
  return Math.min(max, Math.max(min, n));
}

// The built-in PDF fonts only cover Latin characters. Anything else becomes "?" and is reported.
function wmpdfSanitizeText(str) {
  let replaced = false;
  let out = '';
  for (const ch of String(str || '').replace(/[\r\n\t]+/g, ' ')) {
    const c = ch.codePointAt(0);
    if ((c >= 32 && c <= 126) || (c >= 161 && c <= 255)) out += ch;
    else if (c === 160) out += ' ';
    else { out += '?'; replaced = true; }
  }
  return { text: out.trim(), replaced };
}

// "#aabbcc" or "#abc" -> { r, g, b } between 0 and 1
function wmpdfHexToRgb01(hex) {
  let h = String(hex || '').trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(h)) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return { r: 0.5, g: 0.5, b: 0.5 };
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255
  };
}

// Looks at the first bytes of the file, not the file name.
function wmpdfDetectImageType(bytes) {
  if (!bytes || bytes.length < 4) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'png';
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'jpg';
  return null;
}

function wmpdfNormalizeRotation(deg) {
  const n = Number(deg);
  if (!isFinite(n)) return 0;
  return ((Math.round(n / 90) * 90 % 360) + 360) % 360;
}

function wmpdfVisualSize(box, rot) {
  const r = wmpdfNormalizeRotation(rot);
  return r % 180 === 0 ? { width: box.width, height: box.height } : { width: box.height, height: box.width };
}

// Point on the page as the reader sees it (origin bottom-left) -> point in the file's page space.
function wmpdfMapVisualPoint(vx, vy, box, rot) {
  const r = wmpdfNormalizeRotation(rot);
  const W = box.width;
  const H = box.height;
  let x;
  let y;
  if (r === 0) { x = vx; y = vy; }
  else if (r === 90) { x = W - vy; y = vx; }
  else if (r === 180) { x = W - vx; y = H - vy; }
  else { x = vy; y = H - vx; }
  return { x: box.x + x, y: box.y + y };
}

// pdf-lib rotates text and images around their bottom-left corner.
// Returns the corner to use so that the item's centre ends up at (cx, cy) after rotating by angleDeg.
function wmpdfAnchorForCenter(cx, cy, w, h, angleDeg) {
  const a = angleDeg * Math.PI / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return { x: cx - ((w / 2) * cos - (h / 2) * sin), y: cy - ((w / 2) * sin + (h / 2) * cos) };
}

// Centres for repeating the watermark across the page (staggered grid), in visual coordinates.
function wmpdfTileCenters(vw, vh, w, h, angleDeg, maxTiles) {
  const a = angleDeg * Math.PI / 180;
  const bw = Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a));
  const bh = Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a));
  const gap = Math.max(h, 12) * 1.2;
  let stepX = Math.max(bw + gap, 20);
  let stepY = Math.max(bh + gap, 20);
  const limit = maxTiles || 400;
  const build = () => {
    const out = [];
    let row = 0;
    for (let y = stepY / 2; y < vh + stepY / 2; y += stepY, row++) {
      const offset = row % 2 === 1 ? stepX / 2 : 0;
      for (let x = stepX / 2 - offset; x < vw + stepX / 2; x += stepX) out.push({ x, y });
    }
    return out;
  };
  let tiles = build();
  while (tiles.length > limit) {
    stepX *= 1.25;
    stepY *= 1.25;
    tiles = build();
  }
  return tiles;
}

// Final drawing positions for one page, already converted to the file's page space.
// position: 'center' | 'tiled'. w and h are the unrotated size of the item. angleDeg is the angle the reader sees.
function wmpdfPlacements(position, box, rot, w, h, angleDeg) {
  const v = wmpdfVisualSize(box, rot);
  const centers = position === 'tiled'
    ? wmpdfTileCenters(v.width, v.height, w, h, angleDeg, 400)
    : [{ x: v.width / 2, y: v.height / 2 }];
  const fileAngle = angleDeg + wmpdfNormalizeRotation(rot);
  return centers.map(c => {
    const p = wmpdfMapVisualPoint(c.x, c.y, box, rot);
    const anchor = wmpdfAnchorForCenter(p.x, p.y, w, h, fileAngle);
    return { x: anchor.x, y: anchor.y, angle: fileAngle };
  });
}

function wmpdfLoadErrorMessage(err) {
  const msg = err && err.message ? String(err.message) : '';
  if (/encrypt/i.test(msg)) return 'This PDF is password-protected. Remove the password first, then try again.';
  return 'Could not read this PDF. It may be damaged or not a valid PDF file.';
}

if (typeof module !== 'undefined') {
  module.exports = {
    wmpdfParsePageRange, wmpdfClamp, wmpdfSanitizeText, wmpdfHexToRgb01, wmpdfDetectImageType,
    wmpdfNormalizeRotation, wmpdfVisualSize, wmpdfMapVisualPoint, wmpdfAnchorForCenter,
    wmpdfTileCenters, wmpdfPlacements, wmpdfLoadErrorMessage
  };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const workspace = document.getElementById('workspace');
    const pdfInfo = document.getElementById('pdf-info');
    const textInput = document.getElementById('wmpdf-text');
    const sizeInput = document.getElementById('wmpdf-size');
    const colorInput = document.getElementById('wmpdf-color');
    const opacityInput = document.getElementById('wmpdf-opacity');
    const opacityOut = document.getElementById('wmpdf-opacity-out');
    const angleInput = document.getElementById('wmpdf-angle');
    const posSelect = document.getElementById('wmpdf-position');
    const rangeInput = document.getElementById('wmpdf-range');
    const imageInput = document.getElementById('wmpdf-image');
    const imageName = document.getElementById('wmpdf-image-name');
    const imageClear = document.getElementById('wmpdf-image-clear');
    const imageScale = document.getElementById('wmpdf-image-scale');
    const imageScaleOut = document.getElementById('wmpdf-image-scale-out');
    const imageOpacity = document.getElementById('wmpdf-image-opacity');
    const imageOpacityOut = document.getElementById('wmpdf-image-opacity-out');
    const applyBtn = document.getElementById('wmpdf-btn');
    const resetBtn = document.getElementById('reset-btn');
    const BTN_HTML = '<i class="fa-solid fa-droplet"></i> Add Watermark & Download';
    const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

    let currentFile = null;
    let pdfDoc = null;
    let totalPages = 0;
    let imageBytes = null;
    let imageType = null;

    function showOut(input, out) { out.textContent = input.value + '%'; }
    opacityInput.addEventListener('input', () => showOut(opacityInput, opacityOut));
    imageScale.addEventListener('input', () => showOut(imageScale, imageScaleOut));
    imageOpacity.addEventListener('input', () => showOut(imageOpacity, imageOpacityOut));
    [[opacityInput, opacityOut], [imageScale, imageScaleOut], [imageOpacity, imageOpacityOut]].forEach(([i, o]) => showOut(i, o));

    function clearImage() {
      imageBytes = null;
      imageType = null;
      imageInput.value = '';
      imageName.textContent = 'No image chosen';
      imageClear.classList.add('hidden');
    }

    imageInput.addEventListener('change', async () => {
      const file = imageInput.files && imageInput.files[0];
      if (!file) { clearImage(); return; }
      if (file.size > MAX_IMAGE_BYTES) {
        showToast('This image is larger than 15 MB. Please choose a smaller PNG or JPG.', 'warning');
        clearImage();
        return;
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const type = wmpdfDetectImageType(bytes);
      if (!type) {
        showToast('Only PNG and JPG images can be used as a watermark.', 'warning');
        clearImage();
        return;
      }
      imageBytes = bytes;
      imageType = type;
      imageName.textContent = file.name;
      imageClear.classList.remove('hidden');
    });
    imageClear.addEventListener('click', clearImage);

    async function handleFiles(files) {
      const file = files.find(isPdfFile);
      if (!file) { showToast('Please choose a PDF file.', 'warning'); return; }
      if (typeof PDFLib === 'undefined') {
        showToast('The PDF library could not be loaded. Please check your internet connection and reload.', 'error');
        return;
      }
      try {
        const buf = await file.arrayBuffer();
        pdfDoc = await PDFLib.PDFDocument.load(buf);
        currentFile = file;
        totalPages = pdfDoc.getPageCount();
        pdfInfo.textContent = file.name + ' (' + formatBytes(file.size) + ', ' + totalPages + ' page' + (totalPages === 1 ? '' : 's') + ')';
        rangeInput.value = '';
        dropzone.classList.add('hidden');
        workspace.classList.remove('hidden');
      } catch (err) {
        pdfDoc = null;
        showToast(wmpdfLoadErrorMessage(err), 'error');
      }
    }

    setupDropzone(dropzone, fileInput, handleFiles);

    applyBtn.addEventListener('click', async () => {
      if (!pdfDoc) return;

      const cleaned = wmpdfSanitizeText(textInput.value);
      if (cleaned.text === '' && !imageBytes) {
        showToast('Type some watermark text or choose an image.', 'warning');
        return;
      }
      if (cleaned.replaced) {
        showToast('Some characters are not supported in PDF watermark text and were replaced with "?". Use Latin letters and numbers.', 'warning');
      }

      let indices;
      const rangeText = rangeInput.value.trim();
      if (rangeText === '') {
        indices = Array.from({ length: totalPages }, (_, i) => i);
      } else {
        const parsed = wmpdfParsePageRange(rangeText, totalPages);
        if (parsed.invalid.length > 0) {
          showToast('This PDF has ' + totalPages + ' page' + (totalPages === 1 ? '' : 's') + '. Cannot use: ' + parsed.invalid.join(', '), 'warning');
          return;
        }
        indices = parsed.indices;
      }
      if (indices.length === 0) { showToast('No pages are selected.', 'warning'); return; }

      const size = wmpdfClamp(sizeInput.value, 10, 300, 60);
      const angle = wmpdfClamp(angleInput.value, -180, 180, 45);
      const opacity = wmpdfClamp(opacityInput.value, 5, 100, 30) / 100;
      const imgScale = wmpdfClamp(imageScale.value, 5, 100, 30) / 100;
      const imgOpacity = wmpdfClamp(imageOpacity.value, 5, 100, 30) / 100;
      sizeInput.value = size;
      angleInput.value = angle;
      const rgb = wmpdfHexToRgb01(colorInput.value);
      const position = posSelect.value === 'tiled' ? 'tiled' : 'center';

      applyBtn.disabled = true;
      applyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Adding watermark...';
      try {
        const bytesIn = await pdfDoc.save();
        const work = await PDFLib.PDFDocument.load(bytesIn);

        let font = null;
        if (cleaned.text !== '') font = await work.embedFont(PDFLib.StandardFonts.HelveticaBold);
        let image = null;
        if (imageBytes) image = imageType === 'png' ? await work.embedPng(imageBytes) : await work.embedJpg(imageBytes);

        for (const i of indices) {
          const page = work.getPage(i);
          const box = page.getCropBox();
          const rot = wmpdfNormalizeRotation(page.getRotation().angle);

          if (image) {
            const v = wmpdfVisualSize(box, rot);
            const w = v.width * imgScale;
            const h = w * (image.height / image.width);
            wmpdfPlacements(position, box, rot, w, h, angle).forEach(p => {
              page.drawImage(image, { x: p.x, y: p.y, width: w, height: h, rotate: PDFLib.degrees(p.angle), opacity: imgOpacity });
            });
          }
          if (font) {
            const w = font.widthOfTextAtSize(cleaned.text, size);
            const h = size * 0.72;
            wmpdfPlacements(position, box, rot, w, h, angle).forEach(p => {
              page.drawText(cleaned.text, {
                x: p.x, y: p.y, size, font,
                color: PDFLib.rgb(rgb.r, rgb.g, rgb.b),
                opacity,
                rotate: PDFLib.degrees(p.angle)
              });
            });
          }
        }

        const bytes = await work.save();
        downloadBlob(new Blob([bytes], { type: 'application/pdf' }), 'fixlytools-' + baseName(currentFile.name) + '-watermarked.pdf');
        showToast('Watermark added to ' + indices.length + ' page' + (indices.length === 1 ? '' : 's') + '. Your original file was not changed.', 'success');
      } catch (err) {
        console.error(err);
        showToast('Something went wrong while adding the watermark. The file or image may be damaged.', 'error');
      } finally {
        applyBtn.disabled = false;
        applyBtn.innerHTML = BTN_HTML;
      }
    });

    resetBtn.addEventListener('click', () => {
      currentFile = null;
      pdfDoc = null;
      clearImage();
      workspace.classList.add('hidden');
      dropzone.classList.remove('hidden');
    });
  });
}
