// Fixlytools - Calculator (everyday four-function calculator)
// All logic lives in pure functions with the prefix "ca". The state machine caPress(state, key)
// never mutates its input and never lets NaN, Infinity or undefined reach the display.

var CA_MAX_DIGITS = 16;
var CA_HISTORY_MAX = 20;
var CA_SYMBOL = { '+': '+', '-': '−', '*': '×', '/': '÷' };

// ---------- exact decimal helpers ----------

// Plain decimal number -> { n: BigInt, s: scale } so that value = n / 10^s. Returns null for exponent forms.
function caParseDec(x) {
  if (typeof x !== 'number' || !isFinite(x)) return null;
  var m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(String(x));
  if (!m) return null;
  var frac = m[3] || '';
  if (m[2].length + frac.length > 40) return null;
  var n = BigInt(m[2] + frac);
  if (m[1]) n = -n;
  return { n: n, s: frac.length };
}

function caDecToNumber(n, s) {
  return Number(n.toString() + 'e-' + s);
}

// Snaps a result to 12 significant digits when it is only a floating-point whisker away from such a number.
function caClean(x, scale) {
  if (!isFinite(x) || x === 0) return x;
  var r = Number(x.toPrecision(12));
  var sc = Math.max(Math.abs(scale), Math.abs(x));
  return Math.abs(x - r) <= sc * 1e-15 ? r : x;
}

function caAdd(a, b) {
  var da = caParseDec(a), db = caParseDec(b);
  if (da && db) {
    var s = Math.max(da.s, db.s);
    var n = da.n * (10n ** BigInt(s - da.s)) + db.n * (10n ** BigInt(s - db.s));
    return caClean(caDecToNumber(n, s), Math.max(Math.abs(a), Math.abs(b)));
  }
  return caClean(a + b, Math.max(Math.abs(a), Math.abs(b)));
}

function caSub(a, b) {
  return caAdd(a, -b);
}

function caMul(a, b) {
  var da = caParseDec(a), db = caParseDec(b);
  if (da && db) {
    return caClean(caDecToNumber(da.n * db.n, da.s + db.s), Math.max(Math.abs(a), Math.abs(b)));
  }
  return caClean(a * b, Math.max(Math.abs(a), Math.abs(b)));
}

// Returns null when dividing by zero (the caller shows the message).
function caDiv(a, b) {
  if (b === 0) return null;
  return caClean(a / b, Math.max(Math.abs(a), Math.abs(b)));
}

function caApply(op, a, b) {
  if (op === '+') return caAdd(a, b);
  if (op === '-') return caSub(a, b);
  if (op === '*') return caMul(a, b);
  if (op === '/') return caDiv(a, b);
  return b;
}

// Percent key. op is the pending operator or null. Returns a number, or null for divide by zero.
function caPercent(op, acc, cur) {
  if (op === '+') return caAdd(acc, caDiv(caMul(acc, cur), 100));
  if (op === '-') return caSub(acc, caDiv(caMul(acc, cur), 100));
  if (op === '*') return caDiv(caMul(acc, cur), 100);
  if (op === '/') {
    if (cur === 0) return null;
    return caMul(caDiv(acc, cur), 100);
  }
  return caDiv(cur, 100);
}

// ---------- display formatting ----------

// Turns a number into display text: about 12 significant digits, exponent form for very big or very small values.
function caFormat(x) {
  if (typeof x !== 'number' || !isFinite(x)) return 'Error';
  if (x === 0) return '0';
  if (Number.isInteger(x) && Math.abs(x) < 1e16) return String(x);
  var r = Number(x.toPrecision(12));
  var abs = Math.abs(r);
  if (abs >= 1e16 || abs < 1e-6) {
    var e = r.toExponential(11);              // 1.23450000000e+21
    var parts = e.split('e');
    var mant = parts[0].replace(/\.?0+$/, '');
    return mant + 'e' + parts[1];
  }
  var s = String(r);
  if (/e/.test(s)) {                          // JS switched to exponent form inside our plain range; avoid it
    s = r.toFixed(12).replace(/\.?0+$/, '');
  }
  return s;
}

// Adds thousands separators to the integer part of a plain number string (leaves exponent forms alone).
function caGroup(str) {
  if (/e/i.test(str) || /[^0-9.\-]/.test(str)) return str;
  var neg = str.charAt(0) === '-';
  var body = neg ? str.slice(1) : str;
  var dot = body.indexOf('.');
  var intPart = dot === -1 ? body : body.slice(0, dot);
  var rest = dot === -1 ? '' : body.slice(dot);
  intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + intPart + rest;
}

// ---------- state machine ----------

function caInit() {
  return {
    typing: null,      // text being typed, or null when the display shows a number
    cur: 0,            // current number (full precision) when not typing
    acc: null,         // left operand waiting for the pending operator
    op: null,          // pending operator: + - * /
    fresh: false,      // true right after an operator: the next number has not been entered yet
    lastOp: null,      // for repeated equals
    lastOperand: 0,
    mem: null,         // memory value or null
    error: null,
    expr: '',          // text shown above the display
    history: []
  };
}

function caClone(s) {
  var c = {};
  for (var k in s) c[k] = s[k];
  c.history = s.history.slice();
  return c;
}

function caValue(s) {
  return s.typing !== null ? Number(s.typing) : s.cur;
}

function caDisplay(s, useSep) {
  if (s.error) return s.error;
  var t = s.typing !== null ? s.typing : caFormat(s.cur);
  return useSep ? caGroup(t) : t;
}

function caSetError(s, msg) {
  s.error = msg;
  s.typing = null;
  s.acc = null;
  s.op = null;
  s.fresh = false;
  s.lastOp = null;
  s.expr = '';
  return s;
}

function caPushHistory(s, expr, result) {
  s.history.unshift({ expr: expr, result: result });
  if (s.history.length > CA_HISTORY_MAX) s.history.length = CA_HISTORY_MAX;
}

function caCheckResult(s, result) {
  if (result === null) { caSetError(s, 'Cannot divide by zero'); return false; }
  if (!isFinite(result)) { caSetError(s, 'Overflow'); return false; }
  return true;
}

function caDigitCount(text) {
  return text.replace(/[^0-9]/g, '').length;
}

function caPress(prev, key) {
  var s = caClone(prev);

  if (s.error) {
    if (key === 'C' || key === 'CE') { s.error = null; s.cur = 0; s.typing = null; return s; }
    if (/^[0-9.]$/.test(key)) { s.error = null; s.cur = 0; s.typing = null; }
    else if (key === 'MC') { s.mem = null; return s; }
    else return s;
  }

  var v;

  if (/^[0-9]$/.test(key)) {
    if (s.typing === null) {
      if (s.op === null) { s.lastOp = null; s.expr = ''; }
      s.typing = key;
    } else if (s.typing === '0') {
      s.typing = key;
    } else if (s.typing === '-0') {
      s.typing = '-' + key;
    } else if (caDigitCount(s.typing) < CA_MAX_DIGITS) {
      s.typing += key;
    }
    s.fresh = false;
    return s;
  }

  if (key === '.') {
    if (s.typing === null) {
      if (s.op === null) { s.lastOp = null; s.expr = ''; }
      s.typing = '0.';
    } else if (s.typing.indexOf('.') === -1 && caDigitCount(s.typing) < CA_MAX_DIGITS) {
      s.typing += '.';
    }
    s.fresh = false;
    return s;
  }

  if (key === '+' || key === '-' || key === '*' || key === '/') {
    v = caValue(s);
    if (s.op !== null && s.fresh) {                 // operator pressed twice: replace the first one
      s.op = key;
      s.expr = s.expr.replace(/\s\S$/, ' ' + CA_SYMBOL[key]);
      return s;
    }
    if (s.op !== null) {                            // chain: run the pending operation first
      var r = caApply(s.op, s.acc, v);
      if (!caCheckResult(s, r)) return s;
      s.expr += ' ' + caFormat(v) + ' ' + CA_SYMBOL[key];
      s.acc = r;
      s.cur = r;
    } else {
      s.acc = v;
      s.cur = v;
      s.expr = caFormat(v) + ' ' + CA_SYMBOL[key];
    }
    s.op = key;
    s.typing = null;
    s.fresh = true;
    return s;
  }

  if (key === '=') {
    v = caValue(s);
    var expr, res;
    if (s.op !== null) {
      res = caApply(s.op, s.acc, v);
      if (!caCheckResult(s, res)) return s;
      expr = s.expr + ' ' + caFormat(v) + ' =';
      s.lastOp = s.op;
      s.lastOperand = v;
      s.op = null;
      s.acc = null;
    } else if (s.lastOp !== null) {
      res = caApply(s.lastOp, v, s.lastOperand);
      if (!caCheckResult(s, res)) return s;
      expr = caFormat(v) + ' ' + CA_SYMBOL[s.lastOp] + ' ' + caFormat(s.lastOperand) + ' =';
    } else {
      s.cur = v;
      s.typing = null;
      return s;
    }
    caPushHistory(s, expr.replace(/^\s+/, ''), res);
    s.cur = res;
    s.typing = null;
    s.fresh = false;
    s.expr = expr.replace(/^\s+/, '');
    return s;
  }

  if (key === 'C') {
    s.typing = null; s.cur = 0; s.acc = null; s.op = null; s.fresh = false; s.lastOp = null; s.expr = '';
    return s;
  }

  if (key === 'CE') {
    s.typing = null; s.cur = 0;
    s.fresh = false;
    return s;
  }

  if (key === 'BS') {
    if (s.typing !== null) {
      var t = s.typing.slice(0, -1);
      if (t === '' || t === '-') t = '0';
      s.typing = t;
    }
    return s;
  }

  if (key === 'NEG') {
    if (s.typing !== null) {
      if (Number(s.typing) === 0 && s.typing.indexOf('.') === -1) return s;   // keep a plain zero as it is
      s.typing = s.typing.charAt(0) === '-' ? s.typing.slice(1) : '-' + s.typing;
    } else {
      s.cur = s.cur === 0 ? 0 : -s.cur;
      s.fresh = false;
    }
    return s;
  }

  if (key === 'PCT') {
    v = caValue(s);
    if (s.op !== null) {
      var pr = caPercent(s.op, s.acc, v);
      if (!caCheckResult(s, pr)) return s;
      var pexpr = s.expr + ' ' + caFormat(v) + '% =';
      caPushHistory(s, pexpr, pr);
      s.cur = pr;
      s.typing = null;
      s.op = null;
      s.acc = null;
      s.lastOp = null;
      s.fresh = false;
      s.expr = pexpr;
    } else {
      var p1 = caPercent(null, 0, v);
      s.cur = p1;
      s.typing = null;
      s.fresh = false;
    }
    return s;
  }

  if (key === 'SQRT') {
    v = caValue(s);
    if (v < 0) { caSetError(s, 'Invalid input'); return s; }
    var sq = caClean(Math.sqrt(v), v);
    s.cur = sq;
    s.typing = null;
    s.fresh = false;
    return s;
  }

  if (key === 'INV') {
    v = caValue(s);
    var iv = caDiv(1, v);
    if (!caCheckResult(s, iv)) return s;
    s.cur = iv;
    s.typing = null;
    s.fresh = false;
    return s;
  }

  if (key === 'MC') { s.mem = null; return s; }
  if (key === 'MR') {
    if (s.mem === null) return s;
    s.cur = s.mem;
    s.typing = null;
    s.fresh = false;
    return s;
  }
  if (key === 'M+' || key === 'M-') {
    v = caValue(s);
    var base = s.mem === null ? 0 : s.mem;
    var nm = key === 'M+' ? caAdd(base, v) : caSub(base, v);
    if (!isFinite(nm)) { caSetError(s, 'Overflow'); return s; }
    s.mem = nm;
    s.cur = v;
    s.typing = null;
    s.fresh = false;
    return s;
  }

  return s;
}

// Loads a number (for example from the history) as the current entry.
function caLoad(prev, value) {
  var s = caClone(prev);
  if (s.error) s.error = null;
  s.cur = value;
  s.typing = null;
  s.fresh = false;
  if (s.op === null) { s.lastOp = null; }
  return s;
}

if (typeof module !== 'undefined') {
  module.exports = {
    caParseDec, caClean, caAdd, caSub, caMul, caDiv, caApply, caPercent,
    caFormat, caGroup, caInit, caValue, caDisplay, caPress, caLoad, CA_MAX_DIGITS, CA_HISTORY_MAX
  };
}

// ---------- page wiring ----------

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function () {
    var elDisplay = document.getElementById('ca-display');
    var elExpr = document.getElementById('ca-expr');
    var elMem = document.getElementById('ca-mem');
    var elKeys = document.getElementById('ca-keys');
    var elHistory = document.getElementById('ca-history');
    var elHistEmpty = document.getElementById('ca-history-empty');
    var elSep = document.getElementById('ca-sep');
    var elCopy = document.getElementById('ca-copy');
    var elClearHist = document.getElementById('ca-clear-history');
    if (!elDisplay || !elKeys) return;

    var state = caInit();
    var useSep = false;

    // Shrinks the font so a long number always fits without scrolling.
    function fitDisplay() {
      elDisplay.style.fontSize = '';
      if (state.error) return;
      var size = 36;
      while (elDisplay.scrollWidth > elDisplay.clientWidth && size > 12) {
        size -= 2;
        elDisplay.style.fontSize = size + 'px';
      }
    }

    function render() {
      var text = caDisplay(state, useSep);
      elDisplay.textContent = text;
      elDisplay.classList.toggle('ca-display-error', !!state.error);
      fitDisplay();
      elExpr.textContent = state.expr || ' ';
      elMem.hidden = state.mem === null;
      elHistory.textContent = '';
      state.history.forEach(function (h, i) {
        var li = document.createElement('li');
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'ca-hist-item';
        b.setAttribute('data-index', String(i));
        b.setAttribute('aria-label', 'Reuse result ' + caFormat(h.result) + ' from ' + h.expr);
        var e = document.createElement('span');
        e.className = 'ca-hist-expr';
        e.textContent = h.expr;
        var r = document.createElement('span');
        r.className = 'ca-hist-res';
        r.textContent = useSep ? caGroup(caFormat(h.result)) : caFormat(h.result);
        b.appendChild(e);
        b.appendChild(r);
        li.appendChild(b);
        elHistory.appendChild(li);
      });
      elHistEmpty.hidden = state.history.length > 0;
      elClearHist.disabled = state.history.length === 0;
    }

    function press(key) {
      state = caPress(state, key);
      render();
    }

    elKeys.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-key]');
      if (!btn) return;
      press(btn.getAttribute('data-key'));
    });

    elHistory.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-index]');
      if (!btn) return;
      var item = state.history[Number(btn.getAttribute('data-index'))];
      if (!item) return;
      state = caLoad(state, item.result);
      render();
    });

    elSep.addEventListener('change', function () {
      useSep = elSep.checked;
      render();
    });

    elClearHist.addEventListener('click', function () {
      state = caClone(state);
      state.history = [];
      render();
    });

    elCopy.addEventListener('click', function () {
      if (state.error) { showToast('There is no result to copy.', 'warning'); return; }
      var text = caDisplay(state, false);
      copyText(text).then(function () {
        showToast('Copied ' + text, 'success');
      }).catch(function () {
        showToast('Could not copy. Select the number and copy it manually.', 'error');
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      var k = e.key;
      var map = {
        '+': '+', '-': '-', '*': '*', 'x': '*', 'X': '*', '/': '/', '=': '=', 'Enter': '=',
        'Backspace': 'BS', 'Escape': 'C', 'Delete': 'CE', '.': '.', ',': '.', '%': 'PCT'
      };
      var key = null;
      if (/^[0-9]$/.test(k)) key = k;
      else if (map.hasOwnProperty(k)) key = map[k];
      if (key === null) return;
      e.preventDefault();
      press(key);
    });

    render();
  });
}
