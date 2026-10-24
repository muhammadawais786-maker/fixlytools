// Fixlytools - JPG / PNG / WebP Converter
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const fileList = document.getElementById('file-list');
    const targetFormat = document.getElementById('target-format');
    const convertAllBtn = document.getElementById('convert-all-btn');
    const clearBtn = document.getElementById('clear-btn');
    const controls = document.getElementById('controls');

    const MAX_PIXELS = 100000000;
    let queue = [];
    let nextId = 1;

    function getExt(mime) {
      if (mime === 'image/jpeg') return 'jpg';
      if (mime === 'image/webp') return 'webp';
      return 'png';
    }

    function revokeItem(item) {
      if (item.url) URL.revokeObjectURL(item.url);
      item.url = null;
      item.blob = null;
      item.format = null;
      item.failed = false;
    }

    function addFiles(files) {
      const images = files.filter(f => f.type.startsWith('image/'));
      if (images.length < files.length) {
        showToast('Some files were skipped because they are not images.', 'warning');
      }
      images.forEach(file => queue.push({ id: nextId++, file, blob: null, url: null, format: null, failed: false }));
      renderList();
    }

    function renderList() {
      if (queue.length === 0) {
        controls.classList.add('hidden');
        fileList.innerHTML = '';
        return;
      }
      controls.classList.remove('hidden');
      fileList.innerHTML = queue.map(item => {
        let action;
        if (item.blob) {
          const name = `${baseName(item.file.name)}.${getExt(item.format)}`;
          action = `<a href="${item.url}" download="${escapeHtml(name)}"
            class="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 flex items-center gap-1.5">
            <i class="fa-solid fa-download"></i> Save</a>`;
        } else if (item.failed) {
          action = '<span class="text-xs text-rose-500">Could not convert</span>';
        } else {
          action = '<span class="text-xs text-slate-400">Ready</span>';
        }
        return `
          <div class="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600">
            <div class="flex items-center gap-3 overflow-hidden">
              <i class="fa-solid fa-file-image text-purple-600 text-xl"></i>
              <div class="truncate">
                <p class="text-sm font-semibold truncate text-slate-800 dark:text-slate-100">${escapeHtml(item.file.name)}</p>
                <p class="text-xs text-slate-500">${formatBytes(item.file.size)}${item.blob ? ' → ' + formatBytes(item.blob.size) : ''}</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              ${action}
              <button type="button" data-id="${item.id}" class="remove-btn text-slate-400 hover:text-rose-500 p-1" aria-label="Remove ${escapeHtml(item.file.name)}">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>`;
      }).join('');
    }

    fileList.addEventListener('click', (e) => {
      const btn = e.target.closest('.remove-btn');
      if (!btn) return;
      const id = parseInt(btn.dataset.id, 10);
      const idx = queue.findIndex(i => i.id === id);
      if (idx >= 0) {
        revokeItem(queue[idx]);
        queue.splice(idx, 1);
        renderList();
      }
    });

    setupDropzone(dropzone, fileInput, addFiles);

    // results belong to the format they were made in: changing the format resets them
    targetFormat.addEventListener('change', () => {
      queue.forEach(revokeItem);
      renderList();
    });

    async function convertItem(item, format) {
      revokeItem(item);
      try {
        const img = await loadImageFile(item.file);
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (w * h > MAX_PIXELS) throw new Error('too large');
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (format === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
        }
        ctx.drawImage(img, 0, 0);
        const blob = await canvasToBlob(canvas, format, 0.95);
        if (!blob) throw new Error('encode failed');
        item.blob = blob;
        item.format = blob.type || format;
        item.url = URL.createObjectURL(blob);
      } catch (err) {
        item.failed = true;
      }
    }

    convertAllBtn.addEventListener('click', async () => {
      if (queue.length === 0) return;
      const format = targetFormat.value;
      convertAllBtn.disabled = true;
      convertAllBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Converting...';

      for (const item of queue) {
        await convertItem(item, format);
      }

      renderList();
      convertAllBtn.disabled = false;
      convertAllBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Convert All Files';

      const failed = queue.filter(i => i.failed).length;
      const ok = queue.length - failed;
      if (failed === 0) showToast('All images converted successfully!', 'success');
      else if (ok === 0) showToast('None of the files could be converted.', 'error');
      else showToast(`${ok} converted, ${failed} could not be converted.`, 'warning');
    });

    clearBtn.addEventListener('click', () => {
      queue.forEach(revokeItem);
      queue = [];
      fileInput.value = '';
      renderList();
    });
  });
}
