// Fixlytools - Image Resizer
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

  let originalWidth = 0;
  let originalHeight = 0;
  let aspectRatio = 1;
  let currentFile = null;
  let currentImage = null;

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
    }
  });

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) handleImage(fileInput.files[0]);
  });

  function handleImage(file) {
    currentFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      currentImage = new Image();
      currentImage.onload = () => {
        originalWidth = currentImage.width;
        originalHeight = currentImage.height;
        aspectRatio = originalWidth / originalHeight;

        widthInput.value = originalWidth;
        heightInput.value = originalHeight;
        updateInfo();

        previewImg.src = e.target.result;
        dropzone.classList.add('hidden');
        workspace.classList.remove('hidden');
      };
      currentImage.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function updateInfo() {
    dimensionInfo.textContent = `Original: ${originalWidth} × ${originalHeight} px | New: ${widthInput.value} × ${heightInput.value} px`;
  }

  widthInput.addEventListener('input', () => {
    const w = parseInt(widthInput.value, 10);
    if (lockAspect.checked && w > 0) {
      heightInput.value = Math.round(w / aspectRatio);
    }
    updateInfo();
  });

  heightInput.addEventListener('input', () => {
    const h = parseInt(heightInput.value, 10);
    if (lockAspect.checked && h > 0) {
      widthInput.value = Math.round(h * aspectRatio);
    }
    updateInfo();
  });

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const scale = parseFloat(btn.dataset.scale);
      widthInput.value = Math.round(originalWidth * scale);
      heightInput.value = Math.round(originalHeight * scale);
      updateInfo();
    });
  });

  downloadBtn.addEventListener('click', () => {
    if (!currentImage) return;

    const targetWidth = parseInt(widthInput.value, 10) || originalWidth;
    const targetHeight = parseInt(heightInput.value, 10) || originalHeight;

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(currentImage, 0, 0, targetWidth, targetHeight);

    const format = formatSelect.value;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const ext = format === 'image/jpeg' ? 'jpg' : (format === 'image/webp' ? 'webp' : 'png');
      a.download = `fixlytools-resized-${targetWidth}x${targetHeight}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('Resized image downloaded successfully!', 'success');
    }, format, 0.92);
  });

  resetBtn.addEventListener('click', () => {
    currentFile = null;
    currentImage = null;
    fileInput.value = '';
    workspace.classList.add('hidden');
    dropzone.classList.remove('hidden');
  });
});
