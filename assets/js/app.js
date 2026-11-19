// Fixlytools Core Application Script
// Set to true after AdSense approval: shows the reserved ad slots (below tools only).
const ADS_ON = false;
if (ADS_ON) {
  document.documentElement.classList.add('ads-on');
  document.addEventListener('DOMContentLoaded', () => {
    if (document.body.classList.contains('sc-page')) return;
    const a = document.createElement('div'); a.className = 'ad-anchor'; a.setAttribute('aria-hidden', 'true'); document.body.appendChild(a);
  });
}
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMobileMenu();
  initSearchAndFilter();
  initRecentTracking();
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

// 3. Favorites, Recent, Tool Search & Category Filter
const FT_FAV_KEY = 'fixlytools_favs_v1';
const FT_RECENT_KEY = 'fixlytools_recent_v1';
const FT_DEFAULT_FAVS = ['image-compressor', 'pdf-compressor', 'scan-to-pdf', 'translate', 'speech-to-text'];
function ftRead(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return Array.isArray(v) ? v : fallback; } catch (e) { return fallback; }
}
function ftWrite(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* private mode */ } }
function ftFavs() { return ftRead(FT_FAV_KEY, FT_DEFAULT_FAVS.slice()); }
function ftSlug(href) { const m = (href || '').match(/\/tools\/([a-z0-9-]+)/); return m ? m[1] : ''; }

// Record the tool being used (Recent list, newest first, max 8)
function initRecentTracking() {
  const slug = ftSlug(location.pathname);
  if (!slug) return;
  const list = ftRead(FT_RECENT_KEY, []).filter(x => x !== slug);
  list.unshift(slug);
  ftWrite(FT_RECENT_KEY, list.slice(0, 8));
}

function initSearchAndFilter() {
  const searchInput = document.getElementById('tool-search');
  const categoryButtons = document.querySelectorAll('button.category-btn');
  const toolCards = document.querySelectorAll('.tool-card');
  const noResults = document.getElementById('no-results');
  const listEmpty = document.getElementById('list-empty');

  // star buttons on every card
  toolCards.forEach(card => {
    const slug = ftSlug(card.getAttribute('href'));
    if (!slug || card.querySelector('.fav-star')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fav-star';
    b.innerHTML = '<i class="fa-solid fa-star"></i>';
    const paint = () => {
      const on = ftFavs().includes(slug);
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.setAttribute('aria-label', (on ? 'Remove from favorites: ' : 'Add to favorites: ') + (card.querySelector('.tool-title')?.textContent || slug));
      b.title = on ? 'Remove from favorites' : 'Add to favorites';
    };
    b.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      let f = ftFavs();
      f = f.includes(slug) ? f.filter(x => x !== slug) : f.concat(slug);
      ftWrite(FT_FAV_KEY, f);
      document.querySelectorAll('.fav-star').forEach(x => x.dispatchEvent(new Event('ft-paint')));
      if (currentCategory === 'fav') filterTools();
    });
    b.addEventListener('ft-paint', paint);
    paint();
    card.appendChild(b);
  });

  if (!searchInput && categoryButtons.length === 0) return;

  let currentCategory = 'all';
  let currentSearch = '';

  function filterTools() {
    let visibleCount = 0;
    const query = currentSearch.toLowerCase().trim();
    const favs = ftFavs();
    const recent = ftRead(FT_RECENT_KEY, []);

    toolCards.forEach(card => {
      const cardCategory = card.dataset.category || 'all';
      const slug = ftSlug(card.getAttribute('href'));
      const title = (card.querySelector('.tool-title')?.textContent || '').toLowerCase();
      const desc = (card.querySelector('.tool-desc')?.textContent || '').toLowerCase();
      const keywords = (card.dataset.keywords || '').toLowerCase();

      let matchesCat = true;
      card.style.order = '';
      if (currentCategory === 'fav') matchesCat = favs.includes(slug);
      else if (currentCategory === 'recent') { matchesCat = recent.includes(slug); card.style.order = String(recent.indexOf(slug)); }
      else if (currentCategory !== 'all') matchesCat = cardCategory === currentCategory;
      const matchesSearch = !query || title.includes(query) || desc.includes(query) || keywords.includes(query);

      if (matchesCat && matchesSearch) {
        card.style.display = 'flex';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });

    const special = (currentCategory === 'fav' || currentCategory === 'recent') && !query;
    if (listEmpty) {
      if (special && visibleCount === 0) {
        document.getElementById('list-empty-title').textContent = currentCategory === 'fav' ? 'No favorites yet' : 'Nothing opened recently';
        document.getElementById('list-empty-text').textContent = currentCategory === 'fav'
          ? 'Tap the star on any tool card to keep it here.' : 'Tools you open will show up here.';
        listEmpty.classList.remove('hidden');
      } else listEmpty.classList.add('hidden');
    }
    if (noResults) {
      if (visibleCount === 0 && !(special)) noResults.classList.remove('hidden');
      else noResults.classList.add('hidden');
    }
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value;
      filterTools();
    });
  }

  function setActive(btn) {
    categoryButtons.forEach(b => {
      b.classList.remove('bg-blue-600', 'text-white', 'shadow-sm');
      b.classList.add('bg-slate-100', 'text-slate-700', 'dark:bg-slate-800', 'dark:text-slate-300');
    });
    btn.classList.add('bg-blue-600', 'text-white');
    btn.classList.remove('bg-slate-100', 'text-slate-700', 'dark:bg-slate-800', 'dark:text-slate-300');
  }
  categoryButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      setActive(btn);
      currentCategory = btn.dataset.category || 'all';
      filterTools();
    });
  });

  // #favorites / #recent deep links from other pages
  const h = (location.hash || '').replace('#', '');
  if (h === 'favorites' || h === 'recent') {
    const key = h === 'favorites' ? 'fav' : 'recent';
    const btn = Array.from(categoryButtons).find(b => b.dataset.category === key);
    if (btn) { setActive(btn); currentCategory = key; filterTools(); }
  }
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
