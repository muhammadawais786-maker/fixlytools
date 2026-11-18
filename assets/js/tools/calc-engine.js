// Fixlytools - Scientific Calculator engine (Casio fx-991 style).
// Own tokenizer + parser (AST) + evaluator. No eval, no new Function, no libraries.
// Values: number | {re,im} (complex) | {list:[...],labels:[...]} (Pol/Rec results).

var CE_PI = Math.PI;
function ceErr(msg) { return { ce: true, msg: msg }; }

// ---------- complex helpers ----------
function cIs(v) { return v !== null && typeof v === 'object' && v.im !== undefined; }
function cRe(v) { return cIs(v) ? v.re : v; }
function cIm(v) { return cIs(v) ? v.im : 0; }
function cMk(re, im) {
  var s = Math.max(Math.abs(re), Math.abs(im));
  if (Math.abs(im) <= 1e-14 * s) im = 0;
  if (Math.abs(re) <= 1e-14 * s) re = 0;
  if (!isFinite(re) || !isFinite(im)) throw ceErr('Math ERROR');
  return im === 0 ? re : { re: re, im: im };
}
function cAdd(a, b) { return cMk(cRe(a) + cRe(b), cIm(a) + cIm(b)); }
function cSub(a, b) { return cMk(cRe(a) - cRe(b), cIm(a) - cIm(b)); }
function cMul(a, b) { return cMk(cRe(a) * cRe(b) - cIm(a) * cIm(b), cRe(a) * cIm(b) + cIm(a) * cRe(b)); }
function cDiv(a, b) {
  var d = cRe(b) * cRe(b) + cIm(b) * cIm(b);
  if (d === 0) throw ceErr('Math ERROR');
  return cMk((cRe(a) * cRe(b) + cIm(a) * cIm(b)) / d, (cIm(a) * cRe(b) - cRe(a) * cIm(b)) / d);
}
function cAbs(a) { return Math.hypot(cRe(a), cIm(a)); }
function cArg(a) { return Math.atan2(cIm(a), cRe(a)); }
function cExp(a) { var m = Math.exp(cRe(a)); return cMk(m * Math.cos(cIm(a)), m * Math.sin(cIm(a))); }
function cLn(a) { if (cAbs(a) === 0) throw ceErr('Math ERROR'); return cMk(Math.log(cAbs(a)), cArg(a)); }
function cSqrt(a) {
  if (!cIs(a)) return a >= 0 ? Math.sqrt(a) : { re: 0, im: Math.sqrt(-a) };
  var r = Math.sqrt(cAbs(a)), t = cArg(a) / 2;
  return cMk(r * Math.cos(t), r * Math.sin(t));
}
function cPow(a, b) {
  if (cAbs(a) === 0) { if (cRe(b) > 0 && cIm(b) === 0) return 0; throw ceErr('Math ERROR'); }
  return cExp(cMul(b, cLn(a)));
}
function cSin(a) { return cMk(Math.sin(cRe(a)) * Math.cosh(cIm(a)), Math.cos(cRe(a)) * Math.sinh(cIm(a))); }
function cCos(a) { return cMk(Math.cos(cRe(a)) * Math.cosh(cIm(a)), -Math.sin(cRe(a)) * Math.sinh(cIm(a))); }
function cSinh(a) { return cMk(Math.sinh(cRe(a)) * Math.cos(cIm(a)), Math.cosh(cRe(a)) * Math.sin(cIm(a))); }
function cCosh(a) { return cMk(Math.cosh(cRe(a)) * Math.cos(cIm(a)), Math.sinh(cRe(a)) * Math.sin(cIm(a))); }

// ---------- number helpers ----------
function ceChk(x) { if (!isFinite(x) || isNaN(x)) throw ceErr('Math ERROR'); return x; }
function ceFrac(x, maxD, tol) {
  var s = x < 0 ? -1 : 1, a = Math.abs(x);
  if (!isFinite(a) || a > 1e9) return null;
  var h1 = 1, h0 = 0, k1 = 0, k0 = 1, b = a;
  for (var i = 0; i < 40; i++) {
    var ai = Math.floor(b), h2 = ai * h1 + h0, k2 = ai * k1 + k0;
    if (k2 > maxD) break;
    h0 = h1; h1 = h2; k0 = k1; k1 = k2;
    if (Math.abs(a - h1 / k1) <= tol * Math.max(1, a)) return { n: s * h1, d: k1 };
    var fr = b - ai;
    if (fr < 1e-15) break;
    b = 1 / fr;
  }
  return null;
}
function ceGcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a; }
function ceIsInt(x) { return Math.abs(x - Math.round(x)) < 1e-9 * Math.max(1, Math.abs(x)); }
function ceFactorial(n) {
  if (!ceIsInt(n) || n < 0 || n > 69) throw ceErr('Math ERROR');
  n = Math.round(n); var r = 1; for (var i = 2; i <= n; i++) r *= i; return r;
}
function ceNcr(n, r) {
  if (!ceIsInt(n) || !ceIsInt(r) || n < 0 || r < 0 || r > n) throw ceErr('Math ERROR');
  n = Math.round(n); r = Math.round(r); if (r > n - r) r = n - r;
  var v = 1; for (var i = 1; i <= r; i++) v = v * (n - r + i) / i;
  return Math.round(v);
}
function ceNpr(n, r) {
  if (!ceIsInt(n) || !ceIsInt(r) || n < 0 || r < 0 || r > n) throw ceErr('Math ERROR');
  n = Math.round(n); r = Math.round(r); var v = 1; for (var i = 0; i < r; i++) v *= (n - i);
  return ceChk(v);
}

// ---------- angles & trig ----------
function ceToDeg(x, mode) { return mode === 'deg' ? x : mode === 'grad' ? x * 0.9 : x * 180 / CE_PI; }
function ceFromDeg(d, mode) { return mode === 'deg' ? d : mode === 'grad' ? d / 0.9 : d * CE_PI / 180; }
function ceSnapHalf(r) { var h = Math.round(r * 2) / 2; return Math.abs(r - h) < 1.5e-15 ? h : r; }
function ceTrig(name, x, mode) {
  var d = ceToDeg(x, mode) % 360; if (d < 0) d += 360;
  var q = d / 90, onAxis = Math.abs(q - Math.round(q)) < 1e-12;
  if (onAxis) d = (Math.round(q) % 4) * 90;
  var sn = ceSnapHalf(Math.sin(d * CE_PI / 180)), cs = ceSnapHalf(Math.cos(d * CE_PI / 180));
  if (name === 'sin') return sn;
  if (name === 'cos') return cs;
  if (cs === 0) throw ceErr('Math ERROR');
  var t = sn / cs; return Math.abs(t - Math.round(t)) < 1e-14 ? Math.round(t) : t;
}
function ceInvTrig(name, x, mode) {
  var r;
  if (name === 'asin') { if (Math.abs(x) > 1) throw ceErr('Math ERROR'); r = Math.asin(x); }
  else if (name === 'acos') { if (Math.abs(x) > 1) throw ceErr('Math ERROR'); r = Math.acos(x); }
  else r = Math.atan(x);
  var d = r * 180 / CE_PI;
  var rd = Math.round(d); if (Math.abs(d - rd) < 1e-12) d = rd;
  return ceFromDeg(d, mode);
}

// ---------- tokenizer ----------
var CE_NAMES = ['asinh', 'acosh', 'atanh', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'asin', 'acos', 'atan',
  'sin', 'cos', 'tan', 'log', 'ln', 'exp', 'sqrt', 'cbrt', 'abs', 'intg', 'int', 'rnd', 'root', 'pol', 'rec', 'gcd', 'lcm',
  'sum', 'prod', 'deriv', 'integ', 'ceil', 'floor', 'cot', 'acot', 'lim', 'fact', 'ranint#', 'ran#', 'conj', 'arg', 're', 'im', 'ans', 'preans', 'pi', 'mod', 'ncr', 'npr', 'divr', 'xor', 'and', 'not', 'true', 'false', 'or', 'neg']
  .sort(function (a, b) { return b.length - a.length; });
var CE_ALIAS = { arcsin: 'asin', arccos: 'acos', arctan: 'atan' };
var CE_VARS = 'ABCDEFMXYRSTUVWZ';
var CE_CONST = { pi: 1, ans: 1, preans: 1 };
var CE_WORD = { mod: 1, ncr: 1, npr: 1, divr: 1, xor: 1, and: 1, or: 1, not: 1 };

function ceNormalize(t) {
  return String(t).replace(/÷R/g, ' divr ').replace(/×|·|⋅/g, '*').replace(/÷/g, '/').replace(/[−–—]/g, '-').replace(/π/g, 'pi')
    .replace(/√/g, 'sqrt').replace(/∛/g, 'cbrt').replace(/²/g, '^2').replace(/³/g, '^3').replace(/⁻¹/g, '^-1')
    .replace(/′/g, "'").replace(/″/g, '"').replace(/∫/g, 'integ').replace(/Σ/g, 'sum').replace(/Π/g, 'prod')
    .replace(/θ/g, 'Y').replace(/∞/g, '1E15').replace(/¬/g, ' not ').replace(/[{]/g, '(').replace(/[}]/g, ')').replace(/>=|⩾/g, '≥').replace(/<=|⩽/g, '≤').replace(/!=|<>/g, '≠');
}
function ceTokenize(text) {
  var s = ceNormalize(text), out = [], i = 0, m;
  m = /^\s*([A-Za-z])\s*:=\s*(.+)$/.exec(s); if (m) s = m[2] + '→' + m[1];
  while (i < s.length) {
    var ch = s.charAt(i);
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      m = /^(\d*)\.?(\d*)‾(\d{1,12})/.exec(s.slice(i));
      if (m && m[0].indexOf('.') !== -1 || (m && m[1] !== '')) {
        var ip = m[1] === '' ? '0' : m[1], np = m[2], rp = m[3], kk = np.length, mm = rp.length;
        var num = (Number(ip + np)) * (Math.pow(10, mm) - 1) + Number(rp), den = Math.pow(10, kk) * (Math.pow(10, mm) - 1);
        out.push({ t: 'num', v: num / den }); i += m[0].length; continue;
      }
      m = /^(?:\d+\.?\d*|\.\d+)(?:E[+-]?\d+)?/.exec(s.slice(i));
      if (!m || s.charAt(i + m[0].length) === '.') throw ceErr('Syntax ERROR');
      var nv = Number(m[0]); if (!isFinite(nv)) throw ceErr('Math ERROR');
      out.push({ t: 'num', v: nv }); i += m[0].length; continue;
    }
    if (/[A-Za-z]/.test(ch)) {
      var low = s.slice(i).toLowerCase(), found = null, k;
      for (k = 0; k < CE_NAMES.length; k++) if (low.indexOf(CE_NAMES[k]) === 0) { found = CE_NAMES[k]; break; }
      if (found === 'true' || found === 'false') { out.push({ t: 'num', v: found === 'true' ? 1 : 0, bool: true }); i += found.length; continue; }
      if (found) {
        var nm = CE_ALIAS[found] || found;
        out.push({ t: CE_CONST[nm] ? 'const' : (CE_WORD[nm] ? 'word' : 'func'), v: nm }); i += found.length; continue;
      }
      if (ch === 'e') { out.push({ t: 'const', v: 'e' }); i++; continue; }
      if (ch === 'i') { out.push({ t: 'const', v: 'i' }); i++; continue; }
      var up = ch.toUpperCase();
      if (CE_VARS.indexOf(up) !== -1) { out.push({ t: 'var', v: up }); i++; continue; }
      throw ceErr('Syntax ERROR');
    }
    if ('+-*/^()!%,=⌟°\'"∠→><≥≤≠'.indexOf(ch) !== -1) { out.push({ t: 'op', v: ch }); i++; continue; }
    throw ceErr('Syntax ERROR');
  }
  return out;
}

// ---------- parser (AST) ----------
function ceParse(text) {
  var tk = ceTokenize(text), pos = 0, depth = 0;
  function pk() { return tk[pos]; }
  function isOp(t, v) { return t && t.t === 'op' && t.v === v; }
  function enter() { if (++depth > 60) throw ceErr('Stack ERROR'); }
  function leave() { depth--; }
  function startsPrimary(t) {
    return t && (t.t === 'num' || t.t === 'const' || t.t === 'var' || (t.t === 'func' && t.v !== 'neg') || isOp(t, '('));
  }
  function lor() {
    var l = lxor();
    while (pk() && pk().t === 'word' && pk().v === 'or') { pos++; l = { t: 'logic', op: 'or', a: l, b: lxor() }; }
    return l;
  }
  function lxor() {
    var l = land();
    while (pk() && pk().t === 'word' && pk().v === 'xor') { pos++; l = { t: 'logic', op: 'xor', a: l, b: land() }; }
    return l;
  }
  function land() {
    var l = lnot();
    while (pk() && pk().t === 'word' && pk().v === 'and') { pos++; l = { t: 'logic', op: 'and', a: l, b: lnot() }; }
    return l;
  }
  function lnot() {
    if (pk() && pk().t === 'word' && pk().v === 'not') { pos++; enter(); var r = { t: 'lnot', a: lnot() }; leave(); return r; }
    return cmp();
  }
  function cmp() {
    var l = add();
    while (pk() && pk().t === 'op' && '><≥≤≠'.indexOf(pk().v) !== -1) { var co = tk[pos++].v; l = { t: 'bin', op: co, a: l, b: add() }; }
    return l;
  }
  function add() {
    var l = mul();
    while (pk() && (isOp(pk(), '+') || isOp(pk(), '-'))) { var op = tk[pos++].v; l = { t: 'bin', op: op, a: l, b: mul() }; }
    return l;
  }
  function mul() {
    var l = comb();
    while (pk()) {
      var t = pk();
      if (isOp(t, '*') || isOp(t, '/')) { pos++; l = { t: 'bin', op: t.v, a: l, b: comb() }; }
      else if (t.t === 'word' && t.v === 'divr') { pos++; l = { t: 'bin', op: 'divr', a: l, b: comb() }; }
      else if (t.t === 'word' && t.v === 'mod') { pos++; l = { t: 'bin', op: 'mod', a: l, b: comb() }; }
      else break;
    }
    return l;
  }
  function comb() {
    var l = imp();
    while (pk()) {
      var t = pk();
      if (t.t === 'word' && (t.v === 'ncr' || t.v === 'npr')) { pos++; l = { t: 'bin', op: t.v, a: l, b: imp() }; }
      else if (isOp(t, '∠')) { pos++; l = { t: 'polar', a: l, b: imp() }; }
      else break;
    }
    return l;
  }
  function imp() {
    var l = unary();
    while (startsPrimary(pk())) l = { t: 'bin', op: '*', a: l, b: pow() };
    return l;
  }
  function unary() {
    enter();
    var r, t = pk();
    if (isOp(t, '-')) { pos++; r = { t: 'un', op: '-', a: unary() }; }
    else if (isOp(t, '+')) { pos++; r = unary(); }
    else r = pow();
    leave(); return r;
  }
  function pow() {
    var b = post();
    if (isOp(pk(), '^')) { pos++; enter(); var e = unary(); leave(); return { t: 'bin', op: '^', a: b, b: e }; }
    return b;
  }
  function post() {
    var p = primary();
    while (pk() && (isOp(pk(), '!') || isOp(pk(), '%'))) { p = { t: 'post', op: tk[pos++].v, a: p }; }
    return p;
  }
  function expectClose() { if (isOp(pk(), ')')) pos++; else if (pk()) throw ceErr('Syntax ERROR'); }
  function primary() {
    var t = pk();
    if (!t) throw ceErr('Syntax ERROR');
    if (t.t === 'num') {
      pos++; var v = t.v;
      if (isOp(pk(), '°')) {
        pos++;
        if (pk() && pk().t === 'num' && isOp(tk[pos + 1], "'")) {
          v += pk().v / 60; pos += 2;
          if (pk() && pk().t === 'num' && isOp(tk[pos + 1], '"')) { v += pk().v / 3600; pos += 2; }
        }
        return { t: 'deg', a: { t: 'num', v: v } };
      }
      if (isOp(pk(), '⌟')) {
        pos++; var b = pk(); if (!b || b.t !== 'num') throw ceErr('Syntax ERROR'); pos++;
        if (isOp(pk(), '⌟')) {
          pos++; var c = pk(); if (!c || c.t !== 'num') throw ceErr('Syntax ERROR'); pos++;
          return { t: 'bin', op: '+', a: { t: 'num', v: v }, b: { t: 'bin', op: '/', a: { t: 'num', v: b.v }, b: { t: 'num', v: c.v } } };
        }
        return { t: 'bin', op: '/', a: { t: 'num', v: v }, b: { t: 'num', v: b.v } };
      }
      return { t: 'num', v: v };
    }
    if (t.t === 'const') { pos++; return { t: 'const', n: t.v }; }
    if (t.t === 'var') { pos++; return { t: 'var', n: t.v }; }
    if (isOp(t, '(')) {
      pos++; enter(); var e = lor(); leave(); expectClose();
      return e;
    }
    if (t.t === 'func') {
      pos++;
      if (isOp(pk(), '(')) {
        pos++; enter(); var args = [];
        if (!isOp(pk(), ')')) {
          args.push(lor());
          while (isOp(pk(), ',')) { pos++; args.push(lor()); }
        }
        leave(); expectClose();
        return { t: 'call', n: t.v, a: args };
      }
      if (t.v === 'ran#') return { t: 'call', n: t.v, a: [] };
      var one = (t.v === 'sqrt' || t.v === 'cbrt') ? pow() : pow();
      return { t: 'call', n: t.v, a: [one] };
    }
    throw ceErr('Syntax ERROR');
  }
  var node = lor();
  if (isOp(pk(), '=')) { pos++; node = { t: 'eq', a: node, b: lor() }; }
  if (isOp(pk(), '→')) {
    pos++; var vt = pk();
    if (!vt || vt.t !== 'var') throw ceErr('Syntax ERROR');
    pos++; node = { t: 'sto', a: node, n: vt.v };
  }
  if (pos < tk.length) throw ceErr('Syntax ERROR');
  return node;
}

// ---------- evaluator ----------
function ceNewEnv(o) {
  o = o || {};
  return { mode: o.mode || 'deg', cmplx: !!o.cmplx, vars: o.vars || {}, ans: o.ans || 0, preans: o.preans || 0, n: 0 };
}
function ceBool(b) { return { text: b ? 'True' : 'False', num: b ? 1 : 0, bool: true }; }
function ceTruth(v) { if (v && v.bool) return v.num !== 0; if (cIs(v) || (v && (v.list || v.text !== undefined))) throw ceErr('Math ERROR'); return v !== 0; }
function ceReal(v) { if (v && v.bool) return v.num; if (cIs(v)) throw ceErr('Math ERROR'); if (v && v.list) throw ceErr('Math ERROR'); return v; }
function ceCplxOK(env, v) { if (cIs(v) && !env.cmplx) throw ceErr('Math ERROR'); return v; }

function cePowV(a, b, env) {
  if (!cIs(a) && !cIs(b)) {
    if (a === 0) { if (b > 0) return 0; throw ceErr('Math ERROR'); }
    if (a < 0 && !ceIsInt(b)) {
      var f = ceFrac(b, 99, 1e-12);
      if (f && f.d % 2 === 1) { var r = Math.pow(-a, b); return ceChk((Math.abs(f.n) % 2 === 1 ? -1 : 1) * r); }
      if (!env.cmplx) throw ceErr('Math ERROR');
      return cPow(a, b);
    }
    return ceChk(Math.pow(a, b));
  }
  if (!env.cmplx) throw ceErr('Math ERROR');
  if (!cIs(b) && ceIsInt(b) && Math.abs(b) <= 64) {
    var n = Math.round(b), res = 1, base = n < 0 ? cDiv(1, a) : a;
    for (var i = 0; i < Math.abs(n); i++) res = cMul(res, base);
    return res;
  }
  return cPow(a, b);
}

function ceBind(env, name, val) { var old = env.vars[name]; env.vars[name] = val; return old; }

function ceIntegrate(f, a, b) {
  var xk = [0.991455371120813, 0.949107912342759, 0.864864423359769, 0.741531185599394, 0.586087235467691, 0.405845151377397, 0.207784955007898, 0];
  var wk = [0.022935322010529, 0.063092092629979, 0.104790010322250, 0.140653259715525, 0.169004726639267, 0.190350578064785, 0.204432940075298, 0.209482141084728];
  var wg = [0.129484966168870, 0.279705391489277, 0.381830050505119, 0.417959183673469];
  function gk(a0, b0) {
    var c = (a0 + b0) / 2, h = (b0 - a0) / 2, fc = f(c), k = fc * wk[7], g = fc * wg[3];
    for (var j = 0; j < 7; j++) {
      var dx = h * xk[j], f1 = f(c - dx), f2 = f(c + dx);
      k += wk[j] * (f1 + f2);
      if (j % 2 === 1) g += wg[(j - 1) / 2] * (f1 + f2);
    }
    return { v: k * h, e: Math.abs((k - g) * h) };
  }
  function rec(a0, b0, tol, d) {
    var r = gk(a0, b0);
    if (d >= 22 || r.e <= tol) return r.v;
    var m = (a0 + b0) / 2;
    return rec(a0, m, tol / 2, d + 1) + rec(m, b0, tol / 2, d + 1);
  }
  if (a === b) return 0;
  var sg = 1; if (a > b) { var t = a; a = b; b = t; sg = -1; }
  var n = 8, tot = 0, w = (b - a) / n;
  for (var i = 0; i < n; i++) tot += rec(a + i * w, a + (i + 1) * w, 1e-11 * Math.max(1, Math.abs(b - a)) / n, 0);
  return sg * tot;
}
function ceDerive(f, x) {
  var h = Math.max(Math.abs(x), 1) * 0.05, a = [[]], best = 0, err = Infinity, i, j;
  var CON = 1.4, SAFE = 2;
  a[0][0] = (f(x + h) - f(x - h)) / (2 * h);
  for (i = 1; i < 10; i++) {
    h /= CON; a[i] = [];
    a[i][0] = (f(x + h) - f(x - h)) / (2 * h);
    var fac = CON * CON;
    for (j = 1; j <= i; j++) {
      a[i][j] = (a[i][j - 1] * fac - a[i - 1][j - 1]) / (fac - 1);
      fac *= CON * CON;
      var e = Math.max(Math.abs(a[i][j] - a[i][j - 1]), Math.abs(a[i][j] - a[i - 1][j - 1]));
      if (e <= err) { err = e; best = a[i][j]; }
    }
    if (Math.abs(a[i][i] - a[i - 1][i - 1]) >= SAFE * err) break;
  }
  return best;
}

function ceEval(n, env) {
  if (++env.n > 3000000) throw ceErr('Time Out');
  var a, b;
  switch (n.t) {
    case 'num': return n.v;
    case 'const':
      if (n.n === 'pi') return CE_PI;
      if (n.n === 'e') return Math.E;
      if (n.n === 'i') return { re: 0, im: 1 };
      if (n.n === 'ans') return env.ans;
      return env.preans;
    case 'var': { var vv = env.vars[n.n]; return vv === undefined ? 0 : vv; }
    case 'deg': { var dv = ceEval(n.a, env); return ceFromDeg(dv, env.mode); }
    case 'un': a = ceEval(n.a, env); return cIs(a) ? cMk(-a.re, -a.im) : -a;
    case 'post':
      a = ceEval(n.a, env);
      if (n.op === '!') return ceFactorial(ceReal(a));
      return cIs(a) ? cMk(a.re / 100, a.im / 100) : a / 100;
    case 'polar': {
      var r = ceReal(ceEval(n.a, env)), th = ceToDeg(ceReal(ceEval(n.b, env)), env.mode) * CE_PI / 180;
      ceCplxOK(env, { re: 0, im: 1 });
      return cMk(r * Math.cos(th), r * Math.sin(th));
    }
    case 'bin':
      a = ceEval(n.a, env); b = ceEval(n.b, env);
      if (a && a.list || b && b.list) throw ceErr('Math ERROR');
      if (a && a.bool) a = a.num; if (b && b.bool) b = b.num;
      switch (n.op) {
        case '+': return (cIs(a) || cIs(b)) ? ceCplxOK(env, cAdd(a, b)) : ceChk(a + b);
        case '-': return (cIs(a) || cIs(b)) ? ceCplxOK(env, cSub(a, b)) : ceChk(a - b);
        case '*': return (cIs(a) || cIs(b)) ? ceCplxOK(env, cMul(a, b)) : ceChk(a * b);
        case '/':
          if (cIs(a) || cIs(b)) return ceCplxOK(env, cDiv(a, b));
          if (b === 0) throw ceErr('Math ERROR');
          return ceChk(a / b);
        case '^': return cePowV(a, b, env);
        case 'mod': ceReal(a); ceReal(b); if (b === 0) throw ceErr('Math ERROR'); { var m = a % b; if (m !== 0 && (m < 0) !== (b < 0)) m += b; return m; }
        case '>': return ceBool(ceReal(a) > ceReal(b));
        case '<': return ceBool(ceReal(a) < ceReal(b));
        case '≥': return ceBool(ceReal(a) >= ceReal(b));
        case '≤': return ceBool(ceReal(a) <= ceReal(b));
        case '≠': return ceBool(ceReal(a) !== ceReal(b));
        case 'divr': { ceReal(a); ceReal(b); if (b === 0 || a !== Math.trunc(a) || b !== Math.trunc(b)) throw ceErr('Math ERROR'); var qq = Math.trunc(a / b), rr2 = a - qq * b; return { text: qq + ' R ' + rr2, num: qq }; }
        case 'ncr': return ceNcr(ceReal(a), ceReal(b));
        case 'npr': return ceNpr(ceReal(a), ceReal(b));
      }
      throw ceErr('Syntax ERROR');
    case 'logic': { var la = ceTruth(ceEval(n.a, env)), lb = ceTruth(ceEval(n.b, env)); return ceBool(n.op === 'and' ? (la && lb) : n.op === 'or' ? (la || lb) : (la !== lb)); }
    case 'lnot': return ceBool(!ceTruth(ceEval(n.a, env)));
    case 'sto': {
      var sv = ceEval(n.a, env); env.vars[n.n] = sv; return sv;
    }
    case 'eq': throw ceErr('Syntax ERROR');
    case 'call': return ceCall(n, env);
  }
  throw ceErr('Syntax ERROR');
}

function ceArgN(n, k) { if (n.a.length !== k) throw ceErr('Argument ERROR'); }

function ceCall(n, env) {
  var f = n.n, A = n.a, x, y;
  if (f === 'ran#') { ceArgN(n, 0); return Math.floor(Math.random() * 1000) / 1000; }
  if (f === 'sum' || f === 'prod') {
    ceArgN(n, 4);
    var lo = Math.round(ceReal(ceEval(A[2], env))), hi = Math.round(ceReal(ceEval(A[3], env)));
    var vn = A[1].t === 'var' ? A[1].n : null; if (!vn) throw ceErr('Syntax ERROR');
    if (hi - lo > 200000) throw ceErr('Math ERROR');
    var acc = f === 'sum' ? 0 : 1, old = env.vars[vn];
    for (var k = lo; k <= hi; k++) {
      env.vars[vn] = k; var t = ceEval(A[0], env);
      acc = f === 'sum' ? ((cIs(acc) || cIs(t)) ? cAdd(acc, t) : ceChk(acc + t)) : ((cIs(acc) || cIs(t)) ? cMul(acc, t) : ceChk(acc * t));
    }
    env.vars[vn] = old; return acc;
  }
  if (f === 'lim') {
    if (A.length < 2) throw ceErr('Argument ERROR');
    var la = ceReal(ceEval(A[1], env)), lold = env.vars.X;
    var lf = function (v) { env.vars.X = v; var r = ceEval(A[0], env); ceReal(r); return r; };
    var lres;
    try {
      if (Math.abs(la) >= 1e15) {
        var sgn = la < 0 ? -1 : 1, p1 = lf(sgn * 1e6), p2 = lf(sgn * 1e8), p3 = lf(sgn * 1e10);
        if (!isFinite(p3)) throw ceErr('Math ERROR');
        if (Math.abs(p3 - p2) > 1e-6 * Math.max(1, Math.abs(p3)) || Math.abs(p2 - p1) > 1e-3 * Math.max(1, Math.abs(p2)) + 1e-9) throw ceErr('Math ERROR');
        lres = p3;
      } else {
        var hs = [1e-3, 1e-4, 1e-5, 1e-6], rl = [], rr3 = [];
        hs.forEach(function (hh) { var hx = hh * Math.max(1, Math.abs(la)); try { rl.push(lf(la - hx)); } catch (e1) { } try { rr3.push(lf(la + hx)); } catch (e2) { } });
        var lastL = rl.length ? rl[rl.length - 1] : NaN, lastR = rr3.length ? rr3[rr3.length - 1] : NaN;
        var okL = isFinite(lastL), okR = isFinite(lastR);
        if (!okL && !okR) throw ceErr('Math ERROR');
        if (okL && okR && Math.abs(lastL - lastR) > 1e-4 * Math.max(1, Math.abs(lastL))) throw ceErr('Math ERROR');
        lres = okL && okR ? (lastL + lastR) / 2 : (okL ? lastL : lastR);
        if (rl.length > 1 && Math.abs(rl[rl.length - 1] - rl[rl.length - 2]) > 1e-3 * Math.max(1, Math.abs(lres)) && Math.abs(lres) > 1e6) throw ceErr('Math ERROR');
      }
    } finally { env.vars.X = lold; }
    var lrr = Math.round(lres); if (Math.abs(lres - lrr) < 1e-5 * Math.max(1, Math.abs(lres))) lres = lrr;
    return ceChk(lres);
  }
  if (f === 'integ' || f === 'deriv') {
    if (f === 'integ') ceArgN(n, 3); else if (A.length < 2) throw ceErr('Argument ERROR');
    var xs = ceReal(ceEval(A[1], env)), old2 = env.vars.X;
    var fn = function (v) { env.vars.X = v; var r = ceEval(A[0], env); ceReal(r); return ceChk(r); };
    var res;
    try {
      if (f === 'integ') res = ceIntegrate(fn, xs, ceReal(ceEval(A[2], env)));
      else res = ceDerive(fn, xs);
    } finally { env.vars.X = old2; }
    res = ceChk(res);
    var rr = Math.round(res); if (Math.abs(res - rr) < 1e-9 * Math.max(1, Math.abs(res)) && f === 'integ') res = rr;
    return res;
  }
  var v = A.map(function (a) { return ceEval(a, env); });
  if (f === 'pol' || f === 'rec') {
    ceArgN(n, 2); x = ceReal(v[0]); y = ceReal(v[1]);
    if (f === 'pol') {
      var rad = Math.hypot(x, y), ang = Math.atan2(y, x) * 180 / CE_PI;
      env.vars.X = rad; env.vars.Y = ceFromDeg(ang, env.mode);
      return { list: [rad, env.vars.Y], labels: ['r', 'θ'] };
    }
    var rx = ceSnapHalf0(x * ceTrig('cos', y, env.mode)), ry = ceSnapHalf0(x * ceTrig('sin', y, env.mode));
    env.vars.X = rx; env.vars.Y = ry;
    return { list: [rx, ry], labels: ['x', 'y'] };
  }
  if (f === 'gcd' || f === 'lcm') {
    if (v.length < 2) throw ceErr('Argument ERROR');
    var g = Math.abs(Math.round(ceReal(v[0])));
    v.forEach(function (q) { if (!ceIsInt(ceReal(q))) throw ceErr('Math ERROR'); });
    for (var i = 1; i < v.length; i++) {
      var q2 = Math.abs(Math.round(v[i]));
      g = f === 'gcd' ? ceGcd(g, q2) : (g === 0 || q2 === 0 ? 0 : g / ceGcd(g, q2) * q2);
    }
    return ceChk(g);
  }
  if (f === 'ranint#') { ceArgN(n, 2); var a1 = Math.round(ceReal(v[0])), b1 = Math.round(ceReal(v[1])); if (b1 < a1) throw ceErr('Math ERROR'); return a1 + Math.floor(Math.random() * (b1 - a1 + 1)); }
  if (f === 'root') { ceArgN(n, 2); return cePowV(v[1], ceChk(cDiv(1, v[0])), env); }
  if (f === 'log' && v.length === 2) {
    var base = ceReal(v[0]), val = ceReal(v[1]);
    if (base <= 0 || base === 1 || val <= 0) throw ceErr('Math ERROR');
    var lg = Math.log(val) / Math.log(base), rl = Math.round(lg); return Math.abs(lg - rl) < 1e-12 ? rl : lg;
  }
  ceArgN(n, 1); x = v[0];
  if (x && x.list) throw ceErr('Math ERROR');
  var cx = cIs(x);
  switch (f) {
    case 'sin': case 'cos': case 'tan':
      if (cx) { ceCplxOK(env, x); if (f === 'sin') return cSin(x); if (f === 'cos') return cCos(x); return cDiv(cSin(x), cCos(x)); }
      return ceTrig(f, x, env.mode);
    case 'asin': case 'acos': case 'atan': return ceInvTrig(f, ceReal(x), env.mode);
    case 'sinh': if (cx) return ceCplxOK(env, cSinh(x)); return ceChk(Math.sinh(x));
    case 'cosh': if (cx) return ceCplxOK(env, cCosh(x)); return ceChk(Math.cosh(x));
    case 'tanh': if (cx) return ceCplxOK(env, cDiv(cSinh(x), cCosh(x))); return Math.tanh(x);
    case 'asinh': return ceChk(Math.asinh(ceReal(x)));
    case 'acosh': if (ceReal(x) < 1) throw ceErr('Math ERROR'); return Math.acosh(x);
    case 'atanh': if (Math.abs(ceReal(x)) >= 1) throw ceErr('Math ERROR'); return Math.atanh(x);
    case 'ln':
      if (cx || x < 0) { if (!env.cmplx) throw ceErr('Math ERROR'); return cLn(x); }
      if (x === 0) throw ceErr('Math ERROR');
      return Math.log(x);
    case 'log':
      if (cx) throw ceErr('Math ERROR');
      if (x <= 0) throw ceErr('Math ERROR');
      var l10 = Math.log10(x), r10 = Math.round(l10); return Math.abs(l10 - r10) < 1e-13 ? r10 : l10;
    case 'exp': if (cx) return ceCplxOK(env, cExp(x)); return ceChk(Math.exp(x));
    case 'sqrt':
      if (cx || x < 0) { if (!env.cmplx) throw ceErr('Math ERROR'); return cSqrt(x); }
      return Math.sqrt(x);
    case 'cbrt': return Math.cbrt(ceReal(x));
    case 'abs': return cx ? cAbs(x) : Math.abs(x);
    case 'ceil': return Math.ceil(ceReal(x));
    case 'floor': return Math.floor(ceReal(x));
    case 'acot': { ceReal(x); var ar = x === 0 ? CE_PI / 2 : Math.atan(1 / x) + (x < 0 ? CE_PI : 0); var ad = ar * 180 / CE_PI, adr = Math.round(ad); if (Math.abs(ad - adr) < 1e-12) ad = adr; return ceFromDeg(ad, env.mode); }
    case 'fact': { ceReal(x); if (x !== Math.trunc(x) || x < 2 || x > 1e12) throw ceErr('Math ERROR'); var nn = x, fs = [], pf = 2; while (pf * pf <= nn) { var cc = 0; while (nn % pf === 0) { nn /= pf; cc++; } if (cc) fs.push(cc > 1 ? pf + '^' + cc : String(pf)); pf += pf === 2 ? 1 : 2; } if (nn > 1) fs.push(String(nn)); return { text: x + ' = ' + (fs.length === 1 && fs[0] == x ? 'prime' : fs.join('×')), num: x }; }
    case 'cot': { ceReal(x); var sn = ceTrig('sin', x, env.mode); if (sn === 0) throw ceErr('Math ERROR'); return ceTrig('cos', x, env.mode) / sn; }
    case 'int': return Math.trunc(ceReal(x));
    case 'intg': return Math.floor(ceReal(x));
    case 'rnd': return Number(ceReal(x).toPrecision(10));
    case 'conj': return cx ? cMk(x.re, -x.im) : x;
    case 'arg': { if (!env.cmplx) throw ceErr('Math ERROR'); return ceFromDeg(cArg(x) * 180 / CE_PI, env.mode); }
    case 're': return cRe(x);
    case 'im': return cIm(x);
    case 'neg': return cx ? cMk(-x.re, -x.im) : -x;
  }
  throw ceErr('Syntax ERROR');
}
function ceSnapHalf0(x) { return Math.abs(x) < 1e-14 ? 0 : x; }

// Top-level evaluate: returns { ok, v } or { ok:false, msg }
function ceRun(text, env) {
  try {
    if (!String(text).trim()) return { ok: false, msg: '' };
    if (text.length > 400) throw ceErr('Syntax ERROR');
    var sm = /^\s*(expand|factor|simplify|simply|diff|sint)\s*\((.*)\)\s*$/i.exec(text);
    if (sm) { var fnm = sm[1].toLowerCase(); if (fnm === 'simply') fnm = 'simplify'; return { ok: true, v: { text: ceSymRun(fnm, sm[2]) } }; }
    var ast = ceParse(text);
    if (ast.t === 'eq') throw ceErr('Syntax ERROR');
    var v = ceEval(ast, env);
    if (typeof v === 'number') { if (!isFinite(v)) throw ceErr('Math ERROR'); if (Object.is(v, -0)) v = 0; }
    return { ok: true, v: v };
  } catch (e) {
    if (e && e.ce) return { ok: false, msg: e.msg };
    if (e instanceof RangeError) return { ok: false, msg: 'Stack ERROR' };
    return { ok: false, msg: 'Syntax ERROR' };
  }
}

// ---------- SOLVE ----------
function ceSolve(text, guess, env) {
  var ast = ceParse(text);
  if (ast.t !== 'eq') { ast = { t: 'eq', a: ast, b: { t: 'num', v: 0 } }; }
  var old = env.vars.X;
  function f(x) { env.vars.X = x; var l = ceEval(ast.a, env), r = ceEval(ast.b, env); ceReal(l); ceReal(r); return l - r; }
  function safe(x) { try { var v = f(x); return isFinite(v) ? v : NaN; } catch (e) { return NaN; } }
  try {
    var x = guess || 0, i;
    for (i = 0; i < 200; i++) {
      var fx = safe(x); if (isNaN(fx)) break;
      if (Math.abs(fx) < 1e-14) return { x: x, fx: fx };
      var h = Math.max(Math.abs(x), 1) * 1e-7, d = (safe(x + h) - safe(x - h)) / (2 * h);
      if (!isFinite(d) || d === 0) break;
      var step = fx / d, nx = x - step;
      if (Math.abs(step) < 1e-15 * Math.max(1, Math.abs(x))) { x = nx; break; }
      x = nx;
    }
    var fxx = safe(x);
    if (isFinite(fxx) && Math.abs(fxx) < 1e-9 * Math.max(1, Math.abs(x))) return { x: x, fx: fxx };
    // bracket scan
    var spans = [1, 10, 100, 1e3, 1e4, 1e6], s, j;
    for (s = 0; s < spans.length; s++) {
      var c = guess || 0, R = spans[s], N = 400, px = c - R, pf = safe(px);
      for (j = 1; j <= N; j++) {
        var cx = c - R + 2 * R * j / N, cf = safe(cx);
        if (!isNaN(pf) && !isNaN(cf) && pf * cf <= 0) {
          var lo = px, hi = cx, flo = pf;
          for (var it = 0; it < 200; it++) {
            var mid = (lo + hi) / 2, fm = safe(mid);
            if (isNaN(fm)) break;
            if (flo * fm <= 0) hi = mid; else { lo = mid; flo = fm; }
          }
          var rx = (lo + hi) / 2;
          if (Math.abs(safe(rx)) < 1e-6 * Math.max(1, Math.abs(rx))) return { x: rx, fx: safe(rx) };
        }
        px = cx; pf = cf;
      }
    }
    return null;
  } finally { env.vars.X = old; }
}

// ---------- CALC: variables used ----------
function ceVarsIn(text) {
  var seen = {}, list = [];
  ceTokenize(text).forEach(function (t) { if (t.t === 'var' && !seen[t.v]) { seen[t.v] = 1; list.push(t.v); } });
  return list;
}

// ---------- formatting ----------
function ceTrimZeros(s) { return s.indexOf('.') === -1 ? s : s.replace(/0+$/, '').replace(/\.$/, ''); }
function ceSciStr(x, digits) {
  var s = x.toExponential(digits ? digits - 1 : 9), p = s.split('e'), mant = p[0];
  if (!digits) mant = ceTrimZeros(mant);
  var ex = Number(p[1]);
  return mant + 'E' + ex;
}
function ceFmtNum(x, st) {
  st = st || {};
  if (x === 0) return '0';
  var fmt = st.fmt || 'norm2', ax = Math.abs(x);
  if (st.si && isFinite(x) && ax >= 1e-24 && ax < 1e27) {
    var e3 = Math.floor(Math.log10(ax) / 3) * 3, sm = x / Math.pow(10, e3);
    if (Math.abs(sm) >= 999.9995) { sm /= 1000; e3 += 3; }
    var pre = { '-24': 'y', '-21': 'z', '-18': 'a', '-15': 'f', '-12': 'p', '-9': 'n', '-6': 'µ', '-3': 'm', '0': '', '3': 'k', '6': 'M', '9': 'G', '12': 'T', '15': 'P', '18': 'E', '21': 'Z', '24': 'Y' }[String(e3)];
    var st2 = {}; for (var sk in st) st2[sk] = st[sk]; st2.si = false;
    return ceFmtNum(Number(sm.toPrecision(10)), st2) + (pre === undefined ? '' : pre);
  }
  if (fmt === 'sci') return ceSciStr(x, st.digits || 3);
  if (ax >= 1e10) return ceSciStr(x, null);
  if (fmt === 'fix') {
    var s = x.toFixed(st.digits === undefined ? 2 : st.digits);
    return /^-?0(\.0*)?$/.test(s) && x < 0 ? s.replace('-', '') : s;
  }
  var lo = fmt === 'norm1' ? 1e-2 : 1e-9;
  if (ax < lo) return ceSciStr(x, null);
  var dec = Math.min(20, Math.max(0, 9 - Math.floor(Math.log10(ax))));
  var str = Number(x.toPrecision(10)).toFixed(dec);
  return ceTrimZeros(str);
}
function ceSqFree(n) {
  var k = 1, s = n;
  for (var p = 2; p * p <= s; p++) while (s % (p * p) === 0) { s /= p * p; k *= p; }
  return { k: k, s: s };
}
function ceExact(x, st) {
  if (!isFinite(x) || x === 0 || ceIsInt(x) && Math.abs(x) < 1e15) return null;
  var neg = x < 0, a = Math.abs(x), f = ceFrac(a, 9999, 1e-10), txt = null;
  var sg = neg ? '-' : '';
  if (f && f.d > 1) {
    if (st && st.mixed && f.n > f.d) { var w = Math.floor(f.n / f.d); return sg + w + ' ' + (f.n - w * f.d) + '/' + f.d; }
    return sg + f.n + '/' + f.d;
  }
  var r = ceFrac(a / CE_PI, 360, 1e-11);
  if (r && r.n > 0 && Math.abs(r.n / r.d * CE_PI - a) < 1e-11 * a) {
    var num = r.n === 1 ? 'π' : r.n + 'π';
    return sg + (r.d === 1 ? num : num + '/' + r.d);
  }
  var y = ceFrac(a * a, 1000, 1e-11);
  if (y) {
    var prod = y.n * y.d;
    if (prod <= 1e6) {
      var sf = ceSqFree(prod), s2 = sf.s, k = sf.k, d = y.d;
      if (s2 > 1 && Math.abs(k * Math.sqrt(s2) / d - a) < 1e-11 * a) {
        var g = ceGcd(k, d); k /= g; d /= g;
        var top = (k === 1 ? '' : k) + '√' + s2;
        return sg + (d === 1 ? top : top + '/' + d);
      }
    }
  }
  return txt;
}
function ceDMS(x) {
  var neg = x < 0, a = Math.abs(x), d = Math.floor(a + 1e-12), rem = (a - d) * 60, m = Math.floor(rem + 1e-9), s = (rem - m) * 60;
  s = Math.round(s * 1e6) / 1e6;
  if (s >= 60) { s -= 60; m++; } if (m >= 60) { m -= 60; d++; }
  return (neg ? '-' : '') + d + '°' + m + '′' + ceTrimZeros(s.toFixed(4)) + '″';
}
function ceEng(x) {
  if (x === 0) return '0';
  var e = Math.floor(Math.log10(Math.abs(x)) / 3) * 3, m = x / Math.pow(10, e);
  return ceTrimZeros(Number(m.toPrecision(10)).toString()) + 'E' + e;
}
// st: { fmt, digits, cfmt:'rect'|'polar', math:true, mixed:false, mode }
function ceFmtValue(v, st) {
  st = st || {};
  if (v && v.text !== undefined) return v.text;
  if (v && v.list) return v.list.map(function (q, i) { return v.labels[i] + '=' + ceFmtValue(q, st); }).join('  ');
  if (cIs(v)) {
    if (st.cfmt === 'polar') {
      var ang = ceFromDeg(cArg(v) * 180 / CE_PI, st.mode || 'deg');
      return ceFmtNum(cAbs(v), st) + '∠' + ceFmtNum(ang, st);
    }
    var re = ceFmtNum(v.re, st), im = Math.abs(v.im) === 1 ? '' : ceFmtNum(Math.abs(v.im), st);
    var sgn = v.im < 0 ? '-' : '+';
    return (v.re === 0 ? (v.im < 0 ? '-' : '') + im + 'i' : re + sgn + im + 'i');
  }
  if (st.math !== false && !st.fmt_override && !st.si) { var ex = ceExact(v, st); if (ex) return ex; }
  return ceFmtNum(v, st);
}

// ---------- BASE-N ----------
function ceBaseDigits(base) { return '0123456789ABCDEF'.slice(0, base); }
function ceBaseWrap(x) { x = Math.trunc(x); x = x % 4294967296; if (x < 0) x += 4294967296; return x | 0; }
function ceBaseEval(text, base) {
  var s = String(text).toUpperCase().replace(/\s+/g, ''), pos = 0, dg = ceBaseDigits(base);
  function pk() { return s.slice(pos); }
  function word(w) { if (s.slice(pos, pos + w.length) === w) { pos += w.length; return true; } return false; }
  function orx() {
    var l = andx();
    for (;;) { if (word('XNOR')) l = ~(l ^ andx()); else if (word('XOR')) l = l ^ andx(); else if (word('OR')) l = l | andx(); else break; }
    return l;
  }
  function andx() { var l = add(); while (word('AND')) l = l & add(); return l; }
  function add() {
    var l = mul();
    for (;;) { if (s.charAt(pos) === '+') { pos++; l = ceBaseWrap(l + mul()); } else if (s.charAt(pos) === '-') { pos++; l = ceBaseWrap(l - mul()); } else break; }
    return l;
  }
  function mul() {
    var l = un();
    for (;;) {
      if (s.charAt(pos) === '*') { pos++; l = ceBaseWrap(l * un()); }
      else if (s.charAt(pos) === '/') { pos++; var d = un(); if (d === 0) throw ceErr('Math ERROR'); l = Math.trunc(l / d); }
      else break;
    }
    return l;
  }
  function un() {
    if (word('NOT(')) { var v = orx(); if (s.charAt(pos) === ')') pos++; return ~v; }
    if (word('NEG(')) { var v2 = orx(); if (s.charAt(pos) === ')') pos++; return ceBaseWrap(-v2); }
    if (s.charAt(pos) === '-') { pos++; return ceBaseWrap(-un()); }
    if (s.charAt(pos) === '(') { pos++; var e = orx(); if (s.charAt(pos) === ')') pos++; else if (pos < s.length) throw ceErr('Syntax ERROR'); return e; }
    var st = pos;
    while (pos < s.length && dg.indexOf(s.charAt(pos)) !== -1 && !/^(AND|XNOR|XOR|OR)/.test(s.slice(pos)) || (pos < s.length && base === 16 && dg.indexOf(s.charAt(pos)) !== -1 && pos === st)) pos++;
    if (pos === st) throw ceErr('Syntax ERROR');
    var n = parseInt(s.slice(st, pos), base);
    if (n > 4294967295 || (base === 10 && n > 2147483647 * 2 + 1)) throw ceErr('Math ERROR');
    return ceBaseWrap(n);
  }
  if (!s) return null;
  var r = orx();
  if (pos < s.length) throw ceErr('Syntax ERROR');
  return r | 0;
}
function ceBaseShow(n, base) {
  var u = n >>> 0;
  if (base === 10) return String(n);
  return u.toString(base).toUpperCase();
}

// ---------- statistics ----------
function ceExpand(xs, fs) {
  var out = [];
  for (var i = 0; i < xs.length; i++) { var f = fs ? fs[i] : 1; for (var k = 0; k < f; k++) { out.push(xs[i]); if (out.length > 200000) throw ceErr('Math ERROR'); } }
  return out;
}
function ceMedian(a) { var n = a.length, m = Math.floor(n / 2); return n % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
function ceStat1(xs, fs) {
  var n = 0, sx = 0, sx2 = 0, i;
  for (i = 0; i < xs.length; i++) { var f = fs ? fs[i] : 1; n += f; sx += f * xs[i]; sx2 += f * xs[i] * xs[i]; }
  if (n < 1) throw ceErr('Math ERROR');
  var mean = sx / n, ss = 0;
  for (i = 0; i < xs.length; i++) ss += (fs ? fs[i] : 1) * Math.pow(xs[i] - mean, 2);
  var all = ceExpand(xs, fs).sort(function (a, b) { return a - b; });
  var h = Math.floor(all.length / 2), lower = all.slice(0, h), upper = all.slice(all.length - h);
  return {
    n: n, mean: mean, sumx: sx, sumx2: sx2, sigx: Math.sqrt(ss / n), sx: n > 1 ? Math.sqrt(ss / (n - 1)) : NaN,
    min: all[0], max: all[all.length - 1], q1: lower.length ? ceMedian(lower) : all[0], med: ceMedian(all), q3: upper.length ? ceMedian(upper) : all[all.length - 1]
  };
}
function ceSolveLinear(M, b) {
  var n = M.length, A = M.map(function (r, i) { return r.slice().concat([b[i]]); }), i, j, k;
  for (i = 0; i < n; i++) {
    var p = i; for (j = i + 1; j < n; j++) if (Math.abs(A[j][i]) > Math.abs(A[p][i])) p = j;
    if (Math.abs(A[p][i]) < 1e-12) return null;
    var t = A[i]; A[i] = A[p]; A[p] = t;
    for (j = i + 1; j < n; j++) { var f = A[j][i] / A[i][i]; for (k = i; k <= n; k++) A[j][k] -= f * A[i][k]; }
  }
  var x = new Array(n);
  for (i = n - 1; i >= 0; i--) { var s = A[i][n]; for (j = i + 1; j < n; j++) s -= A[i][j] * x[j]; x[i] = s / A[i][i]; }
  return x;
}
var CE_REG = {
  lin: 'y = a + bx', quad: 'y = a + bx + cx²', log: 'y = a + b·ln x', exp: 'y = a·e^(bx)', ab: 'y = a·b^x', pow: 'y = a·x^b', inv: 'y = a + b/x'
};
function ceStat2(xs, ys, fs, type) {
  var i, n = 0, sx = 0, sy = 0, sx2 = 0, sy2 = 0, sxy = 0;
  for (i = 0; i < xs.length; i++) { var f = fs ? fs[i] : 1; n += f; sx += f * xs[i]; sy += f * ys[i]; sx2 += f * xs[i] * xs[i]; sy2 += f * ys[i] * ys[i]; sxy += f * xs[i] * ys[i]; }
  if (n < 2) throw ceErr('Math ERROR');
  var mx = sx / n, my = sy / n, vx = 0, vy = 0;
  for (i = 0; i < xs.length; i++) { var g = fs ? fs[i] : 1; vx += g * Math.pow(xs[i] - mx, 2); vy += g * Math.pow(ys[i] - my, 2); }
  var out = {
    n: n, xmean: mx, ymean: my, sumx: sx, sumy: sy, sumx2: sx2, sumy2: sy2, sumxy: sxy,
    sigx: Math.sqrt(vx / n), sigy: Math.sqrt(vy / n), sx: Math.sqrt(vx / (n - 1)), sy: Math.sqrt(vy / (n - 1))
  };
  type = type || 'lin';
  if (type === 'quad') {
    var s = [0, 0, 0, 0, 0], t = [0, 0, 0];
    for (i = 0; i < xs.length; i++) {
      var w = fs ? fs[i] : 1, x = xs[i], y = ys[i];
      s[0] += w; s[1] += w * x; s[2] += w * x * x; s[3] += w * Math.pow(x, 3); s[4] += w * Math.pow(x, 4);
      t[0] += w * y; t[1] += w * x * y; t[2] += w * x * x * y;
    }
    var co = ceSolveLinear([[s[0], s[1], s[2]], [s[1], s[2], s[3]], [s[2], s[3], s[4]]], t);
    if (!co) throw ceErr('Math ERROR');
    out.a = co[0]; out.b = co[1]; out.c = co[2]; out.type = type; return out;
  }
  var tx = { lin: 1, exp: 1, ab: 1 }[type] ? function (x) { return x; } : (type === 'inv' ? function (x) { return 1 / x; } : function (x) { return Math.log(x); });
  var ty = { exp: 1, ab: 1, pow: 1 }[type] ? function (y) { return Math.log(y); } : function (y) { return y; };
  var X = [], Y = [];
  for (i = 0; i < xs.length; i++) {
    if ((tx === undefined) || ((type === 'log' || type === 'pow') && xs[i] <= 0) || (type === 'inv' && xs[i] === 0) || ((type === 'exp' || type === 'ab' || type === 'pow') && ys[i] <= 0)) throw ceErr('Math ERROR');
    X.push(tx(xs[i])); Y.push(ty(ys[i]));
  }
  var Sx = 0, Sy = 0, Sxx = 0, Syy = 0, Sxy = 0, N = 0;
  for (i = 0; i < X.length; i++) { var q = fs ? fs[i] : 1; N += q; Sx += q * X[i]; Sy += q * Y[i]; Sxx += q * X[i] * X[i]; Syy += q * Y[i] * Y[i]; Sxy += q * X[i] * Y[i]; }
  var den = N * Sxx - Sx * Sx;
  if (den === 0) throw ceErr('Math ERROR');
  var B = (N * Sxy - Sx * Sy) / den, Aa = (Sy - B * Sx) / N;
  var rden = Math.sqrt(den * (N * Syy - Sy * Sy));
  out.r = rden === 0 ? NaN : (N * Sxy - Sx * Sy) / rden;
  if (type === 'exp') { out.a = Math.exp(Aa); out.b = B; }
  else if (type === 'ab') { out.a = Math.exp(Aa); out.b = Math.exp(B); }
  else if (type === 'pow') { out.a = Math.exp(Aa); out.b = B; }
  else { out.a = Aa; out.b = B; }
  out.type = type; return out;
}
function ceRegY(m, x) {
  switch (m.type) {
    case 'quad': return m.a + m.b * x + m.c * x * x;
    case 'log': return m.a + m.b * Math.log(x);
    case 'exp': return m.a * Math.exp(m.b * x);
    case 'ab': return m.a * Math.pow(m.b, x);
    case 'pow': return m.a * Math.pow(x, m.b);
    case 'inv': return m.a + m.b / x;
    default: return m.a + m.b * x;
  }
}
function ceRegX(m, y) {
  switch (m.type) {
    case 'quad': {
      var D = m.b * m.b - 4 * m.c * (m.a - y);
      if (D < 0) throw ceErr('Math ERROR');
      return [(-m.b + Math.sqrt(D)) / (2 * m.c), (-m.b - Math.sqrt(D)) / (2 * m.c)];
    }
    case 'log': return Math.exp((y - m.a) / m.b);
    case 'exp': return Math.log(y / m.a) / m.b;
    case 'ab': return Math.log(y / m.a) / Math.log(m.b);
    case 'pow': return Math.pow(y / m.a, 1 / m.b);
    case 'inv': return m.b / (y - m.a);
    default: return (y - m.a) / m.b;
  }
}

// ---------- distributions ----------
function ceErf(x) {
  var ax = Math.abs(x);
  if (ax < 3) {
    var sum = ax, term = ax, k = 0;
    while (Math.abs(term) > 1e-17 * Math.abs(sum) && k < 200) { k++; term *= -ax * ax / k; sum += term / (2 * k + 1); }
    var r = 2 / Math.sqrt(CE_PI) * sum; return x < 0 ? -r : r;
  }
  var e = 1 - ceErfcPos(ax); return x < 0 ? -e : e;
}
function ceErfcPos(x) { // x >= 3, continued fraction
  var f = 0; for (var k = 60; k >= 1; k--) f = (k / 2) / (x + f);
  return Math.exp(-x * x) / Math.sqrt(CE_PI) / (x + f);
}
function ceNormCdf(z) {
  if (z < -3 * Math.SQRT2) return 0.5 * ceErfcPos(-z / Math.SQRT2);
  if (z > 3 * Math.SQRT2) return 1 - 0.5 * ceErfcPos(z / Math.SQRT2);
  return 0.5 * (1 + ceErf(z / Math.SQRT2));
}
function ceNormPdf(x, mu, sg) { var z = (x - mu) / sg; return Math.exp(-z * z / 2) / (sg * Math.sqrt(2 * CE_PI)); }
function ceNormInv(p) {
  if (p <= 0 || p >= 1) throw ceErr('Math ERROR');
  var a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239],
    b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1],
    c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783],
    d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416], x, q, r;
  if (p < 0.02425) { q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  else if (p > 1 - 0.02425) { q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  else { q = p - 0.5; r = q * q; x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
  for (var i = 0; i < 3; i++) { var e = ceNormCdf(x) - p, u = e * Math.sqrt(2 * CE_PI) * Math.exp(x * x / 2); x = x - u / (1 + x * u / 2); }
  return x;
}
function ceLgamma(x) {
  var g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(CE_PI / Math.abs(Math.sin(CE_PI * x))) - ceLgamma(1 - x);
  x -= 1; var a = c[0], t = x + g + 0.5;
  for (var i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * CE_PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
function ceBinomPd(k, n, p) {
  if (!ceIsInt(k) || !ceIsInt(n) || n < 0 || p < 0 || p > 1) throw ceErr('Math ERROR');
  k = Math.round(k); n = Math.round(n); if (k < 0 || k > n) return 0;
  if (p === 0) return k === 0 ? 1 : 0; if (p === 1) return k === n ? 1 : 0;
  return Math.exp(ceLgamma(n + 1) - ceLgamma(k + 1) - ceLgamma(n - k + 1) + k * Math.log(p) + (n - k) * Math.log(1 - p));
}
function ceBinomCd(k, n, p) { var s = 0; k = Math.floor(k + 1e-9); for (var i = 0; i <= Math.min(k, n); i++) s += ceBinomPd(i, n, p); return Math.min(1, s); }
function cePoisPd(k, lam) {
  if (!ceIsInt(k) || lam <= 0) throw ceErr('Math ERROR'); k = Math.round(k); if (k < 0) return 0;
  return Math.exp(-lam + k * Math.log(lam) - ceLgamma(k + 1));
}
function cePoisCd(k, lam) { var s = 0; k = Math.floor(k + 1e-9); for (var i = 0; i <= k; i++) s += cePoisPd(i, lam); return Math.min(1, s); }

// ---------- equations ----------
function ceRoots(coefs) { // highest degree first, real coefs
  while (coefs.length > 1 && coefs[0] === 0) coefs = coefs.slice(1);
  var n = coefs.length - 1;
  if (n < 1) throw ceErr('Math ERROR');
  if (n === 1) return [cMk(-coefs[1] / coefs[0], 0)];
  if (n === 2) {
    var a = coefs[0], b = coefs[1], c = coefs[2], D = b * b - 4 * a * c;
    if (D >= 0) { var sq = Math.sqrt(D); return [cMk((-b + sq) / (2 * a), 0), cMk((-b - sq) / (2 * a), 0)]; }
    var s2 = Math.sqrt(-D) / (2 * a); return [cMk(-b / (2 * a), s2), cMk(-b / (2 * a), -s2)];
  }
  var p = coefs.map(function (x) { return x / coefs[0]; }), z = [], i, j, it;
  var R = 1 + Math.max.apply(null, p.slice(1).map(Math.abs));
  for (i = 0; i < n; i++) { var ang = 2 * CE_PI * i / n + 0.4; z.push({ re: R * 0.5 * Math.cos(ang), im: R * 0.5 * Math.sin(ang) }); }
  function ev(x) { var r = { re: 1, im: 0 }; for (var q = 1; q <= n; q++) { r = { re: r.re * x.re - r.im * x.im + p[q], im: r.re * x.im + r.im * x.re }; } return r; }
  function cm(a, b) { return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }; }
  function cd(a, b) { var d = b.re * b.re + b.im * b.im; return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d }; }
  for (it = 0; it < 500; it++) {
    var mx = 0;
    for (i = 0; i < n; i++) {
      var den = { re: 1, im: 0 };
      for (j = 0; j < n; j++) if (j !== i) den = cm(den, { re: z[i].re - z[j].re, im: z[i].im - z[j].im });
      var dl = cd(ev(z[i]), den); z[i] = { re: z[i].re - dl.re, im: z[i].im - dl.im }; mx = Math.max(mx, Math.hypot(dl.re, dl.im));
    }
    if (mx < 1e-15) break;
  }
  return z.map(function (q) { return cMk(Math.abs(q.re) < 1e-11 ? 0 : q.re, Math.abs(q.im) < 1e-9 ? 0 : q.im); })
    .sort(function (a, b) { return cRe(b) - cRe(a) || cIm(b) - cIm(a); });
}

// ---------- matrix & vector ----------
function ceMatSnap(x) { return Math.abs(x) < 1e-12 ? 0 : Number(x.toPrecision(13)); }
function ceMatMul(A, B) {
  if (A[0].length !== B.length) throw ceErr('Dimension ERROR');
  return A.map(function (r) { return B[0].map(function (_, j) { var s = 0; for (var k = 0; k < B.length; k++) s += r[k] * B[k][j]; return ceMatSnap(s); }); });
}
function ceMatAdd(A, B, sg) {
  if (A.length !== B.length || A[0].length !== B[0].length) throw ceErr('Dimension ERROR');
  return A.map(function (r, i) { return r.map(function (v, j) { return v + sg * B[i][j]; }); });
}
function ceMatScale(A, k) { return A.map(function (r) { return r.map(function (v) { return ceMatSnap(v * k); }); }); }
function ceMatTrn(A) { return A[0].map(function (_, j) { return A.map(function (r) { return r[j]; }); }); }
function ceMatDet(A) {
  var n = A.length; if (A.some(function (r) { return r.length !== n; })) throw ceErr('Dimension ERROR');
  var M = A.map(function (r) { return r.slice(); }), det = 1, i, j, k;
  for (i = 0; i < n; i++) {
    var p = i; for (j = i + 1; j < n; j++) if (Math.abs(M[j][i]) > Math.abs(M[p][i])) p = j;
    if (M[p][i] === 0) return 0;
    if (p !== i) { var t = M[i]; M[i] = M[p]; M[p] = t; det = -det; }
    det *= M[i][i];
    for (j = i + 1; j < n; j++) { var f = M[j][i] / M[i][i]; for (k = i; k < n; k++) M[j][k] -= f * M[i][k]; }
  }
  return ceMatSnap(Number(det.toPrecision(12)));
}
function ceMatInv(A) {
  var n = A.length; if (A.some(function (r) { return r.length !== n; })) throw ceErr('Dimension ERROR');
  var M = A.map(function (r, i) { var row = r.slice(); for (var j = 0; j < n; j++) row.push(i === j ? 1 : 0); return row; }), i, j, k;
  for (i = 0; i < n; i++) {
    var p = i; for (j = i + 1; j < n; j++) if (Math.abs(M[j][i]) > Math.abs(M[p][i])) p = j;
    if (Math.abs(M[p][i]) < 1e-12) throw ceErr('Math ERROR');
    var t = M[i]; M[i] = M[p]; M[p] = t;
    var pv = M[i][i]; for (k = 0; k < 2 * n; k++) M[i][k] /= pv;
    for (j = 0; j < n; j++) if (j !== i) { var f = M[j][i]; for (k = 0; k < 2 * n; k++) M[j][k] -= f * M[i][k]; }
  }
  return M.map(function (r) { return r.slice(n).map(ceMatSnap); });
}
function ceVecDot(a, b) { if (a.length !== b.length) throw ceErr('Dimension ERROR'); return ceMatSnap(a.reduce(function (s, v, i) { return s + v * b[i]; }, 0)); }
function ceVecCross(a, b) {
  if (a.length !== 3 || b.length !== 3) throw ceErr('Dimension ERROR');
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]].map(ceMatSnap);
}
function ceVecAbs(a) { return Math.sqrt(a.reduce(function (s, v) { return s + v * v; }, 0)); }
function ceVecAngle(a, b, mode) {
  var m = ceVecAbs(a) * ceVecAbs(b); if (m === 0) throw ceErr('Math ERROR');
  var c = Math.max(-1, Math.min(1, ceVecDot(a, b) / m)); return ceFromDeg(Math.acos(c) * 180 / CE_PI, mode);
}

// ---------- TABLE ----------
function ceTable(text, start, end, step, env) {
  var ast = ceParse(text); if (ast.t === 'eq') throw ceErr('Syntax ERROR');
  if (step <= 0 || end < start) throw ceErr('Math ERROR');
  var rows = [], x, old = env.vars.X, cnt = 0;
  try {
    for (x = start; x <= end + step * 1e-9; x += step) {
      if (++cnt > 100) throw ceErr('Math ERROR');
      env.vars.X = Number(x.toPrecision(12));
      var y; try { y = ceEval(ast, env); } catch (e) { y = null; }
      rows.push([env.vars.X, y]);
    }
  } finally { env.vars.X = old; }
  return rows;
}

// ---------- constants & conversions ----------
var CE_CONSTS = [
  ['mp', 'Proton mass', 1.67262192369e-27], ['mn', 'Neutron mass', 1.67492749804e-27], ['me', 'Electron mass', 9.1093837015e-31],
  ['mμ', 'Muon mass', 1.883531627e-28], ['a0', 'Bohr radius', 5.29177210903e-11], ['h', 'Planck constant', 6.62607015e-34],
  ['μN', 'Nuclear magneton', 5.0507837461e-27], ['μB', 'Bohr magneton', 9.2740100783e-24], ['ħ', 'Reduced Planck constant', 1.054571817e-34],
  ['α', 'Fine-structure constant', 7.2973525693e-3], ['re', 'Classical electron radius', 2.8179403262e-15], ['λc', 'Compton wavelength', 2.42631023867e-12],
  ['γp', 'Proton gyromagnetic ratio', 2.6752218744e8], ['λcp', 'Proton Compton wavelength', 1.32140985539e-15], ['λcn', 'Neutron Compton wavelength', 1.31959090581e-15],
  ['R∞', 'Rydberg constant', 10973731.56816], ['u', 'Atomic mass unit', 1.6605390666e-27], ['μp', 'Proton magnetic moment', 1.41060679736e-26],
  ['μe', 'Electron magnetic moment', -9.2847647043e-24], ['μn', 'Neutron magnetic moment', -9.6623651e-27], ['μμ', 'Muon magnetic moment', -4.4904483e-26],
  ['F', 'Faraday constant', 96485.33212], ['e', 'Elementary charge', 1.602176634e-19], ['NA', 'Avogadro constant', 6.02214076e23],
  ['k', 'Boltzmann constant', 1.380649e-23], ['Vm', 'Molar volume (ideal gas, 273.15 K)', 0.02241396954], ['R', 'Molar gas constant', 8.314462618],
  ['c0', 'Speed of light', 299792458], ['C1', 'First radiation constant', 3.741771852e-16], ['C2', 'Second radiation constant', 0.01438776877],
  ['σ', 'Stefan-Boltzmann constant', 5.670374419e-8], ['ε0', 'Electric constant', 8.8541878128e-12], ['μ0', 'Magnetic constant', 1.25663706212e-6],
  ['φ0', 'Magnetic flux quantum', 2.067833848e-15], ['g', 'Standard gravity', 9.80665], ['G0', 'Conductance quantum', 7.748091729e-5],
  ['Z0', 'Characteristic impedance of vacuum', 376.730313668], ['t', 'Celsius temperature (0 °C in K)', 273.15], ['G', 'Gravitational constant', 6.6743e-11],
  ['atm', 'Standard atmosphere', 101325]
];
var CE_UNITS = {
  Length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mile: 1609.344, yard: 0.9144, foot: 0.3048, inch: 0.0254, 'nautical mile': 1852 },
  Area: { 'm²': 1, 'km²': 1e6, 'cm²': 1e-4, hectare: 1e4, acre: 4046.8564224, 'ft²': 0.09290304, 'in²': 6.4516e-4, marla: 25.2929538, kanal: 505.857 },
  Volume: { litre: 1, ml: 0.001, 'm³': 1000, gallon_US: 3.785411784, 'quart_US': 0.946352946, 'cup_US': 0.2365882365, 'fl_oz_US': 0.0295735296, 'ft³': 28.316846592 },
  Mass: { kg: 1, g: 0.001, mg: 1e-6, tonne: 1000, pound: 0.45359237, ounce: 0.028349523125, tola: 0.01166375, seer: 0.9331 },
  Speed: { 'm/s': 1, 'km/h': 1 / 3.6, mph: 0.44704, knot: 0.514444444, 'ft/s': 0.3048 },
  Pressure: { Pa: 1, kPa: 1000, bar: 1e5, atm: 101325, psi: 6894.757293, mmHg: 133.322387, 'kgf/cm²': 98066.5 },
  Energy: { J: 1, kJ: 1000, cal: 4.184, kcal: 4184, Wh: 3600, kWh: 3.6e6, eV: 1.602176634e-19, BTU: 1055.05585 },
  Power: { W: 1, kW: 1000, hp: 745.699872, 'kcal/h': 1.162222 },
  Time: { s: 1, min: 60, hour: 3600, day: 86400, week: 604800, year: 31557600 },
  Angle: { degree: 1, radian: 180 / CE_PI, gradian: 0.9 }
};
function ceConvert(val, cat, from, to) {
  if (cat === 'Temperature') {
    var k = from === 'K' ? val : from === '°C' ? val + 273.15 : from === '°F' ? (val - 32) * 5 / 9 + 273.15 : val * 5 / 9;
    return to === 'K' ? k : to === '°C' ? k - 273.15 : to === '°F' ? (k - 273.15) * 9 / 5 + 32 : k * 9 / 5;
  }
  var t = CE_UNITS[cat]; if (!t || !t[from] || !t[to]) throw ceErr('Math ERROR');
  return val * t[from] / t[to];
}
CE_UNITS.Temperature = { '°C': 1, '°F': 1, K: 1, '°R': 1 };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ceNewEnv: ceNewEnv, ceRun: ceRun, ceParse: ceParse, ceEval: ceEval, ceSolve: ceSolve, ceVarsIn: ceVarsIn, ceFmtValue: ceFmtValue, ceFmtNum: ceFmtNum,
    ceExact: ceExact, ceDMS: ceDMS, ceEng: ceEng, ceBaseEval: ceBaseEval, ceBaseShow: ceBaseShow, ceStat1: ceStat1, ceStat2: ceStat2, ceRegY: ceRegY, ceRegX: ceRegX,
    ceNormCdf: ceNormCdf, ceNormPdf: ceNormPdf, ceNormInv: ceNormInv, ceBinomPd: ceBinomPd, ceBinomCd: ceBinomCd, cePoisPd: cePoisPd, cePoisCd: cePoisCd,
    ceRoots: ceRoots, ceSolveLinear: ceSolveLinear, ceMatMul: ceMatMul, ceMatAdd: ceMatAdd, ceMatScale: ceMatScale, ceMatTrn: ceMatTrn, ceMatDet: ceMatDet, ceMatInv: ceMatInv,
    ceVecDot: ceVecDot, ceVecCross: ceVecCross, ceVecAbs: ceVecAbs, ceVecAngle: ceVecAngle, ceTable: ceTable, CE_CONSTS: CE_CONSTS, CE_UNITS: CE_UNITS, ceConvert: ceConvert, CE_REG: CE_REG
  };
}

// ---------- symbolic algebra (polynomials over atoms): expand / factor / simplify / diff / sint ----------
var CES_FUN = { sin: 1, cos: 1, tan: 1, ln: 1, log: 1, exp: 1, sqrt: 1, abs: 1, asin: 1, acos: 1, atan: 1, cbrt: 1 };
function cesTok(src) {
  var s = String(src).replace(/\s+/g, '').replace(/×|·/g, '*').replace(/÷/g, '/').replace(/[−–—]/g, '-').replace(/π/g, 'pi').replace(/√/g, 'sqrt').replace(/²/g, '^2').replace(/³/g, '^3').replace(/[{[]/g, '(').replace(/[}\]]/g, ')');
  var out = [], i = 0, m;
  while (i < s.length) {
    var ch = s.charAt(i);
    if (/[0-9.]/.test(ch)) { m = /^(?:\d+\.?\d*|\.\d+)/.exec(s.slice(i)); if (!m) throw ceErr('Syntax ERROR'); out.push({ t: 'n', v: Number(m[0]) }); i += m[0].length; continue; }
    if (/[A-Za-z]/.test(ch)) {
      var w = /^[A-Za-z]+/.exec(s.slice(i))[0], j = 0;
      while (j < w.length) {
        var rest = w.slice(j).toLowerCase(), f = null, nm;
        for (nm in CES_FUN) if (rest.indexOf(nm) === 0 && (!f || nm.length > f.length)) f = nm;
        if (f) { out.push({ t: 'f', v: f }); j += f.length; }
        else if (rest.indexOf('pi') === 0) { out.push({ t: 'c', v: 'pi' }); j += 2; }
        else if (rest.charAt(0) === 'e') { out.push({ t: 'c', v: 'e' }); j++; }
        else { out.push({ t: 'v', v: rest.charAt(0) }); j++; }
      }
      i += w.length; continue;
    }
    if ('+-*/^(),'.indexOf(ch) !== -1) { out.push({ t: 'o', v: ch }); i++; continue; }
    throw ceErr('Syntax ERROR');
  }
  return out;
}
function cesParse(src) {
  var tk = cesTok(src), pos = 0, depth = 0;
  function pk() { return tk[pos]; }
  function isO(v) { return pk() && pk().t === 'o' && pk().v === v; }
  function starts(t) { return t && (t.t === 'n' || t.t === 'v' || t.t === 'c' || t.t === 'f' || (t.t === 'o' && t.v === '(')); }
  function expr() {
    var terms = [term()];
    while (isO('+') || isO('-')) { var neg = tk[pos++].v === '-', t = term(); terms.push(neg ? { k: 'mul', a: [{ k: 'n', v: -1 }, t] } : t); }
    return terms.length === 1 ? terms[0] : { k: 'add', a: terms };
  }
  function term() {
    var fs = [unary()];
    while (pk()) {
      if (isO('*')) { pos++; fs.push(unary()); }
      else if (isO('/')) { pos++; fs.push({ k: 'pow', b: unary(), e: { k: 'n', v: -1 } }); }
      else if (starts(pk())) fs.push(unary());
      else break;
    }
    return fs.length === 1 ? fs[0] : { k: 'mul', a: fs };
  }
  function unary() {
    if (++depth > 50) throw ceErr('Stack ERROR');
    var r;
    if (isO('-')) { pos++; r = { k: 'mul', a: [{ k: 'n', v: -1 }, unary()] }; }
    else if (isO('+')) { pos++; r = unary(); }
    else r = pw();
    depth--; return r;
  }
  function pw() {
    var b = atom();
    if (isO('^')) { pos++; var e = unary(); return { k: 'pow', b: b, e: e }; }
    return b;
  }
  function atom() {
    var t = pk(); if (!t) throw ceErr('Syntax ERROR');
    if (t.t === 'n') { pos++; return { k: 'n', v: t.v }; }
    if (t.t === 'v') { pos++; return { k: 'v', n: t.v }; }
    if (t.t === 'c') { pos++; return { k: 'c', n: t.v }; }
    if (t.t === 'f') { pos++; var a; if (isO('(')) { pos++; a = expr(); if (!isO(')')) throw ceErr('Syntax ERROR'); pos++; } else a = pw(); return { k: 'fn', n: t.v, a: a }; }
    if (isO('(')) { pos++; var e = expr(); if (!isO(')')) throw ceErr('Syntax ERROR'); pos++; return e; }
    throw ceErr('Syntax ERROR');
  }
  var r = expr(); if (pos < tk.length) throw ceErr('Syntax ERROR'); return r;
}
function cesNum(x) { return Number(x.toPrecision(12)); }
function cesKey(m) { return Object.keys(m).sort().map(function (a) { return a + '^' + m[a]; }).join('*'); }
function pConst(c) { var p = {}; if (c !== 0) p[''] = { c: c, m: {} }; return p; }
function pAtom(a, e) { var m = {}; m[a] = e === undefined ? 1 : e; var o = {}; o[cesKey(m)] = { c: 1, m: m }; return o; }
function pAdd(a, b) {
  var r = {}, k;
  for (k in a) r[k] = { c: a[k].c, m: a[k].m };
  for (k in b) { if (r[k]) { r[k] = { c: cesNum(r[k].c + b[k].c), m: r[k].m }; if (Math.abs(r[k].c) < 1e-12) delete r[k]; } else r[k] = { c: b[k].c, m: b[k].m }; }
  return r;
}
function pMul(a, b) {
  var r = {}, i, j, x;
  for (i in a) for (j in b) {
    var m = {}; for (x in a[i].m) m[x] = a[i].m[x];
    for (x in b[j].m) { m[x] = (m[x] || 0) + b[j].m[x]; if (m[x] === 0) delete m[x]; }
    var k = cesKey(m), c = cesNum(a[i].c * b[j].c);
    if (r[k]) { r[k].c = cesNum(r[k].c + c); if (Math.abs(r[k].c) < 1e-12) delete r[k]; } else if (Math.abs(c) >= 1e-12) r[k] = { c: c, m: m };
  }
  if (Object.keys(r).length > 3000) throw ceErr('Time Out');
  return r;
}
function pPow(a, n) { var r = pConst(1), i; for (i = 0; i < n; i++) r = pMul(r, a); return r; }
function cesConst(nd) {
  switch (nd.k) {
    case 'n': return nd.v;
    case 'add': { var s = 0; for (var i = 0; i < nd.a.length; i++) { var v = cesConst(nd.a[i]); if (v === null) return null; s += v; } return s; }
    case 'mul': { var p = 1; for (var j = 0; j < nd.a.length; j++) { var w = cesConst(nd.a[j]); if (w === null) return null; p *= w; } return p; }
    case 'pow': { var b = cesConst(nd.b), e = cesConst(nd.e); if (b === null || e === null) return null; var r = Math.pow(b, e); return isFinite(r) ? r : null; }
  }
  return null;
}
function cesFrac(x) {
  if (x === Math.round(x)) return { n: x, d: 1 };
  var h1 = 1, h0 = 0, k1 = 0, k0 = 1, y = x, i;
  for (i = 0; i < 20; i++) {
    var a = Math.floor(y), h2 = a * h1 + h0, k2 = a * k1 + k0;
    h0 = h1; h1 = h2; k0 = k1; k1 = k2;
    if (k1 > 2000) return null;
    if (Math.abs(x - h1 / k1) < 1e-11) return { n: h1, d: k1 };
    if (y - a === 0) break; y = 1 / (y - a);
  }
  return null;
}
function cesCoef(x) { var f = cesFrac(x); return f && f.d === 1 ? String(f.n) : ceFmtNum(x, { fmt: 'norm2', digits: 2 }); }
function cesToPoly(nd, reg) {
  var i;
  switch (nd.k) {
    case 'n': return pConst(nd.v);
    case 'v': return pAtom(nd.n);
    case 'c': return pAtom(nd.n === 'pi' ? 'π' : 'e');
    case 'add': { var s = {}; for (i = 0; i < nd.a.length; i++) s = pAdd(s, cesToPoly(nd.a[i], reg)); return s; }
    case 'mul': { var p = pConst(1); for (i = 0; i < nd.a.length; i++) p = pMul(p, cesToPoly(nd.a[i], reg)); return p; }
    case 'pow': {
      if (nd.b.k === 'c' && nd.b.n === 'e') return cesToPoly({ k: 'fn', n: 'exp', a: nd.e }, reg);
      var b = cesToPoly(nd.b, reg), ev = cesConst(nd.e);
      if (ev !== null && ev === Math.trunc(ev) && Math.abs(ev) < 60) {
        if (ev >= 0) return pPow(b, ev);
        var ks = Object.keys(b);
        if (ks.length === 0) throw ceErr('Math ERROR');
        if (ks.length === 1) { var t = b[ks[0]], m = {}, x; for (x in t.m) m[x] = -t.m[x] * (-ev); var o = {}; if (ev !== -1) { m = {}; for (x in t.m) m[x] = t.m[x] * ev; } else { for (x in t.m) m[x] = -t.m[x]; } o[cesKey(m)] = { c: cesNum(Math.pow(t.c, ev)), m: m }; return o; }
        return pAtom('(' + cesPrint(b) + ')', ev);
      }
      if (ev === 0.5) return cesToPoly({ k: 'fn', n: 'sqrt', a: nd.b }, reg);
      var bs = cesPrint(b), es = ev !== null ? String(ev) : cesPrint(cesToPoly(nd.e, reg));
      return pAtom((/^[a-z0-9.]+$/.test(bs) ? bs : '(' + bs + ')') + '^' + (/^[a-z0-9.]+$/.test(es) ? es : '(' + es + ')'));
    }
    case 'fn': {
      var ap = cesToPoly(nd.a, reg), cv = pIsConst(ap) ? pConstVal(ap) : null;
      if (cv !== null) {
        if (nd.n === 'sqrt' && cv >= 0 && Math.abs(Math.sqrt(cv) - Math.round(Math.sqrt(cv))) < 1e-12) return pConst(Math.round(Math.sqrt(cv)));
        if ((nd.n === 'ln' && cv === 1) || (nd.n === 'sin' && cv === 0) || (nd.n === 'tan' && cv === 0)) return {};
        if ((nd.n === 'exp' && cv === 0) || (nd.n === 'cos' && cv === 0)) return pConst(1);
      }
      var key = nd.n + '(' + cesPrint(ap) + ')';
      if (reg) reg[key] = { n: nd.n, arg: ap };
      return pAtom(key);
    }
  }
  throw ceErr('Syntax ERROR');
}
function pIsConst(p) { var ks = Object.keys(p); return ks.length === 0 || (ks.length === 1 && ks[0] === ''); }
function pConstVal(p) { return p[''] ? p[''].c : 0; }
function cesIsFnAtom(a) { return /^[a-z]{2,}\(/.test(a); }
function cesAtomText(a, e) {
  if (e === 1) return a;
  var es = e === Math.trunc(e) ? String(e) : '(' + cesCoef(e) + ')';
  return a + '^' + es;
}
function cesTermStr(t) {
  var atoms = Object.keys(t.m).sort(function (x, y) {
    var lx = /^[a-z]$/.test(x), ly = /^[a-z]$/.test(y);
    if (lx !== ly) return lx ? -1 : 1; return x < y ? -1 : x > y ? 1 : 0;
  }), num = [], den = [], i;
  for (i = 0; i < atoms.length; i++) { var e = t.m[atoms[i]]; if (e > 0) num.push([atoms[i], e]); else den.push([atoms[i], -e]); }
  function join(parts) {
    var s = '';
    for (var q = 0; q < parts.length; q++) {
      var txt = cesAtomText(parts[q][0], parts[q][1]);
      if (q > 0 && (cesIsFnAtom(parts[q][0]) || cesIsFnAtom(parts[q - 1][0]))) s += '·';
      s += txt;
    }
    return s;
  }
  var mag = Math.abs(t.c), fr = cesFrac(mag), nC = fr ? fr.n : mag, dC = fr ? fr.d : 1;
  var nStr = (nC === 1 && num.length) ? '' : (fr ? String(nC) : cesCoef(mag)) + (num.length && /^[0-9]/.test(join(num).charAt(0)) ? '·' : '') ;
  nStr += join(num); if (nStr === '') nStr = '1';
  var dStr = (dC === 1 ? '' : String(dC)) + join(den);
  if (dStr) { var multi = (dC !== 1 && den.length) || den.length > 1 || (den.length === 1 && den[0][1] > 1 && false); if (multi) dStr = '(' + dStr + ')'; nStr += '/' + dStr; }
  return nStr;
}
function cesPrint(p) {
  var keys = Object.keys(p);
  if (!keys.length) return '0';
  var terms = keys.map(function (k) { return p[k]; });
  function deg(t) { var d = 0; for (var a in t.m) if (t.m[a] > 0 && /^[a-z]$/.test(a)) d += t.m[a]; return d; }
  terms.sort(function (a, b) { var da = deg(a), db = deg(b); if (da !== db) return db - da; var ka = cesKey(a.m), kb = cesKey(b.m); return ka < kb ? -1 : ka > kb ? 1 : 0; });
  var out = '';
  terms.forEach(function (t, i) {
    var neg = t.c < 0, s = cesTermStr(t);
    if (i === 0) out = (neg ? '-' : '') + s; else out += (neg ? ' - ' : ' + ') + s;
  });
  return out;
}
// ----- factor (univariate, rational roots) -----
function cesBigGcd(a, b) { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { var t = a % b; a = b; b = t; } return a; }
function cesDivisors(n) {
  n = Number(n < 0n ? -n : n); var out = [], i;
  if (n === 0) return [1];
  for (i = 1; i * i <= n; i++) if (n % i === 0) { out.push(i); if (i * i !== n) out.push(n / i); }
  return out;
}
function cesUniCoefs(p, v) {
  var deg = 0, k, c = {};
  for (k in p) {
    var t = p[k], ats = Object.keys(t.m);
    if (ats.length === 0) { c[0] = (c[0] || 0) + t.c; continue; }
    if (ats.length !== 1 || ats[0] !== v) return null;
    var e = t.m[v]; if (e !== Math.trunc(e) || e < 0) return null;
    c[e] = (c[e] || 0) + t.c; if (e > deg) deg = e;
  }
  var a = []; for (var i = 0; i <= deg; i++) a.push(c[i] || 0);
  return a;
}
function cesFactorUni(a, v) {
  // a: low-to-high real coefficients -> returns text or null
  var i, lcm = 1, fr;
  for (i = 0; i < a.length; i++) { fr = cesFrac(Math.abs(a[i])); if (!fr) return null; var g = lcm, d = fr.d; while (d) { var tt = g % d; g = d; d = tt; } lcm = lcm / g * fr.d; if (lcm > 1e6) return null; }
  var ia = a.map(function (x) { return BigInt(Math.round(x * lcm)); });
  while (ia.length > 1 && ia[ia.length - 1] === 0n) ia.pop();
  if (ia.length < 2) return null;
  var zeros = 0; while (ia[0] === 0n) { ia.shift(); zeros++; }
  var cont = 0n; ia.forEach(function (x) { cont = cesBigGcd(cont, x); });
  if (ia[ia.length - 1] < 0n) cont = -cont;
  ia = ia.map(function (x) { return x / cont; });
  var facs = [];
  var guard = 0;
  while (ia.length > 2 && guard++ < 40) {
    var found = false, n = ia.length - 1, ps = cesDivisors(ia[0]), qs = cesDivisors(ia[n]), pi, qi, sg;
    if (ps.length * qs.length > 40000) break;
    outer:
    for (pi = 0; pi < ps.length; pi++) for (qi = 0; qi < qs.length; qi++) for (sg = -1; sg <= 1; sg += 2) {
      var P = BigInt(ps[pi] * sg), Q = BigInt(qs[qi]);
      if (cesBigGcd(P, Q) !== 1n) continue;
      var val = 0n, pp = 1n, k;
      for (k = 0; k <= n; k++) { val += ia[k] * pp * (Q ** BigInt(n - k)); pp *= P; }
      if (val === 0n) {
        // divide by (Q x - P): high-to-low
        var hi = ia.slice().reverse(), res = [], carry = 0n, ok = true, z;
        for (z = 0; z < hi.length - 1; z++) { var cur = hi[z] + carry; if (cur % Q !== 0n) { ok = false; break; } var cq = cur / Q; res.push(cq); carry = cq * P; }
        if (!ok || hi[hi.length - 1] + carry !== 0n) continue;
        ia = res.reverse(); facs.push([Q, P]); found = true; break outer;
      }
    }
    if (!found) break;
  }
  if (ia.length === 2) { var Q2 = ia[1], P2 = -ia[0], g2 = cesBigGcd(Q2, P2); if (g2 > 1n) { cont *= g2; Q2 /= g2; P2 /= g2; } facs.push([Q2, P2]); ia = [1n]; }
  var rest = ia.length > 1 ? ia : null, constK = rest ? cont : cont * ia[0];
  if (!zeros && facs.length === 0) return null;
  // group
  var groups = {}, order = [];
  facs.forEach(function (f) { var key = f[0] + ',' + f[1]; if (!groups[key]) { groups[key] = { f: f, n: 0 }; order.push(key); } groups[key].n++; });
  function lin(f) { var q = f[0], p = f[1]; var qs = q === 1n ? '' : String(q); return '(' + qs + v + (p < 0n ? ' + ' + String(-p) : ' - ' + String(p)) + ')'; }
  var s = '', kf = Number(constK) / lcm;
  if (kf === -1) s = '-'; else if (kf !== 1) { var kfr = cesFrac(Math.abs(kf)); s = (kf < 0 ? '-' : '') + (kfr && kfr.d !== 1 ? '(' + kfr.n + '/' + kfr.d + ')' : (kfr ? String(kfr.n) : String(kf))); }
  if (zeros) s += v + (zeros > 1 ? '^' + zeros : '');
  order.forEach(function (key) { s += lin(groups[key].f) + (groups[key].n > 1 ? '^' + groups[key].n : ''); });
  if (rest) {
    var rp = {}; rest.forEach(function (c, i2) { var m = {}; if (i2) m[v] = i2; if (c !== 0n) rp[cesKey(m)] = { c: Number(c), m: m }; });
    s += '(' + cesPrint(rp) + ')';
  }
  return s;
}
function cesFactorPoly(p) {
  var ks = Object.keys(p);
  if (!ks.length) return '0';
  if (pIsConst(p)) { var cv = pConstVal(p); return cesFactorNumber(cv); }
  var vars = {}, k, nonvar = false;
  ks.forEach(function (key) { for (var a in p[key].m) { if (/^[a-z]$/.test(a)) vars[a] = 1; else nonvar = true; } });
  var vn = Object.keys(vars);
  if (vn.length === 1 && !nonvar) { var co = cesUniCoefs(p, vn[0]); if (co) { var r = cesFactorUni(co, vn[0]); if (r) return r; } }
  // common factor: integer content and minimum positive exponents
  var minE = null, g = 0n, ok = true, any = false;
  ks.forEach(function (key) {
    var t = p[key], fr = cesFrac(Math.abs(t.c)); if (!fr || fr.d !== 1) ok = false; else g = cesBigGcd(g, BigInt(fr.n));
    if (minE === null) { minE = {}; for (var a in t.m) minE[a] = t.m[a]; }
    else { for (var b in minE) { if (t.m[b] === undefined || t.m[b] <= 0) delete minE[b]; else minE[b] = Math.min(minE[b], t.m[b]); } }
  });
  for (k in minE) if (minE[k] <= 0) delete minE[k];
  var gnum = ok ? Number(g) : 1;
  if (ks.length > 1 && (gnum > 1 || Object.keys(minE).length)) {
    var neg = p[ks[0]].c < 0 && false, rem = {};
    ks.forEach(function (key) { var t = p[key], m = {}; for (var a in t.m) { var e = t.m[a] - (minE[a] || 0); if (e !== 0) m[a] = e; } rem[cesKey(m)] = { c: cesNum(t.c / gnum), m: m }; });
    var pre = (gnum > 1 ? String(gnum) : '') + Object.keys(minE).sort().map(function (a) { return cesAtomText(a, minE[a]); }).join('');
    return pre + '(' + cesPrint(rem) + ')';
  }
  return cesPrint(p);
}
function cesFactorNumber(v) {
  if (v !== Math.trunc(v) || Math.abs(v) < 2 || Math.abs(v) > 1e12) return ceFmtNum(v, { fmt: 'norm2' });
  var n = Math.abs(v), fs = [], f = 2;
  while (f * f <= n) { var c = 0; while (n % f === 0) { n /= f; c++; } if (c) fs.push(c > 1 ? f + '^' + c : String(f)); f += f === 2 ? 1 : 2; }
  if (n > 1) fs.push(String(n));
  return (v < 0 ? '-' : '') + (fs.length === 1 && fs[0] === String(Math.abs(v)) ? String(Math.abs(v)) + ' (prime)' : fs.join('×'));
}
// ----- derivative (tree) -----
function cesN(v) { return { k: 'n', v: v }; }
function cesMul() { return { k: 'mul', a: Array.prototype.slice.call(arguments) }; }
function cesAdd() { return { k: 'add', a: Array.prototype.slice.call(arguments) }; }
function cesPw(b, e) { return { k: 'pow', b: b, e: typeof e === 'number' ? cesN(e) : e }; }
function cesHas(nd, v) {
  if (nd.k === 'v') return nd.n === v;
  if (nd.k === 'n' || nd.k === 'c') return false;
  if (nd.k === 'add' || nd.k === 'mul') return nd.a.some(function (x) { return cesHas(x, v); });
  if (nd.k === 'pow') return cesHas(nd.b, v) || cesHas(nd.e, v);
  if (nd.k === 'fn') return cesHas(nd.a, v);
  return false;
}
function cesD(nd, v) {
  var i;
  switch (nd.k) {
    case 'n': case 'c': return cesN(0);
    case 'v': return cesN(nd.n === v ? 1 : 0);
    case 'add': return { k: 'add', a: nd.a.map(function (x) { return cesD(x, v); }) };
    case 'mul': {
      var terms = [];
      for (i = 0; i < nd.a.length; i++) { var fs = nd.a.slice(); fs[i] = cesD(nd.a[i], v); terms.push({ k: 'mul', a: fs }); }
      return { k: 'add', a: terms };
    }
    case 'pow': {
      var hb = cesHas(nd.b, v), he = cesHas(nd.e, v);
      if (!he) return cesMul(nd.e, cesPw(nd.b, cesAdd(nd.e, cesN(-1))), cesD(nd.b, v));
      if (!hb) {
        var lnb = (nd.b.k === 'c' && nd.b.n === 'e') ? cesN(1) : { k: 'fn', n: 'ln', a: nd.b };
        return cesMul(nd, lnb, cesD(nd.e, v));
      }
      return cesMul(nd, cesAdd(cesMul(cesD(nd.e, v), { k: 'fn', n: 'ln', a: nd.b }), cesMul(nd.e, cesD(nd.b, v), cesPw(nd.b, -1))));
    }
    case 'fn': {
      var a = nd.a, da = cesD(a, v), g;
      switch (nd.n) {
        case 'sin': g = { k: 'fn', n: 'cos', a: a }; break;
        case 'cos': g = cesMul(cesN(-1), { k: 'fn', n: 'sin', a: a }); break;
        case 'tan': g = cesPw({ k: 'fn', n: 'cos', a: a }, -2); break;
        case 'ln': g = cesPw(a, -1); break;
        case 'log': g = cesMul(cesPw(a, -1), cesN(1 / Math.LN10)); break;
        case 'exp': g = nd; break;
        case 'sqrt': g = cesMul(cesN(0.5), cesPw({ k: 'fn', n: 'sqrt', a: a }, -1)); break;
        case 'cbrt': g = cesMul(cesN(1 / 3), cesPw({ k: 'fn', n: 'cbrt', a: a }, -2)); break;
        case 'abs': g = cesMul(a, cesPw({ k: 'fn', n: 'abs', a: a }, -1)); break;
        case 'asin': g = cesPw({ k: 'fn', n: 'sqrt', a: cesAdd(cesN(1), cesMul(cesN(-1), cesPw(a, 2))) }, -1); break;
        case 'acos': g = cesMul(cesN(-1), cesPw({ k: 'fn', n: 'sqrt', a: cesAdd(cesN(1), cesMul(cesN(-1), cesPw(a, 2))) }, -1)); break;
        case 'atan': g = cesPw(cesAdd(cesN(1), cesPw(a, 2)), -1); break;
        default: throw ceErr('Math ERROR');
      }
      return cesMul(g, da);
    }
  }
  throw ceErr('Syntax ERROR');
}
function cesVarsOf(nd, acc) {
  if (nd.k === 'v') acc[nd.n] = 1;
  else if (nd.k === 'add' || nd.k === 'mul') nd.a.forEach(function (x) { cesVarsOf(x, acc); });
  else if (nd.k === 'pow') { cesVarsOf(nd.b, acc); cesVarsOf(nd.e, acc); }
  else if (nd.k === 'fn') cesVarsOf(nd.a, acc);
  return acc;
}
function cesPickVar(nd, given) {
  if (given) return given.toLowerCase().charAt(0);
  var vs = Object.keys(cesVarsOf(nd, {}));
  if (vs.length === 0) return 'x';
  return vs.indexOf('x') !== -1 ? 'x' : vs.sort()[0];
}
// ----- indefinite integral (term by term) -----
function cesIntegrate(p, v, reg) {
  var out = {}, k;
  for (k in p) {
    var t = p[k], ats = Object.keys(t.m), c = t.c;
    if (ats.length === 0) { out = pAdd(out, pMul(pConst(c), pAtom(v))); continue; }
    var others = ats.filter(function (a) { return a !== v && !cesIsFnAtom(a) && a.charAt(0) !== '('; });
    var fnAtoms = ats.filter(function (a) { return cesIsFnAtom(a) || a.charAt(0) === '('; });
    var cm = {}, vexp = t.m[v] || 0;
    others.forEach(function (a) { cm[a] = t.m[a]; });
    var coefPoly = {}; coefPoly[cesKey(cm)] = { c: c, m: cm };
    if (fnAtoms.length === 0) {
      var r;
      if (vexp === -1) r = pAtom('ln|' + v + '|'); else r = pAtom(v, vexp + 1);
      out = pAdd(out, pMul(coefPoly, vexp === -1 ? r : pMul(pConst(1 / (vexp + 1)), r)));
      continue;
    }
    if (fnAtoms.length === 1 && vexp === 0 && t.m[fnAtoms[0]] === 1 && reg[fnAtoms[0]]) {
      var info = reg[fnAtoms[0]], co = cesUniCoefs(info.arg, v);
      if (co && co.length === 2 && co[1] !== 0) {
        var A = co[1], argTxt = cesPrint(info.arg), res = null;
        if (info.n === 'sin') res = pMul(pConst(-1 / A), pAtom('cos(' + argTxt + ')'));
        else if (info.n === 'cos') res = pMul(pConst(1 / A), pAtom('sin(' + argTxt + ')'));
        else if (info.n === 'exp') res = pMul(pConst(1 / A), pAtom('exp(' + argTxt + ')'));
        else if (info.n === 'tan') res = pMul(pConst(-1 / A), pAtom('ln|cos(' + argTxt + ')|'));
        if (res) { out = pAdd(out, pMul(coefPoly, res)); continue; }
      }
    }
    throw ceErr("Can't integrate");
  }
  return out;
}
function cesSplitArgs(s) {
  var d = 0, parts = [], cur = '', i;
  for (i = 0; i < s.length; i++) { var ch = s.charAt(i); if (ch === '(' || ch === '[' || ch === '{') d++; if (ch === ')' || ch === ']' || ch === '}') d--; if (ch === ',' && d === 0) { parts.push(cur); cur = ''; } else cur += ch; }
  parts.push(cur); return parts;
}
function cesSimplify(src) {
  var nd = cesParse(src), reg = {};
  // rational function with one variable: cancel common linear roots
  var num = [], den = [];
  var top = nd.k === 'mul' ? nd.a : [nd];
  top.forEach(function (f) { if (f.k === 'pow') { var ev = cesConst(f.e); if (ev !== null && ev === Math.trunc(ev) && ev < 0) { den.push(cesPw(f.b, -ev)); return; } } num.push(f); });
  if (den.length) {
    var N = cesToPoly({ k: 'mul', a: num.length ? num : [cesN(1)] }, reg), D = cesToPoly({ k: 'mul', a: den }, reg);
    var vs = {}; [N, D].forEach(function (P) { Object.keys(P).forEach(function (kk) { for (var a in P[kk].m) vs[a] = 1; }); });
    var vn = Object.keys(vs);
    if (vn.length === 1 && /^[a-z]$/.test(vn[0])) {
      var cN = cesUniCoefs(N, vn[0]), cD = cesUniCoefs(D, vn[0]);
      if (cN && cD) {
        var rN = cesRoots(cN), rD = cesRoots(cD);
        if (rN && rD) {
          var changed = false, i;
          for (i = 0; i < rN.roots.length; i++) { var j = rD.roots.indexOf(rN.roots[i]); if (j !== -1) { rN.roots.splice(i, 1); rD.roots.splice(j, 1); i--; changed = true; } }
          if (changed) {
            function build(R) { var pp = pConst(R.k); R.roots.forEach(function (rt) { var fr = cesFrac(rt), m = {}; m[vn[0]] = 1; var lin = {}; lin[cesKey(m)] = { c: fr.d, m: m }; lin = pAdd(lin, pConst(-fr.n)); pp = pMul(pp, lin); }); return pp; }
            var bn = build(rN), bd = build(rD);
            if (pIsConst(bd)) return cesPrint(pMul(bn, pConst(1 / pConstVal(bd))));
            function wr(P) { return Object.keys(P).length > 1 ? '(' + cesPrint(P) + ')' : cesPrint(P); }
            return wr(bn) + '/' + wr(bd);
          }
        }
      }
    }
  }
  return cesPrint(cesToPoly(nd, reg));
}
function cesRoots(co) {
  // rational roots (with multiplicity) of low-to-high coefficient array; returns {k: leading scale, roots:[...]} (only if fully split)
  var a = co.slice(); while (a.length > 1 && a[a.length - 1] === 0) a.pop();
  var roots = [], zeros = 0; while (a.length > 1 && a[0] === 0) { a.shift(); zeros++; }
  for (var z = 0; z < zeros; z++) roots.push(0);
  var lead = a[a.length - 1], guard = 0;
  while (a.length > 2 && guard++ < 30) {
    var found = false, n = a.length - 1, ia = a.map(function (x) { return Math.round(x * 1000000); });
    var ps = cesDivisors(BigInt(Math.abs(ia[0]) || 1)), qs = cesDivisors(BigInt(Math.abs(ia[n]) || 1)), pi, qi, sg;
    outer:
    for (pi = 0; pi < ps.length; pi++) for (qi = 0; qi < qs.length; qi++) for (sg = -1; sg <= 1; sg += 2) {
      var r = sg * ps[pi] / qs[qi], val = 0, k;
      for (k = n; k >= 0; k--) val = val * r + a[k];
      if (Math.abs(val) < 1e-9) {
        var hi = a.slice().reverse(), res = [hi[0]], z2;
        for (z2 = 1; z2 < hi.length - 1; z2++) res.push(hi[z2] + res[z2 - 1] * r);
        a = res.reverse(); roots.push(cesNum(r)); found = true; break outer;
      }
    }
    if (!found) return null;
  }
  if (a.length === 2) roots.push(cesNum(-a[0] / a[1]));
  else if (a.length > 2) return null;
  return { k: lead, roots: roots.map(function (x) { return x; }) };
}
function cesOut(t) { return t.replace(/exp\(([^()]*)\)/g, 'e^($1)'); }
function ceSymRun(fn, argText) { return cesOut(ceSymRun0(fn, argText)); }
function ceSymRun0(fn, argText) {
  var parts = cesSplitArgs(argText), reg = {}, nd, p, v;
  if (fn === 'expand') { nd = cesParse(parts[0]); return cesPrint(cesToPoly(nd, reg)); }
  if (fn === 'factor') { nd = cesParse(parts[0]); return cesFactorPoly(cesToPoly(nd, reg)); }
  if (fn === 'simplify') return cesSimplify(parts[0]);
  if (fn === 'diff') {
    nd = cesParse(parts[0]); v = cesPickVar(nd, parts[1] ? parts[1].trim() : '');
    return cesPrint(cesToPoly(cesD(nd, v), reg));
  }
  if (fn === 'sint') {
    nd = cesParse(parts[0]); v = cesPickVar(nd, parts[1] ? parts[1].trim() : '');
    p = cesToPoly(nd, reg);
    return cesPrint(cesIntegrate(p, v, reg)) + ' + C';
  }
  throw ceErr('Syntax ERROR');
}

// ---------- extra matrix tools ----------
function ceMatRref(A) {
  var M = A.map(function (r) { return r.slice(); }), rows = M.length, cols = M[0].length, r = 0, c, i, j, piv = [];
  for (c = 0; c < cols && r < rows; c++) {
    var p = r; for (i = r + 1; i < rows; i++) if (Math.abs(M[i][c]) > Math.abs(M[p][c])) p = i;
    if (Math.abs(M[p][c]) < 1e-10) continue;
    var t = M[r]; M[r] = M[p]; M[p] = t;
    var pv = M[r][c]; for (j = 0; j < cols; j++) M[r][j] /= pv;
    for (i = 0; i < rows; i++) if (i !== r) { var f = M[i][c]; if (f !== 0) for (j = 0; j < cols; j++) M[i][j] -= f * M[r][j]; }
    piv.push(c); r++;
  }
  return { m: M.map(function (row) { return row.map(ceMatSnap); }), piv: piv };
}
function ceMatRank(A) { return ceMatRref(A).piv.length; }
function ceMatTrace(A) { if (A.some(function (r) { return r.length !== A.length; })) throw ceErr('Dimension ERROR'); return ceMatSnap(A.reduce(function (s, r, i) { return s + r[i]; }, 0)); }
function ceMatEigen(A) {
  var n = A.length, i, j, k;
  if (A.some(function (r) { return r.length !== n; })) throw ceErr('Dimension ERROR');
  var I = function (c) { return A.map(function (r, a) { return r.map(function (_, b) { return a === b ? c : 0; }); }); };
  var Mk = A.map(function (r) { return r.map(function () { return 0; }); }), co = [1], ck = 1;
  for (k = 1; k <= n; k++) {
    var AM = ceMatMul(A, Mk); Mk = AM.map(function (r, a) { return r.map(function (v, b) { return v + (a === b ? ck : 0); }); });
    var AMk = ceMatMul(A, Mk), tr = 0; for (i = 0; i < n; i++) tr += AMk[i][i];
    ck = -tr / k; co.push(ck);
  }
  var roots = n === 1 ? [cMk(A[0][0], 0)] : ceRoots(co.map(function (x) { return Math.abs(x) < 1e-12 ? 0 : x; }));
  var vecs = roots.map(function (lam) {
    if (cIm(lam) !== 0) return null;
    var l = cRe(lam), B = A.map(function (r, a) { return r.map(function (v, b) { return v - (a === b ? l : 0); }); });
    var rr = ceMatRref(B.map(function (r) { return r.map(function (v) { return Math.abs(v) < 1e-12 ? 0 : v; }); }));
    var free = -1; for (j = 0; j < n; j++) if (rr.piv.indexOf(j) === -1) { free = j; break; }
    if (free < 0) return null;
    var v = []; for (j = 0; j < n; j++) v.push(0); v[free] = 1;
    rr.piv.forEach(function (pc, row) { v[pc] = -rr.m[row][free]; });
    var nm = Math.sqrt(v.reduce(function (s, x) { return s + x * x; }, 0)); return v.map(function (x) { return ceMatSnap(x / nm); });
  });
  return { vals: roots, vecs: vecs };
}
