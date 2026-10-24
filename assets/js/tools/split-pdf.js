// Fixlytools - Split PDF (extract pages)

// Turns "1-3, 7, 10-" into zero-based page indices. Returns { indices, invalid } so bad parts can be reported.
function spParsePageRange(rangeStr, maxPages) {
  const indices = new Set();
  const invalid = [];
  const parts = rangeStr.split(',').map(p => p.trim()).filter(Boolean);

  for (const part of parts) {
    let m;
    if ((m = /^(\d+)$/.exec(part))) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= maxPages) indices.add(n - 1); else invalid.push(part);
    } else if ((m = /^(\d+)\s*-\s*(\d*)$/.exec(part))) {
      const start = parseInt(m[1], 10);
      const end = m[2] === '' ? maxPages : parseInt(m[2], 10);   // "5-" means page 5 to the last page
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

if (typeof module !== 'undefined') {
  module.exports = { spParsePageRange };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const workspace = document.getElementById('workspace');
    const pdfInfo = document.getElementById('pdf-info');
    const pageRangeInput = document.getElementById('page-range-input');
    const splitBtn = document.getElementById('split-btn');
    const resetBtn = document.getElementById('reset-btn');

    let currentFile = null;
    let pdfDoc = null;
    let totalPages = 0;

    async function handleFiles(files) {
      const file = files.find(isPdfFile);
      if (!file) {
        showToast('Please choose a PDF file.', 'warning');
        return;
      }
      if (typeof PDFLib === 'undefined') {
        showToast('The PDF library could not be loaded. Please check your internet connection and reload.', 'error');
        return;
      }
      try {
        const arrayBuffer = await file.arrayBuffer();
        pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
        currentFile = file;
        totalPages = pdfDoc.getPageCount();

        pdfInfo.textContent = `${file.name} (${formatBytes(file.size)}, ${totalPages} Total Pages)`;
        pageRangeInput.placeholder = `e.g. 1-${Math.min(3, totalPages)} or 1, 3, 5`;
        pageRangeInput.value = `1-${Math.min(totalPages, 2)}`;

        dropzone.classList.add('hidden');
        workspace.classList.remove('hidden');
      } catch (err) {
        showToast('Could not load this PDF. It may be password-protected or corrupted.', 'error');
      }
    }

    setupDropzone(dropzone, fileInput, handleFiles);

    splitBtn.addEventListener('click', async () => {
      if (!pdfDoc) return;
      const { indices, invalid } = spParsePageRange(pageRangeInput.value, totalPages);

      if (indices.length === 0) {
        showToast(`Please enter valid page numbers between 1 and ${totalPages}.`, 'warning');
        return;
      }
      if (invalid.length > 0) {
        showToast(`Ignored invalid part(s): ${invalid.join(', ')}`, 'warning');
      }

      splitBtn.disabled = true;
      splitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Extracting Pages...';

      try {
        const newPdf = await PDFLib.PDFDocument.create();
        const copiedPages = await newPdf.copyPages(pdfDoc, indices);
        copiedPages.forEach(p => newPdf.addPage(p));
        const pdfBytes = await newPdf.save();
        downloadBlob(new Blob([pdfBytes], { type: 'application/pdf' }), `fixlytools-${baseName(currentFile.name)}-pages.pdf`);
        showToast(`Successfully extracted ${indices.length} page${indices.length === 1 ? '' : 's'}!`, 'success');
      } catch (err) {
        console.error(err);
        showToast('Error splitting PDF.', 'error');
      } finally {
        splitBtn.disabled = false;
        splitBtn.innerHTML = '<i class="fa-solid fa-scissors"></i> Extract & Download PDF';
      }
    });

    resetBtn.addEventListener('click', () => {
      currentFile = null;
      pdfDoc = null;
      workspace.classList.add('hidden');
      dropzone.classList.remove('hidden');
    });
  });
}
