// Fixlytools - Compress Image to a target size (20 KB / 50 KB / 100 KB / 200 KB ...)
// The target is read from data-target-kb on the #tool element of each page.

// Finds the best-looking JPEG that fits in targetBytes.
// 1) measure the image at quality 0.4; 2) if too big, shrink the dimensions until it fits;
// 3) then raise the quality as far as the size limit allows.
// Pure function (takes a "render" callback) so it can be tested without a browser.
async function tcFindBestFit(width, height, targetBytes, render) {
  const MIN_Q = 0.4, MAX_Q = 0.95, MIN_SIDE = 80;

  async function raiseQuality(scale, firstBlob) {
    let best = { blob: firstBlob, quality: MIN_Q };
    let lo = MIN_Q, hi = MAX_Q;
    for (let i = 0; i < 6; i++) {
      const mid = (lo + hi) / 2;
      const blob = await render(scale, mid);
      if (blob && blob.size <= targetBytes) { best = { blob, quality: mid }; lo = mid; } else { hi = mid; }
    }
    return { blob: best.blob, quality: best.quality, scale, fits: true };
  }

  let scale = 1;
  let blob = await render(scale, MIN_Q);
  if (!blob) return null;
  if (blob.size <= targetBytes) return raiseQuality(scale, blob);

  // first guess: file size grows roughly with the pixel count
  scale = Math.min(0.95, Math.sqrt(targetBytes / blob.size));
  let last = blob;
  while (Math.min(width * scale, height * scale) >= MIN_SIDE) {
    blob = await render(scale, MIN_Q);
    if (!blob) return null;
    last = blob;
    if (blob.size <= targetBytes) return raiseQuality(scale, blob);
    scale *= 0.9;
  }
  // could not reach the target even at the smallest allowed size: return the smallest attempt
  return { blob: last, quality: MIN_Q, scale: scale / 0.9, fits: last.size <= targetBytes };
}

if (typeof module !== 'undefined') {
  module.exports = { tcFindBestFit };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const tool = document.getElementById('tool');
    if (!tool) return;
    const targetKb = parseInt(tool.dataset.targetKb, 10) || 100;
    const targetBytes = targetKb * 1000;     // 1000 (not 1024) so the file passes both definitions of "KB"

    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const workspace = document.getElementById('workspace');
    const originalPreview = document.getElementById('original-preview');
    const compressedPreview = document.getElementById('compressed-preview');
    const originalSizeText = document.getElementById('original-size');
    const compressedSizeText = document.getElementById('compressed-size');
    const statusBadge = document.getElementById('status-badge');
    const resultNote = document.getElementById('result-note');
    const downloadBtn = document.getElementById('download-btn');
    const resetBtn = document.getElementById('reset-btn');

    const SUPPORTED = ['image/jpeg', 'image/png', 'image/webp'];
    const MAX_PIXELS = 100000000;
    const GOOD = 'text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300';
    const NEUTRAL = 'text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';

    let currentFile = null;
    let originalUrl = null;
    let compressedUrl = null;
    let result = null;       // { blob, ext }
    let runId = 0;

    function revoke(url) { if (url) URL.revokeObjectURL(url); }

    function setStatus(text, good) {
      statusBadge.textContent = text;
      statusBadge.className = good ? GOOD : NEUTRAL;
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
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      if (width * height > MAX_PIXELS) {
        showToast('This image is too large to process in the browser.', 'error');
        return;
      }

      currentFile = file;
      result = null;
      revoke(originalUrl);
      originalUrl = URL.createObjectURL(file);
      originalPreview.src = originalUrl;
      originalSizeText.textContent = formatBytes(file.size);
      compressedPreview.removeAttribute('src');
      compressedSizeText.textContent = '...';
      resultNote.textContent = 'Compressing your image...';
      setStatus('Working...', false);
      downloadBtn.disabled = true;
      dropzone.classList.add('hidden');
      workspace.classList.remove('hidden');

      const myRun = ++runId;

      // a JPG that is already small enough is returned untouched
      if (file.type === 'image/jpeg' && file.size <= targetBytes) {
        result = { blob: file, ext: 'jpg' };
        showResult(myRun, width, height, width, height, 'Your image is already under ' + targetKb + ' KB, so it was left unchanged.', true);
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      async function render(scale, quality) {
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        ctx.fillStyle = '#ffffff';            // JPG has no transparency: avoid black backgrounds
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return canvasToBlob(canvas, 'image/jpeg', quality);
      }

      let found;
      try {
        found = await tcFindBestFit(width, height, targetBytes, render);
      } catch (err) {
        found = null;
      }
      if (myRun !== runId) return;            // the user reset or chose another file meanwhile
      if (!found) {
        showToast('Could not compress this image. Try a different one.', 'error');
        resetBtn.click();
        return;
      }

      result = { blob: found.blob, ext: 'jpg' };
      const outW = Math.max(1, Math.round(width * found.scale));
      const outH = Math.max(1, Math.round(height * found.scale));
      let note;
      if (found.fits) {
        note = found.scale < 1
          ? 'Done. To fit under ' + targetKb + ' KB the picture was resized from ' + width + ' x ' + height + ' to ' + outW + ' x ' + outH + ' pixels.'
          : 'Done. Your picture keeps its full size of ' + width + ' x ' + height + ' pixels.';
      } else {
        note = 'This image could not be brought under ' + targetKb + ' KB, even at a very small size. The smallest version we could make is shown.';
      }
      showResult(myRun, width, height, outW, outH, note, found.fits);
    }

    function showResult(myRun, w, h, outW, outH, note, fits) {
      if (myRun !== runId || !result) return;
      revoke(compressedUrl);
      compressedUrl = URL.createObjectURL(result.blob);
      compressedPreview.src = compressedUrl;
      compressedSizeText.textContent = formatBytes(result.blob.size) + ' (' + outW + ' x ' + outH + ' px)';
      resultNote.textContent = note;
      setStatus(fits ? 'Under ' + targetKb + ' KB' : 'Over ' + targetKb + ' KB', fits);
      downloadBtn.disabled = false;
    }

    setupDropzone(dropzone, fileInput, handleFiles);

    downloadBtn.addEventListener('click', () => {
      if (!result) return;
      downloadBlob(result.blob, baseName(currentFile.name) + '-' + targetKb + 'kb.' + result.ext);
      showToast('Image downloaded successfully!', 'success');
    });

    resetBtn.addEventListener('click', () => {
      runId++;
      currentFile = null;
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
