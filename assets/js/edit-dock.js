// Fixlytools - "dock" layout for the image editors (like CapCut / VN / PicsArt):
// preview on top, a row of icons below it, and only the controls of the chosen icon are shown.
// Existing controls are MOVED (not copied), so every tool keeps working exactly as before.
(function () {
  function byId(id) { return document.getElementById(id); }
  // element for an id, or a parent of it (up = how many levels)
  function el(id, up) { var e = byId(id); for (var i = 0; e && i < (up || 0); i++) e = e.parentElement; return e; }

  var PAGES = {
    'photo-editor': {
      side: '.photoed-panel', layout: '.photoed-layout', first: 'adjust',
      sections: [
        { key: 'adjust', label: 'Adjust', icon: 'fa-sliders', els: [function () { return byId('photoed-brightness').closest('.photoed-group'); }], mode: 'move' },
        { key: 'filter', label: 'Filter', icon: 'fa-wand-magic-sparkles', els: [function () { return el('photoed-preset', 1); }], mode: 'move' },
        { key: 'rotate', label: 'Rotate', icon: 'fa-rotate', els: [function () { return byId('photoed-rot-left').closest('.photoed-group'); }], mode: 'move' },
        { key: 'text', label: 'Text', icon: 'fa-font', els: [function () { return byId('photoed-text-input').closest('.photoed-group'); }], mode: 'move' },
        { key: 'draw', label: 'Draw', icon: 'fa-paintbrush', els: [function () { return byId('photoed-brush-color').closest('.photoed-group'); }, function () { return el('photoed-mode', 1); }], mode: 'draw' },
        { key: 'save', label: 'Save', icon: 'fa-download', els: [function () { return el('photoed-undo', 1); }, function () { return el('photoed-format', 1); }, function () { return byId('photoed-btn'); }], mode: 'move' }
      ],
      actions: [{ label: 'Undo', icon: 'fa-rotate-left', target: 'photoed-undo' }],
      modeSelect: 'photoed-mode'
    },
    'meme-generator': {
      side: '.memegen-panel', layout: '.memegen-layout', first: 'text',
      sections: [
        { key: 'text', label: 'Text', icon: 'fa-font', els: [function () { return el('memegen-top', 1); }, function () { return el('memegen-bottom', 1); }, function () { return el('memegen-upper', 1); }, function () { return el('memegen-size', 1); }] },
        { key: 'color', label: 'Colours', icon: 'fa-palette', els: [function () { return el('memegen-fill', 2); }] },
        { key: 'boxes', label: 'Text boxes', icon: 'fa-square-plus', els: [function () { return byId('memegen-add').closest('.memegen-group'); }] },
        { key: 'save', label: 'Save', icon: 'fa-download', els: [function () { return el('memegen-format', 1); }, function () { return byId('memegen-btn'); }] }
      ]
    },
    'watermark-image': {
      side: '.edit-side', layout: '.edit-layout', first: 'content',
      sections: [
        { key: 'content', label: 'Content', icon: 'fa-font', els: [function () { return el('mode-select', 1); }, function () { return byId('text-wrap'); }, function () { return byId('logo-wrap'); }] },
        { key: 'place', label: 'Place', icon: 'fa-up-down-left-right', els: [function () { return el('wm-position', 1); }, function () { return el('wm-margin', 1); }] },
        { key: 'style', label: 'Style', icon: 'fa-sliders', els: [function () { return el('wm-opacity', 1); }, function () { return el('wm-rotation', 1); }] },
        { key: 'save', label: 'Save', icon: 'fa-download', els: [function () { return el('format-select', 1); }, function () { return byId('quality-wrap'); }, function () { return byId('download-btn'); }, function () { return byId('progress-text'); }] }
      ]
    }
  };

  var slug = (location.pathname.match(/\/tools\/([a-z0-9-]+)/) || [])[1];
  var cfg = PAGES[slug];
  if (!cfg) return;
  var side = document.querySelector(cfg.side);
  if (!side) return;
  var layout = document.querySelector(cfg.layout);

  var wrap = document.createElement('div'); wrap.className = 'dock-wrap';
  var panel = document.createElement('div'); panel.className = 'dock-panel';
  var bar = document.createElement('div'); bar.className = 'dock-bar'; bar.setAttribute('role', 'tablist');
  var secs = {}, btns = {};
  wrap.appendChild(panel); wrap.appendChild(bar); side.appendChild(wrap); // attach first so getElementById still finds moved nodes

  function setMode(v) {
    var s = cfg.modeSelect && byId(cfg.modeSelect);
    if (s && s.value !== v) { s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); }
  }
  function open(key) {
    Object.keys(secs).forEach(function (k) {
      var on = k === key;
      secs[k].classList.toggle('on', on);
      btns[k].classList.toggle('on', on);
      btns[k].setAttribute('aria-selected', on ? 'true' : 'false');
    });
    var sc = cfg.sections.filter(function (s) { return s.key === key; })[0];
    if (sc && sc.mode) setMode(sc.mode);
    panel.scrollTop = 0;
    if (btns[key] && btns[key].scrollIntoView) { try { btns[key].scrollIntoView({ inline: 'center', block: 'nearest' }); } catch (e) { /* old browser */ } }
  }

  cfg.sections.forEach(function (sc) {
    var d = document.createElement('div'); d.className = 'dock-sec'; d.id = 'dock-sec-' + sc.key; d.setAttribute('role', 'tabpanel');
    sc.els.forEach(function (f) { var e = f(); if (e) d.appendChild(e); });
    panel.appendChild(d); secs[sc.key] = d;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'dock-btn'; b.setAttribute('role', 'tab');
    b.innerHTML = '<i class="fa-solid ' + sc.icon + '" aria-hidden="true"></i><span>' + sc.label + '</span>';
    b.addEventListener('click', function () { open(sc.key); });
    bar.appendChild(b); btns[sc.key] = b;
  });
  (cfg.actions || []).forEach(function (a) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'dock-btn dock-act';
    b.innerHTML = '<i class="fa-solid ' + a.icon + '" aria-hidden="true"></i><span>' + a.label + '</span>';
    b.addEventListener('click', function () { var t = byId(a.target); if (t && !t.disabled) t.click(); });
    bar.appendChild(b);
  });

  // hide what is left of the old panel, then add the dock
  Array.prototype.slice.call(side.children).forEach(function (c) { if (!c.contains(wrap)) c.classList.add('dock-leftover'); });
  if (layout) layout.classList.add('has-dock');
  open(cfg.first);
})();
