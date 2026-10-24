// Fixlytools - Merge PDF
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const workspace = document.getElementById('workspace');
    const pdfList = document.getElementById('pdf-list');
    const mergeBtn = document.getElementById('merge-btn');
    const addMoreBtn = document.getElementById('add-more-btn');
    const clearBtn = document.getElementById('clear-btn');

    let pdfFiles = [];
    let nextId = 1;

    async function handleFiles(files) {
      if (typeof PDFLib === 'undefined') {
        showToast('The PDF library could not be loaded. Please check your internet connection and reload.', 'error');
        return;
      }
      const pdfs = files.filter(isPdfFile);
      if (pdfs.length === 0) {
        showToast('Please choose PDF files.', 'warning');
        return;
      }
      if (pdfs.length < files.length) showToast('Some files were skipped because they are not PDFs.', 'warning');

      for (const file of pdfs) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
          pdfFiles.push({ id: nextId++, file, arrayBuffer, pageCount: pdfDoc.getPageCount() });
        } catch (err) {
          showToast(`Could not read ${file.name}. It might be corrupted or password-protected.`, 'error');
        }
      }
      renderList();
    }

    function renderList() {
      if (pdfFiles.length === 0) {
        workspace.classList.add('hidden');
        dropzone.classList.remove('hidden');
        pdfList.innerHTML = '';
        return;
      }
      dropzone.classList.add('hidden');
      workspace.classList.remove('hidden');

      const BTN = 'p-1.5 rounded text-slate-500';
      pdfList.innerHTML = pdfFiles.map((item, idx) => {
        const upOff = idx === 0;
        const downOff = idx === pdfFiles.length - 1;
        return `
        <div class="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600">
          <div class="flex items-center gap-3 overflow-hidden">
            <span class="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 font-bold text-xs flex items-center justify-center shrink-0">${idx + 1}</span>
            <div class="truncate">
              <p class="text-sm font-semibold truncate text-slate-800 dark:text-slate-100">${escapeHtml(item.file.name)}</p>
              <p class="text-xs text-slate-500">${formatBytes(item.file.size)} &bull; ${item.pageCount} Pages</p>
            </div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <button type="button" data-action="up" data-id="${item.id}" class="${BTN} ${upOff ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-200 dark:hover:bg-slate-600'}" title="Move Up" aria-label="Move ${escapeHtml(item.file.name)} up" ${upOff ? 'disabled' : ''}>
              <i class="fa-solid fa-arrow-up text-xs"></i>
            </button>
            <button type="button" data-action="down" data-id="${item.id}" class="${BTN} ${downOff ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-200 dark:hover:bg-slate-600'}" title="Move Down" aria-label="Move ${escapeHtml(item.file.name)} down" ${downOff ? 'disabled' : ''}>
              <i class="fa-solid fa-arrow-down text-xs"></i>
            </button>
            <button type="button" data-action="remove" data-id="${item.id}" class="p-1.5 hover:bg-rose-100 text-rose-500 rounded ml-1" title="Remove" aria-label="Remove ${escapeHtml(item.file.name)}">
              <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
          </div>
        </div>`;
      }).join('');
    }

    pdfList.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn || btn.disabled) return;
      const id = parseInt(btn.dataset.id, 10);
      const index = pdfFiles.findIndex(p => p.id === id);
      if (index < 0) return;
      const action = btn.dataset.action;
      if (action === 'up' && index > 0) {
        [pdfFiles[index - 1], pdfFiles[index]] = [pdfFiles[index], pdfFiles[index - 1]];
      } else if (action === 'down' && index < pdfFiles.length - 1) {
        [pdfFiles[index + 1], pdfFiles[index]] = [pdfFiles[index], pdfFiles[index + 1]];
      } else if (action === 'remove') {
        pdfFiles.splice(index, 1);
      }
      renderList();
    });

    setupDropzone(dropzone, fileInput, handleFiles);
    addMoreBtn.addEventListener('click', () => fileInput.click());

    mergeBtn.addEventListener('click', async () => {
      if (pdfFiles.length < 2) {
        showToast('Please add at least 2 PDF files to merge.', 'warning');
        return;
      }

      mergeBtn.disabled = true;
      mergeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Merging Documents...';

      try {
        const mergedPdf = await PDFLib.PDFDocument.create();
        for (const item of pdfFiles) {
          const loadedPdf = await PDFLib.PDFDocument.load(item.arrayBuffer);
          const copiedPages = await mergedPdf.copyPages(loadedPdf, loadedPdf.getPageIndices());
          copiedPages.forEach(page => mergedPdf.addPage(page));
        }
        const mergedPdfBytes = await mergedPdf.save();
        downloadBlob(new Blob([mergedPdfBytes], { type: 'application/pdf' }), `fixlytools-merged-${Date.now()}.pdf`);
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
}
