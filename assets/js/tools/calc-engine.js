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
  'sum', 'prod', 'deriv', 'integ', 'ranint#', 'ran#', 'conj', 'arg', 're', 'im', 'ans', 'preans', 'pi', 'mod', 'ncr', 'npr', 'neg']
  .sort(function (a, b) { return b.length - a.length; });
var CE_ALIAS = { arcsin: 'asin', arccos: 'acos', arctan: 'atan' };
var CE_VARS = 'ABCDEFMXY';
var CE_CONST = { pi: 1, ans: 1, preans: 1 };
var CE_WORD = { mod: 1, ncr: 1, npr: 1 };

function ceNormalize(t) {
  return String(t).replace(/×|·|⋅/g, '*').replace(/÷/g, '/').replace(/[−–—]/g, '-').replace(/π/g, 'pi')
    .replace(/√/g, 'sqrt').replace(/∛/g, 'cbrt').replace(/²/g, '^2').replace(/³/g, '^3').replace(/⁻¹/g, '^-1')
    .replace(/′/g, "'").replace(/″/g, '"').replace(/∫/g, 'integ').replace(/Σ/g, 'sum').replace(/Π/g, 'prod')
    .replace(/θ/g, 'Y');
}
function ceTokenize(text) {
  var s = ceNormalize(text), out = [], i = 0, m;
  while (i < s.length) {
    var ch = s.charAt(i);
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      m = /^(?:\d+\.?\d*|\.\d+)(?:E[+-]?\d+)?/.exec(s.slice(i));
      if (!m || s.charAt(i + m[0].length) === '.') throw ceErr('Syntax ERROR');
      var nv = Number(m[0]); if (!isFinite(nv)) throw ceErr('Math ERROR');
      out.push({ t: 'num', v: nv }); i += m[0].length; continue;
    }
    if (/[A-Za-z]/.test(ch)) {
      var low = s.slice(i).toLowerCase(), found = null, k;
      for (k = 0; k < CE_NAMES.length; k++) if (low.indexOf(CE_NAMES[k]) === 0) { found = CE_NAMES[k]; break; }
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
    if ('+-*/^()!%,=⌟°\'"∠→'.indexOf(ch) !== -1) { out.push({ t: 'op', v: ch }); i++; continue; }
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
      pos++; enter(); var e = add(); leave(); expectClose();
      return e;
    }
    if (t.t === 'func') {
      pos++;
      if (isOp(pk(), '(')) {
        pos++; enter(); var args = [];
        if (!isOp(pk(), ')')) {
          args.push(add());
          while (isOp(pk(), ',')) { pos++; args.push(add()); }
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
  var node = add();
  if (isOp(pk(), '=')) { pos++; node = { t: 'eq', a: node, b: add() }; }
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
function ceReal(v) { if (cIs(v)) throw ceErr('Math ERROR'); if (v && v.list) throw ceErr('Math ERROR'); return v; }
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
        case 'ncr': return ceNcr(ceReal(a), ceReal(b));
        case 'npr': return ceNpr(ceReal(a), ceReal(b));
      }
      throw ceErr('Syntax ERROR');
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
  if (st.math !== false && !st.fmt_override) { var ex = ceExact(v, st); if (ex) return ex; }
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
