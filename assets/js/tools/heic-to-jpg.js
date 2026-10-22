// Fixlytools - HEIC to JPG
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
    if (files.length > 0) handleFile(files[0]);
  });

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) handleFile(fileInput.files[0]);
  });

  function handleFile(file) {
    currentFile = file;
    originalSizeText.textContent = formatBytes(file.size);
    dropzone.classList.add('hidden');
    workspace.classList.remove('hidden');
    convertedBlob = null;
    previewImg.src = '';
    convertedSizeText.textContent = 'Processing...';
    startConversion();
  }

  async function startConversion() {
    if (!currentFile) return;

    convertBtn.disabled = true;
    convertBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Converting HEIC in browser...';

    const targetType = formatSelect.value; // 'image/jpeg' or 'image/png'

    try {
      if (typeof heic2any === 'undefined') {
        throw new Error('heic2any library not loaded');
      }

      const result = await heic2any({
        blob: currentFile,
        toType: targetType,
        quality: 0.92
      });

      convertedBlob = Array.isArray(result) ? result[0] : result;
      previewImg.src = URL.createObjectURL(convertedBlob);
      convertedSizeText.textContent = formatBytes(convertedBlob.size);

      downloadBtn.classList.remove('hidden');
      showToast('HEIC converted to ' + (targetType === 'image/jpeg' ? 'JPG' : 'PNG') + ' successfully!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Could not convert this file. Please verify it is a valid HEIC/HEIF file.', 'error');
      convertedSizeText.textContent = 'Conversion failed';
    } finally {
      convertBtn.disabled = false;
      convertBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Re-Convert';
    }
  }

  formatSelect.addEventListener('change', startConversion);

  downloadBtn.addEventListener('click', () => {
    if (!convertedBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(convertedBlob);
    const ext = formatSelect.value === 'image/jpeg' ? 'jpg' : 'png';
    const baseName = currentFile.name.replace(/\.[^/.]+$/, '');
    a.download = `fixlytools-${baseName}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  resetBtn.addEventListener('click', () => {
    currentFile = null;
    convertedBlob = null;
    fileInput.value = '';
    workspace.classList.add('hidden');
    dropzone.classList.remove('hidden');
  });
});
