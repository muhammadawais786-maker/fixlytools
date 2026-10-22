// Fixlytools - JPG to PDF
document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const workspace = document.getElementById('workspace');
  const imageGrid = document.getElementById('image-grid');
  const addMoreBtn = document.getElementById('add-more-btn');
  const clearBtn = document.getElementById('clear-btn');
  const convertPdfBtn = document.getElementById('convert-pdf-btn');
  const orientationSelect = document.getElementById('orientation-select');

  let images = [];

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
    if (files.length > 0) addImages(files);
  });

  dropzone.addEventListener('click', () => fileInput.click());
  addMoreBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) addImages(Array.from(fileInput.files));
  });

  function addImages(files) {
    for (let file of files) {
      const reader = new FileReader();
      reader.onload = (e) => {
        images.push({
          file,
          dataUrl: e.target.result,
          id: Math.random().toString(36).substring(7)
        });
        renderGrid();
      };
      reader.readAsDataURL(file);
    }
  }

  function renderGrid() {
    if (images.length === 0) {
      workspace.classList.add('hidden');
      dropzone.classList.remove('hidden');
      return;
    }

    dropzone.classList.add('hidden');
    workspace.classList.remove('hidden');

    imageGrid.innerHTML = images.map((item, idx) => `
      <div class="relative group bg-slate-100 dark:bg-slate-700 rounded-xl p-2 border border-slate-200 dark:border-slate-600 flex flex-col items-center">
        <span class="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
          ${idx + 1}
        </span>
        <button data-index="${idx}" class="remove-btn absolute top-2 right-2 bg-rose-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs opacity-80 hover:opacity-100">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <img src="${item.dataUrl}" class="h-28 w-full object-contain rounded mt-4" alt="Image ${idx + 1}">
        <p class="text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate w-full mt-2 text-center">${item.file.name}</p>
      </div>
    `).join('');

    imageGrid.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index, 10);
        images.splice(index, 1);
        renderGrid();
      });
    });
  }

  convertPdfBtn.addEventListener('click', async () => {
    if (images.length === 0) return;

    convertPdfBtn.disabled = true;
    convertPdfBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating PDF...';

    try {
      const pdfDoc = await PDFLib.PDFDocument.create();

      for (let item of images) {
        let pdfImage;
        const imgBuffer = await item.file.arrayBuffer();

        if (item.file.type === 'image/png') {
          pdfImage = await pdfDoc.embedPng(imgBuffer);
        } else {
          pdfImage = await pdfDoc.embedJpg(imgBuffer);
        }

        const imgWidth = pdfImage.width;
        const imgHeight = pdfImage.height;

        let pageWidth = imgWidth;
        let pageHeight = imgHeight;

        const orientation = orientationSelect.value;
        if (orientation === 'portrait' && imgWidth > imgHeight) {
          pageWidth = 595.28; // A4 standard
          pageHeight = 841.89;
        } else if (orientation === 'landscape' && imgHeight > imgWidth) {
          pageWidth = 841.89;
          pageHeight = 595.28;
        }

        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        page.drawImage(pdfImage, {
          x: 0,
          y: 0,
          width: pageWidth,
          height: pageHeight,
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });

      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `fixlytools-images-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      showToast('Images converted to PDF successfully!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error converting images to PDF. Ensure JPG/PNG formats are valid.', 'error');
    } finally {
      convertPdfBtn.disabled = false;
      convertPdfBtn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Convert Images to PDF';
    }
  });

  clearBtn.addEventListener('click', () => {
    images = [];
    fileInput.value = '';
    renderGrid();
  });
});
