// Fixlytools - PDF Compressor (lossless structure optimization)
// The tool re-packs the PDF with pdf-lib. It never returns a file that is larger than the original.
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
      compressBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Optimizing PDF Structure...';

      try {
        const arrayBuffer = await currentFile.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);   // fails (as it should) for password-protected files
        const optimizedBytes = await pdfDoc.save({ useObjectStreams: true });

        let message;
        if (optimizedBytes.length < currentFile.size) {
          resultBlob = new Blob([optimizedBytes], { type: 'application/pdf' });
          const pct = Math.round(((currentFile.size - resultBlob.size) / currentFile.size) * 100);
          savingsText.textContent = pct > 0 ? `-${pct}% Saved` : 'Slightly smaller';
          message = 'PDF optimized successfully!';
        } else {
          // the re-packed file would be bigger: give the original back untouched
          resultBlob = currentFile;
          savingsText.textContent = 'Already optimized';
          message = 'This PDF is already well optimized, so its size cannot be reduced further.';
        }

        compressedSizeText.textContent = formatBytes(resultBlob.size);
        resultCard.classList.remove('hidden');
        downloadBtn.classList.remove('hidden');
        compressBtn.classList.add('hidden');
        showToast(message, 'success');
      } catch (err) {
        console.error(err);
        showToast('Could not process this PDF. It may be password-protected or damaged.', 'error');
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
