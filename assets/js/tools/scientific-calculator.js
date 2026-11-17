// Fixlytools - Scientific Calculator (Casio fx-991 style UI). Engine lives in calc-engine.js.
(function () {
  if (typeof document === 'undefined') return;
  var $ = function (id) { return document.getElementById(id); };
  function h(tag, props, kids) {
    var e = document.createElement(tag), k;
    props = props || {};
    for (k in props) {
      if (k === 'text') e.textContent = props[k];
      else if (k === 'cls') e.className = props[k];
      else e.setAttribute(k, props[k]);
    }
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  var SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  function pretty(s) { return String(s).replace(/E(-?\d+)/g, function (m, d) { return '×10' + d.split('').map(function (c) { return SUP[c]; }).join(''); }); }

  var st = { mode: 'deg', fmt: 'norm2', digits: 2, cfmt: 'rect', math: true, mixed: false, cmplx: false };
  var vars = {}, ans = 0, preans = 0, memory = 0;
  var shift = false, alpha = false, hyp = false, flip = false, forceDms = false, forceEng = false;
  var last = null, hist = [], histPos = -1, calcMode = null;

  var elExpr = $('sc-expr'), elRes = $('sc-result'), elHist = $('sc-history'), elHistEmpty = $('sc-history-empty');
  if (!elExpr || !elRes) return;

  function env() { return ceNewEnv({ mode: st.mode, cmplx: st.cmplx, vars: vars, ans: ans, preans: preans }); }
  function fmtOpts(over) { var o = { fmt: st.fmt, digits: st.digits, cfmt: st.cfmt, math: st.math, mixed: st.mixed, mode: st.mode }; for (var k in over) o[k] = over[k]; return o; }
  function plain(x) { return ceFmtNum(x, fmtOpts({})); }

  // ---------- keypad ----------
  // [label, insert, shiftLabel, shiftInsert, alphaLabel, alphaInsert, class]   ('@name' = action)
  var FN = [
    ['SHIFT', '@shift', '', '', '', '', 'k-shift'], ['ALPHA', '@alpha', '', '', '', '', 'k-alpha'], ['◀', '@left', '', '', '', '', 'k-nav'], ['▶', '@right', '', '', '', '', 'k-nav'], ['▲', '@up', '', '', '', '', 'k-nav'], ['MODE', '@mode', 'SETUP', '@setup', '', '', 'k-nav'],
    ['CALC', '@calc', 'SOLVE', '@solve', '=', '=', 'k-fn'], ['∫dx', 'integ(', 'd/dx', 'deriv(', '', '', 'k-fn'], ['x⁻¹', '^-1', 'x!', '!', '', '', 'k-fn'], ['a b/c', '⌟', 'Abs', 'abs(', '', '', 'k-fn'], ['√', 'sqrt(', '∛', 'cbrt(', '', '', 'k-fn'], ['x²', '^2', 'x³', '^3', '', '', 'k-fn'],
    ['xʸ', '^', 'ʸ√', 'root(', '', '', 'k-fn'], ['log', 'log(', '10ˣ', '10^', '', '', 'k-fn'], ['ln', 'ln(', 'eˣ', 'e^(', '', '', 'k-fn'], ['(−)', '-', 'i', 'i', 'A', 'A', 'k-fn'], ['° ′ ″', '°', '►DMS', '@dms', 'B', 'B', 'k-fn'], ['hyp', '@hyp', '', '', 'C', 'C', 'k-fn'],
    ['sin', 'sin(', 'sin⁻¹', 'asin(', 'D', 'D', 'k-fn'], ['cos', 'cos(', 'cos⁻¹', 'acos(', 'E', 'E', 'k-fn'], ['tan', 'tan(', 'tan⁻¹', 'atan(', 'F', 'F', 'k-fn'], ['(', '(', 'Pol(', 'Pol(', 'X', 'X', 'k-fn'], [')', ')', 'Rec(', 'Rec(', 'Y', 'Y', 'k-fn'], ['S⇔D', '@sd', 'ENG', '@eng', '', '', 'k-fn'],
    ['STO', '→', 'RCL', '@rcl', '', '', 'k-mem'], ['M+', '@mplus', 'M−', '@mminus', 'M', 'M', 'k-mem'], ['Σ', 'sum(', 'Π', 'prod(', '', '', 'k-mem'], ['Ran#', 'ran#', 'RanInt', 'ranint#(', '', '', 'k-mem'], ['CONST', '@const', 'CONV', '@conv', '', '', 'k-mem'], ['OPTN', '@optn', '', '', '', '', 'k-mem']
  ];
  var NUM = [
    ['7', '7', '', '', '', '', 'k-num'], ['8', '8', '', '', '', '', 'k-num'], ['9', '9', '', '', '', '', 'k-num'], ['DEL', '@del', '', '', '', '', 'k-clr'], ['AC', '@ac', '', '', '', '', 'k-clr'],
    ['4', '4', '', '', '', '', 'k-num'], ['5', '5', '', '', '', '', 'k-num'], ['6', '6', '', '', '', '', 'k-num'], ['×', '*', 'nPr', ' nPr ', '', '', 'k-op'], ['÷', '/', 'nCr', ' nCr ', '', '', 'k-op'],
    ['1', '1', '', '', '', '', 'k-num'], ['2', '2', '', '', '', '', 'k-num'], ['3', '3', '', '', '', '', 'k-num'], ['+', '+', '', '', '', '', 'k-op'], ['−', '-', '', '', '', '', 'k-op'],
    ['0', '0', 'Rnd', 'rnd(', '', '', 'k-num'], ['.', '.', '∠', '∠', '', '', 'k-num'], ['×10ˣ', 'E', 'π', 'pi', 'e', 'e', 'k-fn'], ['Ans', 'Ans', 'PreAns', 'PreAns', '', '', 'k-fn'], ['=', '@eq', '', '', '', '', 'k-eq']
  ];
  var keyEls = [];
  function buildKeys(list, host) {
    list.forEach(function (d) {
      var b = h('button', { type: 'button', cls: 'sc-key ' + d[6], 'aria-label': d[0] + (d[2] ? ' (shift ' + d[2] + ')' : '') }, []);
      if (d[2]) b.appendChild(h('span', { cls: 'sc-s', text: d[2] }));
      if (d[4]) b.appendChild(h('span', { cls: 'sc-a', text: d[4] }));
      b.appendChild(h('span', { cls: 'sc-m', text: d[0] }));
      b.addEventListener('click', function () { press(d); });
      host.appendChild(b); keyEls.push({ d: d, b: b });
    });
  }
  buildKeys(FN, $('sc-keys-fn'));
  buildKeys(NUM, $('sc-keys-num'));

  function syncKeyState() {
    keyEls.forEach(function (k) {
      if (k.d[1] === '@shift') k.b.setAttribute('aria-pressed', shift ? 'true' : 'false');
      if (k.d[1] === '@alpha') k.b.setAttribute('aria-pressed', alpha ? 'true' : 'false');
      if (k.d[1] === '@hyp') k.b.setAttribute('aria-pressed', hyp ? 'true' : 'false');
    });
    $('sc-badge-shift').hidden = !shift; $('sc-badge-alpha').hidden = !alpha; $('sc-badge-hyp').hidden = !hyp;
    $('sc-badge-mem').hidden = !memory;
    $('sc-badge-mode').textContent = st.mode === 'deg' ? 'DEG' : st.mode === 'rad' ? 'RAD' : 'GRA';
    $('sc-badge-cx').hidden = !st.cmplx;
    $('sc-badge-disp').textContent = st.fmt === 'fix' ? 'Fix' + st.digits : st.fmt === 'sci' ? 'Sci' + st.digits : st.fmt === 'norm1' ? 'Norm1' : 'Norm2';
  }

  // ---------- editing ----------
  function insertText(t) {
    var s = elExpr.selectionStart, e = elExpr.selectionEnd, v = elExpr.value;
    if (s === null || s === undefined) { s = e = v.length; }
    var cont = /^[+\-*\/^!%]/.test(t) && v === '' && last && last.ok && flipFresh;
    if (cont) { v = 'Ans'; s = e = 3; }
    elExpr.value = v.slice(0, s) + t + v.slice(e);
    var p = s + t.length; elExpr.setSelectionRange(p, p);
    flipFresh = false; preview();
  }
  var flipFresh = false;
  function doDel() {
    var s = elExpr.selectionStart, e = elExpr.selectionEnd, v = elExpr.value;
    if (s !== e) { elExpr.value = v.slice(0, s) + v.slice(e); elExpr.setSelectionRange(s, s); }
    else if (s > 0) {
      var m = /(?:[A-Za-z]+#?\()$/.exec(v.slice(0, s)), n = m ? m[0].length : 1;
      elExpr.value = v.slice(0, s - n) + v.slice(s); elExpr.setSelectionRange(s - n, s - n);
    }
    preview();
  }
  function moveCaret(d) {
    var p = Math.max(0, Math.min(elExpr.value.length, (elExpr.selectionStart || 0) + d));
    elExpr.setSelectionRange(p, p); elExpr.focus();
  }
  function hypify(t) { return /^a?(sin|cos|tan)\($/.test(t) ? t.replace('(', 'h(') : t; }

  function press(d) {
    var ins = d[1];
    if (ins === '@shift' || ins === '@alpha') { action(ins.slice(1)); return; }
    var useS = shift && d[3], useA = alpha && d[5];
    var t = useA ? d[5] : (useS ? d[3] : ins);
    var wasHyp = hyp;
    shift = false; alpha = false;
    if (t.charAt(0) === '@') { if (t === '@hyp') { syncKeyState(); action('hyp'); return; } syncKeyState(); action(t.slice(1), d); return; }
    if (wasHyp && !useA) { t = hypify(t); hyp = false; }
    syncKeyState();
    insertText(t);
    elExpr.focus();
  }
  function action(name) {
    var wasShift = shift; shift = false;
    switch (name) {
      case 'shift': shift = !wasShift; alpha = false; break;
      case 'alpha': alpha = !alpha; shift = false; break;
      case 'hyp': hyp = !hyp; break;
      case 'left': moveCaret(-1); break;
      case 'right': moveCaret(1); break;
      case 'up': histRecall(); break;
      case 'mode': openTab('comp'); $('sc-tabs').scrollIntoView({ block: 'nearest' }); $('sc-tabs').querySelector('button').focus(); break;
      case 'setup': $('sc-setup').open = true; $('sc-setup').scrollIntoView({ block: 'nearest' }); break;
      case 'del': doDel(); break;
      case 'ac': elExpr.value = ''; hideBox(); flip = false; forceDms = false; forceEng = false; elRes.className = 'sc-result'; elRes.textContent = ' '; last = null; elExpr.focus(); break;
      case 'eq': commit(); break;
      case 'sd': flip = !flip; forceDms = false; forceEng = false; renderLast(); break;
      case 'dms': if (last && last.ok && typeof last.v === 'number') { forceDms = true; forceEng = false; renderLast(); } break;
      case 'eng': if (last && last.ok && typeof last.v === 'number') { forceEng = true; forceDms = false; renderLast(); } break;
      case 'mplus': case 'mminus': {
        var r = last && last.ok && typeof last.v === 'number' ? last.v : (function () { var q = ceRun(elExpr.value, env()); return q.ok && typeof q.v === 'number' ? q.v : null; })();
        if (r === null) { showErr('Math ERROR'); break; }
        memory += name === 'mplus' ? r : -r; vars.M = memory; syncKeyState();
        break;
      }
      case 'rcl': alpha = true; break;
      case 'calc': openBox('calc'); break;
      case 'solve': openBox('solve'); break;
      case 'const': openTab('const'); break;
      case 'conv': openTab('conv'); break;
      case 'optn': $('sc-optn').hidden = !$('sc-optn').hidden; break;
    }
    syncKeyState();
  }

  // ---------- display ----------
  function showErr(msg) { elRes.className = 'sc-result sc-err'; elRes.textContent = msg; }
  function renderValue(v) {
    if (forceDms && typeof v === 'number') return ceDMS(v);
    if (forceEng && typeof v === 'number') return ceEng(v);
    return ceFmtValue(v, fmtOpts({ math: st.math !== flip }));
  }
  function renderLast() {
    if (!last) return;
    if (!last.ok) { if (last.msg) showErr(last.msg); return; }
    last.text = renderValue(last.v);
    elRes.className = 'sc-result'; elRes.textContent = pretty(last.text);
  }
  function preview() {
    flip = false; forceDms = false; forceEng = false;
    var t = elExpr.value;
    if (!t.trim()) { elRes.className = 'sc-result'; elRes.textContent = ' '; last = null; return; }
    var r = ceRun(t, env());
    last = r;
    if (r.ok) { r.text = renderValue(r.v); elRes.className = 'sc-result sc-preview'; elRes.textContent = pretty(r.text); }
    else { elRes.className = 'sc-result sc-preview'; elRes.textContent = ' '; }
  }
  function commit() {
    var t = elExpr.value;
    if (!t.trim()) return;
    var r = ceRun(t, env()); last = r; flip = false; forceDms = false; forceEng = false;
    if (!r.ok) { showErr(r.msg); return; }
    r.text = renderValue(r.v);
    elRes.className = 'sc-result'; elRes.textContent = pretty(r.text);
    if (typeof r.v === 'number' || (r.v && r.v.im !== undefined)) { preans = ans; ans = r.v; }
    hist.unshift({ e: t, r: r.text }); if (hist.length > 20) hist.pop(); histPos = -1;
    renderHist(); flipFresh = true;
  }
  function histRecall() {
    if (!hist.length) return;
    histPos = Math.min(hist.length - 1, histPos + 1);
    elExpr.value = hist[histPos].e; elExpr.setSelectionRange(elExpr.value.length, elExpr.value.length); preview(); elExpr.focus();
  }
  function renderHist() {
    elHist.textContent = '';
    hist.forEach(function (it) {
      var li = h('li', {}, []);
      var b = h('button', { type: 'button', cls: 'sc-hist-item' }, [h('span', { cls: 'sc-hist-e', text: it.e }), h('span', { cls: 'sc-hist-r', text: '= ' + pretty(it.r) })]);
      b.addEventListener('click', function () { elExpr.value = it.e; preview(); elExpr.focus(); });
      li.appendChild(b); elHist.appendChild(li);
    });
    elHistEmpty.hidden = hist.length > 0; $('sc-clear-history').disabled = !hist.length;
  }

  // ---------- CALC / SOLVE box ----------
  var box = $('sc-box');
  function hideBox() { box.hidden = true; box.textContent = ''; calcMode = null; }
  function openBox(kind) {
    var t = elExpr.value;
    box.textContent = ''; box.hidden = false; calcMode = kind;
    if (!t.trim()) { box.appendChild(h('p', { cls: 'sc-box-msg', text: 'Type an expression first.' })); return; }
    var names;
    try { names = ceVarsIn(t); } catch (e) { box.appendChild(h('p', { cls: 'sc-box-msg', text: 'Syntax ERROR' })); return; }
    var out = h('div', { cls: 'sc-box-out', role: 'status', 'aria-live': 'polite' });
    if (kind === 'calc') {
      box.appendChild(h('p', { cls: 'sc-box-title', text: 'CALC - enter values for the variables, then press Calculate' }));
      var inputs = {};
      if (t.indexOf('=') !== -1) { box.appendChild(h('p', { cls: 'sc-box-msg', text: 'CALC evaluates an expression without "=". Use SOLVE for equations.' })); return; }
      if (!names.length) names = [];
      names.forEach(function (n) {
        var inp = h('input', { type: 'text', cls: 'sc-box-in', inputmode: 'decimal', 'aria-label': 'Value of ' + n, value: String(vars[n] === undefined ? 0 : vars[n]) });
        inputs[n] = inp; box.appendChild(h('label', { cls: 'sc-box-row' }, [h('span', { text: n + ' =' }), inp]));
      });
      var go = h('button', { type: 'button', cls: 'sc-tool-btn', text: 'Calculate' });
      go.addEventListener('click', function () {
        var e2 = env();
        for (var i = 0; i < names.length; i++) {
          var q = ceRun(inputs[names[i]].value, e2);
          if (!q.ok || typeof q.v !== 'number') { out.textContent = 'Input of ' + names[i] + ': ' + (q.msg || 'Math ERROR'); return; }
          vars[names[i]] = q.v; e2.vars[names[i]] = q.v;
        }
        var r = ceRun(t, e2);
        out.textContent = r.ok ? '= ' + pretty(ceFmtValue(r.v, fmtOpts({}))) : r.msg;
        if (r.ok) { last = r; r.text = ceFmtValue(r.v, fmtOpts({})); elRes.className = 'sc-result'; elRes.textContent = pretty(r.text); }
      });
      box.appendChild(go); box.appendChild(out);
    } else {
      box.appendChild(h('p', { cls: 'sc-box-title', text: 'SOLVE - solves for X. Use = for an equation (e.g. X^2-4=0) or leave it as an expression equal to 0.' }));
      var g = h('input', { type: 'text', cls: 'sc-box-in', inputmode: 'decimal', 'aria-label': 'Initial guess for X', value: String(vars.X === undefined ? 1 : vars.X) });
      box.appendChild(h('label', { cls: 'sc-box-row' }, [h('span', { text: 'Initial X =' }), g]));
      var sb = h('button', { type: 'button', cls: 'sc-tool-btn', text: 'Solve' });
      sb.addEventListener('click', function () {
        var gv = ceRun(g.value, env());
        if (!gv.ok || typeof gv.v !== 'number') { out.textContent = 'Initial value: Math ERROR'; return; }
        try {
          var s = ceSolve(t, gv.v, env());
          if (!s) { out.textContent = "Can't Solve (no real root found near the starting value)"; return; }
          vars.X = s.x;
          var xr = Number(s.x.toPrecision(12));
          out.textContent = 'X = ' + pretty(plain(xr)) + '    L − R = ' + pretty(plain(Math.abs(s.fx) < 1e-12 ? 0 : s.fx)) + '  (numeric, approximate)';
        } catch (e) { out.textContent = e && e.msg ? e.msg : 'Syntax ERROR'; }
      });
      box.appendChild(sb); box.appendChild(out);
    }
  }

  // ---------- tabs & panes ----------
  var TABS = [['comp', 'COMP / CMPLX'], ['stat', 'STAT'], ['distr', 'DISTR'], ['base', 'BASE-N'], ['eqn', 'EQN'], ['matrix', 'MATRIX'], ['vector', 'VECTOR'], ['table', 'TABLE'], ['const', 'CONST'], ['conv', 'CONV']];
  var panes = {}, tabBtns = {};
  function openTab(id) {
    Object.keys(panes).forEach(function (k) { panes[k].hidden = k !== id; tabBtns[k].setAttribute('aria-selected', k === id ? 'true' : 'false'); tabBtns[k].tabIndex = k === id ? 0 : -1; });
  }
  var tabHost = $('sc-tabs'), paneHost = $('sc-panes');
  TABS.forEach(function (t) {
    var b = h('button', { type: 'button', role: 'tab', cls: 'sc-tab', id: 'sc-tab-' + t[0], 'aria-selected': 'false', 'aria-controls': 'sc-pane-' + t[0], text: t[1] });
    b.addEventListener('click', function () { openTab(t[0]); });
    b.addEventListener('keydown', function (ev) {
      var i = TABS.findIndex(function (x) { return x[0] === t[0]; }), n = null;
      if (ev.key === 'ArrowRight') n = (i + 1) % TABS.length; else if (ev.key === 'ArrowLeft') n = (i + TABS.length - 1) % TABS.length;
      if (n !== null) { ev.preventDefault(); openTab(TABS[n][0]); tabBtns[TABS[n][0]].focus(); }
    });
    tabHost.appendChild(b); tabBtns[t[0]] = b;
    if (t[0] === 'comp') { panes.comp = $('sc-pane-comp'); }
    else { var p = h('section', { cls: 'sc-pane', id: 'sc-pane-' + t[0], role: 'tabpanel', 'aria-labelledby': 'sc-tab-' + t[0] }); p.hidden = true; paneHost.appendChild(p); panes[t[0]] = p; }
  });

  function field(label, id, val, extra) {
    var inp = h('input', { type: 'text', cls: 'sc-box-in', id: id, value: val === undefined ? '' : val, inputmode: 'decimal', autocomplete: 'off' });
    return { wrap: h('label', { cls: 'sc-box-row' }, [h('span', { text: label }), inp]), inp: inp };
  }
  function select(id, opts, label) {
    var s = h('select', { cls: 'sc-box-in', id: id, 'aria-label': label }, opts.map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
    return s;
  }
  function numOf(inp, name) {
    var q = ceRun(inp.value, env());
    if (!q.ok || typeof q.v !== 'number') throw { ce: true, msg: (name || 'Value') + ': ' + (q.msg || 'Math ERROR') };
    return q.v;
  }
  function outBox() { return h('div', { cls: 'sc-box-out', role: 'status', 'aria-live': 'polite' }); }
  function fail(out, e) { out.textContent = e && e.msg ? e.msg : 'Math ERROR'; out.className = 'sc-box-out sc-err'; }
  function ok(out) { out.className = 'sc-box-out'; out.textContent = ''; }
  function kv(out, rows) {
    ok(out); var t = h('table', { cls: 'sc-tbl' });
    rows.forEach(function (r) { t.appendChild(h('tr', {}, [h('th', { text: r[0], scope: 'row' }), h('td', { text: pretty(r[1]) })])); });
    out.appendChild(t);
  }
  function parseRows(text, cols) {
    var rows = [];
    text.split(/\n/).forEach(function (line) {
      line = line.trim(); if (!line) return;
      var parts = line.split(/[,;\t ]+/).filter(Boolean), r = [];
      parts.forEach(function (p) { var q = ceRun(p, env()); if (!q.ok || typeof q.v !== 'number') throw { ce: true, msg: 'Cannot read "' + p + '"' }; r.push(q.v); });
      rows.push(r);
    });
    return rows;
  }

  // STAT
  (function () {
    var p = panes.stat, ty = select('st-type', [['1', '1-VAR (x, optional frequency)'], ['lin', 'A+BX  (y = a + bx)'], ['quad', '_+CX²  (y = a + bx + cx²)'], ['log', 'ln X  (y = a + b·ln x)'], ['exp', 'e^X  (y = a·e^(bx))'], ['ab', 'A·B^X  (y = a·b^x)'], ['pow', 'A·X^B  (y = a·x^b)'], ['inv', '1/X  (y = a + b/x)']], 'Statistics type');
    var ta = h('textarea', { cls: 'sc-ta', id: 'st-data', rows: '7', 'aria-label': 'Data', placeholder: '1-VAR: one value per line, e.g.\n12\n15\n18, 3   (value, frequency)\n\n2-VAR: x, y per line, e.g.\n1, 2.5\n2, 4.1  (optional third number = frequency)' });
    var go = h('button', { type: 'button', cls: 'sc-tool-btn sc-go', text: 'Calculate' }), out = outBox(), pr = h('div', { cls: 'sc-pred' });
    var px = field('Predict ŷ for x =', 'st-px', ''), py = field('Predict x̂ for y =', 'st-py', '');
    var cur = null, pout = outBox();
    p.appendChild(h('h2', { cls: 'sc-h2', text: 'STAT - Statistics & Regression' }));
    p.appendChild(h('p', { cls: 'sc-pane-note', text: 'Paste or type your data, choose a type and press Calculate. Gives n, mean, sums, population (σ) and sample (s) deviation, quartiles, and regression a, b, c, r.' }));
    p.appendChild(ty); p.appendChild(ta); p.appendChild(go); p.appendChild(out); p.appendChild(pr);
    pr.appendChild(px.wrap); pr.appendChild(py.wrap);
    var pb = h('button', { type: 'button', cls: 'sc-tool-btn', text: 'Predict' }); pr.appendChild(pb); pr.appendChild(pout); pr.hidden = true;
    go.addEventListener('click', function () {
      try {
        var rows = parseRows(ta.value), type = ty.value;
        if (!rows.length) throw { ce: true, msg: 'Enter some data first' };
        if (type === '1') {
          var xs = rows.map(function (r) { return r[0]; }), fs = rows.map(function (r) { return r.length > 1 ? r[1] : 1; });
          if (fs.some(function (f) { return f < 0 || f !== Math.floor(f); })) throw { ce: true, msg: 'Frequency must be a whole number' };
          var s = ceStat1(xs, fs); cur = null; pr.hidden = true;
          kv(out, [['n', plain(s.n)], ['x̄ (mean)', plain(s.mean)], ['Σx', plain(s.sumx)], ['Σx²', plain(s.sumx2)], ['σx (population)', plain(s.sigx)], ['sx (sample)', isNaN(s.sx) ? 'n/a (needs n ≥ 2)' : plain(s.sx)], ['min', plain(s.min)], ['Q1', plain(s.q1)], ['Med', plain(s.med)], ['Q3', plain(s.q3)], ['max', plain(s.max)]]);
        } else {
          if (rows.some(function (r) { return r.length < 2; })) throw { ce: true, msg: 'Each line needs x and y' };
          var X = rows.map(function (r) { return r[0]; }), Y = rows.map(function (r) { return r[1]; }), F = rows.map(function (r) { return r.length > 2 ? r[2] : 1; });
          var m = ceStat2(X, Y, F, type); cur = m; pr.hidden = false; pout.textContent = '';
          var list = [['n', plain(m.n)], ['x̄', plain(m.xmean)], ['ȳ', plain(m.ymean)], ['Σx', plain(m.sumx)], ['Σy', plain(m.sumy)], ['Σx²', plain(m.sumx2)], ['Σy²', plain(m.sumy2)], ['Σxy', plain(m.sumxy)], ['σx', plain(m.sigx)], ['σy', plain(m.sigy)], ['sx', plain(m.sx)], ['sy', plain(m.sy)], ['Model', CE_REG[type]], ['a', plain(m.a)], ['b', plain(m.b)]];
          if (type === 'quad') list.push(['c', plain(m.c)]); else list.push(['r', isNaN(m.r) ? 'n/a' : plain(m.r)]);
          kv(out, list);
        }
      } catch (e) { fail(out, e); pr.hidden = true; }
    });
    pb.addEventListener('click', function () {
      try {
        var rows = [];
        if (!cur) return;
        if (px.inp.value.trim()) rows.push(['ŷ', plain(ceRegY(cur, numOf(px.inp, 'x')))]);
        if (py.inp.value.trim()) { var r = ceRegX(cur, numOf(py.inp, 'y')); rows.push(['x̂', Array.isArray(r) ? r.map(plain).join('  or  ') : plain(r)]); }
        if (!rows.length) { pout.textContent = 'Enter x or y'; return; }
        kv(pout, rows);
      } catch (e) { fail(pout, e); }
    });
  })();

  // DISTR
  (function () {
    var p = panes.distr;
    var D = {
      npd: ['Normal PD', [['x', 0], ['σ', 1], ['μ', 0]], function (a) { return ceNormPdf(a[0], a[2], pos(a[1])); }],
      ncd: ['Normal CD  P(lower ≤ X ≤ upper)', [['Lower', -1], ['Upper', 1], ['σ', 1], ['μ', 0]], function (a) { var s = pos(a[2]); return ceNormCdf((a[1] - a[3]) / s) - ceNormCdf((a[0] - a[3]) / s); }],
      inv: ['Inverse Normal (left-tail area)', [['Area', 0.975], ['σ', 1], ['μ', 0]], function (a) { return a[2] + pos(a[1]) * ceNormInv(a[0]); }],
      bpd: ['Binomial PD  P(X = x)', [['x', 3], ['N', 10], ['p', 0.5]], function (a) { return ceBinomPd(a[0], a[1], a[2]); }],
      bcd: ['Binomial CD  P(X ≤ x)', [['x', 3], ['N', 10], ['p', 0.5]], function (a) { if (a[2] < 0 || a[2] > 1 || a[1] < 0) throw { ce: true, msg: 'Math ERROR' }; return ceBinomCd(a[0], a[1], a[2]); }],
      ppd: ['Poisson PD  P(X = x)', [['x', 2], ['λ', 3]], function (a) { return cePoisPd(a[0], a[1]); }],
      pcd: ['Poisson CD  P(X ≤ x)', [['x', 2], ['λ', 3]], function (a) { if (a[1] <= 0) throw { ce: true, msg: 'Math ERROR' }; return cePoisCd(a[0], a[1]); }]
    };
    function pos(s) { if (s <= 0) throw { ce: true, msg: 'Math ERROR (σ must be positive)' }; return s; }
    var sel = select('ds-type', Object.keys(D).map(function (k) { return [k, D[k][0]]; }), 'Distribution'), form = h('div', {}), out = outBox(), inputs = [];
    var go = h('button', { type: 'button', cls: 'sc-tool-btn sc-go', text: 'Calculate' });
    function build() {
      form.textContent = ''; inputs = [];
      D[sel.value][1].forEach(function (f, i) { var fl = field(f[0] + ' =', 'ds-f' + i, String(f[1])); inputs.push(fl.inp); form.appendChild(fl.wrap); });
      out.textContent = '';
    }
    sel.addEventListener('change', build); build();
    go.addEventListener('click', function () {
      try {
        var a = inputs.map(function (inp, i) { return numOf(inp, D[sel.value][1][i][0]); });
        var r = D[sel.value][2](a); if (!isFinite(r)) throw { ce: true, msg: 'Math ERROR' };
        kv(out, [['Result', ceFmtNum(r, { fmt: 'norm2' })]]);
      } catch (e) { fail(out, e); }
    });
    p.appendChild(h('h2', { cls: 'sc-h2', text: 'DISTR - Probability Distributions' }));
    p.appendChild(h('p', { cls: 'sc-pane-note', text: 'Normal, Binomial and Poisson distributions.' }));
    p.appendChild(sel); p.appendChild(form); p.appendChild(go); p.appendChild(out);
  })();

  // BASE-N
  (function () {
    var p = panes.base, bs = select('bn-base', [['10', 'DEC (base 10)'], ['16', 'HEX (base 16)'], ['2', 'BIN (base 2)'], ['8', 'OCT (base 8)']], 'Number base');
    var inp = h('input', { type: 'text', cls: 'sc-box-in', id: 'bn-in', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', 'aria-label': 'Base-N expression', placeholder: 'e.g. FF + 1A  or  1010 and 110' }), out = outBox();
    var go = h('button', { type: 'button', cls: 'sc-tool-btn sc-go', text: 'Calculate' }), chips = h('div', { cls: 'sc-chips' });
    ['and', 'or', 'xor', 'xnor', 'not(', 'neg(', '+', '-', '*', '/', '(', ')', 'A', 'B', 'C', 'D', 'E', 'F'].forEach(function (c) {
      var b = h('button', { type: 'button', cls: 'sc-chip', text: c });
      b.addEventListener('click', function () { var pre = /^[a-z]/.test(c) && c.length > 1 && c.slice(-1) !== '(' ? ' ' + c + ' ' : c; inp.value += pre; inp.focus(); });
      chips.appendChild(b);
    });
    function run() {
      try {
        var base = Number(bs.value), v = ceBaseEval(inp.value, base);
        if (v === null) { out.textContent = ''; return; }
        kv(out, [['DEC', ceBaseShow(v, 10)], ['HEX', ceBaseShow(v, 16)], ['BIN', ceBaseShow(v, 2)], ['OCT', ceBaseShow(v, 8)]]);
      } catch (e) { fail(out, e); }
    }
    go.addEventListener('click', run); inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') run(); });
    p.appendChild(h('h2', { cls: 'sc-h2', text: 'BASE-N - Binary, Octal, Decimal, Hex' }));
    p.appendChild(h('p', { cls: 'sc-pane-note', text: '32-bit signed integers like the Casio. Operators: + − × ÷, and, or, xor, xnor, not(), neg(). Negative results are shown in two’s complement.' }));
    p.appendChild(bs); p.appendChild(inp); p.appendChild(chips); p.appendChild(go); p.appendChild(out);
  })();

  // EQN
  (function () {
    var p = panes.eqn, sel = select('eq-type', [['s2', 'Simultaneous equations - 2 unknowns'], ['s3', 'Simultaneous equations - 3 unknowns'], ['p2', 'Polynomial - degree 2 (quadratic)'], ['p3', 'Polynomial - degree 3 (cubic)'], ['p4', 'Polynomial - degree 4']], 'Equation type');
    var form = h('div', { cls: 'sc-eqn' }), out = outBox(), inputs = [], go = h('button', { type: 'button', cls: 'sc-tool-btn sc-go', text: 'Solve' });
    function build() {
      form.textContent = ''; inputs = []; out.textContent = '';
      var t = sel.value, n = Number(t.charAt(1));
      if (t.charAt(0) === 's') {
        var names = ['x', 'y', 'z'];
        for (var i = 0; i < n; i++) {
          var row = h('div', { cls: 'sc-eqn-row' }, []), r = [];
          for (var j = 0; j <= n; j++) {
            var inp = h('input', { type: 'text', cls: 'sc-cell', inputmode: 'decimal', 'aria-label': 'Equation ' + (i + 1) + ' ' + (j < n ? 'coefficient of ' + names[j] : 'constant'), value: '0' }); r.push(inp);
            row.appendChild(inp); row.appendChild(h('span', { text: j < n ? names[j] + (j < n - 1 ? ' +' : ' =') : '' }));
          }
          inputs.push(r); form.appendChild(row);
        }
      } else {
        var row2 = h('div', { cls: 'sc-eqn-row' }, []), r2 = [], nm = ['a', 'b', 'c', 'd', 'e'];
        for (var k = 0; k <= n; k++) { var ip = h('input', { type: 'text', cls: 'sc-cell', inputmode: 'decimal', 'aria-label': 'Coefficient ' + nm[k], value: k === 0 ? '1' : '0' }); r2.push(ip); row2.appendChild(ip); row2.appendChild(h('span', { text: (n - k > 1 ? 'x' + (n - k) : n - k === 1 ? 'x' : '') + (k < n ? ' +' : ' = 0') })); }
        inputs.push(r2); form.appendChild(row2);
      }
    }
    sel.addEventListener('change', build); build();
    go.addEventListener('click', function () {
      try {
        var t = sel.value, n = Number(t.charAt(1)), vals = inputs.map(function (r) { return r.map(function (ip) { return numOf(ip, 'Coefficient'); }); });
        if (t.charAt(0) === 's') {
          var sol = ceSolveLinear(vals.map(function (r) { return r.slice(0, n); }), vals.map(function (r) { return r[n]; }));
          if (!sol) throw { ce: true, msg: 'No unique solution (the equations are dependent or inconsistent)' };
          kv(out, sol.map(function (v, i) { return [['x', 'y', 'z'][i], ceFmtNum(Number(v.toPrecision(12)), { fmt: 'norm2' })]; }));
        } else {
          if (vals[0][0] === 0) throw { ce: true, msg: 'Leading coefficient a cannot be 0' };
          var roots = ceRoots(vals[0]);
          kv(out, roots.map(function (z, i) { return ['x' + (i + 1), ceFmtValue(z, { fmt: 'norm2', math: false })]; }));
        }
      } catch (e) { fail(out, e); }
    });
    p.appendChild(h('h2', { cls: 'sc-h2', text: 'EQN - Equation Solver' }));
    p.appendChild(sel); p.appendChild(form); p.appendChild(go); p.appendChild(out);
  })();

  // MATRIX & VECTOR
  function grid(prefix, rows, cols) {
    var g = h('div', { cls: 'sc-mgrid' }), cells = [];
    for (var i = 0; i < rows; i++) { var rr = []; for (var j = 0; j < cols; j++) { var c = h('input', { type: 'text', cls: 'sc-cell', inputmode: 'decimal', 'aria-label': prefix + ' row ' + (i + 1) + ' column ' + (j + 1), value: '0' }); rr.push(c); g.appendChild(c); } cells.push(rr); }
    g.className = 'sc-mgrid sc-cols-' + cols; return { el: g, cells: cells };
  }
  function readGrid(g) { return g.cells.map(function (r) { return r.map(function (c) { return numOf(c, 'Matrix entry'); }); }); }
  function matText(M) { return M.map(function (r) { return r.map(function (v) { return ceFmtNum(v, { fmt: 'norm2' }); }).join('   '); }).join('\n'); }
  (function () {
    var p = panes.matrix, ga, gb, ha = h('div', {}), hb = h('div', {}), out = outBox();
    function dimSel(id, label) { return select(id, [1, 2, 3, 4].map(function (n) { return [String(n), String(n)]; }), label); }
    var ar = dimSel('mx-ar', 'Matrix A rows'), ac = dimSel('mx-ac', 'Matrix A columns'), br = dimSel('mx-br', 'Matrix B rows'), bc = dimSel('mx-bc', 'Matrix B columns');
    ar.value = ac.value = br.value = bc.value = '2';
    function build() {
      ha.textContent = ''; hb.textContent = '';
      ga = grid('A', Number(ar.value), Number(ac.value)); gb = grid('B', Number(br.value), Number(bc.value));
      ha.appendChild(ga.el); hb.appendChild(gb.el);
    }
    [ar, ac, br, bc].forEach(function (s) { s.addEventListener('change', build); }); build();
    var kf = field('k (scalar) =', 'mx-k', '2'), opSel = select('mx-op', [['add', 'A + B'], ['sub', 'A − B'], ['mul', 'A × B'], ['ka', 'k × A'], ['det', 'Det(A)'], ['trn', 'Trn(A)'], ['inv', 'A⁻¹'], ['sq', 'A²'], ['detb', 'Det(B)'], ['invb', 'B⁻¹'], ['ba', 'B × A']], 'Operation');
    var go = h('button', { type: 'button', cls: 'sc-tool-btn sc-go', text: 'Calculate' });
    go.addEventListener('click', function () {
      try {
        var A = readGrid(ga), B = readGrid(gb), op = opSel.value, r;
        if (op === 'add') r = ceMatAdd(A, B, 1); else if (op === 'sub') r = ceMatAdd(A, B, -1); else if (op === 'mul') r = ceMatMul(A, B); else if (op === 'ba') r = ceMatMul(B, A);
        else if (op === 'ka') r = ceMatScale(A, numOf(kf.inp, 'k')); else if (op === 'trn') r = ceMatTrn(A); else if (op === 'inv') r = ceMatInv(A);
        else if (op === 'invb') r = ceMatInv(B); else if (op === 'sq') r = ceMatMul(A, A);
        else { var d = ceMatDet(op === 'det' ? A : B); kv(out, [['Det', ceFmtNum(d, { fmt: 'norm2' })]]); return; }
        ok(out); out.appendChild(h('pre', { cls: 'sc-pre', text: matText(r) }));
      } catch (e) { fail(out, e && e.msg === 'Math ERROR' ? { msg: 'Math ERROR (matrix is singular)' } : e); }
    });
    p.appendChild(h('h2', { cls: 'sc-h2', text: 'MATRIX' }));
    p.appendChild(h('p', { cls: 'sc-pane-note', text: 'Up to 4×4. Choose sizes, fill the entries, pick an operation.' }));
    p.appendChild(h('div', { cls: 'sc-mrow' }, [h('span', { text: 'Matrix A size' }), ar, h('span', { text: '×' }), ac]));
    p.appendChild(ha);
    p.appendChild(h('div', { cls: 'sc-mrow' }, [h('span', { text: 'Matrix B size' }), br, h('span', { text: '×' }), bc]));
    p.appendChild(hb); p.appendChild(kf.wrap); p.appendChild(opSel); p.appendChild(go); p.appendChild(out);
  })();
  (function () {
    var p = panes.vector, dim = select('vc-dim', [['2', '2-dimensional'], ['3', '3-dimensional']], 'Vector dimension'), ha = h('div', {}), hb = h('div', {}), out = outBox(), ga, gb;
    function build() { ha.textContent = ''; hb.textContent = ''; var n = Number(dim.value); ga = grid('Vector A', 1, n); gb = grid('Vector B', 1, n); ha.appendChild(h('p', { cls: 'sc-lbl', text: 'Vector A' })); ha.appendChild(ga.el); hb.appendChild(h('p', { cls: 'sc-lbl', text: 'Vector B' })); hb.appendChild(gb.el); }
    dim.addEventListener('change', build); build();
    var kf = field('k (scalar) =', 'vc-k', '2'), op = select('vc-op', [['add', 'A + B'], ['sub', 'A − B'], ['dot', 'A · B (dot product)'], ['cross', 'A × B (cross product, 3D)'], ['absa', '|A|'], ['absb', '|B|'], ['ang', 'Angle between A and B'], ['unit', 'Unit vector of A'], ['ka', 'k × A']], 'Operation');
    var go = h('button', { type: 'button', cls: 'sc-tool-btn sc-go', text: 'Calculate' });
    go.addEventListener('click', function () {
      try {
        var A = readGrid(ga)[0], B = readGrid(gb)[0], o = op.value, v;
        function fv(V) { return '(' + V.map(function (x) { return ceFmtNum(x, { fmt: 'norm2' }); }).join(', ') + ')'; }
        if (o === 'add') v = fv(A.map(function (x, i) { return x + B[i]; })); else if (o === 'sub') v = fv(A.map(function (x, i) { return x - B[i]; }));
        else if (o === 'dot') v = ceFmtNum(ceVecDot(A, B), { fmt: 'norm2' }); else if (o === 'cross') v = fv(ceVecCross(A, B));
        else if (o === 'absa') v = ceFmtNum(ceVecAbs(A), { fmt: 'norm2' }); else if (o === 'absb') v = ceFmtNum(ceVecAbs(B), { fmt: 'norm2' });
        else if (o === 'ang') v = ceFmtNum(ceVecAngle(A, B, st.mode), { fmt: 'norm2' }) + (st.mode === 'deg' ? '°' : st.mode === 'rad' ? ' rad' : ' grad');
        else if (o === 'unit') { var m = ceVecAbs(A); if (m === 0) throw { ce: true, msg: 'Math ERROR' }; v = fv(A.map(function (x) { return x / m; })); }
        else { var k = numOf(kf.inp, 'k'); v = fv(A.map(function (x) { return x * k; })); }
        kv(out, [['Result', v]]);
      } catch (e) { fail(out, e); }
    });
    p.appendChild(h('h2', { cls: 'sc-h2', text: 'VECTOR' })); p.appendChild(dim); p.appendChild(ha); p.appendChild(hb); p.appendChild(kf.wrap); p.appendChild(op); p.appendChild(go); p.appendChild(out);
  })();

  // TABLE
  (function () {
    var p = panes.table, f = field('f(X) =', 'tb-f', 'X^2+1'), s = field('Start =', 'tb-s', '1'), e = field('End =', 'tb-e', '5'), t = field('Step =', 'tb-t', '1'), out = outBox();
    var go = h('button', { type: 'button', cls: 'sc-tool-btn sc-go', text: 'Make table' });
    f.inp.setAttribute('inputmode', 'text');
    go.addEventListener('click', function () {
      try {
        var rows = ceTable(f.inp.value, numOf(s.inp, 'Start'), numOf(e.inp, 'End'), numOf(t.inp, 'Step'), env());
        ok(out); var tb = h('table', { cls: 'sc-tbl sc-tbl-2' }, [h('tr', {}, [h('th', { text: 'X' }), h('th', { text: 'f(X)' })])]);
        rows.forEach(function (r) { tb.appendChild(h('tr', {}, [h('td', { text: plain(r[0]) }), h('td', { text: r[1] === null ? 'ERROR' : pretty(ceFmtValue(r[1], fmtOpts({ math: false }))) })])); });
        out.appendChild(tb);
      } catch (er) { fail(out, er); }
    });
    p.appendChild(h('h2', { cls: 'sc-h2', text: 'TABLE - f(X) values' }));
    p.appendChild(h('p', { cls: 'sc-pane-note', text: 'Use X as the variable, for example sin(X) + X^2. Up to 100 rows.' }));
    [f, s, e, t].forEach(function (q) { p.appendChild(q.wrap); }); p.appendChild(go); p.appendChild(out);
  })();

  // CONST
  (function () {
    var p = panes.const, q = field('Search', 'cs-q', ''), list = h('ul', { cls: 'sc-clist' });
    q.inp.setAttribute('inputmode', 'text');
    function render() {
      var term = q.inp.value.trim().toLowerCase(); list.textContent = '';
      CE_CONSTS.forEach(function (c, i) {
        if (term && (c[0] + ' ' + c[1]).toLowerCase().indexOf(term) === -1) return;
        var b = h('button', { type: 'button', cls: 'sc-citem' }, [h('b', { text: c[0] }), h('span', { text: c[1] }), h('code', { text: ceSciStr(c[2], null) })]);
        b.addEventListener('click', function () { openTab('comp'); insertText(ceSciStr(c[2], null).replace(/^-/, '(-') + (c[2] < 0 ? ')' : '')); elExpr.focus(); });
        list.appendChild(h('li', {}, [b]));
      });
    }
    q.inp.addEventListener('input', render); render();
    p.appendChild(h('h2', { cls: 'sc-h2', text: 'CONST - 40 scientific constants' }));
    p.appendChild(h('p', { cls: 'sc-pane-note', text: 'Tap a constant to insert its value into the calculator (CODATA 2018, SI units).' }));
    p.appendChild(q.wrap); p.appendChild(list);
  })();

  // CONV
  (function () {
    var p = panes.conv, cat = select('cv-cat', Object.keys(CE_UNITS).map(function (k) { return [k, k]; }), 'Category'), v = field('Value =', 'cv-v', '1'), fr = select('cv-from', [], 'From unit'), to = select('cv-to', [], 'To unit'), out = outBox();
    function units() {
      var u = cat.value === 'Temperature' ? ['°C', '°F', 'K', '°R'] : Object.keys(CE_UNITS[cat.value]);
      [fr, to].forEach(function (s, idx) { s.textContent = ''; u.forEach(function (n, i) { var o = h('option', { value: n, text: n.replace(/_/g, ' ') }); s.appendChild(o); }); s.selectedIndex = Math.min(u.length - 1, idx); });
    }
    cat.addEventListener('change', units); units();
    var go = h('button', { type: 'button', cls: 'sc-tool-btn sc-go', text: 'Convert' }), put = h('button', { type: 'button', cls: 'sc-tool-btn', text: 'Insert result into calculator' }), lastR = null;
    go.addEventListener('click', function () {
      try {
        lastR = ceConvert(numOf(v.inp, 'Value'), cat.value, fr.value, to.value);
        kv(out, [[v.inp.value + ' ' + fr.value.replace(/_/g, ' ') + ' =', ceFmtNum(Number(lastR.toPrecision(12)), { fmt: 'norm2' }) + ' ' + to.value.replace(/_/g, ' ')]]);
      } catch (e) { fail(out, e); }
    });
    put.addEventListener('click', function () { if (lastR === null) return; openTab('comp'); insertText(ceSciStr(Number(lastR.toPrecision(12)), null)); elExpr.focus(); });
    p.appendChild(h('h2', { cls: 'sc-h2', text: 'CONV - Unit conversion' }));
    [cat, v.wrap].forEach(function (x) { p.appendChild(x); });
    p.appendChild(h('div', { cls: 'sc-mrow' }, [h('span', { text: 'From' }), fr, h('span', { text: 'to' }), to]));
    p.appendChild(go); p.appendChild(put); p.appendChild(out);
  })();

  openTab('comp');

  // ---------- setup ----------
  function bindSetup() {
    var sA = $('su-angle'), sF = $('su-fmt'), sD = $('su-digits'), sM = $('su-math'), sC = $('su-cmplx'), sP = $('su-cfmt'), sX = $('su-mixed');
    function read() {
      st.mode = sA.value; st.fmt = sF.value; st.digits = Math.max(0, Math.min(9, Number(sD.value) || 0));
      st.math = sM.value === 'math'; st.cmplx = sC.value === 'cmplx'; st.cfmt = sP.value; st.mixed = sX.value === 'mixed';
      sD.disabled = !(st.fmt === 'fix' || st.fmt === 'sci');
      if (st.fmt === 'sci' && st.digits < 1) { st.digits = 1; sD.value = '1'; }
      syncKeyState(); if (elExpr.value.trim()) preview();
    }
    [sA, sF, sD, sM, sC, sP, sX].forEach(function (s) { s.addEventListener('change', read); s.addEventListener('input', read); });
    $('sc-badge-mode').addEventListener('click', function () { var o = { deg: 'rad', rad: 'grad', grad: 'deg' }; sA.value = o[st.mode]; read(); });
    read();
  }
  bindSetup();

  // ---------- OPTN palette ----------
  [['gcd(', 'GCD'], ['lcm(', 'LCM'], ['int(', 'Int'], ['intg(', 'Intg'], ['rnd(', 'Rnd'], ['abs(', 'Abs'], ['conj(', 'Conjg'], ['arg(', 'arg'], ['re(', 'Re'], ['im(', 'Im'], [' mod ', 'mod'], ['!', 'x!'], ['%', '%'], ['∠', '∠'], ['log(', 'logₐb (a,b)'], ['sinh(', 'sinh'], ['cosh(', 'cosh'], ['tanh(', 'tanh'], ['asinh(', 'sinh⁻¹'], ['acosh(', 'cosh⁻¹'], ['atanh(', 'tanh⁻¹'], [',', ','], ['=', '=']].forEach(function (c) {
    var b = h('button', { type: 'button', cls: 'sc-chip', text: c[1] });
    b.addEventListener('click', function () { insertText(c[0]); elExpr.focus(); });
    $('sc-optn').appendChild(b);
  });

  // ---------- misc ----------
  elExpr.addEventListener('input', function () { flipFresh = false; preview(); });
  elExpr.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    else if (e.key === 'Escape') { e.preventDefault(); action('ac'); }
    else if (e.key === 'ArrowUp' && !e.shiftKey) { e.preventDefault(); histRecall(); }
  });
  $('sc-clear-history').addEventListener('click', function () { hist = []; renderHist(); });
  var kbd = $('sc-kbd');
  kbd.addEventListener('click', function () {
    var on = kbd.getAttribute('aria-pressed') !== 'true';
    kbd.setAttribute('aria-pressed', on ? 'true' : 'false'); kbd.textContent = 'Device keyboard: ' + (on ? 'on' : 'off');
    elExpr.setAttribute('inputmode', on ? 'text' : 'none'); elExpr.focus();
  });
  $('sc-copy').addEventListener('click', function () {
    var b = $('sc-copy');
    if (!last || !last.ok) return;
    var txt = last.text || ''; 
    function done() { var o = b.textContent; b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy result'; }, 1200); }
    try { navigator.clipboard.writeText(txt).then(done, function () { }); } catch (e) { }
  });
  renderHist(); syncKeyState();
})();
