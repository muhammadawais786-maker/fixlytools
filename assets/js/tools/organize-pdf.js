// Fixlytools - Organize PDF (reorder, rotate, delete and duplicate pages)

const OG_THUMB_PX = 200;          // longest side of a thumbnail in CSS pixels
const OG_LARGE_PDF = 300;         // above this many pages we tell the user thumbnails load lazily

// Any angle -> 0, 90, 180 or 270 (negative angles and multiples of 360 are handled)
function ogNormRotation(angle) {
  const n = Math.round((Number(angle) || 0) / 90) * 90;
  return ((n % 360) + 360) % 360;
}

// Rotation that is added on top of a page's own /Rotate value
function ogRotateBy(current, delta) {
  return ogNormRotation((current || 0) + delta);
}

// Moves one item inside a list and returns a new list (the input is never changed)
function ogMove(list, from, to) {
  const out = list.slice();
  if (from < 0 || from >= out.length || to < 0 || to >= out.length || from === to) return out;
  const item = out.splice(from, 1)[0];
  out.splice(to, 0, item);
  return out;
}

// Moves by a number of places (-1 = one step left, +1 = one step right), staying inside the list
function ogMoveBy(list, index, delta) {
  const target = Math.max(0, Math.min(list.length - 1, index + delta));
  return ogMove(list, index, target);
}

function ogRemove(list, index) {
  if (index < 0 || index >= list.length) return list.slice();
  const out = list.slice();
  out.splice(index, 1);
  return out;
}

// Inserts a copy of list[index] right after it. The copy gets the new id.
function ogDuplicate(list, index, newId) {
  if (index < 0 || index >= list.length) return list.slice();
  const out = list.slice();
  out.splice(index + 1, 0, Object.assign({}, list[index], { id: newId }));
  return out;
}

// The page list as plain instructions for the PDF writer
function ogBuildPlan(list) {
  return list.map(p => ({ src: p.src, rotate: ogNormRotation(p.rot) }));
}

// True when the plan would produce the same pages in the same order with no rotation
function ogIsUnchanged(plan, totalPages) {
  if (plan.length !== totalPages) return false;
  return plan.every((p, i) => p.src === i && p.rotate === 0);
}

// Final /Rotate value for a page: the page's own rotation plus what the user added
function ogFinalRotation(existing, added) {
  return ogNormRotation((existing || 0) + (added || 0));
}

// Builds the organized PDF with pdf-lib. src is a loaded PDFDocument, plan comes from ogBuildPlan.
// The first use of each source page is copied in one batch (shared fonts and images stay shared);
// further uses of the same page are copied separately so every copy is an independent page that can be rotated alone.
async function ogBuildPdf(PDFLibRef, srcDoc, plan) {
  const out = await PDFLibRef.PDFDocument.create();
  const firstUses = [];
  const seen = new Set();
  plan.forEach(p => { if (!seen.has(p.src)) { seen.add(p.src); firstUses.push(p.src); } });
  const batch = await out.copyPages(srcDoc, firstUses);
  const firstMap = new Map();
  firstUses.forEach((s, i) => firstMap.set(s, batch[i]));
  const used = new Set();
  for (const p of plan) {
    let page;
    if (!used.has(p.src)) {
      used.add(p.src);
      page = firstMap.get(p.src);
    } else {
      page = (await out.copyPages(srcDoc, [p.src]))[0];
    }
    const existing = page.getRotation().angle;
    page.setRotation(PDFLibRef.degrees(ogFinalRotation(existing, p.rotate)));
    out.addPage(page);
  }
  out.setProducer('Fixlytools');
  out.setCreator('Fixlytools');
  return out;
}

if (typeof module !== 'undefined') {
  module.exports = {
    ogNormRotation, ogRotateBy, ogMove, ogMoveBy, ogRemove, ogDuplicate,
    ogBuildPlan, ogIsUnchanged, ogFinalRotation, ogBuildPdf
  };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const workspace = document.getElementById('workspace');
    const pdfInfo = document.getElementById('pdf-info');
    const summary = document.getElementById('og-summary');
    const grid = document.getElementById('og-grid');
    const emptyMsg = document.getElementById('og-empty');
    const saveBtn = document.getElementById('save-btn');
    const restoreBtn = document.getElementById('restore-btn');
    const resetBtn = document.getElementById('reset-btn');
    const progress = document.getElementById('progress');

    const SAVE_HTML = '<i class="fa-solid fa-download"></i> Save PDF';

    let bytes = null;          // original file bytes (kept for pdf-lib)
    let fileName = '';
    let pdfjsDoc = null;       // pdf.js document, used only for thumbnails
    let totalPages = 0;
    let pages = [];            // [{ id, src, rot }] in the order of the new file
    let nextId = 1;
    let docToken = 0;          // changes whenever a new PDF is opened so old thumbnail jobs stop
    let thumbs = new Map();    // source page index -> object URL ('' = failed)
    let queue = [];
    let rendering = false;
    let observer = null;
    let dragId = null;
    let focusRequest = null;   // { id, action } so keyboard users keep their place after a change

    function setupWorker() {
      if (typeof pdfjsLib === 'undefined') return false;
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      return true;
    }

    function freeThumbs() {
      thumbs.forEach(url => { if (url) URL.revokeObjectURL(url); });
      thumbs = new Map();
      queue = [];
    }

    // ---- thumbnails (one page at a time) ----
    async function renderThumb(srcIdx, token) {
      const page = await pdfjsDoc.getPage(srcIdx + 1);
      try {
        const base = page.getViewport({ scale: 1 });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const scale = (OG_THUMB_PX * dpr) / Math.max(base.width, base.height);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        const blob = await canvasToBlob(canvas, 'image/jpeg', 0.78);
        canvas.width = canvas.height = 0;
        if (token !== docToken) return null;
        return blob ? URL.createObjectURL(blob) : '';
      } finally {
        page.cleanup();
      }
    }

    function applyThumb(srcIdx) {
      const url = thumbs.get(srcIdx);
      grid.querySelectorAll('img[data-src="' + srcIdx + '"]').forEach(img => {
        img.parentElement.classList.remove('og-loading');
        if (url) img.src = url; else img.parentElement.classList.add('og-failed');
      });
    }

    async function processQueue() {
      if (rendering) return;
      rendering = true;
      const token = docToken;
      try {
        while (queue.length && token === docToken) {
          const idx = queue.shift();
          if (thumbs.has(idx)) continue;
          let url = '';
          try {
            const result = await renderThumb(idx, token);
            if (result === null) break;      // a different PDF was opened meanwhile
            url = result;
          } catch (err) {
            console.error(err);
          }
          if (token !== docToken) { if (url) URL.revokeObjectURL(url); break; }
          thumbs.set(idx, url);
          applyThumb(idx);
        }
      } finally {
        rendering = false;
      }
    }

    function enqueue(srcIdx) {
      if (thumbs.has(srcIdx) || queue.includes(srcIdx)) return;
      queue.push(srcIdx);
      processQueue();
    }

    function ensureObserver() {
      if (observer || typeof IntersectionObserver === 'undefined') return;
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          enqueue(parseInt(entry.target.dataset.src, 10));
        });
      }, { rootMargin: '300px' });
    }

    // ---- page cards ----
    function makeButton(action, icon, label, disabled) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'og-btn' + (action === 'delete' ? ' og-btn-danger' : '');
      b.dataset.action = action;
      b.setAttribute('aria-label', label);
      b.title = label;
      b.disabled = !!disabled;
      b.innerHTML = '<i class="fa-solid ' + icon + '" aria-hidden="true"></i>';
      return b;
    }

    function buildCard(p, i) {
      const li = document.createElement('li');
      li.className = 'og-card';
      li.draggable = true;
      li.dataset.id = String(p.id);

      const thumb = document.createElement('div');
      thumb.className = 'og-thumb og-loading';
      thumb.dataset.src = String(p.src);
      const img = document.createElement('img');
      img.alt = 'Preview of page ' + (p.src + 1);
      img.dataset.src = String(p.src);
      img.dataset.rot = String(ogNormRotation(p.rot));
      img.draggable = false;
      const known = thumbs.get(p.src);
      if (known) { img.src = known; thumb.classList.remove('og-loading'); }
      else if (thumbs.has(p.src)) { thumb.classList.remove('og-loading'); thumb.classList.add('og-failed'); }
      thumb.appendChild(img);
      li.appendChild(thumb);

      const label = document.createElement('div');
      label.className = 'og-label';
      const num = document.createElement('strong');
      num.textContent = 'Page ' + (i + 1);
      label.appendChild(num);
      if (p.src !== i) {
        const from = document.createElement('span');
        from.className = 'og-from';
        from.textContent = ' (was ' + (p.src + 1) + ')';
        label.appendChild(from);
      }
      li.appendChild(label);

      const actions = document.createElement('div');
      actions.className = 'og-actions';
      const n = i + 1;
      actions.appendChild(makeButton('left', 'fa-chevron-left', 'Move page ' + n + ' left', i === 0));
      actions.appendChild(makeButton('right', 'fa-chevron-right', 'Move page ' + n + ' right', i === pages.length - 1));
      actions.appendChild(makeButton('rotate', 'fa-rotate-right', 'Rotate page ' + n + ' by 90 degrees'));
      actions.appendChild(makeButton('duplicate', 'fa-clone', 'Duplicate page ' + n));
      actions.appendChild(makeButton('delete', 'fa-trash', 'Delete page ' + n));
      li.appendChild(actions);
      return li;
    }

    function render() {
      if (observer) observer.disconnect();
      grid.innerHTML = '';
      ensureObserver();
      const frag = document.createDocumentFragment();
      pages.forEach((p, i) => frag.appendChild(buildCard(p, i)));
      grid.appendChild(frag);

      grid.querySelectorAll('.og-thumb.og-loading').forEach(el => {
        if (observer) observer.observe(el); else enqueue(parseInt(el.dataset.src, 10));
      });

      const n = pages.length;
      summary.textContent = n + ' page' + (n === 1 ? '' : 's') + ' in the new PDF (original: ' + totalPages + ')';
      emptyMsg.classList.toggle('hidden', n > 0);
      saveBtn.disabled = n === 0;

      if (focusRequest) {
        const card = grid.querySelector('.og-card[data-id="' + focusRequest.id + '"]');
        let target = card && card.querySelector('[data-action="' + focusRequest.action + '"]:not(:disabled)');
        if (!target && card) target = card.querySelector('button:not(:disabled)');
        if (target) target.focus();
        focusRequest = null;
      }
    }

    function indexOfId(id) {
      return pages.findIndex(p => String(p.id) === String(id));
    }

    function freshPages() {
      nextId = 1;
      return Array.from({ length: totalPages }, (_, i) => ({ id: nextId++, src: i, rot: 0 }));
    }

    // ---- loading a PDF ----
    async function handleFiles(files) {
      const file = files.find(isPdfFile);
      if (!file) { showToast('Please choose a PDF file.', 'warning'); return; }
      if (!setupWorker() || typeof PDFLib === 'undefined') {
        showToast('The PDF libraries could not be loaded. Please check your internet connection and reload.', 'error');
        return;
      }
      try {
        const data = new Uint8Array(await file.arrayBuffer());
        const doc = await pdfjsLib.getDocument({ data: data.slice() }).promise;
        if (pdfjsDoc) { try { pdfjsDoc.destroy(); } catch (e) { /* ignore */ } }
        docToken++;
        freeThumbs();
        pdfjsDoc = doc;
        bytes = data;
        fileName = file.name;
        totalPages = doc.numPages;
        pages = freshPages();
        pdfInfo.textContent = file.name + ' (' + formatBytes(file.size) + ', ' + totalPages + ' page' + (totalPages === 1 ? '' : 's') + ')';
        dropzone.classList.add('hidden');
        workspace.classList.remove('hidden');
        render();
        if (totalPages > OG_LARGE_PDF) showToast('Large PDF: thumbnails load as you scroll.', 'info');
      } catch (err) {
        console.error(err);
        const msg = err && err.name === 'PasswordException'
          ? 'This PDF is password-protected. Remove the password first.'
          : 'Could not open this PDF. It may be corrupted.';
        showToast(msg, 'error');
      }
    }

    setupDropzone(dropzone, fileInput, handleFiles);

    // ---- actions ----
    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn || btn.disabled) return;
      const card = btn.closest('.og-card');
      const id = card.dataset.id;
      const i = indexOfId(id);
      if (i < 0) return;
      const action = btn.dataset.action;
      if (action === 'left') { pages = ogMoveBy(pages, i, -1); focusRequest = { id, action }; }
      else if (action === 'right') { pages = ogMoveBy(pages, i, 1); focusRequest = { id, action }; }
      else if (action === 'rotate') { pages[i] = Object.assign({}, pages[i], { rot: ogRotateBy(pages[i].rot, 90) }); focusRequest = { id, action }; }
      else if (action === 'duplicate') {
        const newId = nextId++;
        pages = ogDuplicate(pages, i, newId);
        focusRequest = { id: newId, action };
      } else if (action === 'delete') {
        const nextFocus = pages[i + 1] || pages[i - 1];
        pages = ogRemove(pages, i);
        focusRequest = nextFocus ? { id: nextFocus.id, action: 'delete' } : null;
      }
      render();
    });

    // drag and drop (desktop); the buttons above cover touch screens
    grid.addEventListener('dragstart', (e) => {
      const card = e.target.closest && e.target.closest('.og-card');
      if (!card) return;
      dragId = card.dataset.id;
      card.classList.add('og-dragging');
      if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); }
    });
    grid.addEventListener('dragover', (e) => {
      if (dragId === null) return;
      const card = e.target.closest && e.target.closest('.og-card');
      if (!card) return;
      e.preventDefault();
      grid.querySelectorAll('.og-over').forEach(el => { if (el !== card) el.classList.remove('og-over'); });
      card.classList.add('og-over');
    });
    grid.addEventListener('drop', (e) => {
      if (dragId === null) return;
      e.preventDefault();
      const card = e.target.closest && e.target.closest('.og-card');
      if (card) {
        const from = indexOfId(dragId);
        const to = indexOfId(card.dataset.id);
        if (from >= 0 && to >= 0 && from !== to) {
          pages = ogMove(pages, from, to);
          focusRequest = { id: dragId, action: 'right' };
        }
      }
      dragId = null;
      render();
    });
    grid.addEventListener('dragend', () => {
      dragId = null;
      grid.querySelectorAll('.og-dragging, .og-over').forEach(el => el.classList.remove('og-dragging', 'og-over'));
    });

    restoreBtn.addEventListener('click', () => {
      pages = freshPages();
      focusRequest = null;
      render();
      showToast('Original page order restored.', 'info');
    });

    resetBtn.addEventListener('click', () => {
      docToken++;
      freeThumbs();
      if (pdfjsDoc) { try { pdfjsDoc.destroy(); } catch (e) { /* ignore */ } }
      pdfjsDoc = null; bytes = null; pages = [];
      grid.innerHTML = '';
      workspace.classList.add('hidden');
      dropzone.classList.remove('hidden');
    });

    saveBtn.addEventListener('click', async () => {
      if (!bytes || pages.length === 0) return;
      const plan = ogBuildPlan(pages);
      if (ogIsUnchanged(plan, totalPages)) {
        showToast('You have not changed anything yet. Reorder, rotate, delete or duplicate a page first.', 'info');
        return;
      }
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Building PDF...';
      progress.textContent = 'Building your new PDF...';
      progress.classList.remove('hidden');
      try {
        let srcDoc;
        try {
          srcDoc = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
        } catch (err) {
          const encrypted = err && /encrypt/i.test(String(err.message || err.name));
          showToast(encrypted
            ? 'This PDF is password-protected. Remove the password first.'
            : 'This PDF could not be processed. It may be corrupted.', 'error');
          return;
        }
        const out = await ogBuildPdf(PDFLib, srcDoc, plan);
        const outBytes = await out.save();
        downloadBlob(new Blob([outBytes], { type: 'application/pdf' }), 'fixlytools-' + baseName(fileName) + '-organized.pdf');
        showToast('Saved a new PDF with ' + plan.length + ' page' + (plan.length === 1 ? '' : 's') + '.', 'success');
      } catch (err) {
        console.error(err);
        showToast('Something went wrong while building the PDF.', 'error');
      } finally {
        progress.classList.add('hidden');
        saveBtn.innerHTML = SAVE_HTML;
        saveBtn.disabled = pages.length === 0;
      }
    });
  });
}
