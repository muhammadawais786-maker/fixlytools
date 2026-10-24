// Fixlytools - Image Resizer
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const workspace = document.getElementById('workspace');
    const previewImg = document.getElementById('preview-img');
    const widthInput = document.getElementById('width-input');
    const heightInput = document.getElementById('height-input');
    const lockAspect = document.getElementById('lock-aspect');
    const formatSelect = document.getElementById('format-select');
    const dimensionInfo = document.getElementById('dimension-info');
    const downloadBtn = document.getElementById('download-btn');
    const resetBtn = document.getElementById('reset-btn');
    const presetBtns = document.querySelectorAll('.preset-btn');

    const MAX_SIDE = 10000;
    const MAX_PIXELS = 100000000;

    let originalWidth = 0;
    let originalHeight = 0;
    let aspectRatio = 1;
    let currentFile = null;
    let currentImage = null;
    let previewUrl = null;

    async function handleFiles(files) {
      const file = files.find(f => f.type.startsWith('image/'));
      if (!file) {
        showToast('Please choose an image file (JPG, PNG or WebP).', 'warning');
        return;
      }
      let img;
      try {
        img = await loadImageFile(file);
      } catch (err) {
        showToast('This image could not be read. It may be damaged or in an unsupported format.', 'error');
        return;
      }
      currentFile = file;
      currentImage = img;
      originalWidth = img.naturalWidth || img.width;
      originalHeight = img.naturalHeight || img.height;
      aspectRatio = originalWidth / originalHeight;

      widthInput.value = originalWidth;
      heightInput.value = originalHeight;
      updateInfo();

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(file);
      previewImg.src = previewUrl;
      dropzone.classList.add('hidden');
      workspace.classList.remove('hidden');
    }

    function updateInfo() {
      dimensionInfo.textContent = `Original: ${originalWidth} × ${originalHeight} px | New: ${widthInput.value || '?'} × ${heightInput.value || '?'} px`;
    }

    setupDropzone(dropzone, fileInput, handleFiles);

    widthInput.addEventListener('input', () => {
      const w = parseInt(widthInput.value, 10);
      if (lockAspect.checked && w > 0) heightInput.value = Math.max(1, Math.round(w / aspectRatio));
      updateInfo();
    });

    heightInput.addEventListener('input', () => {
      const h = parseInt(heightInput.value, 10);
      if (lockAspect.checked && h > 0) widthInput.value = Math.max(1, Math.round(h * aspectRatio));
      updateInfo();
    });

    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const scale = parseFloat(btn.dataset.scale);
        widthInput.value = Math.max(1, Math.round(originalWidth * scale));
        heightInput.value = Math.max(1, Math.round(originalHeight * scale));
        updateInfo();
      });
    });

    downloadBtn.addEventListener('click', async () => {
      if (!currentImage) return;

      const targetWidth = parseInt(widthInput.value, 10);
      const targetHeight = parseInt(heightInput.value, 10);
      if (!(targetWidth > 0) || !(targetHeight > 0)) {
        showToast('Please enter a width and height of at least 1 pixel.', 'warning');
        return;
      }
      if (targetWidth > MAX_SIDE || targetHeight > MAX_SIDE || targetWidth * targetHeight > MAX_PIXELS) {
        showToast(`The size is too large. Please keep each side under ${MAX_SIDE} px.`, 'warning');
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';

      const format = formatSelect.value;
      if (format === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';       // JPEG has no transparency: avoid black backgrounds
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      }
      ctx.drawImage(currentImage, 0, 0, targetWidth, targetHeight);

      const blob = await canvasToBlob(canvas, format, 0.92);
      if (!blob) {
        showToast('Could not create the resized image. Try a smaller size.', 'error');
        return;
      }
      // some browsers silently fall back to PNG when a format is unsupported: name the file correctly
      const ext = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png';
      downloadBlob(blob, `fixlytools-${baseName(currentFile.name)}-${targetWidth}x${targetHeight}.${ext}`);
      showToast('Resized image downloaded successfully!', 'success');
    });

    resetBtn.addEventListener('click', () => {
      currentFile = null;
      currentImage = null;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = null;
      previewImg.removeAttribute('src');
      workspace.classList.add('hidden');
      dropzone.classList.remove('hidden');
    });
  });
}
