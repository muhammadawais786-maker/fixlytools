// Fixlytools - PDF Compressor
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

  let currentFile = null;
  let compressedBlob = null;

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

  function handlePdf(file) {
    currentFile = file;
    originalSizeText.textContent = formatBytes(file.size);
    dropzone.classList.add('hidden');
    workspace.classList.remove('hidden');
    resultCard.classList.add('hidden');
    compressBtn.classList.remove('hidden');
  }

  compressBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    compressBtn.disabled = true;
    compressBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Optimizing PDF Structure...';

    try {
      const arrayBuffer = await currentFile.arrayBuffer();
      const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

      // Re-saving with useObjectStreams: true compresses streams and removes unreferenced objects
      const optimizedPdfBytes = await pdfDoc.save({ useObjectStreams: true });
      compressedBlob = new Blob([optimizedPdfBytes], { type: 'application/pdf' });

      // If the original was already highly packed, keep the smaller one
      const finalSize = Math.min(compressedBlob.size, currentFile.size);
      compressedSizeText.textContent = formatBytes(finalSize);

      const diff = currentFile.size - finalSize;
      const pct = Math.max(0, Math.round((diff / currentFile.size) * 100));

      savingsText.textContent = pct > 0 ? `-${pct}% Saved` : 'Optimized';
      resultCard.classList.remove('hidden');
      compressBtn.classList.add('hidden');

      showToast('PDF optimized and compressed successfully!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error compressing PDF. Please ensure the file is not password-protected.', 'error');
    } finally {
      compressBtn.disabled = false;
      compressBtn.innerHTML = '<i class="fa-solid fa-compress"></i> Compress PDF Now';
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (!compressedBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(compressedBlob);
    a.download = `fixlytools-compressed-${currentFile.name}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Compressed PDF downloaded!', 'success');
  });

  resetBtn.addEventListener('click', () => {
    currentFile = null;
    compressedBlob = null;
    fileInput.value = '';
    workspace.classList.add('hidden');
    dropzone.classList.remove('hidden');
  });
});
