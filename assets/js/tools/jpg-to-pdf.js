// Fixlytools - JPG to PDF

const A4_W = 595.28;
const A4_H = 841.89;

// Works out the PDF page size and where the picture sits on it. Pictures are never stretched.
function pdfPageLayout(imgW, imgH, mode) {
  if (mode === 'portrait' || mode === 'landscape') {
    const pageW = mode === 'portrait' ? A4_W : A4_H;
    const pageH = mode === 'portrait' ? A4_H : A4_W;
    const margin = 24;
    const scale = Math.min((pageW - 2 * margin) / imgW, (pageH - 2 * margin) / imgH);
    const w = imgW * scale;
    const h = imgH * scale;
    return { pageW, pageH, x: (pageW - w) / 2, y: (pageH - h) / 2, w, h };
  }
  // auto: the page has the same shape as the picture, scaled so its long side equals an A4 long side
  const scale = A4_H / Math.max(imgW, imgH);
  const w = imgW * scale;
  const h = imgH * scale;
  return { pageW: w, pageH: h, x: 0, y: 0, w, h };
}

// Reads the EXIF orientation of a JPEG (1 = normal). Phone photos are often stored rotated with this flag.
function jpegOrientation(buffer) {
  const v = new DataView(buffer);
  if (v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return 1;
  let off = 2;
  while (off + 4 < v.byteLength) {
    const marker = v.getUint16(off);
    off += 2;
    if (marker === 0xFFE1) {
      if (off + 10 > v.byteLength || v.getUint32(off + 2) !== 0x45786966) return 1; // "Exif"
      const tiff = off + 8;
      const little = v.getUint16(tiff) === 0x4949;
      const ifd = tiff + v.getUint32(tiff + 4, little);
      if (ifd + 2 > v.byteLength) return 1;
      const entries = v.getUint16(ifd, little);
      for (let i = 0; i < entries; i++) {
        const e = ifd + 2 + i * 12;
        if (e + 12 > v.byteLength) return 1;
        if (v.getUint16(e, little) === 0x0112) return v.getUint16(e + 8, little);
      }
      return 1;
    }
    if ((marker & 0xFF00) !== 0xFF00) return 1;
    off += v.getUint16(off);
  }
  return 1;
}

if (typeof module !== 'undefined') {
  module.exports = { pdfPageLayout, jpegOrientation };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const workspace = document.getElementById('workspace');
    const imageGrid = document.getElementById('image-grid');
    const addMoreBtn = document.getElementById('add-more-btn');
    const clearBtn = document.getElementById('clear-btn');
    const convertPdfBtn = document.getElementById('convert-pdf-btn');
    const orientationSelect = document.getElementById('orientation-select');

    let images = [];
    let nextId = 1;

    function addImages(files) {
      const valid = files.filter(f => f.type.startsWith('image/'));
      if (valid.length < files.length) showToast('Some files were skipped because they are not images.', 'warning');
      // order is the order the files were chosen in
      valid.forEach(file => images.push({ id: nextId++, file, url: URL.createObjectURL(file) }));
      renderGrid();
    }

    function removeImage(id) {
      const idx = images.findIndex(i => i.id === id);
      if (idx >= 0) {
        URL.revokeObjectURL(images[idx].url);
        images.splice(idx, 1);
        renderGrid();
      }
    }

    function renderGrid() {
      if (images.length === 0) {
        workspace.classList.add('hidden');
        dropzone.classList.remove('hidden');
        imageGrid.innerHTML = '';
        return;
      }
      dropzone.classList.add('hidden');
      workspace.classList.remove('hidden');

      imageGrid.innerHTML = images.map((item, idx) => `
        <div class="relative group bg-slate-100 dark:bg-slate-700 rounded-xl p-2 border border-slate-200 dark:border-slate-600 flex flex-col items-center">
          <span class="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">${idx + 1}</span>
          <button type="button" data-id="${item.id}" aria-label="Remove ${escapeHtml(item.file.name)}" class="remove-btn absolute top-2 right-2 bg-rose-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs opacity-80 hover:opacity-100">
            <i class="fa-solid fa-xmark"></i>
          </button>
          <img src="${item.url}" class="h-28 w-full object-contain rounded mt-4" alt="Image ${idx + 1}: ${escapeHtml(item.file.name)}">
          <p class="text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate w-full mt-2 text-center">${escapeHtml(item.file.name)}</p>
        </div>
      `).join('');
    }

    imageGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.remove-btn');
      if (btn) removeImage(parseInt(btn.dataset.id, 10));
    });

    // Draws any browser-readable image on a canvas and returns JPEG or PNG bytes
    async function reencode(file, asPng) {
      const img = await loadImageFile(file);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!asPng) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0);
      const blob = await canvasToBlob(canvas, asPng ? 'image/png' : 'image/jpeg', 0.92);
      if (!blob) throw new Error('encode failed');
      return { bytes: new Uint8Array(await blob.arrayBuffer()), png: asPng };
    }

    async function embedImage(pdfDoc, file) {
      const buffer = await file.arrayBuffer();
      const isJpeg = file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name);
      const isPng = file.type === 'image/png' || /\.png$/i.test(file.name);

      try {
        if (isJpeg && jpegOrientation(buffer) === 1) return await pdfDoc.embedJpg(buffer);
        if (isPng) return await pdfDoc.embedPng(buffer);
      } catch (err) {
        // fall through and let the browser re-draw the picture
      }
      // rotated JPEGs, WebP, GIF, BMP and unusual PNGs: re-draw through the browser (also applies EXIF rotation)
      const { bytes, png } = await reencode(file, isPng);
      return png ? pdfDoc.embedPng(bytes) : pdfDoc.embedJpg(bytes);
    }

    convertPdfBtn.addEventListener('click', async () => {
      if (images.length === 0) return;
      if (typeof PDFLib === 'undefined') {
        showToast('The PDF library could not be loaded. Please check your internet connection and reload.', 'error');
        return;
      }

      convertPdfBtn.disabled = true;
      convertPdfBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating PDF...';
      let currentName = '';

      try {
        const pdfDoc = await PDFLib.PDFDocument.create();
        const mode = orientationSelect.value;

        for (const item of images) {
          currentName = item.file.name;
          const pdfImage = await embedImage(pdfDoc, item.file);
          const L = pdfPageLayout(pdfImage.width, pdfImage.height, mode);
          const page = pdfDoc.addPage([L.pageW, L.pageH]);
          page.drawImage(pdfImage, { x: L.x, y: L.y, width: L.w, height: L.h });
        }

        const pdfBytes = await pdfDoc.save();
        downloadBlob(new Blob([pdfBytes], { type: 'application/pdf' }), `fixlytools-images-${Date.now()}.pdf`);
        showToast('Images converted to PDF successfully!', 'success');
      } catch (err) {
        console.error(err);
        showToast(`Could not add "${currentName}" to the PDF. Please remove it and try again.`, 'error');
      } finally {
        convertPdfBtn.disabled = false;
        convertPdfBtn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Convert Images to PDF';
      }
    });

    setupDropzone(dropzone, fileInput, addImages);
    addMoreBtn.addEventListener('click', () => fileInput.click());

    clearBtn.addEventListener('click', () => {
      images.forEach(i => URL.revokeObjectURL(i.url));
      images = [];
      renderGrid();
    });
  });
}
