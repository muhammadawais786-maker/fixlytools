// Fixlytools Core Application Script
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMobileMenu();
  initSearchAndFilter();
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
      mobileMenu.classList.toggle('hidden');
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
  toast.innerHTML = `
    <span>${message}</span>
    <button class="text-white hover:opacity-75 focus:outline-none">&times;</button>
  `;

  toastContainer.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-4', 'opacity-0');
  });

  const closeBtn = toast.querySelector('button');
  const removeToast = () => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  };

  closeBtn.addEventListener('click', removeToast);
  setTimeout(removeToast, 4000);
}

// 5. Utility: Format Bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
