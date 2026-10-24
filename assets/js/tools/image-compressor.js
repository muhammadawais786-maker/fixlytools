// Fixlytools - Image Compressor
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const workspace = document.getElementById('workspace');
    const originalPreview = document.getElementById('original-preview');
    const compressedPreview = document.getElementById('compressed-preview');
    const originalSizeText = document.getElementById('original-size');
    const compressedSizeText = document.getElementById('compressed-size');
    const savingsText = document.getElementById('savings-percentage');
    const qualitySlider = document.getElementById('quality-slider');
    const qualityValue = document.getElementById('quality-value');
    const downloadBtn = document.getElementById('download-btn');
    const resetBtn = document.getElementById('reset-btn');

    const SUPPORTED = ['image/jpeg', 'image/png', 'image/webp'];
    const MAX_PIXELS = 100000000; // browsers fail on canvases bigger than this

    let currentFile = null;
    let currentImage = null;
    let originalUrl = null;
    let compressedUrl = null;
    let result = null;      // { blob, ext, isOriginal }
    let runId = 0;
    let timer = null;

    function revoke(url) { if (url) URL.revokeObjectURL(url); }

    function extFor(type) {
      return type === 'image/jpeg' ? 'jpg' : type === 'image/webp' ? 'webp' : 'png';
    }

    async function handleFiles(files) {
      const file = files[0];
      if (!SUPPORTED.includes(file.type)) {
        showToast('Please choose a JPG, PNG or WebP image.', 'warning');
        return;
      }
      let img;
      try {
        img = await loadImageFile(file);
      } catch (err) {
        showToast('This image could not be read. It may be damaged.', 'error');
        return;
      }
      if (img.width * img.height > MAX_PIXELS) {
        showToast('This image is too large to process in the browser.', 'error');
        return;
      }
      currentFile = file;
      currentImage = img;
      originalSizeText.textContent = formatBytes(file.size);
      revoke(originalUrl);
      originalUrl = URL.createObjectURL(file);
      originalPreview.src = originalUrl;
      dropzone.classList.add('hidden');
      workspace.classList.remove('hidden');
      if (file.type === 'image/png') {
        showToast('PNG images are saved as JPG to reduce size. Transparent areas become white.', 'info');
      }
      compressImage();
    }

    async function compressImage() {
      if (!currentImage) return;
      const myRun = ++runId;

      const canvas = document.createElement('canvas');
      canvas.width = currentImage.naturalWidth || currentImage.width;
      canvas.height = currentImage.naturalHeight || currentImage.height;
      const ctx = canvas.getContext('2d');
      const outType = currentFile.type === 'image/png' ? 'image/jpeg' : currentFile.type;
      if (outType === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';       // JPEG has no transparency: avoid black backgrounds
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(currentImage, 0, 0);

      const quality = parseFloat(qualitySlider.value) / 100;
      const blob = await canvasToBlob(canvas, outType, quality);
      if (myRun !== runId) return;         // a newer run replaced this one
      if (!blob) {
        showToast('Could not compress this image. Try a smaller one.', 'error');
        return;
      }

      // never hand back a file that is bigger than the one the user uploaded
      const biggerThanOriginal = blob.size >= currentFile.size && outType === currentFile.type;
      result = biggerThanOriginal
        ? { blob: currentFile, ext: extFor(currentFile.type), isOriginal: true }
        : { blob, ext: extFor(blob.type || outType), isOriginal: false };

      revoke(compressedUrl);
      compressedUrl = URL.createObjectURL(result.blob);
      compressedPreview.src = compressedUrl;
      compressedSizeText.textContent = formatBytes(result.blob.size);

      const pct = Math.round(((currentFile.size - result.blob.size) / currentFile.size) * 100);
      if (pct > 0) {
        savingsText.textContent = `-${pct}% Saved`;
        savingsText.className = 'text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300';
      } else {
        savingsText.textContent = result.isOriginal ? 'Already optimized' : '0% Saved';
        savingsText.className = 'text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
      }
    }

    setupDropzone(dropzone, fileInput, handleFiles);

    qualitySlider.addEventListener('input', () => {
      qualityValue.textContent = `${qualitySlider.value}%`;
      clearTimeout(timer);
      timer = setTimeout(compressImage, 120);
    });

    downloadBtn.addEventListener('click', () => {
      if (!result) return;
      downloadBlob(result.blob, `fixlytools-compressed-${baseName(currentFile.name)}.${result.ext}`);
      showToast('Image downloaded successfully!', 'success');
    });

    resetBtn.addEventListener('click', () => {
      runId++;
      currentFile = null;
      currentImage = null;
      result = null;
      revoke(originalUrl); revoke(compressedUrl);
      originalUrl = compressedUrl = null;
      originalPreview.removeAttribute('src');
      compressedPreview.removeAttribute('src');
      workspace.classList.add('hidden');
      dropzone.classList.remove('hidden');
    });
  });
}
