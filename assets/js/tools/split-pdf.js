// Fixlytools - Split PDF
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

  ['dragenter', 'dragover'].forEach(name => {
    dropzone.addEventListener(name, (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-active');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    dropzone.addEventListener(name, (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-active');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].name.endsWith('.pdf')) {
      handlePdf(files[0]);
    }
  });

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) handlePdf(fileInput.files[0]);
  });

  async function handlePdf(file) {
    currentFile = file;
    try {
      const arrayBuffer = await file.arrayBuffer();
      pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
      totalPages = pdfDoc.getPageCount();

      pdfInfo.textContent = `${file.name} (${formatBytes(file.size)}, ${totalPages} Total Pages)`;
      pageRangeInput.placeholder = `e.g. 1-${Math.min(3, totalPages)} or 1, 3, 5`;
      pageRangeInput.value = `1-${Math.min(totalPages, 2)}`;

      dropzone.classList.add('hidden');
      workspace.classList.remove('hidden');
    } catch (err) {
      showToast('Could not load PDF. It may be encrypted or corrupted.', 'error');
    }
  }

  function parsePageRange(rangeStr, maxPages) {
    const indices = new Set();
    const parts = rangeStr.split(',');

    for (let part of parts) {
      const clean = part.trim();
      if (clean.includes('-')) {
        const [start, end] = clean.split('-').map(n => parseInt(n.trim(), 10));
        if (!isNaN(start) && !isNaN(end)) {
          const from = Math.max(1, Math.min(start, end));
          const to = Math.min(maxPages, Math.max(start, end));
          for (let i = from; i <= to; i++) {
            indices.add(i - 1);
          }
        }
      } else {
        const pageNum = parseInt(clean, 10);
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= maxPages) {
          indices.add(pageNum - 1);
        }
      }
    }

    return Array.from(indices).sort((a, b) => a - b);
  }

  splitBtn.addEventListener('click', async () => {
    if (!pdfDoc) return;
    const rangeStr = pageRangeInput.value.trim();
    const pageIndices = parsePageRange(rangeStr, totalPages);

    if (pageIndices.length === 0) {
      showToast(`Please enter valid page numbers between 1 and ${totalPages}.`, 'warning');
      return;
    }

    splitBtn.disabled = true;
    splitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Extracting Pages...';

    try {
      const newPdf = await PDFLib.PDFDocument.create();
      const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);
      copiedPages.forEach(p => newPdf.addPage(p));

      const pdfBytes = await newPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });

      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `fixlytools-split-pages-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      showToast(`Successfully extracted ${pageIndices.length} pages!`, 'success');
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
    fileInput.value = '';
    workspace.classList.add('hidden');
    dropzone.classList.remove('hidden');
  });
});
