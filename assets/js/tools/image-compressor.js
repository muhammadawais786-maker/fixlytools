// Fixlytools - Image Compressor
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

  let currentFile = null;
  let currentImage = null;
  let compressedBlob = null;

  // Dropzone drag-and-drop
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-active');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-active');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      handleImage(files[0]);
    } else {
      showToast('Please upload a valid image file (JPG, PNG, WebP).', 'warning');
    }
  });

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleImage(fileInput.files[0]);
    }
  });

  function handleImage(file) {
    currentFile = file;
    originalSizeText.textContent = formatBytes(file.size);

    const reader = new FileReader();
    reader.onload = (e) => {
      currentImage = new Image();
      currentImage.onload = () => {
        originalPreview.src = e.target.result;
        dropzone.classList.add('hidden');
        workspace.classList.remove('hidden');
        compressImage();
      };
      currentImage.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  qualitySlider.addEventListener('input', () => {
    qualityValue.textContent = `${qualitySlider.value}%`;
    compressImage();
  });

  function compressImage() {
    if (!currentImage) return;

    const canvas = document.createElement('canvas');
    canvas.width = currentImage.width;
    canvas.height = currentImage.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(currentImage, 0, 0);

    const quality = parseFloat(qualitySlider.value) / 100;
    const mimeType = currentFile.type === 'image/png' ? 'image/jpeg' : currentFile.type;

    canvas.toBlob((blob) => {
      if (!blob) return;
      compressedBlob = blob;
      compressedPreview.src = URL.createObjectURL(blob);
      compressedSizeText.textContent = formatBytes(blob.size);

      const diff = currentFile.size - blob.size;
      const pct = Math.round((diff / currentFile.size) * 100);
      if (pct > 0) {
        savingsText.textContent = `-${pct}% Saved`;
        savingsText.className = 'text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300';
      } else {
        savingsText.textContent = `0% Saved`;
        savingsText.className = 'text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
      }
    }, mimeType, quality);
  }

  downloadBtn.addEventListener('click', () => {
    if (!compressedBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(compressedBlob);
    const ext = currentFile.type === 'image/png' ? 'jpg' : currentFile.name.split('.').pop();
    a.download = `fixlytools-compressed-${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Compressed image downloaded successfully!', 'success');
  });

  resetBtn.addEventListener('click', () => {
    currentFile = null;
    currentImage = null;
    compressedBlob = null;
    fileInput.value = '';
    workspace.classList.add('hidden');
    dropzone.classList.remove('hidden');
  });
});
