// Fixlytools - Merge PDF
document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const workspace = document.getElementById('workspace');
  const pdfList = document.getElementById('pdf-list');
  const mergeBtn = document.getElementById('merge-btn');
  const addMoreBtn = document.getElementById('add-more-btn');
  const clearBtn = document.getElementById('clear-btn');

  let pdfFiles = [];

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
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
    if (files.length > 0) handleFiles(files);
  });

  dropzone.addEventListener('click', () => fileInput.click());
  addMoreBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleFiles(Array.from(fileInput.files));
    }
  });

  async function handleFiles(files) {
    for (let file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
        const pageCount = pdfDoc.getPageCount();
        pdfFiles.push({
          file,
          arrayBuffer,
          pageCount,
          id: Math.random().toString(36).substring(7)
        });
      } catch (err) {
        showToast(`Could not read ${file.name}. It might be corrupted or encrypted.`, 'error');
      }
    }
    renderList();
  }

  function renderList() {
    if (pdfFiles.length === 0) {
      workspace.classList.add('hidden');
      dropzone.classList.remove('hidden');
      return;
    }

    dropzone.classList.add('hidden');
    workspace.classList.remove('hidden');

    pdfList.innerHTML = pdfFiles.map((item, idx) => `
      <div class="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600">
        <div class="flex items-center gap-3 overflow-hidden">
          <span class="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 font-bold text-xs flex items-center justify-center shrink-0">
            ${idx + 1}
          </span>
          <div class="truncate">
            <p class="text-sm font-semibold truncate text-slate-800 dark:text-slate-100">${item.file.name}</p>
            <p class="text-xs text-slate-500">${formatBytes(item.file.size)} &bull; ${item.pageCount} Pages</p>
          </div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button data-action="up" data-index="${idx}" class="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-slate-500" title="Move Up" ${idx === 0 ? 'disabled class="opacity-30"' : ''}>
            <i class="fa-solid fa-arrow-up text-xs"></i>
          </button>
          <button data-action="down" data-index="${idx}" class="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-slate-500" title="Move Down" ${idx === pdfFiles.length - 1 ? 'disabled class="opacity-30"' : ''}>
            <i class="fa-solid fa-arrow-down text-xs"></i>
          </button>
          <button data-action="remove" data-index="${idx}" class="p-1.5 hover:bg-rose-100 text-rose-500 rounded ml-1" title="Remove">
            <i class="fa-solid fa-trash-can text-xs"></i>
          </button>
        </div>
      </div>
    `).join('');

    pdfList.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const index = parseInt(btn.dataset.index, 10);
        if (action === 'up' && index > 0) {
          const temp = pdfFiles[index];
          pdfFiles[index] = pdfFiles[index - 1];
          pdfFiles[index - 1] = temp;
        } else if (action === 'down' && index < pdfFiles.length - 1) {
          const temp = pdfFiles[index];
          pdfFiles[index] = pdfFiles[index + 1];
          pdfFiles[index + 1] = temp;
        } else if (action === 'remove') {
          pdfFiles.splice(index, 1);
        }
        renderList();
      });
    });
  }

  mergeBtn.addEventListener('click', async () => {
    if (pdfFiles.length < 2) {
      showToast('Please add at least 2 PDF files to merge.', 'warning');
      return;
    }

    mergeBtn.disabled = true;
    mergeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Merging Documents...';

    try {
      const mergedPdf = await PDFLib.PDFDocument.create();

      for (let item of pdfFiles) {
        const loadedPdf = await PDFLib.PDFDocument.load(item.arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(loadedPdf, loadedPdf.getPageIndices());
        copiedPages.forEach(page => mergedPdf.addPage(page));
      }

      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });

      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `fixlytools-merged-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      showToast('PDF files merged and downloaded successfully!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error merging PDF files. Please verify the files are valid.', 'error');
    } finally {
      mergeBtn.disabled = false;
      mergeBtn.innerHTML = '<i class="fa-solid fa-file-circle-plus"></i> Merge All PDFs';
    }
  });

  clearBtn.addEventListener('click', () => {
    pdfFiles = [];
    fileInput.value = '';
    renderList();
  });
});
