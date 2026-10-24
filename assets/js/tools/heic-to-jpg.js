// Fixlytools - HEIC to JPG
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const workspace = document.getElementById('workspace');
    const previewImg = document.getElementById('preview-img');
    const originalSizeText = document.getElementById('original-size');
    const convertedSizeText = document.getElementById('converted-size');
    const convertBtn = document.getElementById('convert-btn');
    const downloadBtn = document.getElementById('download-btn');
    const resetBtn = document.getElementById('reset-btn');
    const formatSelect = document.getElementById('format-select');

    let currentFile = null;
    let convertedBlob = null;
    let previewUrl = null;
    let runId = 0;

    function isHeic(file) {
      return /\.(heic|heif)$/i.test(file.name) || /image\/(heic|heif)/i.test(file.type);
    }

    function handleFiles(files) {
      const file = files.find(isHeic);
      if (!file) {
        showToast('Please choose a HEIC or HEIF photo.', 'warning');
        return;
      }
      currentFile = file;
      originalSizeText.textContent = formatBytes(file.size);
      dropzone.classList.add('hidden');
      workspace.classList.remove('hidden');
      startConversion();
    }

    async function startConversion() {
      if (!currentFile) return;
      const myRun = ++runId;

      convertedBlob = null;
      downloadBtn.classList.add('hidden');
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = null;
      previewImg.removeAttribute('src');
      convertedSizeText.textContent = 'Processing...';
      convertBtn.disabled = true;
      convertBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Converting HEIC in browser...';

      const targetType = formatSelect.value; // 'image/jpeg' or 'image/png'

      try {
        if (typeof heic2any === 'undefined') {
          throw new Error('heic2any library not loaded');
        }
        const result = await heic2any({ blob: currentFile, toType: targetType, quality: 0.92 });
        if (myRun !== runId) return;     // the user changed the format or the file meanwhile

        convertedBlob = Array.isArray(result) ? result[0] : result;
        previewUrl = URL.createObjectURL(convertedBlob);
        previewImg.src = previewUrl;
        convertedSizeText.textContent = formatBytes(convertedBlob.size);
        downloadBtn.classList.remove('hidden');
        showToast('HEIC converted to ' + (targetType === 'image/jpeg' ? 'JPG' : 'PNG') + ' successfully!', 'success');
      } catch (err) {
        if (myRun !== runId) return;
        console.error(err);
        showToast('Could not convert this file. Please verify it is a valid HEIC/HEIF photo and that you are online.', 'error');
        convertedSizeText.textContent = 'Conversion failed';
      } finally {
        if (myRun === runId) {
          convertBtn.disabled = false;
          convertBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Re-Convert';
        }
      }
    }

    setupDropzone(dropzone, fileInput, handleFiles);

    convertBtn.addEventListener('click', startConversion);
    formatSelect.addEventListener('change', startConversion);

    downloadBtn.addEventListener('click', () => {
      if (!convertedBlob) return;
      const ext = formatSelect.value === 'image/jpeg' ? 'jpg' : 'png';
      downloadBlob(convertedBlob, `fixlytools-${baseName(currentFile.name)}.${ext}`);
    });

    resetBtn.addEventListener('click', () => {
      runId++;
      currentFile = null;
      convertedBlob = null;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = null;
      previewImg.removeAttribute('src');
      downloadBtn.classList.add('hidden');
      workspace.classList.add('hidden');
      dropzone.classList.remove('hidden');
    });
  });
}
