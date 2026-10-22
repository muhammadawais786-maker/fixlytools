// Fixlytools - JPG / PNG / WebP Converter
document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const fileList = document.getElementById('file-list');
  const targetFormat = document.getElementById('target-format');
  const convertAllBtn = document.getElementById('convert-all-btn');
  const clearBtn = document.getElementById('clear-btn');
  const controls = document.getElementById('controls');

  let queue = [];

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
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) addFiles(files);
  });

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) addFiles(Array.from(fileInput.files));
  });

  function addFiles(files) {
    files.forEach(file => {
      queue.push({
        file,
        convertedBlob: null,
        id: Math.random().toString(36).substring(7)
      });
    });
    renderList();
  }

  function renderList() {
    if (queue.length === 0) {
      controls.classList.add('hidden');
      fileList.innerHTML = '';
      return;
    }

    controls.classList.remove('hidden');
    fileList.innerHTML = queue.map((item, index) => `
      <div class="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600">
        <div class="flex items-center gap-3 overflow-hidden">
          <i class="fa-solid fa-file-image text-purple-600 text-xl"></i>
          <div class="truncate">
            <p class="text-sm font-semibold truncate text-slate-800 dark:text-slate-100">${item.file.name}</p>
            <p class="text-xs text-slate-500">${formatBytes(item.file.size)}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          ${item.convertedBlob ? `
            <a href="${URL.createObjectURL(item.convertedBlob)}" download="converted-${item.file.name.split('.')[0]}.${getExt(targetFormat.value)}" 
              class="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 flex items-center gap-1.5">
              <i class="fa-solid fa-download"></i> Save
            </a>
          ` : `
            <span class="text-xs text-slate-400">Ready</span>
          `}
          <button data-index="${index}" class="remove-btn text-slate-400 hover:text-rose-500 p-1">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>
    `).join('');

    document.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(btn.dataset.index, 10);
        queue.splice(idx, 1);
        renderList();
      });
    });
  }

  function getExt(mime) {
    if (mime === 'image/jpeg') return 'jpg';
    if (mime === 'image/webp') return 'webp';
    return 'png';
  }

  convertAllBtn.addEventListener('click', async () => {
    if (queue.length === 0) return;
    const format = targetFormat.value;
    convertAllBtn.disabled = true;
    convertAllBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Converting...';

    for (let item of queue) {
      await convertItem(item, format);
    }

    renderList();
    convertAllBtn.disabled = false;
    convertAllBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Convert All Files';
    showToast('All images converted successfully!', 'success');
  });

  function convertItem(item, format) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (format === 'image/jpeg') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            item.convertedBlob = blob;
            resolve();
          }, format, 0.95);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(item.file);
    });
  }

  clearBtn.addEventListener('click', () => {
    queue = [];
    fileInput.value = '';
    renderList();
  });
});
