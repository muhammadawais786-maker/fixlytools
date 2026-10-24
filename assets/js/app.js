// Fixlytools Core Application Script
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMobileMenu();
  initSearchAndFilter();
  initAccessibility();
  initGlobalDropGuard();
  initServiceWorker();
});

// 1. Theme Management (Dark / Light Mode)
function initTheme() {
  const themeToggleButtons = document.querySelectorAll('.theme-toggle');
  const storedTheme = localStorage.getItem('fixlytools_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (storedTheme === 'dark' || (!storedTheme && prefersDark)) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  themeToggleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('fixlytools_theme', isDark ? 'dark' : 'light');
    });
  });
}

// 2. Mobile Menu Navigation
function initMobileMenu() {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');

  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', () => {
      const nowHidden = mobileMenu.classList.toggle('hidden');
      menuBtn.setAttribute('aria-expanded', nowHidden ? 'false' : 'true');
    });
  }
}

// 3. Tool Search & Category Filter (Homepage)
function initSearchAndFilter() {
  const searchInput = document.getElementById('tool-search');
  const categoryButtons = document.querySelectorAll('.category-btn');
  const toolCards = document.querySelectorAll('.tool-card');
  const noResults = document.getElementById('no-results');

  if (!searchInput && categoryButtons.length === 0) return;

  let currentCategory = 'all';
  let currentSearch = '';

  function filterTools() {
    let visibleCount = 0;
    const query = currentSearch.toLowerCase().trim();

    toolCards.forEach(card => {
      const cardCategory = card.dataset.category || 'all';
      const title = (card.querySelector('.tool-title')?.textContent || '').toLowerCase();
      const desc = (card.querySelector('.tool-desc')?.textContent || '').toLowerCase();
      const keywords = (card.dataset.keywords || '').toLowerCase();

      const matchesCat = currentCategory === 'all' || cardCategory === currentCategory;
      const matchesSearch = !query || title.includes(query) || desc.includes(query) || keywords.includes(query);

      if (matchesCat && matchesSearch) {
        card.style.display = 'flex';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });

    if (noResults) {
      if (visibleCount === 0) {
        noResults.classList.remove('hidden');
      } else {
        noResults.classList.add('hidden');
      }
    }
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value;
      filterTools();
    });
  }

  categoryButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      categoryButtons.forEach(b => {
        b.classList.remove('bg-blue-600', 'text-white');
        b.classList.add('bg-slate-100', 'text-slate-700', 'dark:bg-slate-800', 'dark:text-slate-300');
      });
      btn.classList.add('bg-blue-600', 'text-white');
      btn.classList.remove('bg-slate-100', 'text-slate-700', 'dark:bg-slate-800', 'dark:text-slate-300');

      currentCategory = btn.dataset.category || 'all';
      filterTools();
    });
  });
}

// 4. Global Toast Notification
function showToast(message, type = 'info') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  const bgColors = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-rose-600 text-white',
    info: 'bg-blue-600 text-white',
    warning: 'bg-amber-600 text-white'
  };

  toast.className = `${bgColors[type] || bgColors.info} px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center justify-between gap-3 transform transition-all duration-300 translate-y-4 opacity-0`;
  const msgSpan = document.createElement('span');
  msgSpan.textContent = message;
  const closeX = document.createElement('button');
  closeX.className = 'text-white hover:opacity-75 focus:outline-none';
  closeX.setAttribute('aria-label', 'Close notification');
  closeX.innerHTML = '&times;';
  toast.setAttribute('role', 'status');
  toast.appendChild(msgSpan);
  toast.appendChild(closeX);

  toastContainer.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-4', 'opacity-0');
  });

  const closeBtn = closeX;
  const removeToast = () => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  };

  closeBtn.addEventListener('click', removeToast);
  setTimeout(removeToast, 4000);
}

// 5. Utility: Format Bytes
function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes < 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[Math.min(i, sizes.length - 1)];
}


// 6. Utility: escape text before putting it into innerHTML
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 7. Utility: download a Blob and free the temporary URL afterwards
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// 8. Utility: file helpers
function isPdfFile(file) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}
function baseName(name) {
  return name.replace(/\.[^/.]+$/, '') || 'file';
}

// 9. Utility: copy text with a fallback for browsers/contexts without the Clipboard API
function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy') ? resolve() : reject(new Error('copy failed'));
    } catch (err) {
      reject(err);
    } finally {
      document.body.removeChild(ta);
    }
  });
}

// 10. Accessibility: give unlabeled controls an accessible name
function initAccessibility() {
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    if (!btn.getAttribute('aria-label')) btn.setAttribute('aria-label', 'Toggle dark mode');
  });
  const menuBtn = document.getElementById('mobile-menu-btn');
  if (menuBtn) {
    if (!menuBtn.getAttribute('aria-label')) menuBtn.setAttribute('aria-label', 'Open menu');
    menuBtn.setAttribute('aria-expanded', 'false');
  }
  document.querySelectorAll('input, textarea, select').forEach(el => {
    if (el.type === 'hidden' || el.type === 'checkbox' && el.name === 'botcheck') return;
    if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return;
    if (el.id && document.querySelector('label[for="' + el.id + '"]')) return;
    if (el.closest('label')) return;
    const name = el.getAttribute('placeholder') || el.getAttribute('title') || (el.id || '').replace(/-/g, ' ');
    if (name) el.setAttribute('aria-label', name);
  });
}

// 11. If a file is dropped outside the drop area, do not let the browser navigate away from the tool
function initGlobalDropGuard() {
  const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('drop', (e) => { if (hasFiles(e)) e.preventDefault(); });
}

// 12. Shared drag & drop + click-to-browse wiring for the file tools.
// onFiles receives every dropped/selected file as an array; each tool filters and reports invalid ones.
function setupDropzone(dropzone, fileInput, onFiles) {
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
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) onFiles(files);
  });
  dropzone.addEventListener('click', (e) => {
    if (e.target === fileInput) return;
    fileInput.click();
  });
  fileInput.addEventListener('change', () => {
    const files = Array.from(fileInput.files || []);
    fileInput.value = ''; // allows choosing the same file again
    if (files.length > 0) onFiles(files);
  });
}

// 13. Utility: load an image File into an HTMLImageElement (rejects if the browser cannot decode it)
function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Cannot read image: ' + file.name)); };
    img.src = url;
  });
}

// 14. Utility: canvas -> Blob as a Promise
function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}


// 10. Offline support: register the service worker (needs HTTPS or localhost)
function initServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!secure) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* offline mode is optional */ });
  });
}
