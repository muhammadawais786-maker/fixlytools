// Fixlytools - PDF Compressor
// "light"  : lossless re-pack of the PDF structure with pdf-lib.
// others   : every page is rendered with pdf.js and re-built as a JPEG page (like most online compressors), which shrinks
//            scans and photo-heavy PDFs a lot but turns text into an image.
// It never returns a file that is larger than the original.
const PC_LEVELS = {
  medium:  { dpi: 150, quality: 0.72 },
  strong:  { dpi: 110, quality: 0.58 },
  extreme: { dpi: 80,  quality: 0.45 }
};
const PC_MAX_SIDE = 4000;   // pixels, keeps one page canvas small enough for phones

function pcScaleFor(dpi, widthPt, heightPt) {
  const scale = dpi / 72;
  const side = Math.max(widthPt, heightPt) * scale;
  return side > PC_MAX_SIDE ? PC_MAX_SIDE / Math.max(widthPt, heightPt) : scale;
}

function pcLoadPdfJs() {
  return new Promise((resolve, reject) => {
    if (typeof pdfjsLib !== 'undefined') { resolve(); return; }
    const sc = document.createElement('script');
    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    sc.onload = () => (typeof pdfjsLib !== 'undefined' ? resolve() : reject(new Error('pdfjs missing')));
    sc.onerror = () => reject(new Error('pdfjs failed to load'));
    document.head.appendChild(sc);
  });
}

// Re-builds the PDF with every page as a JPEG. onProgress(done, total) is called after each page.
async function pcRasterCompress(arrayBuffer, level, onProgress) {
  await pcLoadPdfJs();
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const src = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const out = await PDFLib.PDFDocument.create();
  for (let i = 1; i <= src.numPages; i++) {
    const page = await src.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: pcScaleFor(level.dpi, base.width, base.height) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await canvasToBlob(canvas, 'image/jpeg', level.quality);
    canvas.width = canvas.height = 0;
    page.cleanup();
    if (!blob) throw new Error('JPEG encoding failed');
    const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
    const outPage = out.addPage([base.width, base.height]);   // keep the original page size
    outPage.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
    if (onProgress) onProgress(i, src.numPages);
  }
  return out.save({ useObjectStreams: true });
}

if (typeof module !== 'undefined') {
  module.exports = { PC_LEVELS, pcScaleFor };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const workspace = document.getElementById('workspace');
    const originalSizeText = document.getElementById('original-size');
    const compressedSizeText = document.getElementById('compressed-size');
    const savingsText = document.getElementById('savings-percentage');
    const compressBtn = document.getElementById('compress-btn');
    const downloadBtn = document.getElementById('download-btn');
    const resetBtn = document.getElementById('reset-btn');
    const resultCard = document.getElementById('result-card');
    const levelSelect = document.getElementById('level-select');

    let currentFile = null;
    let resultBlob = null;

    function handleFiles(files) {
      const file = files.find(isPdfFile);
      if (!file) {
        showToast('Please choose a PDF file.', 'warning');
        return;
      }
      currentFile = file;
      resultBlob = null;
      originalSizeText.textContent = formatBytes(file.size);
      dropzone.classList.add('hidden');
      workspace.classList.remove('hidden');
      resultCard.classList.add('hidden');
      downloadBtn.classList.add('hidden');
      compressBtn.classList.remove('hidden');
    }

    setupDropzone(dropzone, fileInput, handleFiles);

    compressBtn.addEventListener('click', async () => {
      if (!currentFile) return;
      if (typeof PDFLib === 'undefined') {
        showToast('The PDF library could not be loaded. Please check your internet connection and reload.', 'error');
        return;
      }

      compressBtn.disabled = true;
      compressBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Working...';

      try {
        const arrayBuffer = await currentFile.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);   // fails (as it should) for password-protected files
        let optimizedBytes;
        const level = PC_LEVELS[levelSelect.value];
        if (level) {
          optimizedBytes = await pcRasterCompress(arrayBuffer, level, (done, total) => {
            compressBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Compressing page ${done} of ${total}...`;
          });
        } else {
          optimizedBytes = await pdfDoc.save({ useObjectStreams: true });
        }

        let message;
        if (optimizedBytes.length < currentFile.size) {
          resultBlob = new Blob([optimizedBytes], { type: 'application/pdf' });
          const pct = Math.round(((currentFile.size - resultBlob.size) / currentFile.size) * 100);
          savingsText.textContent = pct > 0 ? `-${pct}% Saved` : 'Slightly smaller';
          message = level ? 'PDF compressed. Note: text in this version is part of the page image.' : 'PDF optimized successfully!';
        } else {
          // the re-packed file would be bigger: give the original back untouched
          resultBlob = currentFile;
          savingsText.textContent = 'Already optimized';
          message = level ? 'This PDF could not be made smaller at this level, so your original is returned.' : 'This PDF is already well optimized. Try a stronger compression level to reduce it further.';
        }

        compressedSizeText.textContent = formatBytes(resultBlob.size);
        resultCard.classList.remove('hidden');
        downloadBtn.classList.remove('hidden');
        compressBtn.classList.add('hidden');
        showToast(message, 'success');
      } catch (err) {
        console.error(err);
        showToast('Could not process this PDF. It may be password-protected, damaged or too large for this device.', 'error');
      } finally {
        compressBtn.disabled = false;
        compressBtn.innerHTML = '<i class="fa-solid fa-compress"></i> Compress PDF Now';
      }
    });

    downloadBtn.addEventListener('click', () => {
      if (!resultBlob) return;
      downloadBlob(resultBlob, `fixlytools-optimized-${baseName(currentFile.name)}.pdf`);
      showToast('PDF downloaded!', 'success');
    });

    resetBtn.addEventListener('click', () => {
      currentFile = null;
      resultBlob = null;
      workspace.classList.add('hidden');
      dropzone.classList.remove('hidden');
    });
  });
}
