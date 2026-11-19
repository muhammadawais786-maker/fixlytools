// When an image is loaded in an editing tool, bring the preview + controls into view.
(function () {
  var ws = document.getElementById('workspace');
  if (!ws || !window.MutationObserver) return;
  var done = false;
  new MutationObserver(function () {
    if (done || ws.classList.contains('hidden')) return;
    done = true;
    setTimeout(function () {
      var y = ws.getBoundingClientRect().top + window.pageYOffset - (window.innerWidth >= 768 ? 76 : 8);
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    }, 150);
  }).observe(ws, { attributes: true, attributeFilter: ['class'] });
})();
