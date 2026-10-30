// Fixlytools - Scientific Calculator
// Own tokenizer + recursive-descent parser/evaluator. No eval, no new Function, no libraries.
// Pure functions use the prefix "sc"; scEvaluate never throws and never returns NaN or Infinity.

var SC_FUNCS = ['asinh', 'acosh', 'atanh', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'asin', 'acos', 'atan',
  'sin', 'cos', 'tan', 'log2', 'log', 'ln', 'sqrt', 'cbrt', 'abs', 'exp'];
var SC_FUNC_ALIAS = { arcsin: 'asin', arccos: 'acos', arctan: 'atan' };
var SC_CONSTS = ['pi', 'ans', 'e'];
var SC_WORDS = ['mod', 'ncr', 'npr', 'root', 'grad', 'deg', 'rad'];
var SC_NAMES = SC_FUNCS.concat(SC_CONSTS, SC_WORDS).sort(function (a, b) { return b.length - a.length; });
var SC_MAX_LENGTH = 400;
var SC_MAX_DEPTH = 60;

function scFail(msg, kind) {
  return { sc: true, msg: msg, kind: kind || 'domain' };
}

// ---------- tokenizer ----------

function scNormalize(text) {
  return String(text)
    .replace(/×|·|⋅/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–—]/g, '-')
    .replace(/π/g, 'pi')
    .replace(/√/g, 'sqrt')
    .replace(/∛/g, 'cbrt')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xfee0); })
    .replace(/[（]/g, '(').replace(/[）]/g, ')')
    .replace(/[＋]/g, '+').replace(/[－]/g, '-').replace(/[＊]/g, '*').replace(/[／]/g, '/');
}

// Returns an array of { t: 'num'|'func'|'const'|'word'|'op', v }.
function scTokenize(text) {
  var s = scNormalize(text);
  var tokens = [];
  var i = 0;
  while (i < s.length) {
    var ch = s.charAt(i);
    if (/\s/.test(ch)) { i++; continue; }
    var m;
    if (/[0-9.]/.test(ch)) {
      m = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(s.slice(i));
      if (!m) throw scFail('Invalid number', 'syntax');
      var rest = s.charAt(i + m[0].length);
      if (rest === '.') throw scFail('Invalid number: too many decimal points', 'syntax');
      var numText = m[0];
      var nv = Number(numText);
      if (!isFinite(nv)) throw scFail('Overflow', 'domain');
      tokens.push({ t: 'num', v: nv });
      i += m[0].length;
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      var low = s.slice(i).toLowerCase();
      var found = null;
      for (var k = 0; k < SC_NAMES.length; k++) {
        if (low.indexOf(SC_NAMES[k]) === 0) { found = SC_NAMES[k]; break; }
      }
      if (!found) {
        var word = /^[a-zA-Z]+/.exec(s.slice(i))[0];
        throw scFail('Not understood: "' + word + '"', 'syntax');
      }
      var type = SC_FUNCS.indexOf(found) !== -1 ? 'func' : (SC_CONSTS.indexOf(found) !== -1 ? 'const' : 'word');
      tokens.push({ t: type, v: SC_FUNC_ALIAS[found] || found });
      i += found.length;
      continue;
    }
    if ('+-*/^()!%'.indexOf(ch) !== -1) {
      tokens.push({ t: 'op', v: ch });
      i++;
      continue;
    }
    throw scFail('Not understood: "' + ch + '"', 'syntax');
  }
  return tokens;
}

// ---------- maths helpers ----------

function scSnap(x) {
  return isFinite(x) && x !== 0 ? Number(x.toPrecision(15)) : x;
}

function scCheck(x) {
  if (typeof x !== 'number' || isNaN(x)) throw scFail('Not a real number');
  if (!isFinite(x)) throw scFail('Overflow');
  return x;
}

// Converts an angle in the current mode to radians.
function scToRad(x, mode) {
  if (mode === 'rad') return x;
  if (mode === 'grad') return x * Math.PI / 200;
  return x * Math.PI / 180;
}

function scFromRad(r, mode) {
  if (mode === 'rad') return r;
  if (mode === 'grad') return r * 200 / Math.PI;
  return r * 180 / Math.PI;
}

// Converts a value written with deg / rad / grad into the current angle mode.
function scUnitToMode(x, unit, mode) {
  var rad = unit === 'deg' ? x * Math.PI / 180 : (unit === 'grad' ? x * Math.PI / 200 : x);
  if (unit === mode) return x;
  return scSnap(scFromRad(rad, mode));
}

// Detects exact multiples of a quarter turn (so sin(180deg) is exactly 0). Returns k or null.
function scQuarterTurns(rad) {
  if (rad === 0) return 0;
  var n = Math.round(rad / (Math.PI / 2));
  if (n === 0) return null;
  return Math.abs(rad - n * Math.PI / 2) <= 1e-12 * Math.abs(rad) ? n : null;
}

function scMod4(n) {
  return ((n % 4) + 4) % 4;
}

function scSin(x, mode) {
  var rad = scToRad(x, mode);
  var k = scQuarterTurns(rad);
  if (k !== null) return [0, 1, 0, -1][scMod4(k)];
  return scSnap(Math.sin(rad));
}

function scCos(x, mode) {
  var rad = scToRad(x, mode);
  var k = scQuarterTurns(rad);
  if (k !== null) return [1, 0, -1, 0][scMod4(k)];
  return scSnap(Math.cos(rad));
}

function scTan(x, mode) {
  var rad = scToRad(x, mode);
  var k = scQuarterTurns(rad);
  if (k !== null) {
    if (scMod4(k) % 2 === 1) throw scFail('Undefined');
    return 0;
  }
  return scSnap(Math.tan(rad));
}

function scFactorial(n) {
  if (!isFinite(n) || n < 0 || n > 170 || Math.floor(n) !== n) {
    throw scFail('Factorial needs a whole number from 0 to 170');
  }
  var r = 1;
  for (var i = 2; i <= n; i++) r *= i;
  return r;
}

function scBigToNumber(big) {
  var str = big.toString();
  if (str.length > 308) throw scFail('Overflow');
  return Number(str);
}

function scNcr(n, r) {
  if (!isFinite(n) || !isFinite(r) || n < 0 || r < 0 || Math.floor(n) !== n || Math.floor(r) !== r || r > n || n > 100000) {
    throw scFail('nCr needs whole numbers with 0 ≤ r ≤ n (n up to 100000)');
  }
  var k = Math.min(r, n - r);
  var result = 1n;
  for (var i = 1; i <= k; i++) {
    result = result * BigInt(n - k + i) / BigInt(i);
    if (result.toString().length > 310) throw scFail('Overflow');
  }
  return scBigToNumber(result);
}

function scNpr(n, r) {
  if (!isFinite(n) || !isFinite(r) || n < 0 || r < 0 || Math.floor(n) !== n || Math.floor(r) !== r || r > n || n > 100000) {
    throw scFail('nPr needs whole numbers with 0 ≤ r ≤ n (n up to 100000)');
  }
  var result = 1n;
  for (var i = 0; i < r; i++) {
    result = result * BigInt(n - i);
    if (result.toString().length > 310) throw scFail('Overflow');
  }
  return scBigToNumber(result);
}

function scPow(a, b) {
  if (a === 0 && b === 0) throw scFail('0^0 is undefined');
  if (a === 0 && b < 0) throw scFail('Cannot divide by zero');
  if (a < 0 && Math.floor(b) !== b) {
    throw scFail('Not a real number. A negative number to a fractional power is not supported; for odd roots use "root" or cbrt, for example 8 root 3 or cbrt(-8)');
  }
  return scCheck(Math.pow(a, b));
}

function scRoot(x, n) {
  if (n === 0) throw scFail('The root degree cannot be 0');
  if (x < 0) {
    if (Math.floor(n) === n && Math.abs(n) % 2 === 1) return -scRoot(-x, n);
    throw scFail('Not a real number');
  }
  var r = Math.pow(x, 1 / n);
  var c = Math.round(r);
  if (Math.abs(r - c) < 1e-9 * Math.max(1, Math.abs(r)) && Math.pow(c, n) === x) return c;
  return scSnap(scCheck(r));
}

function scMath(name, x, mode) {
  switch (name) {
    case 'sin': return scSin(x, mode);
    case 'cos': return scCos(x, mode);
    case 'tan': return scTan(x, mode);
    case 'asin':
      if (x < -1 || x > 1) throw scFail('asin(x) needs x between -1 and 1');
      return scSnap(scFromRad(Math.asin(x), mode));
    case 'acos':
      if (x < -1 || x > 1) throw scFail('acos(x) needs x between -1 and 1');
      return scSnap(scFromRad(Math.acos(x), mode));
    case 'atan': return scSnap(scFromRad(Math.atan(x), mode));
    case 'sinh': return scCheck(scSnap(Math.sinh(x)));
    case 'cosh': return scCheck(scSnap(Math.cosh(x)));
    case 'tanh': return scSnap(Math.tanh(x));
    case 'asinh': return scSnap(Math.asinh(x));
    case 'acosh':
      if (x < 1) throw scFail('acosh(x) needs x of 1 or more');
      return scSnap(Math.acosh(x));
    case 'atanh':
      if (x <= -1 || x >= 1) throw scFail('atanh(x) needs x between -1 and 1');
      return scSnap(Math.atanh(x));
    case 'log':
      if (x <= 0) throw scFail('log(x) needs x greater than 0');
      return scSnap(Math.log10(x));
    case 'log2':
      if (x <= 0) throw scFail('log2(x) needs x greater than 0');
      return scSnap(Math.log2(x));
    case 'ln':
      if (x <= 0) throw scFail('ln(x) needs x greater than 0');
      return scSnap(Math.log(x));
    case 'sqrt':
      if (x < 0) throw scFail('Not a real number');
      return scSnap(Math.sqrt(x));
    case 'cbrt': return scSnap(Math.cbrt(x));
    case 'abs': return Math.abs(x);
    case 'exp': return scCheck(scSnap(Math.exp(x)));
  }
  throw scFail('Not understood: "' + name + '"', 'syntax');
}

// ---------- parser / evaluator ----------

function scParseAndEval(tokens, opts) {
  var pos = 0;
  var depth = 0;
  var mode = opts.mode;

  function peek() { return tokens[pos]; }
  function isOp(tok, v) { return tok && tok.t === 'op' && tok.v === v; }
  function isWord(tok, v) { return tok && tok.t === 'word' && tok.v === v; }
  function describe(tok) {
    if (!tok) return 'the end';
    if (tok.t === 'num') return 'the number ' + tok.v;
    return '"' + tok.v + '"';
  }
  function enter() {
    depth++;
    if (depth > SC_MAX_DEPTH) throw scFail('Brackets are nested too deeply', 'syntax');
  }
  function leave() { depth--; }

  function parseAddSub() {
    var left = parseMulDiv();
    for (;;) {
      var tok = peek();
      if (isOp(tok, '+')) { pos++; left = scCheck(left + parseMulDiv()); }
      else if (isOp(tok, '-')) { pos++; left = scCheck(left - parseMulDiv()); }
      else break;
    }
    return left;
  }

  function startsFactor(tok) {
    return tok && (tok.t === 'func' || tok.t === 'const' || isOp(tok, '('));
  }

  function parseMulDiv() {
    var left = parseComb();
    for (;;) {
      var tok = peek();
      if (isOp(tok, '*')) { pos++; left = scCheck(left * parseComb()); }
      else if (isOp(tok, '/')) {
        pos++;
        var d = parseComb();
        if (d === 0) throw scFail('Cannot divide by zero');
        left = scCheck(left / d);
      }
      else if (isWord(tok, 'mod')) {
        pos++;
        var m = parseComb();
        if (m === 0) throw scFail('Cannot divide by zero');
        left = scCheck(left - m * Math.floor(left / m));
      }
      else if (isWord(tok, 'deg') || isWord(tok, 'rad') || isWord(tok, 'grad')) {
        // a unit applies to everything written before it in this term: "pi/6 rad" is (pi/6) radians
        pos++;
        left = scUnitToMode(left, tok.v, mode);
      }
      else if (startsFactor(tok)) { left = scCheck(left * parseComb()); }   // implicit multiplication
      else break;
    }
    return left;
  }

  function parseComb() {
    var left = parseUnary();
    for (;;) {
      var tok = peek();
      if (isWord(tok, 'ncr')) { pos++; left = scNcr(left, parseUnary()); }
      else if (isWord(tok, 'npr')) { pos++; left = scNpr(left, parseUnary()); }
      else if (isWord(tok, 'root')) { pos++; left = scRoot(left, parseUnary()); }
      else break;
    }
    return left;
  }

  function parseUnary() {
    var tok = peek();
    if (isOp(tok, '-')) { pos++; enter(); var v = -parseUnary(); leave(); return v === 0 ? 0 : v; }
    if (isOp(tok, '+')) { pos++; enter(); var w = parseUnary(); leave(); return w; }
    return parsePower();
  }

  function parsePower() {
    var base = parsePostfix();
    if (isOp(peek(), '^')) {
      pos++;
      enter();
      var exp = parseUnary();          // right associative; allows 2^-3
      leave();
      return scPow(base, exp);
    }
    return base;
  }

  function parsePostfix() {
    var v = parsePrimary();
    for (;;) {
      var tok = peek();
      if (isOp(tok, '!')) { pos++; v = scFactorial(v); }
      else if (isOp(tok, '%')) { pos++; v = v / 100; }
      else break;
    }
    return v;
  }

  function parsePrimary() {
    var tok = peek();
    if (!tok) throw scFail('Incomplete expression', 'syntax');
    if (tok.t === 'num') { pos++; return tok.v; }
    if (tok.t === 'const') {
      pos++;
      if (tok.v === 'pi') return Math.PI;
      if (tok.v === 'e') return Math.E;
      return typeof opts.ans === 'number' && isFinite(opts.ans) ? opts.ans : 0;
    }
    if (tok.t === 'func') {
      pos++;
      if (!isOp(peek(), '(')) throw scFail('Put brackets after ' + tok.v + ', for example ' + tok.v + '(30)', 'syntax');
      pos++;
      enter();
      var arg = parseAddSub();
      if (!isOp(peek(), ')')) throw scFail('Missing closing bracket', 'syntax');
      pos++;
      leave();
      return scMath(tok.v, arg, mode);
    }
    if (isOp(tok, '(')) {
      pos++;
      enter();
      var inner = parseAddSub();
      if (!isOp(peek(), ')')) throw scFail('Missing closing bracket', 'syntax');
      pos++;
      leave();
      return inner;
    }
    if (tok.t === 'word') throw scFail('"' + tok.v + '" needs a number before it', 'syntax');
    throw scFail('Unexpected ' + describe(tok), 'syntax');
  }

  var result = parseAddSub();
  if (pos < tokens.length) {
    var extra = tokens[pos];
    if (isOp(extra, ')')) throw scFail('Extra closing bracket', 'syntax');
    if (extra.t === 'num') throw scFail('Missing operator before ' + describe(extra), 'syntax');
    throw scFail('Unexpected ' + describe(extra), 'syntax');
  }
  return result;
}

// Adds missing ")" at the end.
function scAutoClose(tokens) {
  var open = 0;
  for (var i = 0; i < tokens.length; i++) {
    if (tokens[i].t === 'op' && tokens[i].v === '(') open++;
    else if (tokens[i].t === 'op' && tokens[i].v === ')' && open > 0) open--;
  }
  var out = tokens.slice();
  while (open-- > 0) out.push({ t: 'op', v: ')' });
  return out;
}

// Main entry point. opts: { mode: 'deg' | 'rad' | 'grad', ans: number }
// Returns { ok: true, value, text } or { ok: false, error, kind: 'syntax' | 'domain' }
function scEvaluate(expr, opts) {
  var o = opts || {};
  var mode = o.mode === 'rad' || o.mode === 'grad' ? o.mode : 'deg';
  try {
    var text = String(expr == null ? '' : expr);
    if (text.trim() === '') return { ok: false, error: 'Type an expression', kind: 'syntax' };
    if (text.length > SC_MAX_LENGTH) return { ok: false, error: 'The expression is too long', kind: 'syntax' };
    var tokens = scAutoClose(scTokenize(text));
    var value = scParseAndEval(tokens, { mode: mode, ans: o.ans });
    if (typeof value !== 'number' || isNaN(value)) return { ok: false, error: 'Not a real number', kind: 'domain' };
    if (!isFinite(value)) return { ok: false, error: 'Overflow', kind: 'domain' };
    if (value === 0) value = 0;
    return { ok: true, value: value, text: scFormat(value) };
  } catch (e) {
    if (e && e.sc) return { ok: false, error: e.msg, kind: e.kind };
    return { ok: false, error: 'Could not calculate this expression', kind: 'syntax' };
  }
}

// ---------- formatting ----------

function scFormat(x) {
  if (typeof x !== 'number' || isNaN(x)) return 'Not a real number';
  if (!isFinite(x)) return 'Overflow';
  if (x === 0) return '0';
  if (Number.isInteger(x) && Math.abs(x) < 1e15) return String(x);
  var r = Number(x.toPrecision(12));
  var abs = Math.abs(r);
  if (abs >= 1e15 || abs < 1e-6) return r.toExponential();
  var s = String(r);
  if (/e/i.test(s)) s = r.toFixed(12).replace(/\.?0+$/, '');
  return s;
}

// A number as text with enough digits to be re-used inside an expression (memory recall).
function scLiteral(x) {
  if (!isFinite(x)) return '0';
  var s = String(Number(x.toPrecision(15)));
  return s.replace('e+', 'E').replace('e-', 'E-');
}

// ---------- keypad helpers (pure, so they can be tested) ----------

// Returns the text a key inserts, given the 2nd and hyp toggles. null when the key does nothing to the text.
function scKeyText(key, inv, hyp) {
  switch (key) {
    case 'sin': case 'cos': case 'tan':
      return (inv ? 'a' : '') + key + (hyp ? 'h' : '') + '(';
    case 'ln': return inv ? 'e^(' : 'ln(';
    case 'log': return inv ? '10^(' : 'log(';
    case 'sq': return '^2';
    case 'cube': return '^3';
    case 'pow': return '^';
    case 'sqrt': return '√(';
    case 'cbrt': return '∛(';
    case 'root': return ' root ';
    case 'fact': return '!';
    case 'ncr': return ' nCr ';
    case 'npr': return ' nPr ';
    case 'mod': return ' mod ';
    case 'pi': return 'π';
    case 'e': return 'e';
    case 'exp': return 'E';
    case 'abs': return 'abs(';
    case 'pct': return '%';
    case 'ans': return 'Ans';
    case 'lp': return '(';
    case 'rp': return ')';
    case 'add': return '+';
    case 'sub': return '−';
    case 'mul': return '×';
    case 'div': return '÷';
    case 'dot': return '.';
  }
  if (/^[0-9]$/.test(key)) return key;
  return null;
}

// Text that continues an existing answer (an operator) rather than starting a new expression.
function scContinuesAnswer(text) {
  return /^(\^|!|%|\+|\-|−|×|÷|\*|\/| root | nCr | nPr | mod )/.test(text);
}

// Inserts text at the cursor. Returns { text, cursor }.
function scInsertAt(expr, start, end, ins) {
  var a = Math.max(0, Math.min(start, expr.length));
  var b = Math.max(a, Math.min(end, expr.length));
  return { text: expr.slice(0, a) + ins + expr.slice(b), cursor: a + ins.length };
}

// Backspace at the cursor. Returns { text, cursor }.
function scBackspaceAt(expr, start, end) {
  if (end > start) return scInsertAt(expr, start, end, '');
  if (start === 0) return { text: expr, cursor: 0 };
  return { text: expr.slice(0, start - 1) + expr.slice(end), cursor: start - 1 };
}

// 1/x key: after a value wraps with ^(-1), otherwise starts 1/(.
function scReciprocalText(expr, cursor) {
  var before = expr.slice(0, cursor).replace(/\s+$/, '');
  if (/[0-9.)!%]$/.test(before) || /(pi|ans|π|e)$/i.test(before)) return '^(-1)';
  return '1/(';
}

if (typeof module !== 'undefined') {
  module.exports = {
    scNormalize, scTokenize, scEvaluate, scFormat, scLiteral, scFactorial, scNcr, scNpr, scPow, scRoot,
    scSin, scCos, scTan, scKeyText, scContinuesAnswer, scInsertAt, scBackspaceAt, scReciprocalText,
    scUnitToMode, SC_MAX_LENGTH
  };
}

// ---------- page wiring ----------

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function () {
    var elExpr = document.getElementById('sc-expr');
    var elResult = document.getElementById('sc-result');
    var elKeys = document.getElementById('sc-keys');
    var elModes = document.getElementById('sc-modes');
    var elBadgeMode = document.getElementById('sc-badge-mode');
    var elBadgeInv = document.getElementById('sc-badge-inv');
    var elBadgeHyp = document.getElementById('sc-badge-hyp');
    var elBadgeMem = document.getElementById('sc-badge-mem');
    var elKbd = document.getElementById('sc-kbd');
    var elCopy = document.getElementById('sc-copy');
    var elHistory = document.getElementById('sc-history');
    var elHistEmpty = document.getElementById('sc-history-empty');
    var elClearHist = document.getElementById('sc-clear-history');
    if (!elExpr || !elKeys) return;

    var mode = 'deg';
    var inv = false;
    var hyp = false;
    var memory = null;
    var ans = 0;
    var justEvaluated = false;
    var history = [];
    var lastShown = '';

    function modeLabel() { return mode.toUpperCase(); }

    function showResult(text, cls) {
      elResult.textContent = text === '' ? ' ' : text;
      elResult.className = 'sc-result' + (cls ? ' ' + cls : '');
      lastShown = cls === 'sc-final' ? text : lastShown;
    }

    function preview() {
      var text = elExpr.value;
      if (text.trim() === '') { showResult('', ''); return; }
      var r = scEvaluate(text, { mode: mode, ans: ans });
      if (r.ok) showResult('= ' + r.text, 'sc-preview');
      else if (r.kind === 'domain') showResult(r.error, 'sc-preview sc-err');
      else showResult('', '');
    }

    function renderBadges() {
      elBadgeMode.textContent = modeLabel();
      elBadgeInv.hidden = !inv;
      elBadgeHyp.hidden = !hyp;
      elBadgeMem.hidden = memory === null;
      var buttons = elModes.querySelectorAll('button[data-mode]');
      buttons.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-mode') === mode ? 'true' : 'false'); });
      document.getElementById('sc-key-inv').setAttribute('aria-pressed', inv ? 'true' : 'false');
      document.getElementById('sc-key-hyp').setAttribute('aria-pressed', hyp ? 'true' : 'false');
      // relabel keys that change with 2nd / hyp
      var labels = {
        sin: (inv ? 'a' : '') + 'sin' + (hyp ? 'h' : ''),
        cos: (inv ? 'a' : '') + 'cos' + (hyp ? 'h' : ''),
        tan: (inv ? 'a' : '') + 'tan' + (hyp ? 'h' : ''),
        ln: inv ? 'eˣ' : 'ln',
        log: inv ? '10ˣ' : 'log'
      };
      Object.keys(labels).forEach(function (k) {
        var b = elKeys.querySelector('button[data-key="' + k + '"]');
        if (b) b.textContent = labels[k];
      });
    }

    function renderHistory() {
      elHistory.textContent = '';
      history.forEach(function (h, i) {
        var li = document.createElement('li');
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'sc-hist-item';
        b.setAttribute('data-index', String(i));
        b.setAttribute('aria-label', 'Reuse expression ' + h.expr);
        var e = document.createElement('span');
        e.className = 'sc-hist-expr';
        e.textContent = h.expr;
        var r = document.createElement('span');
        r.className = 'sc-hist-res';
        r.textContent = '= ' + h.text;
        b.appendChild(e);
        b.appendChild(r);
        li.appendChild(b);
        elHistory.appendChild(li);
      });
      elHistEmpty.hidden = history.length > 0;
      elClearHist.disabled = history.length === 0;
    }

    function setExpr(text, cursor) {
      elExpr.value = text;
      var c = typeof cursor === 'number' ? cursor : text.length;
      try { elExpr.setSelectionRange(c, c); } catch (e) { /* not supported for this input */ }
    }

    function insert(text) {
      if (justEvaluated) {
        if (scContinuesAnswer(text)) setExpr('Ans');
        else setExpr('');
        justEvaluated = false;
      }
      var start = elExpr.selectionStart == null ? elExpr.value.length : elExpr.selectionStart;
      var end = elExpr.selectionEnd == null ? start : elExpr.selectionEnd;
      var r = scInsertAt(elExpr.value, start, end, text);
      setExpr(r.text, r.cursor);
      preview();
    }

    function evaluateNow() {
      var text = elExpr.value;
      var r = scEvaluate(text, { mode: mode, ans: ans });
      if (r.ok) {
        ans = r.value;
        history.unshift({ expr: text.trim(), text: r.text, value: r.value });
        if (history.length > 20) history.length = 20;
        showResult(r.text, 'sc-final');
        justEvaluated = true;
        renderHistory();
      } else {
        showResult(r.error, 'sc-final sc-err');
      }
    }

    function memoryValue() {
      var text = elExpr.value;
      if (text.trim() !== '') {
        var r = scEvaluate(text, { mode: mode, ans: ans });
        if (r.ok) return r.value;
        showToast(r.kind === 'domain' ? r.error : 'Finish the expression first, or clear it to use the last answer.', 'warning');
        return null;
      }
      return ans;
    }

    function pressKey(key) {
      if (key === 'inv') { inv = !inv; renderBadges(); return; }
      if (key === 'hyp') { hyp = !hyp; renderBadges(); return; }
      if (key === 'eq') { evaluateNow(); return; }
      if (key === 'ac') { setExpr(''); justEvaluated = false; showResult('', ''); elExpr.focus({ preventScroll: true }); return; }
      if (key === 'bs') {
        if (justEvaluated) { justEvaluated = false; }
        var s = elExpr.selectionStart == null ? elExpr.value.length : elExpr.selectionStart;
        var e = elExpr.selectionEnd == null ? s : elExpr.selectionEnd;
        var r = scBackspaceAt(elExpr.value, s, e);
        setExpr(r.text, r.cursor);
        preview();
        return;
      }
      if (key === 'left' || key === 'right') {
        var pos = elExpr.selectionStart == null ? elExpr.value.length : elExpr.selectionStart;
        pos = Math.max(0, Math.min(elExpr.value.length, pos + (key === 'left' ? -1 : 1)));
        elExpr.setSelectionRange(pos, pos);
        return;
      }
      if (key === 'rand') {
        insert(String(Math.floor(Math.random() * 1000000) / 1000000));
        return;
      }
      if (key === 'inverse') {
        var cur = elExpr.selectionStart == null ? elExpr.value.length : elExpr.selectionStart;
        insert(justEvaluated ? '^(-1)' : scReciprocalText(elExpr.value, cur));
        return;
      }
      if (key === 'mc') { memory = null; renderBadges(); return; }
      if (key === 'mr') {
        if (memory === null) { showToast('Memory is empty.', 'info'); return; }
        insert(scLiteral(memory));
        return;
      }
      if (key === 'mp' || key === 'mm') {
        var v = memoryValue();
        if (v === null) return;
        memory = (memory === null ? 0 : memory) + (key === 'mp' ? v : -v);
        if (!isFinite(memory)) { memory = null; showToast('Overflow', 'warning'); }
        renderBadges();
        return;
      }
      var text = scKeyText(key, inv, hyp);
      if (text === null) return;
      var isToggleKey = (key === 'sin' || key === 'cos' || key === 'tan' || key === 'ln' || key === 'log');
      insert(text);
      if (isToggleKey && (inv || hyp)) { inv = false; hyp = false; renderBadges(); }
    }

    elKeys.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-key]');
      if (!btn) return;
      pressKey(btn.getAttribute('data-key'));
    });

    elModes.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-mode]');
      if (!btn) return;
      mode = btn.getAttribute('data-mode');
      renderBadges();
      if (justEvaluated) evaluateNow(); else preview();
    });

    elExpr.addEventListener('input', function () { justEvaluated = false; preview(); });
    elExpr.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); evaluateNow(); }
      else if (e.key === 'Escape') { e.preventDefault(); pressKey('ac'); }
    });

    elKbd.addEventListener('click', function () {
      var on = elExpr.getAttribute('inputmode') === 'none';
      elExpr.setAttribute('inputmode', on ? 'text' : 'none');
      elKbd.setAttribute('aria-pressed', on ? 'true' : 'false');
      elKbd.textContent = on ? 'Device keyboard: on' : 'Device keyboard: off';
      elExpr.focus();
    });

    elHistory.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-index]');
      if (!btn) return;
      var item = history[Number(btn.getAttribute('data-index'))];
      if (!item) return;
      setExpr(item.expr);
      justEvaluated = false;
      preview();
      elExpr.focus({ preventScroll: true });
    });

    elClearHist.addEventListener('click', function () { history = []; renderHistory(); });

    elCopy.addEventListener('click', function () {
      var r = scEvaluate(elExpr.value, { mode: mode, ans: ans });
      var text = r.ok ? r.text : (justEvaluated ? lastShown : '');
      if (!text) { showToast('There is no result to copy yet.', 'warning'); return; }
      copyText(text).then(function () { showToast('Copied ' + text, 'success'); })
        .catch(function () { showToast('Could not copy. Select the result and copy it manually.', 'error'); });
    });

    renderBadges();
    renderHistory();
    showResult('', '');
  });
}
