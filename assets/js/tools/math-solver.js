// Fixlytools - Math Solver
// Plain JavaScript, no libraries. Exact arithmetic uses BigInt fractions; user input is only ever read by the parser below.

class MsError extends Error {
  constructor(message, hint) { super(message); this.name = 'MsError'; this.hint = hint || ''; }
}

const MS_MAX_INPUT = 600;
const MS_MAX_DEPTH = 120;

// ---------------------------------------------------------------- exact fractions (BigInt)
function msGcd(a, b) {
  if (a < 0n) a = -a;
  if (b < 0n) b = -b;
  while (b) { const t = a % b; a = b; b = t; }
  return a;
}
function msFrac(n, d) {
  n = BigInt(n); d = d === undefined ? 1n : BigInt(d);
  if (d === 0n) throw new MsError('Division by zero');
  if (d < 0n) { n = -n; d = -d; }
  const g = msGcd(n, d);
  if (g > 1n) { n /= g; d /= g; }
  return { n, d };
}
const msfAdd = (a, b) => msFrac(a.n * b.d + b.n * a.d, a.d * b.d);
const msfSub = (a, b) => msFrac(a.n * b.d - b.n * a.d, a.d * b.d);
const msfMul = (a, b) => msFrac(a.n * b.n, a.d * b.d);
const msfDiv = (a, b) => { if (b.n === 0n) throw new MsError('Division by zero'); return msFrac(a.n * b.d, a.d * b.n); };
const msfNeg = (a) => ({ n: -a.n, d: a.d });
const msfCmp = (a, b) => { const l = a.n * b.d, r = b.n * a.d; return l < r ? -1 : l > r ? 1 : 0; };
const msfIsZero = (a) => a.n === 0n;
const msfIsInt = (a) => a.d === 1n;
const msfIsOne = (a) => a.n === 1n && a.d === 1n;
const msfSign = (a) => (a.n < 0n ? -1 : a.n > 0n ? 1 : 0);
const msfAbs = (a) => (a.n < 0n ? { n: -a.n, d: a.d } : a);
const MS_ZERO = { n: 0n, d: 1n }, MS_ONE = { n: 1n, d: 1n };
function msfPow(a, k) {            // k is a JS integer
  if (k === 0) return MS_ONE;
  if (k < 0) return msfPow(msfDiv(MS_ONE, a), -k);
  let result = MS_ONE, base = a, e = k;
  while (e > 0) { if (e & 1) result = msfMul(result, base); e = Math.floor(e / 2); if (e) base = msfMul(base, base); }
  return result;
}
function msfToNum(a) {
  const n = Number(a.n), d = Number(a.d);
  if (Number.isFinite(n) && Number.isFinite(d)) return n / d;
  const q = (a.n * 10n ** 30n) / a.d;
  return Number(q) / 1e30;
}
function msfFromString(s) {       // "12", "3.25", ".5", "1e-3"
  const m = /^(\d*)\.?(\d*)(?:[eE]([+-]?\d+))?$/.exec(s);
  if (!m || (m[1] === '' && m[2] === '')) throw new MsError('I could not read the number "' + s + '"');
  let n = BigInt((m[1] || '') + (m[2] || '') || '0');
  let d = 10n ** BigInt((m[2] || '').length);
  if (m[3] !== undefined) {
    const e = parseInt(m[3], 10);
    if (Math.abs(e) > 300) throw new MsError('That number is too large or too small');
    if (e >= 0) n *= 10n ** BigInt(e); else d *= 10n ** BigInt(-e);
  }
  return msFrac(n, d);
}
function msfStr(a) { return a.d === 1n ? a.n.toString() : a.n.toString() + '/' + a.d.toString(); }
// integer n-th root of a non-negative BigInt, or null when it is not a perfect power
function msIntRoot(x, k) {
  if (x < 0n) return null;
  if (x < 2n) return x;
  let lo = 1n, hi = 1n;
  while (hi ** BigInt(k) <= x) hi *= 2n;
  lo = hi / 2n;
  while (lo < hi) {
    const mid = (lo + hi + 1n) / 2n;
    if (mid ** BigInt(k) <= x) lo = mid; else hi = mid - 1n;
  }
  return lo ** BigInt(k) === x ? lo : null;
}

// ---------------------------------------------------------------- input cleaning
const MS_SUPER = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-' };
function msNormalize(text, opts) {
  const keepBrackets = !!(opts && opts.keepBrackets);
  let s = String(text === undefined || text === null ? '' : text);
  s = s.replace(/[\u0660-\u0669]/g, c => String(c.charCodeAt(0) - 0x0660));      // Arabic-Indic digits
  s = s.replace(/[\u06F0-\u06F9]/g, c => String(c.charCodeAt(0) - 0x06F0));      // Urdu / Persian digits
  s = s.replace(/[\u0966-\u096F]/g, c => String(c.charCodeAt(0) - 0x0966));      // Devanagari digits
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, m => '^' + m.split('').map(c => MS_SUPER[c]).join(''));
  s = s.replace(/[\u2212\u2013\u2014]/g, '-');
  s = s.replace(/[\u00D7\u00B7\u22C5\u2219]/g, '*');
  s = s.replace(/[\u00F7\u2215]/g, '/');
  s = s.replace(/\u060C/g, ',').replace(/\u066B/g, '.').replace(/\u061B/g, ';');
  s = s.replace(/\u03C0/g, 'pi');
  s = s.replace(/\u221A\s*(\d+\.?\d*|[A-Za-z])/g, 'sqrt($1)').replace(/\u221A/g, 'sqrt');
  s = s.normalize('NFKC');
  s = s.replace(/\u2044/g, '/').replace(/\*\*/g, '^').replace(/\uFF1D/g, '=');
  if (!keepBrackets) s = s.replace(/[\[{]/g, '(').replace(/[\]}]/g, ')');
  return s.replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------- tokens
const MS_FUNCS = ['asinh', 'acosh', 'atanh', 'arcsin', 'arccos', 'arctan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'sqrt', 'cbrt', 'sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'abs', 'exp', 'log', 'ln'];
const MS_UNSUPPORTED = ['floor', 'ceil', 'round', 'mod', 'max', 'min', 'gcd', 'lcm', 'sign', 'sgn', 'det', 'inv', 'sum', 'prod', 'integral', 'lim', 'limit', 'infinity', 'inf', 'sigma'];
const MS_FUNC_ALIAS = { arcsin: 'asin', arccos: 'acos', arctan: 'atan' };

function msTokenize(s) {
  const toks = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === ' ') { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      const m = /^(\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(s.slice(i));
      if (!m) throw new MsError('I could not read a number near "' + s.slice(i, i + 6) + '"');
      toks.push({ k: 'num', v: m[0] });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z]/.test(ch)) {
      const run = /^[A-Za-z]+/.exec(s.slice(i))[0];
      for (const bad of MS_UNSUPPORTED) {
        if (run.toLowerCase().includes(bad) && run.length <= bad.length + 1) throw new MsError('"' + bad + '" is not supported here', 'Use the question types in the menu instead.');
      }
      let j = 0;
      while (j < run.length) {
        let hit = null;
        for (const f of MS_FUNCS) { if (run.startsWith(f, j)) { hit = f; break; } }
        if (hit) { toks.push({ k: 'fn', v: MS_FUNC_ALIAS[hit] || hit }); j += hit.length; }
        else if (run.startsWith('pi', j)) { toks.push({ k: 'const', v: 'pi' }); j += 2; }
        else if (run[j] === 'e') { toks.push({ k: 'const', v: 'e' }); j++; }
        else { toks.push({ k: 'var', v: run[j] }); j++; }
      }
      i += run.length;
      continue;
    }
    if ('+-*/^!(),=\u00B0;'.includes(ch)) { toks.push({ k: 'op', v: ch }); i++; continue; }
    throw new MsError('I did not understand the character "' + ch + '"');
  }
  return toks;
}

// ---------------------------------------------------------------- syntax tree
const msNum = (f) => ({ t: 'num', f });
const msInt = (n) => ({ t: 'num', f: msFrac(BigInt(n), 1n) });
const msVar = (name) => ({ t: 'var', name });
const msConst = (name) => ({ t: 'const', name });
const msNegN = (a) => ({ t: 'neg', a });
const msBin = (op, a, b) => ({ t: 'bin', op, a, b });
const msAdd = (a, b) => msBin('+', a, b);
const msMulN = (a, b) => msBin('*', a, b);
const msDivN = (a, b) => msBin('/', a, b);
const msPowN = (a, b) => msBin('^', a, b);
const msFn = (name, arg) => ({ t: 'fn', name, a: arg });

function msParseTokens(toks) {
  let pos = 0, depth = 0;
  const peek = () => toks[pos];
  const isOp = (v) => toks[pos] && toks[pos].k === 'op' && toks[pos].v === v;
  const startsPrimary = () => { const t = toks[pos]; return !!t && (t.k === 'num' || t.k === 'var' || t.k === 'const' || t.k === 'fn' || (t.k === 'op' && t.v === '(')); };
  const enter = () => { if (++depth > MS_MAX_DEPTH) throw new MsError('This expression is nested too deeply'); };
  const leave = () => { depth--; };

  function parseAdd() {
    enter();
    let left = parseMul();
    while (isOp('+') || isOp('-')) {
      const op = toks[pos++].v;
      const right = parseMul();
      left = op === '+' ? msAdd(left, right) : msAdd(left, msNegN(right));
    }
    leave();
    return left;
  }
  function parseMul() {
    let left = parseUnary();
    for (;;) {
      if (isOp('*')) { pos++; left = msMulN(left, parseUnary()); }
      else if (isOp('/')) { pos++; left = msDivN(left, parseUnary()); }
      else if (startsPrimary()) left = msMulN(left, parseUnary());          // implicit multiplication: 2x, x(x+1), 3sin(x)
      else break;
    }
    return left;
  }
  function parseUnary() {
    if (isOp('-')) { pos++; enter(); const r = msNegN(parseUnary()); leave(); return r; }
    if (isOp('+')) { pos++; return parseUnary(); }
    return parsePower();
  }
  function parsePower() {
    const base = parsePostfix();
    if (isOp('^')) {
      pos++;
      enter();
      const exp = parseExponent();
      leave();
      return msPowN(base, exp);
    }
    return base;
  }
  function parseExponent() {
    if (isOp('-')) { pos++; return msNegN(parseExponent()); }
    if (isOp('+')) { pos++; return parseExponent(); }
    return parsePower();
  }
  function parsePostfix() {
    let node = parsePrimary();
    for (;;) {
      if (isOp('!')) { pos++; node = msFn('fact', node); }
      else if (isOp('\u00B0')) { pos++; node = msMulN(node, msDivN(msConst('pi'), msInt(180))); }
      else break;
    }
    return node;
  }
  function parsePrimary() {
    const t = peek();
    if (!t) throw new MsError('The expression ends too early', 'Something is missing at the end.');
    if (t.k === 'num') { pos++; return msNum(msfFromString(t.v)); }
    if (t.k === 'var') { pos++; return msVar(t.v); }
    if (t.k === 'const') { pos++; return msConst(t.v); }
    if (t.k === 'fn') {
      pos++;
      if (!isOp('(')) throw new MsError('Write the brackets after "' + t.v + '"', 'For example ' + t.v + '(x).');
      pos++;
      const arg = parseAdd();
      if (isOp(',')) throw new MsError('"' + t.v + '" takes one value only');
      if (!isOp(')')) throw new MsError('A closing bracket is missing');
      pos++;
      return msBuildFn(t.v, arg);
    }
    if (t.k === 'op' && t.v === '(') {
      pos++;
      const inner = parseAdd();
      if (!isOp(')')) throw new MsError('A closing bracket is missing');
      pos++;
      return inner;
    }
    if (t.k === 'op' && t.v === ')') throw new MsError('There is a closing bracket without an opening one');
    throw new MsError('I did not expect "' + t.v + '" here');
  }

  const result = parseAdd();
  if (pos < toks.length) {
    const t = toks[pos];
    if (t.k === 'op' && t.v === ')') throw new MsError('There is a closing bracket without an opening one');
    throw new MsError('I could not understand the part starting at "' + t.v + '"');
  }
  return result;
}

// exp(u) is stored as e^u, sec/csc/cot are rewritten with sin and cos so every later step works on one set of functions
function msBuildFn(name, arg) {
  if (name === 'exp') return msPowN(msConst('e'), arg);
  if (name === 'sec') return msDivN(msInt(1), msFn('cos', arg));
  if (name === 'csc') return msDivN(msInt(1), msFn('sin', arg));
  if (name === 'cot') return msDivN(msFn('cos', arg), msFn('sin', arg));
  return msFn(name, arg);
}

function msParse(text) {
  const s = msNormalize(text);
  if (s === '') throw new MsError('Please type something first');
  if (s.length > MS_MAX_INPUT) throw new MsError('That is too long', 'Please keep it under ' + MS_MAX_INPUT + ' characters.');
  return msParseTokens(msTokenize(s));
}

// ---------------------------------------------------------------- printing
const MS_SUP_OUT = { 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
function msIsAtomic(n) { return n.t === 'var' || n.t === 'const' || n.t === 'fn' || (n.t === 'num' && msfIsInt(n.f) && n.f.n >= 0n); }
function msConstText(name) { return name === 'pi' ? 'π' : name; }

// precedence: 1 sum, 2 product, 3 negation/power base, 4 atom
function msPrint(n, ctx) {
  const c = ctx || 0;
  const wrap = (txt, p) => (p < c ? '(' + txt + ')' : txt);
  switch (n.t) {
    case 'num': {
      const f = n.f;
      if (f.d === 1n) return f.n < 0n ? wrap(f.n.toString(), 3) : f.n.toString();
      return wrap(f.n.toString() + '/' + f.d.toString(), 2.5);
    }
    case 'var': return n.name;
    case 'const': return msConstText(n.name);
    case 'neg': return wrap('-' + msPrint(n.a, 2), 2);
    case 'fn': {
      if (n.name === 'fact') return msPrint(n.a, 4) + '!';
      return n.name + '(' + msPrint(n.a, 0) + ')';
    }
    case 'bin': {
      if (n.op === '+') {
        let out = msPrint(n.a, 1);
        const rhs = n.b;
        if (rhs.t === 'neg') out += ' - ' + msPrint(rhs.a, 2);
        else if (rhs.t === 'num' && rhs.f.n < 0n) out += ' - ' + msPrint(msNum(msfNeg(rhs.f)), 2);
        else out += ' + ' + msPrint(rhs, 1.5);
        return wrap(out, 1);
      }
      if (n.op === '*') return wrap(msPrintProduct(n), 2);
      if (n.op === '/') return wrap(msPrint(n.a, 2) + '/' + msPrint(n.b, 3), 2);
      if (n.op === '^') {
        if (n.b.t === 'num' && n.b.f.n === 1n && n.b.f.d === 2n) return 'sqrt(' + msPrint(n.a, 0) + ')';
        const base = msPrint(n.a, 3.5);
        if (n.b.t === 'num' && msfIsInt(n.b.f) && n.b.f.n >= 2n && n.b.f.n <= 9n && (n.a.t === 'var' || n.a.t === 'const' || (n.a.t === 'num' && msfIsInt(n.a.f) && n.a.f.n >= 0n) || base.startsWith('('))) {
          return base + MS_SUP_OUT[Number(n.b.f.n)];
        }
        const exp = msPrint(n.b, 3.5);
        return wrap(base + '^' + (msIsAtomic(n.b) ? exp : exp.startsWith('(') ? exp : '(' + exp + ')'), 3);
      }
    }
  }
  return '?';
}
function msFlattenProduct(n, out) {
  if (n.t === 'bin' && n.op === '*') { msFlattenProduct(n.a, out); msFlattenProduct(n.b, out); } else out.push(n);
  return out;
}
function msPrintProduct(n) {
  const factors = msFlattenProduct(n, []);
  const parts = factors.map(f => msPrint(f, 2.5));
  let out = parts[0];
  for (let i = 1; i < factors.length; i++) {
    const prev = factors[i - 1], cur = factors[i];
    const prevNumber = prev.t === 'num' && msfIsInt(prev.f);
    const curSimple = cur.t === 'var' || cur.t === 'const' || cur.t === 'fn' || cur.t === 'bin';
    const bothLetters = (prev.t === 'var' || prev.t === 'const') && (cur.t === 'var' || cur.t === 'const');
    const groupAfterGroup = parts[i].startsWith('(') && prev.t !== 'fn' && prev.t !== 'num';
    const glue = (prevNumber && curSimple && !(cur.t === 'num')) || bothLetters || groupAfterGroup;
    out += (glue ? '' : '*') + parts[i];
  }
  return out;
}

if (typeof module !== 'undefined') {
  module.exports = Object.assign(module.exports || {}, {
    MsError, msGcd, msFrac, msfAdd, msfSub, msfMul, msfDiv, msfNeg, msfCmp, msfIsZero, msfIsInt, msfPow, msfToNum, msfFromString, msfStr, msIntRoot,
    msNormalize, msTokenize, msParse, msPrint
  });
}

// ================================================================= polynomials (many letters and "atoms")
// An atom is a function call or a non-integer power such as sin(x) or sqrt(x): inside the algebra it behaves like one more letter.
const msMonoKey = (m) => m.map(x => x[0] + '^' + x[1]).join('\u0001');
function msPNew() { return { terms: new Map() }; }
function msPAddTerm(p, m, c) {
  if (msfIsZero(c)) return;
  const k = msMonoKey(m);
  const cur = p.terms.get(k);
  if (!cur) { p.terms.set(k, { c, m }); return; }
  const s = msfAdd(cur.c, c);
  if (msfIsZero(s)) p.terms.delete(k); else cur.c = s;
}
function msPConst(f) { const p = msPNew(); msPAddTerm(p, [], f); return p; }
function msPVarP(name) { const p = msPNew(); msPAddTerm(p, [[name, 1]], MS_ONE); return p; }
const msPIsZero = (p) => p.terms.size === 0;
function msPAsConst(p) {
  if (p.terms.size === 0) return MS_ZERO;
  if (p.terms.size === 1) { const t = p.terms.values().next().value; if (t.m.length === 0) return t.c; }
  return null;
}
function msPAdd(a, b) { const r = msPNew(); a.terms.forEach(t => msPAddTerm(r, t.m, t.c)); b.terms.forEach(t => msPAddTerm(r, t.m, t.c)); return r; }
function msPNeg(a) { const r = msPNew(); a.terms.forEach(t => msPAddTerm(r, t.m, msfNeg(t.c))); return r; }
function msPSub(a, b) { return msPAdd(a, msPNeg(b)); }
function msPScale(a, f) { const r = msPNew(); a.terms.forEach(t => msPAddTerm(r, t.m, msfMul(t.c, f))); return r; }
function msMonoMul(m1, m2) {
  const map = new Map();
  m1.forEach(x => map.set(x[0], (map.get(x[0]) || 0) + x[1]));
  m2.forEach(x => map.set(x[0], (map.get(x[0]) || 0) + x[1]));
  return Array.from(map.entries()).sort(msNameOrder);
}
// pi first, then single letters, then function-like atoms
const msNameRank = (n) => (n === '\u03C0' ? 0 : /^[A-Za-z]$/.test(n) ? 1 : 2);
function msNameOrder(p, q) {
  const a = msNameRank(p[0]), b = msNameRank(q[0]);
  if (a !== b) return a - b;
  return p[0] < q[0] ? -1 : p[0] > q[0] ? 1 : 0;
}
function msPMul(a, b) {
  if (a.terms.size * b.terms.size > 40000) throw new MsError('That expression is too big to expand');
  const r = msPNew();
  a.terms.forEach(x => b.terms.forEach(y => msPAddTerm(r, msMonoMul(x.m, y.m), msfMul(x.c, y.c))));
  return r;
}
function msPPow(a, k) {
  let result = msPConst(MS_ONE), base = a, e = k;
  while (e > 0) { if (e & 1) result = msPMul(result, base); e = Math.floor(e / 2); if (e) base = msPMul(base, base); }
  return result;
}
function msPVars(p) { const s = new Set(); p.terms.forEach(t => t.m.forEach(x => s.add(x[0]))); return s; }
function msPDegIn(p, name) { let d = 0; p.terms.forEach(t => t.m.forEach(x => { if (x[0] === name && x[1] > d) d = x[1]; })); return d; }
function msPTotalDeg(p) { let d = 0; p.terms.forEach(t => { const s = t.m.reduce((a, x) => a + x[1], 0); if (s > d) d = s; }); return d; }
// coefficients of a polynomial in one chosen letter: result[k] is a polynomial (in the other letters) multiplying name^k
function msPCoeffsIn(p, name) {
  const deg = msPDegIn(p, name), out = [];
  for (let i = 0; i <= deg; i++) out.push(msPNew());
  p.terms.forEach(t => {
    let e = 0; const rest = [];
    t.m.forEach(x => { if (x[0] === name) e = x[1]; else rest.push(x); });
    msPAddTerm(out[e], rest, t.c);
  });
  return out;
}
function msPFromCoeffsIn(arr, name) {
  let r = msPNew();
  arr.forEach((c, i) => { r = msPAdd(r, msPMul(c, i === 0 ? msPConst(MS_ONE) : msPPow(msPVarP(name), i))); });
  return r;
}
function msPContent(p) {          // rational content: gcd of numerators over lcm of denominators
  let g = 0n, l = 1n;
  p.terms.forEach(t => { g = msGcd(g, t.c.n); l = (l / msGcd(l, t.c.d)) * t.c.d; });
  return g === 0n ? MS_ONE : msFrac(g, l);
}
function msPMonoGcd(p) {          // largest common monomial: [[name, exp], ...]
  let common = null;
  p.terms.forEach(t => {
    const mp = new Map(t.m);
    if (common === null) common = mp;
    else common.forEach((e, k) => { const o = mp.get(k) || 0; if (o < e) { if (o === 0) common.delete(k); else common.set(k, o); } });
  });
  return common ? Array.from(common.entries()).sort() : [];
}
function msPDivMono(p, m) {
  if (!m.length) return p;
  const mm = new Map(m), r = msPNew();
  p.terms.forEach(t => { const nm = []; t.m.forEach(x => { const e = x[1] - (mm.get(x[0]) || 0); if (e > 0) nm.push([x[0], e]); }); msPAddTerm(r, nm, t.c); });
  return r;
}
// display order: higher total degree first, then letters alphabetically with higher powers first
function msPSortedTerms(p) {
  const arr = Array.from(p.terms.values());
  const deg = (t) => t.m.reduce((a, x) => a + x[1], 0);
  arr.sort((a, b) => {
    const da = deg(a), db = deg(b);
    if (da !== db) return db - da;
    const n = Math.max(a.m.length, b.m.length);
    for (let i = 0; i < n; i++) {
      const x = a.m[i], y = b.m[i];
      if (!x) return 1;
      if (!y) return -1;
      if (x[0] !== y[0]) return msNameOrder(x, y);
      if (x[1] !== y[1]) return y[1] - x[1];
    }
    return 0;
  });
  return arr;
}
function msPLeadSign(p) { const t = msPSortedTerms(p)[0]; return t ? msfSign(t.c) : 0; }

// ----------------------------------------------------------------- univariate arrays of fractions (index = power)
function msUTrim(a) { while (a.length && msfIsZero(a[a.length - 1])) a.pop(); return a; }
function msUAdd(a, b) { const n = Math.max(a.length, b.length), r = []; for (let i = 0; i < n; i++) r.push(msfAdd(a[i] || MS_ZERO, b[i] || MS_ZERO)); return msUTrim(r); }
function msUSub(a, b) { const n = Math.max(a.length, b.length), r = []; for (let i = 0; i < n; i++) r.push(msfSub(a[i] || MS_ZERO, b[i] || MS_ZERO)); return msUTrim(r); }
function msUMul(a, b) { if (!a.length || !b.length) return []; const r = new Array(a.length + b.length - 1).fill(MS_ZERO); a.forEach((x, i) => b.forEach((y, j) => { r[i + j] = msfAdd(r[i + j], msfMul(x, y)); })); return msUTrim(r); }
function msUScale(a, f) { return msUTrim(a.map(x => msfMul(x, f))); }
function msUDivMod(a, b) {
  if (!b.length) throw new MsError('Division by zero');
  let r = a.slice(); const q = new Array(Math.max(0, a.length - b.length + 1)).fill(MS_ZERO);
  const lead = b[b.length - 1];
  while (r.length >= b.length && r.length) {
    const k = r.length - b.length, f = msfDiv(r[r.length - 1], lead);
    q[k] = f;
    for (let i = 0; i < b.length; i++) r[i + k] = msfSub(r[i + k], msfMul(f, b[i]));
    r = msUTrim(r);
    if (r.length === a.length) break;
  }
  return [msUTrim(q), msUTrim(r)];
}
function msUMonic(a) { return a.length ? msUScale(a, msfDiv(MS_ONE, a[a.length - 1])) : a; }
function msUGcd(a, b) { a = msUTrim(a.slice()); b = msUTrim(b.slice()); while (b.length) { const r = msUDivMod(a, b)[1]; a = b; b = r; } return msUMonic(a); }
function msUDeriv(a) { return msUTrim(a.slice(1).map((c, i) => msfMul(c, msFrac(BigInt(i + 1))))); }
function msUEval(a, x) { let r = MS_ZERO; for (let i = a.length - 1; i >= 0; i--) r = msfAdd(msfMul(r, x), a[i]); return r; }
function msUEvalNum(a, x) { let r = 0; for (let i = a.length - 1; i >= 0; i--) r = r * x + msfToNum(a[i]); return r; }
function msUToInts(a) {             // scale so all coefficients are integers with gcd 1 (sign kept)
  let l = 1n; a.forEach(c => { l = (l / msGcd(l, c.d)) * c.d; });
  const ints = a.map(c => c.n * (l / c.d));
  let g = 0n; ints.forEach(c => { g = msGcd(g, c); });
  return { ints: g > 1n ? ints.map(c => c / g) : ints, factor: msFrac(g === 0n ? 1n : g, l) };
}
function msPToUni(p, name) {
  const out = [];
  let ok = true;
  p.terms.forEach(t => {
    if (!ok) return;
    if (t.m.length === 0) { out[0] = msfAdd(out[0] || MS_ZERO, t.c); return; }
    if (t.m.length === 1 && t.m[0][0] === name) { const e = t.m[0][1]; out[e] = msfAdd(out[e] || MS_ZERO, t.c); return; }
    ok = false;
  });
  if (!ok) return null;
  for (let i = 0; i < out.length; i++) if (!out[i]) out[i] = MS_ZERO;
  return msUTrim(out);
}
function msUToP(a, name) { const p = msPNew(); a.forEach((c, i) => msPAddTerm(p, i === 0 ? [] : [[name, i]], c)); return p; }

// ================================================================= constant folding
const MS_SQRT_SMALL_PRIMES = (() => { const out = []; for (let i = 2; i < 3000; i++) { let ok = true; for (let j = 2; j * j <= i; j++) if (i % j === 0) { ok = false; break; } if (ok) out.push(BigInt(i)); } return out; })();
// sqrt of a positive integer as s*sqrt(r) with r square-free as far as small primes allow
function msSqrtParts(n) {
  let s = 1n, r = n;
  for (const p of MS_SQRT_SMALL_PRIMES) {
    const pp = p * p;
    if (pp > r) break;
    while (r % pp === 0n) { r /= pp; s *= p; }
  }
  const root = msIntRoot(r, 2);
  if (root !== null) { s *= root; r = 1n; }
  return { s, r };
}
const MS_TRIG_TABLE = (() => {        // angle = k * 30 or 45 degrees, stored as multiples of 15 degrees (k15 mod 24)
  const S = (txt) => txt;
  const sin = { 0: '0', 2: '1/2', 3: 'sqrt(2)/2', 4: 'sqrt(3)/2', 6: '1', 8: 'sqrt(3)/2', 9: 'sqrt(2)/2', 10: '1/2', 12: '0', 14: '-1/2', 15: '-sqrt(2)/2', 16: '-sqrt(3)/2', 18: '-1', 20: '-sqrt(3)/2', 21: '-sqrt(2)/2', 22: '-1/2' };
  return { sin: Object.fromEntries(Object.entries(sin).map(([k, v]) => [k, S(v)])) };
})();
function msTrigExact(name, arg) {      // arg is a Frac multiple of pi; returns an AST or null
  const k = msfMul(arg, msFrac(12n));                  // angle in units of 15 degrees
  if (!msfIsInt(k)) return null;
  const idx = Number(((k.n % 24n) + 24n) % 24n);
  const sinAt = (i) => TRIG_SIN[((i % 24) + 24) % 24];
  const TRIG_SIN = MS_TRIG_TABLE.sin;
  const have = (i) => TRIG_SIN[((i % 24) + 24) % 24] !== undefined;
  if (name === 'sin') return have(idx) ? msParse(sinAt(idx)) : null;
  if (name === 'cos') return have(idx + 6) ? msParse(sinAt(idx + 6)) : null;
  if (name === 'tan') {
    if (!have(idx) || !have(idx + 6)) return null;
    const c = sinAt(idx + 6);
    if (c === '0') throw new MsError('tan has no value at this angle');
    return msFold(msDivN(msParse(sinAt(idx)), msParse(c)));
  }
  return null;
}
function msAsFrac(n) { return n.t === 'num' ? n.f : null; }
// if the node equals q * pi for a rational q, return q
function msAngleOverPi(n) {
  if (n.t === 'const' && n.name === 'pi') return MS_ONE;
  if (n.t === 'neg') { const q = msAngleOverPi(n.a); return q ? msfNeg(q) : null; }
  if (n.t === 'bin' && n.op === '*') {
    if (n.a.t === 'num') { const q = msAngleOverPi(n.b); return q ? msfMul(n.a.f, q) : null; }
    if (n.b.t === 'num') { const q = msAngleOverPi(n.a); return q ? msfMul(n.b.f, q) : null; }
  }
  if (n.t === 'bin' && n.op === '/' && n.b.t === 'num' && !msfIsZero(n.b.f)) { const q = msAngleOverPi(n.a); return q ? msfDiv(q, n.b.f) : null; }
  return null;
}
function msFold(n) {
  switch (n.t) {
    case 'num': case 'var': return n;
    case 'const': return n;
    case 'neg': {
      const a = msFold(n.a);
      if (a.t === 'num') return msNum(msfNeg(a.f));
      if (a.t === 'neg') return a.a;
      return msNegN(a);
    }
    case 'fn': {
      const a = msFold(n.a);
      const f = msAsFrac(a);
      switch (n.name) {
        case 'sqrt':
          if (f && msfSign(f) >= 0) {
            if (msfIsZero(f)) return msInt(0);
            const parts = msSqrtParts(f.n * f.d);
            const coeff = msFrac(parts.s, f.d);
            if (parts.r === 1n) return msNum(coeff);
            const radical = msFn('sqrt', msInt(parts.r));
            return msfIsOne(coeff) ? radical : msMulN(msNum(coeff), radical);
          }
          return msFn('sqrt', a);
        case 'cbrt':
          if (f) {
            const r = msIntRoot(f.n < 0n ? -f.n : f.n, 3), d = msIntRoot(f.d, 3);
            if (r !== null && d !== null) return msNum(msFrac(f.n < 0n ? -r : r, d));
          }
          return msFn('cbrt', a);
        case 'abs': return f ? msNum(msfAbs(f)) : msFn('abs', a);
        case 'fact':
          if (f && msfIsInt(f) && f.n >= 0n && f.n <= 170n) { let r = 1n; for (let i = 2n; i <= f.n; i++) r *= i; return msNum(msFrac(r)); }
          return msFn('fact', a);
        case 'ln':
          if (f && msfIsOne(f)) return msInt(0);
          if (a.t === 'const' && a.name === 'e') return msInt(1);
          if (a.t === 'bin' && a.op === '^' && a.a.t === 'const' && a.a.name === 'e') return a.b;
          return msFn('ln', a);
        case 'log':
          if (f && msfIsOne(f)) return msInt(0);
          if (f && msfIsInt(f) && f.n > 0n) { let k = 0, v = f.n; while (v % 10n === 0n) { v /= 10n; k++; } if (v === 1n) return msInt(k); }
          return msFn('log', a);
        case 'sin': case 'cos': case 'tan': {
          if (f && msfIsZero(f)) return msInt(n.name === 'cos' ? 1 : 0);
          // angle written as (rational) * pi
          const q = msAngleOverPi(a);
          if (q) { const exact = msTrigExact(n.name, q); if (exact) return msFold(exact); }
          return msFn(n.name, a);
        }
        case 'asin': case 'atan': case 'sinh': case 'tanh': return f && msfIsZero(f) ? msInt(0) : msFn(n.name, a);
        case 'cosh': return f && msfIsZero(f) ? msInt(1) : msFn('cosh', a);
        default: return msFn(n.name, a);
      }
    }
    case 'bin': {
      const a = msFold(n.a), b = msFold(n.b);
      const fa = msAsFrac(a), fb = msAsFrac(b);
      switch (n.op) {
        case '+':
          if (fa && fb) return msNum(msfAdd(fa, fb));
          if (fa && msfIsZero(fa)) return b;
          if (fb && msfIsZero(fb)) return a;
          return msAdd(a, b);
        case '*':
          if (fa && fb) return msNum(msfMul(fa, fb));
          if ((fa && msfIsZero(fa)) || (fb && msfIsZero(fb))) return msInt(0);
          if (fa && msfIsOne(fa)) return b;
          if (fb && msfIsOne(fb)) return a;
          return msMulN(a, b);
        case '/':
          if (fb && msfIsZero(fb)) throw new MsError('Division by zero');
          if (fa && fb) return msNum(msfDiv(fa, fb));
          if (fb && msfIsOne(fb)) return a;
          if (fa && msfIsZero(fa)) return msInt(0);
          return msDivN(a, b);
        case '^': {
          if (fb && msfIsZero(fb)) return msInt(1);
          if (fb && msfIsOne(fb)) return a;
          if (fa && msfIsOne(fa)) return msInt(1);
          if (fa && fb) {
            if (msfIsInt(fb) && fb.n >= -5000n && fb.n <= 5000n) {
              if (msfIsZero(fa) && fb.n < 0n) throw new MsError('Division by zero');
              const sizeOk = (fa.n < 0n ? -fa.n : fa.n).toString().length * Math.abs(Number(fb.n)) < 4000;
              if (sizeOk) return msNum(msfPow(fa, Number(fb.n)));
            } else if (!msfIsInt(fb) && msfSign(fa) >= 0 && fb.d <= 12n && fb.n >= -60n && fb.n <= 60n) {
              const rn = msIntRoot(fa.n, Number(fb.d)), rd = msIntRoot(fa.d, Number(fb.d));
              if (rn !== null && rd !== null && !(rn === 0n && fb.n < 0n)) return msNum(msfPow(msFrac(rn, rd), Number(fb.n)));
              if (fb.n === 1n && fb.d === 2n) return msFold(msFn('sqrt', a));
            }
          }
          if (fb && fb.n === 1n && fb.d === 2n) return msFold(msFn('sqrt', a));
          return msPowN(a, b);
        }
      }
    }
  }
  return n;
}

// ================================================================= tree <-> rational function
function msAtomName(node) { return msPrint(node, 0); }
function msRatConst(f) { return { n: msPConst(f), d: msPConst(MS_ONE) }; }
function msRatMul(a, b) { return { n: msPMul(a.n, b.n), d: msPMul(a.d, b.d) }; }
function msRatInv(a) { if (msPIsZero(a.n)) throw new MsError('Division by zero'); return { n: a.d, d: a.n }; }
function msRatAdd(a, b) {
  if (msPMonoEqual(a.d, b.d)) return { n: msPAdd(a.n, b.n), d: a.d };
  return { n: msPAdd(msPMul(a.n, b.d), msPMul(b.n, a.d)), d: msPMul(a.d, b.d) };
}
function msPMonoEqual(a, b) {
  if (a.terms.size !== b.terms.size) return false;
  for (const [k, t] of a.terms) { const o = b.terms.get(k); if (!o || msfCmp(o.c, t.c) !== 0) return false; }
  return true;
}
function msRatPow(a, k) {
  if (k >= 0) return { n: msPPow(a.n, k), d: msPPow(a.d, k) };
  const inv = msRatInv(a);
  return { n: msPPow(inv.n, -k), d: msPPow(inv.d, -k) };
}
// atoms: Map name -> tree node (shared between calls so that equal atoms get the same name)
function msToRat(node, atoms, depth) {
  const dpt = (depth || 0) + 1;
  if (dpt > 400) throw new MsError('This expression is nested too deeply');
  switch (node.t) {
    case 'num': return msRatConst(node.f);
    case 'var': return { n: msPVarP(node.name), d: msPConst(MS_ONE) };
    case 'const': { const nm = msConstText(node.name); atoms.set(nm, node); return { n: msPVarP(nm), d: msPConst(MS_ONE) }; }
    case 'neg': { const r = msToRat(node.a, atoms, dpt); return { n: msPNeg(r.n), d: r.d }; }
    case 'bin': {
      if (node.op === '+') return msRatAdd(msToRat(node.a, atoms, dpt), msToRat(node.b, atoms, dpt));
      if (node.op === '*') return msRatMul(msToRat(node.a, atoms, dpt), msToRat(node.b, atoms, dpt));
      if (node.op === '/') return msRatMul(msToRat(node.a, atoms, dpt), msRatInv(msToRat(node.b, atoms, dpt)));
      const e = msFold(node.b);
      if (e.t === 'num' && msfIsInt(e.f)) {
        if (e.f.n > 200n || e.f.n < -200n) throw new MsError('That power is too large');
        return msRatPow(msToRat(node.a, atoms, dpt), Number(e.f.n));
      }
      return msAtomize(msPowN(msSimplifyAst(node.a, atoms), e === node.b ? msSimplifyAst(e, atoms) : e), atoms);
    }
    case 'fn': {
      if (node.name === 'fact') return msAtomize(msFn('fact', msSimplifyAst(node.a, atoms)), atoms);
      return msAtomize(msFn(node.name, msSimplifyAst(node.a, atoms)), atoms);
    }
  }
  throw new MsError('I could not read this expression');
}
function msAtomize(node, atoms) {
  const folded = msFold(node);
  if (folded.t !== 'fn' && !(folded.t === 'bin' && folded.op === '^')) return msToRat(folded, atoms, 0);   // folding found an exact value
  let nm = msAtomName(folded);
  if (/^[A-Za-z\u03C0]$/.test(nm)) nm = '(' + nm + ')';
  atoms.set(nm, folded);
  return { n: msPVarP(nm), d: msPConst(MS_ONE) };
}
// remove common factors; keep the denominator primitive with a positive leading coefficient
function msRatCancel(r) {
  let n = r.n, d = r.d;
  if (msPIsZero(n)) return { n, d: msPConst(MS_ONE) };
  const dc = msPAsConst(d);
  if (dc) return { n: msPScale(n, msfDiv(MS_ONE, dc)), d: msPConst(MS_ONE) };
  const vars = new Set([...msPVars(n), ...msPVars(d)]);
  if (vars.size === 1) {
    const v = Array.from(vars)[0];
    const un = msPToUni(n, v), ud = msPToUni(d, v);
    if (un && ud) {
      const g = msUGcd(un, ud);
      let qn = un, qd = ud;
      if (g.length > 1) { qn = msUDivMod(un, g)[0]; qd = msUDivMod(ud, g)[0]; }
      n = msUToP(qn, v); d = msUToP(qd, v);
    }
  } else {
    const gm = msPMonoGcd(n), gd = msPMonoGcd(d);
    const common = [];
    gm.forEach(x => { const o = gd.find(y => y[0] === x[0]); if (o) common.push([x[0], Math.min(x[1], o[1])]); });
    n = msPDivMono(n, common); d = msPDivMono(d, common);
  }
  const cn = msPContent(n), cd = msPContent(d);
  n = msPScale(n, msfDiv(MS_ONE, cn)); d = msPScale(d, msfDiv(MS_ONE, cd));
  let k = msfDiv(cn, cd);
  if (msPLeadSign(d) < 0) { d = msPNeg(d); k = msfNeg(k); }
  n = msPScale(n, k);
  const dc2 = msPAsConst(d);
  if (dc2) return { n: msPScale(n, msfDiv(MS_ONE, dc2)), d: msPConst(MS_ONE) };
  return { n, d };
}
function msSimplifyAst(node, atoms) {
  const reg = atoms || new Map();
  const r = msRatCancel(msToRat(msFold(node), reg));
  return msRatToAst(r, reg);
}
// ----------------------------------------------------------------- polynomial -> tree and text
function msPolyToAst(p, atoms) {
  const terms = msPSortedTerms(p);
  if (!terms.length) return msInt(0);
  let acc = null;
  terms.forEach(t => {
    let prod = null;
    t.m.forEach(([name, e]) => {
      const base = atoms.has(name) ? atoms.get(name) : msVar(name);
      const push = (f) => { prod = prod ? msMulN(prod, f) : f; };
      if (base.t === 'fn' && base.name === 'sqrt' && e >= 2) {          // sqrt(u)^2 = u
        const whole = Math.floor(e / 2);
        push(whole === 1 ? base.a : msPowN(base.a, msInt(whole)));
        if (e % 2) push(base);
      } else push(e === 1 ? base : msPowN(base, msInt(e)));
    });
    const neg = msfSign(t.c) < 0, absC = msfAbs(t.c);
    let term;
    if (!prod) term = msNum(absC);
    else if (msfIsOne(absC)) term = prod;
    else if (msfIsInt(absC)) term = msMulN(msNum(absC), prod);
    else {
      const top = msfIsOne(msFrac(absC.n)) ? prod : msMulN(msNum(msFrac(absC.n)), prod);
      term = msDivN(top, msNum(msFrac(absC.d)));
    }
    if (acc === null) acc = neg ? msNegN(term) : term;
    else acc = msAdd(acc, neg ? msNegN(term) : term);
  });
  return acc;
}
function msRatToAst(r, atoms) {
  let n = r.n, d = r.d;
  if (msPAsConst(d) && msfIsOne(msPAsConst(d))) return msPolyToAstGrouped(n, atoms);
  let l = 1n;                                            // clear numeric fractions: 1/2 / sqrt(x) becomes 1 / (2 sqrt(x))
  [n, d].forEach(p => p.terms.forEach(t => { l = (l / msGcd(l, t.c.d)) * t.c.d; }));
  if (l > 1n) { n = msPScale(n, msFrac(l)); d = msPScale(d, msFrac(l)); }
  const g = msGcd(msPContent(n).n, msPContent(d).n);
  if (g > 1n && msPContent(n).d === 1n && msPContent(d).d === 1n) { n = msPScale(n, msFrac(1n, g)); d = msPScale(d, msFrac(1n, g)); }
  return msDivN(msPolyToAstGrouped(n, atoms), msDenAst(d, atoms));
}
// denominators of one letter are shown factored: (x - 1)^2 instead of x^2 - 2x + 1
function msDenAst(d, atoms) {
  const vars = msPVars(d);
  if (vars.size === 1) {
    const v = Array.from(vars)[0];
    if (!atoms.has(v)) {
      const u = msPToUni(d, v);
      if (u && u.length > 2) {
        let fr = null;
        try { fr = msFactorUni(u); } catch (e) { fr = null; }
        if (fr && (fr.factors.length > 1 || fr.factors.some(f => f.mult > 1))) {
          let prod = null;
          fr.factors.forEach(f => {
            const base = msPolyToAst(msUToP(f.poly, v), atoms);
            const t = f.mult === 1 ? base : msPowN(base, msInt(f.mult));
            prod = prod ? msMulN(prod, t) : t;
          });
          return msfIsOne(fr.content) ? prod : msMulN(msNum(fr.content), prod);
        }
      }
    }
  }
  return msPolyToAstGrouped(d, atoms);
}
// put a common numeric denominator in front: (3x^2 + 2x)/6 instead of x^2/2 + x/3
function msPolyToAstGrouped(p, atoms) {
  let l = 1n;
  p.terms.forEach(t => { l = (l / msGcd(l, t.c.d)) * t.c.d; });
  if (l === 1n || p.terms.size < 2) return msPolyToAst(p, atoms);
  return msDivN(msPolyToAst(msPScale(p, msFrac(l)), atoms), msInt(l));
}
function msSimplifyToString(node) { return msPrint(msSimplifyAst(node)); }

if (typeof module !== 'undefined') {
  Object.assign(module.exports, {
    msPNew, msPConst, msPVarP, msPAdd, msPSub, msPMul, msPPow, msPScale, msPNeg, msPIsZero, msPAsConst, msPVars, msPDegIn, msPCoeffsIn, msPFromCoeffsIn,
    msPContent, msPSortedTerms, msUAdd, msUSub, msUMul, msUDivMod, msUGcd, msUDeriv, msUEval, msUEvalNum, msUToInts, msPToUni, msUToP, msUScale, msUMonic, msUTrim,
    msFold, msToRat, msRatCancel, msSimplifyAst, msSimplifyToString, msRatToAst, msPolyToAst, msSqrtParts
  });
}

// ================================================================= factoring, roots, linear systems
function msDivisors(n, limit) {          // positive divisors of a BigInt, or null if n is too big to search
  n = n < 0n ? -n : n;
  if (n === 0n) return null;
  if (n > (limit || 1000000000000n)) return null;
  const small = [], large = [];
  const lim = Number(n);
  for (let i = 1; i * i <= lim; i++) {
    if (n % BigInt(i) === 0n) { small.push(BigInt(i)); const o = n / BigInt(i); if (o !== BigInt(i)) large.push(o); }
    if (i > 2000000) return null;
  }
  return small.concat(large.reverse());
}
function msUFromInts(ints) { return ints.map(c => msFrac(c)); }
// divide an integer-coefficient polynomial by (q x - p)
function msUDivLinear(a, p, q) { return msUDivMod(a, [msFrac(-p, q), MS_ONE]); }
function msUIsEqual(a, b) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (msfCmp(a[i], b[i]) !== 0) return false; return true; }
function msUMakePrimitive(a) {     // returns { poly: integer-coefficient Frac array with positive lead and gcd 1, scale: Frac } with a = scale * poly
  const info = msUToInts(a);
  let ints = info.ints, scale = info.factor;
  if (ints[ints.length - 1] < 0n) { ints = ints.map(c => -c); scale = msfNeg(scale); }
  return { poly: msUFromInts(ints), scale };
}
function msFactorUni(a) {
  a = msUTrim(a.slice());
  if (!a.length) throw new MsError('Nothing to factor');
  const prim = msUMakePrimitive(a);
  const result = { content: prim.scale, factors: [], complete: true };
  let cur = prim.poly;
  const add = (poly, mult) => {
    const norm = msUMakePrimitive(poly);
    result.content = msfMul(result.content, msfPow(norm.scale, mult));
    const found = result.factors.find(f => msUIsEqual(f.poly, norm.poly));
    if (found) found.mult += mult; else result.factors.push({ poly: norm.poly, mult });
  };
  let zeros = 0;
  while (cur.length > 1 && msfIsZero(cur[0])) { cur = cur.slice(1); zeros++; }
  if (zeros) add([MS_ZERO, MS_ONE], zeros);
  // rational roots
  let searched = true;
  while (cur.length > 2) {
    const ints = cur.map(c => c.n);
    const dp = msDivisors(ints[0]), dq = msDivisors(ints[ints.length - 1]);
    if (!dp || !dq) { searched = false; break; }
    let hit = null;
    outer:
    for (const q of dq) {
      for (const p0 of dp) {
        if (msGcd(p0, q) !== 1n) continue;
        for (const p of [p0, -p0]) {
          let val = 0n;                                    // sum a_i p^i q^(n-i)
          const n = ints.length - 1;
          for (let i = 0; i <= n; i++) val += ints[i] * (p ** BigInt(i)) * (q ** BigInt(n - i));
          if (val === 0n) { hit = { p, q }; break outer; }
        }
      }
    }
    if (!hit) break;
    let mult = 0;
    for (;;) {
      const [quo, rem] = msUDivLinear(cur, hit.p, hit.q);
      if (rem.length) break;
      cur = msUMakePrimitive(quo).poly; mult++;
      if (cur.length < 2) break;
    }
    add([msFrac(-hit.p), msFrac(hit.q)], mult);
  }
  if (cur.length === 2) { add(cur, 1); cur = [MS_ONE]; }
  else if (cur.length > 2) {
    if (!searched) result.complete = false;
    const split = msSplitNoRoots(cur.map(c => c.n));
    split.list.forEach(ints => add(msUFromInts(ints), 1));
    if (!split.complete) result.complete = false;
    cur = [MS_ONE];
  }
  if (cur.length === 1 && !msfIsOne(cur[0])) result.content = msfMul(result.content, cur[0]);
  return result;
}
// Split an integer polynomial that has no rational roots into irreducible factors (lists of BigInt coefficients).
function msSplitNoRoots(ints) {
  const n = ints.length - 1;
  if (n <= 3) return { list: [ints], complete: true };
  if (n === 4) { const pair = msQuarticSplit(ints); return pair ? { list: pair, complete: true } : { list: [ints], complete: true }; }
  if (n > 12) return { list: [ints], complete: false };
  const g = msKronecker(ints);
  if (g === 'unknown') return { list: [ints], complete: false };
  if (!g) return { list: [ints], complete: true };
  const qr = msUDivMod(msUFromInts(ints), msUFromInts(g));
  const h = msUMakePrimitive(qr[0]).poly.map(c => c.n);
  const rest = msSplitNoRoots(h);
  return { list: [g].concat(rest.list), complete: rest.complete };
}
// Kronecker's method: the smallest factor of degree d is fixed by its values at d+1 integer points, which must divide the values of the polynomial.
function msKronecker(ints) {
  const n = ints.length - 1;
  const evalAt = (x) => { let r = 0n; for (let i = n; i >= 0; i--) r = r * x + ints[i]; return r; };
  const pool = [];
  for (let k = 0; k <= 9; k++) {
    for (const x of (k === 0 ? [0n] : [BigInt(k), BigInt(-k)])) {
      const v = evalAt(x);
      if (v === 0n) continue;
      const divs = msDivisors(v < 0n ? -v : v, 10n ** 15n);
      if (divs) pool.push({ x, divs });
    }
  }
  pool.sort((p, q) => p.divs.length - q.divs.length);
  let budget = 3000000;
  for (let d = 2; d <= Math.floor(n / 2); d++) {
    if (pool.length < d + 1) return 'unknown';
    const pts = pool.slice(0, d + 1), xs = pts.map(p => p.x), cs = new Array(d + 1);
    let found = null, exhausted = false;
    const pick = (k, prev) => {
      const p = pts[k];
      for (const dv of p.divs) {
        for (const sg of (k === 0 ? [1n] : [1n, -1n])) {
          if (found || exhausted) return;
          if (--budget < 0) { exhausted = true; return; }
          const row = [dv * sg];
          let ok = true;
          for (let j = 1; j <= k; j++) {
            const num = row[j - 1] - prev[j - 1], den = p.x - xs[k - j];
            if (num % den !== 0n) { ok = false; break; }
            row.push(num / den);
          }
          if (!ok) continue;
          cs[k] = row[k];
          if (k === d) {
            const lead = row[d];
            if (lead <= 0n || ints[n] % lead !== 0n) continue;
            const coefs = msNewtonToCoeffs(xs, cs);
            const qr = msUDivMod(msUFromInts(ints), msUFromInts(coefs));
            if (!qr[1].length) { found = coefs; return; }
          } else pick(k + 1, row);
        }
      }
    };
    pick(0, []);
    if (found) return msUMakePrimitive(msUFromInts(found)).poly.map(c => c.n);
    if (exhausted) return 'unknown';
  }
  return null;
}
// Newton form  c0 + c1 (x-x0) + c2 (x-x0)(x-x1) + ...  ->  integer coefficients (null if not all integers)
function msNewtonToCoeffs(xs, cs) {
  let poly = [cs[cs.length - 1]];
  for (let i = cs.length - 2; i >= 0; i--) {
    const next = new Array(poly.length + 1).fill(0n);
    poly.forEach((c, k) => { next[k + 1] += c; next[k] -= c * xs[i]; });
    next[0] += cs[i];
    poly = next;
  }
  return poly;
}
// integer quartic without rational roots -> two integer quadratics, or null (then it is irreducible over the rationals)
function msQuarticSplit(c) {
  const e0 = c[0], e1 = c[1], e2 = c[2], e3 = c[3], e4 = c[4];      // e4 x^4 + e3 x^3 + e2 x^2 + e1 x + e0
  const dA = msDivisors(e4), dE = msDivisors(e0);
  if (!dA || !dE) return null;
  for (const p of dA) {
    const p2 = e4 / p;
    for (const qa of dE) {
      for (const q of [qa, -qa]) {
        const q2 = e0 / q;
        // (p x^2 + s x + q)(p2 x^2 + t x + q2):  x^3: p t + p2 s = e3,  x: q t + q2 s = e1,  x^2: p q2 + s t + q p2 = e2
        const det = p * q2 - p2 * q;
        const cands = [];
        if (det !== 0n) {
          const tN = e3 * q2 - p2 * e1, sN = p * e1 - q * e3;
          if (tN % det !== 0n || sN % det !== 0n) continue;
          cands.push([tN / det, sN / det]);
        } else {
          const A = -p2, B = e3, C = -p * (e2 - p * q2 - q * p2);
          const D = B * B - 4n * A * C;
          const r = D < 0n ? null : msIntRoot(D, 2);
          if (r === null || A === 0n) continue;
          for (const sg of [r, -r]) {
            const num = -B + sg, den = 2n * A;
            if (num % den !== 0n) continue;
            const s = num / den, t0 = e3 - p2 * s;
            if (t0 % p !== 0n) continue;
            cands.push([t0 / p, s]);
          }
        }
        for (const ts of cands) {
          const t = ts[0], s = ts[1];
          if (p * q2 + s * t + q * p2 !== e2 || q * t + q2 * s !== e1 || p * t + p2 * s !== e3) continue;
          return [[q, s, p], [q2, t, p2]];
        }
      }
    }
  }
  return null;
}
// numeric roots (complex) of a polynomial with fraction coefficients: Durand-Kerner then Newton polishing
function msRootsNumeric(a) {
  a = msUTrim(a.slice());
  const n = a.length - 1;
  if (n < 1) return [];
  const co = a.map(msfToNum), lead = co[n];
  const c = co.map(x => x / lead);
  let roots = [];
  const radius = 1 + Math.max(...c.slice(0, n).map(Math.abs));
  for (let k = 0; k < n; k++) { const ang = 2 * Math.PI * k / n + 0.4; roots.push([radius * 0.7 * Math.cos(ang), radius * 0.7 * Math.sin(ang)]); }
  const cmul = (p, q) => [p[0] * q[0] - p[1] * q[1], p[0] * q[1] + p[1] * q[0]];
  const cdiv = (p, q) => { const d = q[0] * q[0] + q[1] * q[1]; return [(p[0] * q[0] + p[1] * q[1]) / d, (p[1] * q[0] - p[0] * q[1]) / d]; };
  const horner = (x) => { let r = [c[n], 0]; for (let i = n - 1; i >= 0; i--) { r = cmul(r, x); r[0] += c[i]; } return r; };
  for (let it = 0; it < 800; it++) {
    let moved = 0;
    roots = roots.map((r, i) => {
      let denom = [1, 0];
      roots.forEach((o, j) => { if (j !== i) denom = cmul(denom, [r[0] - o[0], r[1] - o[1]]); });
      if (denom[0] === 0 && denom[1] === 0) denom = [1e-12, 0];
      const step = cdiv(horner(r), denom);
      moved = Math.max(moved, Math.abs(step[0]) + Math.abs(step[1]));
      return [r[0] - step[0], r[1] - step[1]];
    });
    if (moved < 1e-15 * radius) break;
  }
  return roots.map(r => ({ re: r[0], im: r[1] })).map(r => {
    const scale = 1 + Math.hypot(r.re, r.im);
    if (Math.abs(r.im) < 1e-9 * scale) r.im = 0;
    if (Math.abs(r.re) < 1e-12 * scale) r.re = 0;
    return r;
  });
}
function msCSub(a, b) { return { re: a.re - b.re, im: a.im - b.im }; }
function msUEvalComplex(a, x) {
  let re = 0, im = 0;
  for (let i = a.length - 1; i >= 0; i--) {
    const nr = re * x.re - im * x.im + msfToNum(a[i]);
    const ni = re * x.im + im * x.re;
    re = nr; im = ni;
  }
  return { re, im };
}
// exact roots of a x^2 + b x + c as display text; returns { disc, kind, roots:[{text, re, im}] }
function msQuadratic(a, b, c) {
  const disc = msfSub(msfMul(b, b), msfMul(msFrac(4n), msfMul(a, c)));
  const twoA = msfMul(msFrac(2n), a);
  const p = msfDiv(msfNeg(b), twoA);                       // real part, rational
  const neg = msfSign(disc) < 0;
  const absDisc = msfAbs(disc);
  const num = msfToNum;
  if (msfIsZero(disc)) return { disc, kind: 'double', roots: [{ text: msfStr(p), re: num(p), im: 0 }] };
  // sqrt(|disc|) = (s/d) sqrt(r)
  const parts = msSqrtParts(absDisc.n * absDisc.d);
  const q = msfAbs(msfDiv(msFrac(parts.s, absDisc.d), twoA));
  if (parts.r === 1n && !neg) {
    const r1 = msfAdd(p, q), r2 = msfSub(p, q);
    const roots = [r1, r2].sort(msfCmp).map(r => ({ text: msfStr(r), re: num(r), im: 0 }));
    return { disc, kind: 'rational', roots };
  }
  // p +- q*sqrt(r) written as (P +- Q sqrt(r)) / L
  let L = 1n; [p, q].forEach(f => { L = (L / msGcd(L, f.d)) * f.d; });
  const P = (p.n * (L / p.d)), Q = (q.n * (L / q.d));
  const rad = parts.r === 1n ? '' : 'sqrt(' + parts.r + ')';
  const imag = neg ? 'i' : '';
  const radText = [imag, rad].filter(Boolean).join('*');
  const qText = Q === 1n ? radText : Q.toString() + radText;
  const pText = P === 0n ? '' : P.toString();
  const mk = (sign) => {
    let inner;
    if (P === 0n) inner = (sign < 0 ? '-' : '') + (qText || '1');
    else inner = pText + (sign < 0 ? ' - ' : ' + ') + (qText || '1');
    if (L === 1n) return inner;
    return P === 0n && Q === 1n && !radText ? inner + '/' + L : '(' + inner + ')/' + L;
  };
  const sq = Math.sqrt(Number(parts.r)) * Number(parts.s) / Number(absDisc.d) / Math.abs(num(twoA));
  const pn = num(p);
  if (neg) return { disc, kind: 'complex', roots: [{ text: mk(1), re: pn, im: sq }, { text: mk(-1), re: pn, im: -sq }] };
  return { disc, kind: 'irrational', roots: [{ text: mk(-1), re: pn - sq, im: 0 }, { text: mk(1), re: pn + sq, im: 0 }] };
}
// Gauss-Jordan on an augmented matrix of fractions (rows of length nVars + 1)
function msGaussSolve(rowsIn, nVars) {
  const rows = rowsIn.map(r => r.slice());
  const pivots = [];
  let r = 0;
  for (let col = 0; col < nVars && r < rows.length; col++) {
    let sel = -1;
    for (let i = r; i < rows.length; i++) if (!msfIsZero(rows[i][col])) { sel = i; break; }
    if (sel < 0) continue;
    [rows[r], rows[sel]] = [rows[sel], rows[r]];
    const inv = msfDiv(MS_ONE, rows[r][col]);
    rows[r] = rows[r].map(x => msfMul(x, inv));
    for (let i = 0; i < rows.length; i++) {
      if (i === r || msfIsZero(rows[i][col])) continue;
      const f = rows[i][col];
      rows[i] = rows[i].map((x, j) => msfSub(x, msfMul(f, rows[r][j])));
    }
    pivots.push(col);
    r++;
  }
  for (let i = r; i < rows.length; i++) if (!msfIsZero(rows[i][nVars])) return { kind: 'none', rows };
  if (pivots.length === nVars) return { kind: 'unique', values: rows.slice(0, nVars).map(x => x[nVars]), rows };
  const free = []; for (let c = 0; c < nVars; c++) if (!pivots.includes(c)) free.push(c);
  return { kind: 'infinite', pivots, free, rows };
}

if (typeof module !== 'undefined') {
  Object.assign(module.exports, { msKronecker, msSplitNoRoots, msDivisors, msFactorUni, msRootsNumeric, msQuadratic, msGaussSolve, msUEvalComplex });
}

// ================================================================= numeric evaluation, derivatives, integrals
function msContains(n, v) {
  switch (n.t) {
    case 'var': return n.name === v;
    case 'neg': return msContains(n.a, v);
    case 'fn': return msContains(n.a, v);
    case 'bin': return msContains(n.a, v) || msContains(n.b, v);
    default: return false;
  }
}
function msVarsOf(n, set) {
  const s = set || new Set();
  if (n.t === 'var') s.add(n.name);
  else if (n.t === 'neg' || n.t === 'fn') msVarsOf(n.a, s);
  else if (n.t === 'bin') { msVarsOf(n.a, s); msVarsOf(n.b, s); }
  return s;
}
function msSubst(n, v, value) {
  switch (n.t) {
    case 'var': return n.name === v ? value : n;
    case 'neg': return msNegN(msSubst(n.a, v, value));
    case 'fn': return msFn(n.name, msSubst(n.a, v, value));
    case 'bin': return msBin(n.op, msSubst(n.a, v, value), msSubst(n.b, v, value));
    default: return n;
  }
}
function msFactorial(x) {
  if (!Number.isInteger(x) || x < 0 || x > 170) return NaN;
  let r = 1; for (let i = 2; i <= x; i++) r *= i; return r;
}
// floating point value of a tree; env maps letters to numbers; undefined results come back as NaN
function msEvalNum(n, env) {
  switch (n.t) {
    case 'num': return msfToNum(n.f);
    case 'var': { if (env && Object.prototype.hasOwnProperty.call(env, n.name)) return env[n.name]; throw new MsError('The letter ' + n.name + ' has no value here'); }
    case 'const': return n.name === 'pi' ? Math.PI : Math.E;
    case 'neg': return -msEvalNum(n.a, env);
    case 'bin': {
      const a = msEvalNum(n.a, env);
      if (n.op === '^') {
        const eb = msEvalNum(n.b, env);
        if (a < 0 && Number.isFinite(eb) && !Number.isInteger(eb)) {              // real odd roots, e.g. (-8)^(1/3)
          for (let q = 3; q <= 99; q += 2) {
            const pq = eb * q;
            if (Math.abs(pq - Math.round(pq)) < 1e-12 * q) { const r = Math.pow(-a, eb); return Math.round(pq) % 2 !== 0 ? -r : r; }
          }
        }
        return Math.pow(a, eb);
      }
      const b = msEvalNum(n.b, env);
      if (n.op === '+') return a + b;
      if (n.op === '*') return a * b;
      return a / b;
    }
    case 'fn': {
      const a = msEvalNum(n.a, env);
      switch (n.name) {
        case 'sin': return Math.sin(a); case 'cos': return Math.cos(a); case 'tan': return Math.tan(a);
        case 'asin': return Math.asin(a); case 'acos': return Math.acos(a); case 'atan': return Math.atan(a);
        case 'sinh': return Math.sinh(a); case 'cosh': return Math.cosh(a); case 'tanh': return Math.tanh(a);
        case 'asinh': return Math.asinh(a); case 'acosh': return Math.acosh(a); case 'atanh': return Math.atanh(a);
        case 'sqrt': return Math.sqrt(a); case 'cbrt': return Math.cbrt(a); case 'abs': return Math.abs(a);
        case 'ln': return Math.log(a); case 'log': return Math.log10(a);
        case 'fact': return msFactorial(a);
      }
    }
  }
  return NaN;
}
// removes floating point dust: 1.0000000000000002 -> 1, 6e-17 -> 0
function msClean(x) {
  if (!Number.isFinite(x)) return x;
  if (Math.abs(x) < 1e-14) return 0;
  const r = Math.round(x);
  if (Math.abs(x - r) < 1e-12 * Math.max(1, Math.abs(x))) return r;
  return parseFloat(x.toPrecision(13));
}
function msFmtNum(x) {
  if (!Number.isFinite(x)) return String(x);
  x = msClean(x);
  if (x === 0) return '0';
  const ax = Math.abs(x);
  if (ax >= 1e15 || ax < 1e-6) return x.toExponential(9).replace(/\.?0+e/, 'e').replace('e+', 'e');
  let s = parseFloat(x.toPrecision(10)).toString();
  if (s.includes('e')) s = x.toFixed(9).replace(/\.?0+$/, '');
  return s;
}

// ---------------------------------------------------------------- derivatives
const MS_RULE_TEXT = {
  sum: 'Sum rule: differentiate each term separately',
  constant: 'Constant multiple rule: constants stay in front',
  product: 'Product rule: (u*v)\' = u\'*v + u*v\'',
  quotient: 'Quotient rule: (u/v)\' = (u\'*v - u*v\')/v^2',
  power: 'Power rule: (x^n)\' = n*x^(n-1)',
  chain: 'Chain rule: differentiate the outer function, then multiply by the derivative of the inside',
  exponential: 'Exponential rule: (a^x)\' = a^x*ln(a)',
  general: 'Logarithmic differentiation for a power with x in both base and exponent',
  trig: 'Trigonometric rules: (sin x)\' = cos x, (cos x)\' = -sin x, (tan x)\' = 1/cos(x)^2',
  inverse: 'Inverse function rules: (asin x)\' = 1/sqrt(1-x^2), (atan x)\' = 1/(1+x^2)',
  log: 'Logarithm rules: (ln x)\' = 1/x, (log x)\' = 1/(x*ln(10))',
  hyper: 'Hyperbolic rules: (sinh x)\' = cosh x, (cosh x)\' = sinh x'
};
function msDiff(n, v, rules) {
  const note = (k) => { if (rules) rules.add(k); };
  if (!msContains(n, v)) return msInt(0);
  switch (n.t) {
    case 'var': return msInt(1);
    case 'neg': return msNegN(msDiff(n.a, v, rules));
    case 'bin': {
      const a = n.a, b = n.b;
      if (n.op === '+') { note('sum'); return msAdd(msDiff(a, v, rules), msDiff(b, v, rules)); }
      if (n.op === '*') {
        if (!msContains(a, v)) { note('constant'); return msMulN(a, msDiff(b, v, rules)); }
        if (!msContains(b, v)) { note('constant'); return msMulN(msDiff(a, v, rules), b); }
        note('product');
        return msAdd(msMulN(msDiff(a, v, rules), b), msMulN(a, msDiff(b, v, rules)));
      }
      if (n.op === '/') {
        if (!msContains(b, v)) { note('constant'); return msDivN(msDiff(a, v, rules), b); }
        note('quotient');
        return msDivN(msAdd(msMulN(msDiff(a, v, rules), b), msNegN(msMulN(a, msDiff(b, v, rules)))), msPowN(b, msInt(2)));
      }
      if (!msContains(b, v)) {
        note('power');
        if (a.t !== 'var') note('chain');
        return msMulN(msMulN(b, msPowN(a, msAdd(b, msInt(-1)))), msDiff(a, v, rules));
      }
      if (!msContains(a, v)) {
        note('exponential');
        if (b.t !== 'var') note('chain');
        const lnA = a.t === 'const' && a.name === 'e' ? msInt(1) : msFn('ln', a);
        return msMulN(msMulN(n, lnA), msDiff(b, v, rules));
      }
      note('general');
      return msMulN(n, msAdd(msMulN(msDiff(b, v, rules), msFn('ln', a)), msDivN(msMulN(b, msDiff(a, v, rules)), a)));
    }
    case 'fn': {
      const u = n.a;
      const du = msDiff(u, v, rules);
      if (u.t !== 'var') note('chain');
      const chain = (outer) => msMulN(outer, du);
      switch (n.name) {
        case 'sin': note('trig'); return chain(msFn('cos', u));
        case 'cos': note('trig'); return chain(msNegN(msFn('sin', u)));
        case 'tan': note('trig'); return msDivN(du, msPowN(msFn('cos', u), msInt(2)));
        case 'asin': note('inverse'); return msDivN(du, msFn('sqrt', msAdd(msInt(1), msNegN(msPowN(u, msInt(2))))));
        case 'acos': note('inverse'); return msNegN(msDivN(du, msFn('sqrt', msAdd(msInt(1), msNegN(msPowN(u, msInt(2)))))));
        case 'atan': note('inverse'); return msDivN(du, msAdd(msInt(1), msPowN(u, msInt(2))));
        case 'sinh': note('hyper'); return chain(msFn('cosh', u));
        case 'cosh': note('hyper'); return chain(msFn('sinh', u));
        case 'tanh': note('hyper'); return msDivN(du, msPowN(msFn('cosh', u), msInt(2)));
        case 'ln': note('log'); return msDivN(du, u);
        case 'log': note('log'); return msDivN(du, msMulN(u, msFn('ln', msInt(10))));
        case 'sqrt': note('power'); return msDivN(du, msMulN(msInt(2), msFn('sqrt', u)));
        case 'cbrt': note('power'); return msDivN(du, msMulN(msInt(3), msPowN(msFn('cbrt', u), msInt(2))));
        case 'abs': return msDivN(msMulN(u, du), msFn('abs', u));
      }
      throw new MsError('I cannot differentiate ' + n.name + ' here');
    }
  }
  return msInt(0);
}
function msDerivative(node, v, order) {
  const rules = new Set();
  let cur = msSimplifyAst(node);
  for (let i = 0; i < order; i++) cur = msSimplifyAst(msDiff(cur, v, i === 0 ? rules : null));
  return { ast: cur, rules: Array.from(rules).map(k => MS_RULE_TEXT[k]) };
}

// ---------------------------------------------------------------- integrals
function msLinearIn(n, v) {          // n = a*v + b with exact rational a, b?  returns { a, b } (Fracs) or null
  const atoms = new Map();
  let r;
  try { r = msRatCancel(msToRat(msFold(n), atoms)); } catch (e) { return null; }
  if (!msPAsConst(r.d)) return null;
  const un = msPToUni(r.n, v);
  if (!un || un.length > 2) return null;
  const a = un[1] || MS_ZERO, b = un[0] || MS_ZERO;
  if (msfIsZero(a)) return null;
  return { a, b };
}
const msNumF = (f) => msNum(f);
function msProdN(list) { return list.reduce((acc, x) => (acc ? msMulN(acc, x) : x), null); }
// integral of P(v) * G(u) where u = a v + b and G is e^u, sin u or cos u; P has rational coefficients (array, index = power). Repeated integration by parts.
function msIntPolyTimes(kind, P, a, b, v) {
  // returns an AST for  sum_k  P^{(k)}(v) * G_{k+1}(u) / a^{k+1}  with signs from the integration by parts table
  const u = msAdd(msMulN(msNumF(a), msVar(v)), msNumF(b));
  const derivs = [P];
  while (derivs[derivs.length - 1].length > 1) derivs.push(msUDeriv(derivs[derivs.length - 1]));
  const antiderivative = (j) => {          // j-th antiderivative of G(u) w.r.t. v, without the 1/a^j factor
    if (kind === 'exp') return msPowN(msConst('e'), u);
    const cycle = kind === 'sin' ? ['sin', 'neg-cos', 'neg-sin', 'cos'] : ['cos', 'sin', 'neg-cos', 'neg-sin'];
    // d/dx sin = cos ... the first antiderivative of sin is -cos, then -sin, then cos, then sin
    const sinSeq = ['neg-cos', 'neg-sin', 'cos', 'sin'];
    const cosSeq = ['sin', 'neg-cos', 'neg-sin', 'cos'];
    void cycle;
    const item = (kind === 'sin' ? sinSeq : cosSeq)[(j - 1) % 4];
    const fn = item.replace('neg-', '');
    const node = msFn(fn, u);
    return item.startsWith('neg-') ? msNegN(node) : node;
  };
  let total = null;
  derivs.forEach((d, k) => {
    // term k:  (-1)^k * P^{(k)}(v) * G_{k+1}(u) / a^{k+1}
    const coef = msfMul(msfPow(msFrac(-1n), k), msfPow(msfDiv(MS_ONE, a), k + 1));
    const poly = msPolyToAst(msUToP(d, v), new Map());
    const term = msMulN(msMulN(msNumF(coef), poly), antiderivative(k + 1));
    total = total ? msAdd(total, term) : term;
  });
  return total;
}
// partial fractions for N/D (univariate, rational coefficients). Returns an AST or null.
function msIntRational(N, D, v) {
  const ln = (arg) => msFn('ln', msFn('abs', arg));
  const [Q, R] = msUDivMod(N, D);
  let result = null;
  const addT = (t) => { result = result ? msAdd(result, t) : t; };
  if (Q.length) {
    const anti = [MS_ZERO].concat(Q.map((c, i) => msfDiv(c, msFrac(BigInt(i + 1)))));
    addT(msPolyToAst(msUToP(anti, v), new Map()));
  }
  if (!R.length) return result || msInt(0);
  const fac = msFactorUni(D);
  if (!fac.complete) return null;
  const lin = [], quad = [];
  for (const f of fac.factors) {
    const deg = f.poly.length - 1;
    if (deg === 1) lin.push(f);
    else if (deg === 2 && f.mult === 1) quad.push(f);
    else return null;
  }
  // unknowns: A_{i,j} for each linear factor power, then (B_i, C_i) for each quadratic
  const unknownCount = lin.reduce((s, f) => s + f.mult, 0) + quad.length * 2;
  const degD = D.length - 1;
  if (unknownCount !== degD) return null;
  const fullFactors = [];                           // [poly, power] of every factor with its multiplicity
  lin.forEach(f => fullFactors.push([f.poly, f.mult])); quad.forEach(f => fullFactors.push([f.poly, 1]));
  const productExcept = (skipIdx, skipPow) => {     // D / (factor_i^skipPow)
    let p = [MS_ONE];
    fullFactors.forEach(([poly, m], idx) => { const times = idx === skipIdx ? m - skipPow : m; for (let t = 0; t < times; t++) p = msUMul(p, poly); });
    return p;
  };
  const columns = [];
  const meta = [];
  lin.forEach((f, i) => { for (let j = 1; j <= f.mult; j++) { columns.push(msUMul(productExcept(i, j), [MS_ONE])); meta.push({ type: 'lin', i, j }); } });
  quad.forEach((f, qi) => {
    const idx = lin.length + qi;
    const base = productExcept(idx, 1);
    columns.push(msUMul(base, [MS_ZERO, MS_ONE])); meta.push({ type: 'quadB', qi });
    columns.push(base); meta.push({ type: 'quadC', qi });
  });
  const rows = [];
  for (let k = 0; k < degD; k++) rows.push(columns.map(col => col[k] || MS_ZERO).concat([R[k] || MS_ZERO]));
  const sol = msGaussSolve(rows, columns.length);
  if (sol.kind !== 'unique') return null;
  const val = (pred) => sol.values[meta.findIndex(pred)];
  lin.forEach((f, i) => {
    const root = msfDiv(msfNeg(f.poly[0]), f.poly[1]);           // factor = lead*(v - root)
    for (let j = 1; j <= f.mult; j++) {
      const Aj = msfDiv(val(m => m.type === 'lin' && m.i === i && m.j === j), msfPow(f.poly[1], j));
      if (msfIsZero(Aj)) continue;
      const lineAst = msAdd(msVar(v), msNumF(msfNeg(root)));
      if (j === 1) addT(msMulN(msNumF(Aj), ln(lineAst)));
      else addT(msMulN(msNumF(msfDiv(msfNeg(Aj), msFrac(BigInt(j - 1)))), msPowN(lineAst, msInt(-(j - 1)))));
    }
  });
  quad.forEach((f, qi) => {
    const B = val(m => m.type === 'quadB' && m.qi === qi), C = val(m => m.type === 'quadC' && m.qi === qi);
    const qa = f.poly[2], qb = f.poly[1], qc = f.poly[0];
    const delta = msfSub(msfMul(msFrac(4n), msfMul(qa, qc)), msfMul(qb, qb));
    if (msfSign(delta) <= 0) throw new MsError('internal: reducible quadratic');
    const qAst = msPolyToAst(msUToP(f.poly, v), new Map());
    const twoA = msfMul(msFrac(2n), qa);
    if (!msfIsZero(B)) addT(msMulN(msNumF(msfDiv(B, twoA)), msFn('ln', qAst)));
    const rest = msfSub(C, msfDiv(msfMul(B, qb), twoA));
    if (!msfIsZero(rest)) {
      const sq = msFold(msFn('sqrt', msNumF(delta)));
      const arg = msDivN(msAdd(msMulN(msNumF(twoA), msVar(v)), msNumF(qb)), sq);
      addT(msMulN(msDivN(msNumF(msfMul(msFrac(2n), rest)), sq), msFn('atan', arg)));
    }
  });
  return result || msInt(0);
}
// split an expression (as a polynomial in v and atoms) into terms and integrate each by table
function msIntegrateTerms(rat, v, atoms, rules) {
  const note = (t) => rules.add(t);
  const dens = msPAsConst(rat.d);
  let total = null;
  const add = (t) => { total = total ? msAdd(total, t) : t; };
  // group terms: coefficient (everything not depending on v) * v^k * dependent atoms
  const groups = new Map();
  const denMono = dens ? null : msMonoOnly(rat.d);
  if (!dens && !denMono) return null;
  rat.n.terms.forEach(t => {
    let k = 0; const dep = [], coefFactors = [];
    t.m.forEach(([name, e]) => {
      if (name === v) k += e;
      else if (atoms.has(name) && msContains(atoms.get(name), v)) dep.push([name, e]);
      else coefFactors.push([name, e]);
    });
    if (denMono) {
      denMono.m.forEach(([name, e]) => {
        if (name === v) k -= e;
        else if (atoms.has(name) && msContains(atoms.get(name), v)) { const ex = dep.find(x => x[0] === name); if (ex) ex[1] -= e; else dep.push([name, -e]); }
        else coefFactors.push([name, -e]);
      });
    }
    const coefMono = coefFactors.filter(x => x[1] !== 0);
    const key = JSON.stringify([k, dep.filter(x => x[1] !== 0).sort(), coefMono.sort()]);
    const c = denMono ? msfDiv(t.c, denMono.c) : (dens ? msfDiv(t.c, dens) : t.c);
    const g = groups.get(key);
    if (g) g.c = msfAdd(g.c, c); else groups.set(key, { k, dep: dep.filter(x => x[1] !== 0), coef: coefMono, c });
  });
  // the polynomial-times-function families need the polynomial parts collected per function
  const families = new Map();
  for (const g of groups.values()) {
    if (msfIsZero(g.c)) continue;
    const coefAst = msProdN([msNumF(g.c)].concat(g.coef.map(([nm, e]) => { const b = atoms.has(nm) ? atoms.get(nm) : msVar(nm); return e === 1 ? b : msPowN(b, msInt(e)); })));
    if (g.dep.length === 0) {
      if (g.k === -1) { note('Logarithm rule: the integral of 1/x is ln|x|'); add(msMulN(coefAst, msFn('ln', msFn('abs', msVar(v))))); }
      else { note('Power rule: the integral of x^n is x^(n+1)/(n+1)'); add(msMulN(msDivN(coefAst, msInt(g.k + 1)), msPowN(msVar(v), msInt(g.k + 1)))); }
      continue;
    }
    const famKey = JSON.stringify([g.dep, g.coef]);
    let fam = families.get(famKey);
    if (!fam) { fam = { dep: g.dep, coef: g.coef, poly: [], coefAst: msProdN(g.coef.map(([nm, e]) => { const b = atoms.has(nm) ? atoms.get(nm) : msVar(nm); return e === 1 ? b : msPowN(b, msInt(e)); })) }; families.set(famKey, fam); }
    if (g.k < 0) return null;
    while (fam.poly.length <= g.k) fam.poly.push(MS_ZERO);
    fam.poly[g.k] = msfAdd(fam.poly[g.k], g.c);
  }
  for (const fam of families.values()) {
    const t = msIntFamily(fam, v, atoms, note);
    if (!t) return null;
    add(fam.coefAst ? msMulN(fam.coefAst, t) : t);
  }
  return total;
}
function msMonoOnly(p) {            // a polynomial with exactly one term -> that term
  if (p.terms.size !== 1) return null;
  return p.terms.values().next().value;
}
// P(v) * (dependent atoms), with P a rational polynomial (array)
function msIntFamily(fam, v, atoms, note) {
  const dep = fam.dep, P = msUTrim(fam.poly.slice());
  const atomNode = (nm) => atoms.get(nm);
  const lin = (node) => msLinearIn(node, v);
  const u0 = (a, b) => msAdd(msMulN(msNumF(a), msVar(v)), msNumF(b));
  if (dep.length === 1) {
    const nm = dep[0][0]; let e = dep[0][1];
    const node = atomNode(nm);
    // e^(w): any integer power just scales the exponent
    if (node.t === 'bin' && node.op === '^' && node.a.t === 'const' && node.a.name === 'e') {
      const w = lin(node.b);
      if (!w) return null;
      const a = msfMul(w.a, msFrac(BigInt(e))), b = msfMul(w.b, msFrac(BigInt(e)));
      note('Exponential rule: the integral of e^(a*x+b) is e^(a*x+b)/a' + (P.length > 1 ? ', combined with integration by parts' : ''));
      return msIntPolyTimes('exp', P, a, b, v);
    }
    if (node.t === 'fn' && (node.name === 'sin' || node.name === 'cos') && e === 1) {
      const w = lin(node.a);
      if (!w) return null;
      note('Trigonometric rule: the integral of sin(u) is -cos(u) and of cos(u) is sin(u), divided by the coefficient of x' + (P.length > 1 ? ', with integration by parts' : ''));
      return msIntPolyTimes(node.name, P, w.a, w.b, v);
    }
    if (node.t === 'fn' && node.name === 'ln' && e === 1 && node.a.t === 'var' && node.a.name === v) {
      let tot = null;
      P.forEach((ck, k) => {
        if (msfIsZero(ck)) return;
        const pw = msPowN(msVar(v), msInt(k + 1));
        const t = k === 0
          ? msMulN(msNumF(ck), msAdd(msMulN(msVar(v), msFn('ln', msVar(v))), msNegN(msVar(v))))
          : msMulN(msNumF(msfDiv(ck, msfAdd(msFrac(BigInt(k)), MS_ONE))), msAdd(msMulN(pw, msFn('ln', msVar(v))), msNegN(msDivN(pw, msInt(k + 1)))));
        tot = tot ? msAdd(tot, t) : t;
      });
      note('Integration by parts with u = ln(x)');
      return tot;
    }
    if (P.length !== 1) return null;
    const c = P[0];
    if (msfIsZero(c)) return null;
    if (node.t === 'fn' && (node.name === 'sin' || node.name === 'cos') && e === 2) {
      const w = lin(node.a);
      if (!w) return null;
      note('Power-reduction identity: sin(u)^2 = (1 - cos(2u))/2 and cos(u)^2 = (1 + cos(2u))/2');
      const u = u0(w.a, w.b);
      const double = msFn('sin', msMulN(msInt(2), u));
      const s = node.name === 'sin' ? -1 : 1;
      const t = msAdd(msDivN(u, msNumF(msfMul(msFrac(2n), w.a))), msMulN(msNumF(msfDiv(msFrac(BigInt(s)), msfMul(msFrac(4n), w.a))), double));
      return msMulN(msNumF(c), t);
    }
    if (node.t === 'fn' && e === 1) {
      const w = lin(node.a);
      if (node.name === 'tan' && w) { note('The integral of tan(u) is -ln|cos(u)|'); return msMulN(msNumF(msfDiv(msfNeg(c), w.a)), msFn('ln', msFn('abs', msFn('cos', node.a)))); }
      if (node.name === 'sinh' && w) return msMulN(msNumF(msfDiv(c, w.a)), msFn('cosh', node.a));
      if (node.name === 'cosh' && w) return msMulN(msNumF(msfDiv(c, w.a)), msFn('sinh', node.a));
      if (node.name === 'tanh' && w) return msMulN(msNumF(msfDiv(c, w.a)), msFn('ln', msFn('cosh', node.a)));
      if (node.name === 'ln' && w) {
        if (P.length === 1 || P.length === 0) {
          note('Integration by parts: the integral of ln(u) is u*ln(u) - u');
          const u = node.a;
          return msMulN(msNumF(msfDiv(c, w.a)), msAdd(msMulN(u, msFn('ln', u)), msNegN(u)));
        }
      }
    }
    // 1/cos(u)^2 and 1/sin(u)^2
    if (node.t === 'fn' && (node.name === 'cos' || node.name === 'sin') && e === -2) {
      const w = lin(node.a);
      if (!w) return null;
      note(node.name === 'cos' ? 'The integral of 1/cos(u)^2 is tan(u)' : 'The integral of 1/sin(u)^2 is -cos(u)/sin(u)');
      const base = node.name === 'cos' ? msDivN(msFn('sin', node.a), msFn('cos', node.a)) : msNegN(msDivN(msFn('cos', node.a), msFn('sin', node.a)));
      return msMulN(msNumF(msfDiv(c, w.a)), base);
    }
    // (a x + b)^(p/q) written as sqrt(u) or cbrt(u)
    if (node.t === 'fn' && (node.name === 'sqrt' || node.name === 'cbrt')) {
      const w = lin(node.a);
      if (!w) return null;
      const root = node.name === 'sqrt' ? msFrac(1n, 2n) : msFrac(1n, 3n);
      const power = msfMul(root, msFrac(BigInt(e)));
      if (msfIsOne(msfAdd(power, MS_ONE))) return null;
      note('Power rule applied to the inside expression (a*x+b)');
      if (msfIsZero(msfAdd(power, MS_ONE))) return msMulN(msNumF(msfDiv(c, w.a)), msFn('ln', msFn('abs', node.a)));
      const np = msfAdd(power, MS_ONE);
      return msMulN(msNumF(msfDiv(c, msfMul(w.a, np))), msPowN(node.a, msNumF(np)));
    }
    // a^(u) with a numeric: written as a power node with variable exponent
    if (node.t === 'bin' && node.op === '^' && node.a.t === 'num' && e === 1) {
      const w = lin(node.b);
      if (!w) return null;
      note('Exponential rule: the integral of a^x is a^x/ln(a)');
      return msMulN(msNumF(msfDiv(c, w.a)), msDivN(node, msFn('ln', node.a)));
    }
    // generic power (a x + b)^q with q rational kept as an atom
    if (node.t === 'bin' && node.op === '^' && node.b.t === 'num' && !msfIsInt(node.b.f)) {
      const w = lin(node.a);
      if (!w) return null;
      const power = msfMul(node.b.f, msFrac(BigInt(e)));
      const np = msfAdd(power, MS_ONE);
      if (msfIsZero(np)) return msMulN(msNumF(msfDiv(c, w.a)), msFn('ln', msFn('abs', node.a)));
      note('Power rule applied to the inside expression (a*x+b)');
      return msMulN(msNumF(msfDiv(c, msfMul(w.a, np))), msPowN(node.a, msNumF(np)));
    }
    return null;
  }
  if (dep.length === 2 && P.length === 1) {
    const c = P[0];
    const [A, B] = dep.map(([nm, e]) => [atomNode(nm), e]);
    // sin(u)*cos(u)
    const fnPair = [A, B].filter(x => x[0].t === 'fn' && (x[0].name === 'sin' || x[0].name === 'cos') && x[1] === 1);
    if (fnPair.length === 2 && fnPair[0][0].name !== fnPair[1][0].name && msPrint(fnPair[0][0].a) === msPrint(fnPair[1][0].a)) {
      const w = lin(fnPair[0][0].a);
      if (!w) return null;
      note('sin(u)*cos(u) = sin(2u)/2, then the cosine rule');
      return msMulN(msNumF(msfDiv(c, msfMul(msFrac(2n), w.a))), msPowN(msFn('sin', fnPair[0][0].a), msInt(2)));
    }
    // e^(p x + q) * sin/cos(r x + s)
    const ex = [A, B].find(x => x[0].t === 'bin' && x[0].op === '^' && x[0].a.t === 'const' && x[0].a.name === 'e');
    const tr = [A, B].find(x => x[0].t === 'fn' && (x[0].name === 'sin' || x[0].name === 'cos') && x[1] === 1);
    if (ex && tr) {
      const wp = lin(ex[0].b), wr = lin(tr[0].a);
      if (!wp || !wr) return null;
      const p = msfMul(wp.a, msFrac(BigInt(ex[1]))), r = wr.a;
      const denom = msfAdd(msfMul(p, p), msfMul(r, r));
      const eAst = msPowN(msConst('e'), msNumF(msfMul(wp.b, msFrac(BigInt(ex[1])))).t ? msAdd(msMulN(msNumF(p), msVar(v)), msNumF(msfMul(wp.b, msFrac(BigInt(ex[1]))))) : msVar(v));
      const s = tr[0].name === 'sin' ? [p, msfNeg(r)] : [r, p];            // d/dx of e^px sin: p sin - r cos ; of e^px cos: p cos + r sin
      const sinCoef = s[0], cosCoef = s[1];
      note('Integration by parts twice (the same integral appears again and is solved for)');
      const body = msAdd(msMulN(msNumF(sinCoef), msFn('sin', tr[0].a)), msMulN(msNumF(cosCoef), msFn('cos', tr[0].a)));
      return msMulN(msNumF(msfDiv(c, denom)), msMulN(eAst, body));
    }
  }
  return null;
}
function msIntegrateAst(node, v) {
  const rules = new Set();
  const atoms = new Map();
  const folded = msFold(node);
  if (!msContains(folded, v)) {
    rules.add('Constant rule: the integral of a constant c is c*x');
    return { ast: msSimplifyAst(msMulN(folded, msVar(v))), rules: Array.from(rules) };
  }
  let rat;
  try { rat = msRatCancel(msToRat(folded, atoms)); } catch (e) { if (e instanceof MsError) throw e; return null; }
  let result = null;
  const vars = new Set([...msPVars(rat.n), ...msPVars(rat.d)]);
  const dependent = Array.from(vars).filter(nm => nm === v || (atoms.has(nm) && msContains(atoms.get(nm), v)));
  const pureRational = dependent.every(nm => nm === v) && !msPAsConst(rat.d);
  if (pureRational) {
    const others = Array.from(vars).filter(nm => nm !== v);
    const un = msPToUni(rat.n, v), ud = msPToUni(rat.d, v);
    if (un && ud && ud.length > 1 && !others.length && (ud.length > 2 || un.length >= ud.length || ud.length === 2 && un.length > 1 || true)) {
      // a lone monomial denominator is handled by the table (1/x^n); everything else by partial fractions
      const denTerm = msMonoOnly(rat.d);
      if (!denTerm) {
        result = msIntRational(un, ud, v);
        if (result) rules.add('Partial fractions: split the fraction into simpler fractions, then integrate each one');
      }
    }
  }
  if (!result) result = msIntegrateTerms(rat, v, atoms, rules);
  if (!result) return null;
  // the answer must differentiate back to the question; otherwise it is not shown
  const simple = msSimplifyAst(result);
  if (!msVerifyAntiderivative(simple, folded, v)) return null;
  return { ast: simple, rules: Array.from(rules) };
}
const MS_SAMPLE_POINTS = [0.37, 0.91, 1.43, 2.17, 2.89, 3.61, -0.53, -1.7, -2.6, 0.12, 5.3];
function msVerifyAntiderivative(F, f, v) {
  let dF;
  try { dF = msDiff(F, v, null); } catch (e) { return false; }
  let good = 0;
  for (const x of MS_SAMPLE_POINTS) {
    const env = { [v]: x };
    let a, b;
    try { a = msEvalNum(dF, msWithParams(env, F, v)); b = msEvalNum(f, msWithParams(env, f, v)); } catch (e) { return false; }
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    if (Math.abs(a - b) > 1e-7 * (1 + Math.abs(a) + Math.abs(b))) return false;
    good++;
  }
  return good >= 3;
}
function msWithParams(env, node, v) { const e = Object.assign({}, env); msVarsOf(node).forEach(n => { if (n !== v && !(n in e)) e[n] = 1.7; }); return e; }

// adaptive Simpson rule: returns { value, ok }
function msSimpson(fn, a, b, tol) {
  const f = (x) => fn(x);
  const simpson = (fa, fm, fb, h) => (h / 6) * (fa + 4 * fm + fb);
  let evals = 0, bad = false;
  const rec = (a0, b0, fa, fm, fb, whole, eps, depth) => {
    const m = (a0 + b0) / 2, lm = (a0 + m) / 2, rm = (m + b0) / 2;
    const flm = f(lm), frm = f(rm);
    evals += 2;
    if (!Number.isFinite(flm) || !Number.isFinite(frm)) bad = true;
    const left = simpson(fa, flm, fm, m - a0), right = simpson(fm, frm, fb, b0 - m);
    if (depth <= 0 || Math.abs(left + right - whole) <= 15 * eps || evals > 200000) return left + right + (left + right - whole) / 15;
    return rec(a0, m, fa, flm, fm, left, eps / 2, depth - 1) + rec(m, b0, fm, frm, fb, right, eps / 2, depth - 1);
  };
  const fa = f(a), fb = f(b), fm = f((a + b) / 2);
  if (![fa, fb, fm].every(Number.isFinite)) return { value: NaN, ok: false };
  const value = rec(a, b, fa, fm, fb, simpson(fa, fm, fb, b - a), tol || 1e-11, 40);
  return { value, ok: !bad && Number.isFinite(value) };
}

if (typeof module !== 'undefined') {
  Object.assign(module.exports, {
    msContains, msVarsOf, msSubst, msEvalNum, msClean, msFmtNum, msDiff, msDerivative, msIntegrateAst, msSimpson, msVerifyAntiderivative, MS_RULE_TEXT
  });
}

// ================================================================= solving, matrices, statistics, and the single entry point
const MS_SCAN_LIMIT = 100000000;
function msSplitTop(text) {
  const out = []; let depth = 0, cur = '';
  for (const ch of text) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if ((ch === ',' || ch === ';') && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim()).filter(s => s.length);
}
function msFmtComplex(re, im) {
  const r = msFmtNum(re);
  if (!im) return r;
  const i = msFmtNum(Math.abs(im));
  const imText = i === '1' ? 'i' : i + 'i';
  if (Math.abs(re) < 1e-14) return (im < 0 ? '-' : '') + imText;
  return r + (im < 0 ? ' - ' : ' + ') + imText;
}
function msFracOrNum(f) {            // exact fraction text plus a decimal when the fraction is not whole
  if (msfIsInt(f)) return msfStr(f);
  return msfStr(f) + ' (≈ ' + msFmtNum(msfToNum(f)) + ')';
}
function msBlock(kind, title, lines) { return { kind, title: title || '', lines: lines.filter(l => l !== null && l !== undefined) }; }
function msPrintFactored(fr, v) {
  const parts = [];
  fr.factors.forEach(f => {
    const base = msPrint(msPolyToAst(msUToP(f.poly, v), new Map()));
    const txt = f.poly.length === 2 && msfIsZero(f.poly[0]) ? v : '(' + base + ')';
    parts.push(f.mult === 1 ? txt : txt + (f.mult <= 9 ? MS_SUP_OUT[f.mult] || '^' + f.mult : '^' + f.mult));
  });
  let lead = '';
  if (!msfIsOne(fr.content)) lead = msfIsInt(fr.content) ? (fr.content.n === -1n ? '-' : fr.content.n.toString()) : '(' + msfStr(fr.content) + ')';
  return lead + parts.join('');
}
// roots of a univariate polynomial (array of fractions). Exact where possible, numerical otherwise.
function msSolvePolyUni(un) {
  const fr = msFactorUni(un);
  const roots = [];
  let approximate = false;
  fr.factors.forEach(f => {
    const deg = f.poly.length - 1;
    if (deg === 1) {
      const r = msfDiv(msfNeg(f.poly[0]), f.poly[1]);
      roots.push({ text: msfStr(r), re: msfToNum(r), im: 0, mult: f.mult, exact: true, frac: r });
    } else if (deg === 2) {
      const q = msQuadratic(f.poly[2], f.poly[1], f.poly[0]);
      q.roots.forEach(r => roots.push({ text: r.text, re: r.re, im: r.im, mult: f.mult, exact: true }));
    } else {
      msRootsNumeric(f.poly).forEach(r => roots.push({ text: msFmtComplex(r.re, r.im), re: r.re, im: r.im, mult: f.mult, exact: false }));
      approximate = true;
    }
  });
  roots.sort((a, b) => ((a.im !== 0) !== (b.im !== 0) ? (a.im !== 0 ? 1 : -1) : a.re !== b.re ? a.re - b.re : a.im - b.im));
  return { roots, factored: fr, approximate, complete: fr.complete };
}
function msDedupeRoots(roots) {
  const out = [];
  roots.forEach(r => { if (!out.some(o => Math.abs(o.re - r.re) < 1e-9 * (1 + Math.abs(r.re)) && Math.abs(o.im - r.im) < 1e-9 * (1 + Math.abs(r.im)))) out.push(r); });
  return out;
}
function msSnapRational(x) {
  if (Math.abs(x) > 1e4) return null;
  for (let q = 1; q <= 1000; q++) { const p = Math.round(x * q); if (Math.abs(x - p / q) < 1e-10) return msFrac(BigInt(p), BigInt(q)); }
  return null;
}
// sign changes of fn on a grid of x values; returns refined roots
function msScanRoots(fn) {
  const near = [];
  for (let i = -20000; i <= 20000; i++) near.push(i * 0.005);
  let roots = msScanGrid(fn, near);
  if (!roots.length) {                                   // nothing nearby: look much further out on a logarithmic grid
    const far = [];
    for (let k = 0; k <= 300; k++) { const m = 100 * Math.pow(10, k / 40); if (m > MS_SCAN_LIMIT) break; far.push(m, -m); }
    far.sort((a, b) => a - b);
    roots = msScanGrid(fn, far);
  }
  return roots;
}
function msScanGrid(fn, xs) {
  const ys = xs.map(x => { try { return fn(x); } catch (e) { return NaN; } });
  const roots = [];
  const push = (r) => { if (!roots.some(o => Math.abs(o - r) < 1e-7 * (1 + Math.abs(r)))) roots.push(r); };
  for (let i = 0; i < xs.length - 1; i++) {
    const y0 = ys[i], y1 = ys[i + 1];
    if (!Number.isFinite(y0) || !Number.isFinite(y1)) continue;
    if (y0 === 0) { push(xs[i]); continue; }
    if (y0 * y1 < 0) {
      let a = xs[i], b = xs[i + 1], fa = y0;
      for (let k = 0; k < 200; k++) { const m = (a + b) / 2, fm = fn(m); if (!Number.isFinite(fm)) break; if (fa * fm <= 0) b = m; else { a = m; fa = fm; } }
      const r = (a + b) / 2, fr = fn(r);
      const scale = 1 + Math.max(Math.abs(y0), Math.abs(y1));
      if (Number.isFinite(fr) && Math.abs(fr) < 1e-6 * scale && Math.abs(fr) <= Math.max(Math.abs(y0), Math.abs(y1))) push(r);
    }
  }
  // roots where the graph only touches zero: tiny local minima of |f|
  for (let i = 1; i < xs.length - 1; i++) {
    const a = Math.abs(ys[i - 1]), b = Math.abs(ys[i]), c = Math.abs(ys[i + 1]);
    if (!(Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c))) continue;
    if (b <= a && b <= c && b < 1e-3 && ys[i - 1] * ys[i + 1] >= 0 && ys[i] !== 0) {
      let lo = xs[i - 1], hi = xs[i + 1];
      for (let k = 0; k < 200; k++) { const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; if (Math.abs(fn(m1)) < Math.abs(fn(m2))) hi = m2; else lo = m1; }
      const r = (lo + hi) / 2;
      if (Math.abs(fn(r)) < 1e-12) push(r);
    }
  }
  return roots.sort((p, q) => p - q);
}
function msPiMultiple(x) {            // 0.5235987756 -> "π/6"
  if (Math.abs(x) > 1e4) return null;
  for (let q = 1; q <= 12; q++) {
    const p = Math.round(x * q / Math.PI);
    if (p !== 0 && Math.abs(x - p * Math.PI / q) < 1e-9 * (1 + Math.abs(x))) {
      const g = Number(msGcd(BigInt(Math.abs(p)), BigInt(q))), P = p / g, Q = q / g;
      return (P === 1 ? '' : P === -1 ? '-' : String(P)) + 'π' + (Q === 1 ? '' : '/' + Q);
    }
  }
  return null;
}
function msEquationParts(text) {
  const parts = msSplitTop(msNormalize(String(text).replace(/\n/g, ';')));
  if (!parts.length) throw new MsError('Please type an equation first');
  return parts.map(p => {
    const sides = p.split('=');
    if (sides.length > 2) throw new MsError('Each equation can have only one "=" sign');
    const l = msParse(sides[0]);
    const r = sides.length === 2 ? msParse(sides[1]) : msInt(0);
    if (sides.length === 2 && sides[1].trim() === '') throw new MsError('Nothing is written after the "=" sign');
    return { lhs: l, rhs: r, diff: msAdd(l, msNegN(r)), text: msPrint(l) + ' = ' + msPrint(r) };
  });
}
function msPickVariable(vars, wanted, what) {
  if (wanted) {
    const w = String(wanted).trim();
    if (!/^[A-Za-z]$/.test(w) || w === 'e') throw new MsError('The letter to ' + what + ' must be one letter (for example x)');
    return w;
  }
  if (vars.size === 1) return Array.from(vars)[0];
  if (vars.has('x')) return 'x';
  if (vars.size === 0) return null;
  throw new MsError('Which letter should I ' + what + '?', 'Type the letter in the box next to the question.');
}
function msSolveSystem(eqs, vars) {
  const names = Array.from(vars).sort();
  if (names.length > 6) throw new MsError('Systems with more than 6 unknown letters are not supported');
  const rows = [];
  eqs.forEach(eq => {
    const atoms = new Map();
    const r = msRatCancel(msToRat(msFold(eq.diff), atoms));
    if (atoms.size) throw new MsError('Systems of equations must use plain letters and numbers only', 'Functions like sin(x) are not supported in a system.');
    if (!msPAsConst(r.d) || msPTotalDeg(r.n) > 1) throw new MsError('Systems of equations must be linear (no x², no xy, nothing divided by a letter)');
    const row = names.map(nm => { let c = MS_ZERO; r.n.terms.forEach(t => { if (t.m.length === 1 && t.m[0][0] === nm) c = msfAdd(c, t.c); }); return c; });
    let k = MS_ZERO; r.n.terms.forEach(t => { if (t.m.length === 0) k = msfAdd(k, t.c); });
    row.push(msfNeg(k));
    rows.push(row);
  });
  const g = msGaussSolve(rows, names.length);
  const blocks = [];
  const steps = ['Wrote the equations as a table of coefficients and used Gaussian elimination with exact fractions.'];
  if (g.kind === 'none') {
    blocks.push(msBlock('answer', 'Answer', ['No solution. The equations contradict each other.']));
  } else if (g.kind === 'unique') {
    const lines = names.map((nm, i) => nm + ' = ' + msFracOrNum(g.values[i]));
    blocks.push(msBlock('answer', 'Answer', lines));
    const checks = eqs.map(eq => {
      let l = eq.lhs, r = eq.rhs;
      names.forEach((nm, i) => { l = msSubst(l, nm, msNum(g.values[i])); r = msSubst(r, nm, msNum(g.values[i])); });
      const fl = msFold(l), fr = msFold(r);
      return msPrint(l) + ' = ' + msPrint(fl) + (fl.t === 'num' && fr.t === 'num' && msfCmp(fl.f, fr.f) === 0 ? '  (equals ' + msPrint(fr) + ', correct)' : '  (does not match: check failed)');
    });
    blocks.push(msBlock('check', 'Check by putting the answer back', checks));
  } else {
    const lines = ['Infinitely many solutions.'];
    g.free.forEach(c => lines.push(names[c] + ' can be any number'));
    g.pivots.forEach((pc, ri) => {
      let p = msPConst(g.rows[ri][names.length]);
      g.free.forEach(fc => { p = msPSub(p, msPScale(msPVarP(names[fc]), g.rows[ri][fc])); });
      lines.push(names[pc] + ' = ' + msPrint(msPolyToAst(p, new Map())));
    });
    blocks.push(msBlock('answer', 'Answer', lines));
  }
  blocks.push(msBlock('steps', 'Method', steps));
  return { read: 'Solve the system: ' + eqs.map(e => e.text).join(' ; '), blocks, data: g.kind === 'unique' ? { names, values: g.values.map(msfToNum) } : { names, kind: g.kind } };
}
function msSolveOne(eq, varWanted) {
  const vars = msVarsOf(eq.diff);
  const v = msPickVariable(vars, varWanted, 'solve for');
  if (v === null) {
    const l = msFold(eq.lhs), r = msFold(eq.rhs);
    if (l.t === 'num' && r.t === 'num') return { read: eq.text, blocks: [msBlock('answer', 'Answer', [msfCmp(l.f, r.f) === 0 ? 'True: both sides are equal.' : 'False: the two sides are not equal (' + msPrint(l) + ' and ' + msPrint(r) + ').'])] };
    throw new MsError('There is no letter to solve for');
  }
  const atoms = new Map();
  const folded = msFold(eq.diff);
  const raw = msToRat(folded, atoms);
  const cancelled = msRatCancel(raw);
  const others = Array.from(new Set([...msPVars(cancelled.n), ...msPVars(cancelled.d)])).filter(nm => nm !== v && !atoms.has(nm));
  const atomDepends = Array.from(atoms.entries()).some(([nm, node]) => msContains(node, v) && (msPVars(cancelled.n).has(nm) || msPVars(cancelled.d).has(nm)));
  const read = 'Solve ' + eq.text + ' for ' + v;
  const blocks = [];
  // ---------- numerical branch (functions of the unknown)
  if (atomDepends) {
    if (others.length) throw new MsError('This equation has other letters besides ' + v + ' and uses a function of ' + v, 'Give the other letters numbers, or use a polynomial equation.');
    const fn = (x) => msEvalNum(eq.diff, { [v]: x });
    const all = msScanRoots(fn);
    const found = all.length > 40 ? all.slice().sort((p, q) => Math.abs(p) - Math.abs(q)).slice(0, 40).sort((p, q) => p - q) : all;
    const lines = [];
    found.forEach(r => {
      const snap = msSnapRational(r);
      const piForm = snap ? null : msPiMultiple(r);
      lines.push(v + ' ' + (snap ? '= ' + msfStr(snap) : '≈ ' + msFmtNum(r) + (piForm ? '   (= ' + piForm + ')' : '')));
    });
    if (all.length > 40) lines.push('... and ' + (all.length - 40) + ' more solutions farther from zero (the pattern repeats).');
    if (!all.length) lines.push('No solution found for ' + v + ' between -100000000 and 100000000.');
    blocks.push(msBlock('answer', 'Answer (numerical)', lines));
    const checks = found.slice(0, 6).map(r => v + ' = ' + msFmtNum(r) + ': left side = ' + msFmtNum(msEvalNum(eq.lhs, { [v]: r })) + ', right side = ' + msFmtNum(msEvalNum(eq.rhs, { [v]: r })));
    if (checks.length) blocks.push(msBlock('check', 'Check by putting the answer back', checks));
    blocks.push(msBlock('note', 'Please note', ['This equation has no simple algebra method here, so it was solved numerically: the tool searches for places where (left side - right side) changes sign, first between -100 and 100 and, only if nothing is found there, much farther out. Solutions where the graph only touches zero, or lies very close together, can be missed. Equations with sin or cos have infinitely many solutions; only some are listed.']));
    return { read, blocks, data: { roots: found.map(r => ({ re: r, im: 0 })) } };
  }
  // ---------- polynomial / rational branch with other letters (literal equation)
  if (others.length) {
    if (msPAsConst(cancelled.d) === null && msPVars(cancelled.d).has(v)) throw new MsError('Solving for ' + v + ' with other letters is supported when ' + v + ' is not inside a denominator');
    const co = msPCoeffsIn(cancelled.n, v);
    const deg = co.length - 1;
    const sym = new Map();
    const prn = (p) => msPrint(msPolyToAst(p, sym));
    if (deg < 1) throw new MsError(v + ' does not appear in this equation');
    if (deg > 2) throw new MsError('With other letters in the equation, only equations up to ' + v + '² can be solved', 'Give the other letters numbers to solve higher powers.');
    const lines = [], steps = [];
    if (deg === 1) {
      const sol = msRatCancel({ n: msPNeg(co[0]), d: co[1] });
      lines.push(v + ' = ' + msPrint(msRatToAst(sol, sym)));
      steps.push('Collected all terms with ' + v + ': (' + prn(co[1]) + ')*' + v + ' + (' + prn(co[0]) + ') = 0', 'Solved: ' + v + ' = -(' + prn(co[0]) + ')/(' + prn(co[1]) + '). This works when (' + prn(co[1]) + ') is not zero.');
    } else {
      const disc = msPSub(msPMul(co[1], co[1]), msPScale(msPMul(co[2], co[0]), msFrac(4n)));
      const twoA = msPScale(co[2], msFrac(2n));
      const mk = (sign) => msDivN(msAdd(msNegN(msPolyToAst(co[1], sym)), sign > 0 ? msFn('sqrt', msPolyToAst(disc, sym)) : msNegN(msFn('sqrt', msPolyToAst(disc, sym)))), msPolyToAst(twoA, sym));
      lines.push(v + ' = ' + msPrint(mk(1)), v + ' = ' + msPrint(mk(-1)));
      steps.push('a = ' + prn(co[2]) + ', b = ' + prn(co[1]) + ', c = ' + prn(co[0]), 'Discriminant D = b² - 4ac = ' + prn(disc), v + ' = (-b ± sqrt(D))/(2a)');
    }
    // numeric sanity check with sample values for the other letters
    const env = {}; others.forEach((nm, i) => { env[nm] = [1.3, -0.7, 2.1, 0.45][i % 4]; });
    let confirmed = 0;
    for (let attempt = 0; attempt < 6 && !confirmed; attempt++) {
      if (attempt) others.forEach((nm, i) => { env[nm] = [1.3, -0.7, 2.1, 0.45][i % 4] * (attempt + 1) * (attempt % 2 ? -1 : 1); });
      const cand = [];
      const cn = {}; co.forEach((p, i) => { cn[i] = msEvalNum(msPolyToAst(p, sym), env); });
      if (deg === 1) cand.push(-cn[0] / cn[1]);
      else { const D = cn[1] * cn[1] - 4 * cn[2] * cn[0]; if (D >= 0) { cand.push((-cn[1] + Math.sqrt(D)) / (2 * cn[2]), (-cn[1] - Math.sqrt(D)) / (2 * cn[2])); } }
      if (cand.length && cand.every(c => Number.isFinite(c))) {
        const ok = cand.every(c => { const e2 = Object.assign({}, env, { [v]: c }); const l = msEvalNum(eq.lhs, e2), r = msEvalNum(eq.rhs, e2); return Math.abs(l - r) <= 1e-8 * (1 + Math.abs(l) + Math.abs(r)); });
        if (!ok) throw new MsError('I could not solve this safely');
        confirmed = 1;
      }
    }
    blocks.push(msBlock('answer', 'Answer', lines));
    blocks.push(msBlock('steps', 'Steps', steps));
    if (confirmed) blocks.push(msBlock('check', 'Check', ['Putting sample numbers in for ' + others.join(', ') + ' gives equal left and right sides.']));
    return { read, blocks };
  }
  // ---------- exact polynomial / rational branch
  const un = msPToUni(cancelled.n, v), ud = msPToUni(cancelled.d, v);
  if (!un || !ud) throw new MsError('I could not turn this equation into a polynomial in ' + v);
  if (!un.length) {
    blocks.push(msBlock('answer', 'Answer', ['Every number ' + v + ' is a solution (both sides are always equal), except values that make a denominator zero.']));
    return { read, blocks };
  }
  if (un.length === 1) { blocks.push(msBlock('answer', 'Answer', ['No solution. The equation reduces to ' + msfStr(un[0]) + ' = 0, which is never true.'])); return { read, blocks }; }
  // values that make an original denominator zero are not allowed
  const rawDen = msPToUni(raw.d, v);
  let excluded = [];
  if (rawDen && rawDen.length > 1) excluded = msSolvePolyUni(rawDen).roots.filter(r => r.im === 0);
  const sol = msSolvePolyUni(un);
  let roots = msDedupeRoots(sol.roots);
  const removed = roots.filter(r => excluded.some(e => Math.abs(e.re - r.re) < 1e-9 * (1 + Math.abs(r.re))));
  roots = roots.filter(r => !removed.includes(r));
  const degree = un.length - 1;
  const steps = [];
  if (degree === 1) {
    steps.push('Moved everything to one side: (' + msPrint(msPolyToAst(msUToP(un, v), new Map())) + ') = 0', 'Solved the linear equation: ' + v + ' = ' + msfStr(msfDiv(msfNeg(un[0]), un[1])));
  } else if (degree === 2) {
    const q = msQuadratic(un[2], un[1], un[0]);
    steps.push('Moved everything to one side: ' + msPrint(msPolyToAst(msUToP(un, v), new Map())) + ' = 0',
      'a = ' + msfStr(un[2]) + ', b = ' + msfStr(un[1]) + ', c = ' + msfStr(un[0]),
      'Discriminant D = b² - 4ac = ' + msfStr(q.disc) + (msfSign(q.disc) < 0 ? ' (negative, so the solutions are complex)' : msfIsZero(q.disc) ? ' (zero, so there is one repeated solution)' : ''),
      v + ' = (-b ± sqrt(D))/(2a)');
  } else {
    steps.push('Moved everything to one side and factored: ' + msPrintFactored(sol.factored, v) + ' = 0', 'Set each factor to zero.' + (sol.approximate ? ' Factors that cannot be split further were solved numerically.' : ''));
  }
  if (removed.length) steps.push('Excluded ' + removed.map(r => v + ' = ' + r.text).join(', ') + ' because it makes a denominator zero.');
  const lines = [];
  roots.forEach(r => {
    const approx = !r.exact;
    let txt = v + ' ' + (approx ? '≈ ' : '= ') + r.text;
    if (r.exact) {
      const dec = msFmtComplex(r.re, r.im);
      const plainFraction = r.frac && !msfIsInt(r.frac);
      const repeating = plainFraction && (() => { let d = r.frac.d; while (d % 2n === 0n) d /= 2n; while (d % 5n === 0n) d /= 5n; return d !== 1n; })();
      if ((!r.frac && dec !== r.text) || repeating) txt += '   (≈ ' + dec + ')';
    }
    if (r.mult > 1) txt += '   (repeated ' + r.mult + ' times)';
    lines.push(txt);
  });
  if (!lines.length) lines.push('No solution' + (removed.length ? ': the only candidate makes a denominator zero.' : '.'));
  blocks.push(msBlock('answer', 'Answer', lines));
  blocks.push(msBlock('steps', 'Steps', steps));
  // check each real root in the original equation; complex roots in the polynomial
  const checks = [];
  const bad = [];
  roots.forEach(r => {
    if (r.im !== 0) { const val = msUEvalComplex(un, r); const mag = Math.hypot(val.re, val.im) / (1 + Math.hypot(r.re, r.im) ** degree); if (mag > 1e-8) bad.push(r); return; }
    const l = msEvalNum(eq.lhs, { [v]: r.re }), rr = msEvalNum(eq.rhs, { [v]: r.re });
    if (!(Math.abs(l - rr) <= 1e-7 * (1 + Math.abs(l) + Math.abs(rr)))) { bad.push(r); return; }
    if (checks.length < 6) {
      let text = v + ' = ' + (r.frac ? msfStr(r.frac) : msFmtNum(r.re));
      if (r.frac) {
        const lf = msFold(msSubst(eq.lhs, v, msNum(r.frac))), rf = msFold(msSubst(eq.rhs, v, msNum(r.frac)));
        if (lf.t === 'num' && rf.t === 'num') text += ': left side = ' + msfStr(lf.f) + ', right side = ' + msfStr(rf.f);
        else text += ': left side = ' + msFmtNum(l) + ', right side = ' + msFmtNum(rr);
      } else text += ': left side = ' + msFmtNum(l) + ', right side = ' + msFmtNum(rr);
      checks.push(text);
    }
  });
  if (bad.length) throw new MsError('I found candidates that did not check out, so I am not showing a wrong answer', 'Please check the equation.');
  if (roots.some(r => r.im !== 0)) checks.push('Complex solutions were checked in the polynomial and give zero.');
  if (checks.length) blocks.push(msBlock('check', 'Check by putting the answer back', checks));
  if (!sol.complete) blocks.push(msBlock('note', 'Please note', ['This polynomial has a high degree, so exact factoring was not fully possible. The numerical answers above are approximations.']));
  else if (sol.approximate) blocks.push(msBlock('note', 'Please note', ['Solutions marked ≈ are numerical approximations (they have no simple exact form).']));
  return { read, blocks, data: { roots: roots.map(r => ({ re: r.re, im: r.im })) } };
}
function msSolveText(text, varWanted) {
  const eqs = msEquationParts(text);
  if (eqs.length === 1) return msSolveOne(eqs[0], varWanted);
  const vars = new Set(); eqs.forEach(e => msVarsOf(e.diff, vars));
  if (!vars.size) throw new MsError('There is no letter to solve for');
  return msSolveSystem(eqs, vars);
}

// ---------------------------------------------------------------- simplify, expand, factor
function msSameValue(a, b) {
  const vars = new Set(); msVarsOf(a, vars); msVarsOf(b, vars);
  let good = 0;
  for (let i = 0; i < 8; i++) {
    const env = {}; Array.from(vars).forEach((nm, k) => { env[nm] = MS_SAMPLE_POINTS[(i + k * 3) % MS_SAMPLE_POINTS.length] + k * 0.31; });
    let x, y; try { x = msEvalNum(a, env); y = msEvalNum(b, env); } catch (e) { return false; }
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (Math.abs(x - y) > 1e-8 * (1 + Math.abs(x) + Math.abs(y))) return false;
    good++;
  }
  return good >= 2 || vars.size === 0;
}
function msPrimeFactors(n) {
  const out = []; let r = n;
  for (let p = 2n; p * p <= r && p < 10000000n; p += p === 2n ? 1n : 2n) { let e = 0; while (r % p === 0n) { r /= p; e++; } if (e) out.push([p, e]); }
  if (r > 1n) out.push([r, 1]);
  return out;
}
function msRunAlgebra(type, text) {
  const ast = msParse(text);
  const read = (type === 'simplify' ? 'Simplify ' : type === 'expand' ? 'Expand ' : 'Factor ') + msPrint(ast);
  const folded = msFold(ast);
  if (folded.t === 'num' && type === 'factor' && msfIsInt(folded.f) && folded.f.n > 1n && folded.f.n < 10n ** 14n) {
    const pf = msPrimeFactors(folded.f.n);
    const txt = pf.map(([p, e]) => p.toString() + (e > 1 ? (e <= 9 ? MS_SUP_OUT[e] : '^' + e) : '')).join('*');
    return { read, blocks: [msBlock('answer', 'Answer', [folded.f.n + ' = ' + txt])] };
  }
  const atoms = new Map();
  let out;
  const blocks = [];
  if (type === 'expand') {
    const r = msToRat(folded, atoms);
    const rc = msPAsConst(r.d);
    let n = r.n, d = r.d;
    if (rc) { n = msPScale(n, msfDiv(MS_ONE, rc)); out = msPolyToAstGrouped(n, atoms); }
    else out = msDivN(msPolyToAstGrouped(n, atoms), msPolyToAstGrouped(d, atoms));
  } else if (type === 'simplify') {
    out = msRatToAst(msRatCancel(msToRat(folded, atoms)), atoms);
  } else {
    const r = msRatCancel(msToRat(folded, atoms));
    out = msFactorRational(r, atoms, blocks);
  }
  if (!msSameValue(ast, out)) throw new MsError('I could not do this safely', 'The result did not match the original at test values, so it is not shown.');
  const printed = msPrint(out);
  const same = printed === msPrint(ast);
  const lines = [printed];
  if (!msVarsOf(out).size && out.t !== 'num') { const val = msEvalNum(out, {}); if (Number.isFinite(val)) lines.push('≈ ' + msFmtNum(val)); }
  if (same && type === 'factor' && !blocks.some(b => b.kind === 'note')) blocks.unshift(msBlock('note', 'Note', ['This does not factor any further using whole numbers or fractions as coefficients.']));
  else if (same && type !== 'expand' && type !== 'factor') blocks.unshift(msBlock('note', 'Note', ['This is already in its simplest form for this tool.']));
  blocks.unshift(msBlock('answer', 'Answer', lines));
  blocks.push(msBlock('check', 'Check', ['Both forms give the same value at several test points.']));
  return { read, blocks };
}
function msFactorRational(r, atoms, blocks) {
  const vars = new Set([...msPVars(r.n), ...msPVars(r.d)]);
  const build = (p) => {                                       // factored AST of a polynomial
    if (msPIsZero(p)) return { ast: msInt(0), complete: true };
    const c = msPAsConst(p);
    if (c) return { ast: msNum(c), complete: true };
    const pv = msPVars(p);
    if (pv.size === 1 && !atoms.has(Array.from(pv)[0])) {
      const v = Array.from(pv)[0];
      const fr = msFactorUni(msPToUni(p, v));
      let prod = null;
      fr.factors.forEach(f => {
        const base = f.poly.length === 2 && msfIsZero(f.poly[0]) ? msVar(v) : msPolyToAst(msUToP(f.poly, v), atoms);
        const t = f.mult === 1 ? base : msPowN(base, msInt(f.mult));
        prod = prod ? msMulN(prod, t) : t;
      });
      if (!msfIsOne(fr.content)) prod = prod ? msMulN(msNum(fr.content), prod) : msNum(fr.content);
      return { ast: prod, complete: fr.complete };
    }
    // several letters: take out the common monomial and number, then try homogeneous two-letter polynomials
    const mono = msPMonoGcd(p);
    const rest = msPDivMono(p, mono);
    const cont = msPContent(rest);
    const prim = msPScale(rest, msfDiv(MS_ONE, cont));
    let core = null, complete = false;
    const rv = Array.from(msPVars(prim));
    const degs = new Set(); prim.terms.forEach(t => degs.add(t.m.reduce((s, x) => s + x[1], 0)));
    if (rv.length === 2 && degs.size === 1 && !rv.some(nm => atoms.has(nm))) {
      const [a, b] = rv;
      const u = msPToUni(msPCoeffsIn(prim, b).reduce((acc, c, i) => msPAdd(acc, msPMul(c, i ? msPConst(MS_ONE) : msPConst(MS_ONE))), msPNew()), a);   // set b = 1
      if (u) {
        const fr = msFactorUni(u);
        const D = msPTotalDeg(prim);
        let prod = null, count = 0;
        fr.factors.forEach(f => {
          let h = msPNew();                                           // homogenise: sum c_k a^k b^(deg - k)
          f.poly.forEach((c, k) => { const m = msMonoMul(k ? [[a, k]] : [], f.poly.length - 1 - k ? [[b, f.poly.length - 1 - k]] : []); msPAddTerm(h, m, c); });
          const base = msPolyToAst(h, atoms);
          const t = f.mult === 1 ? base : msPowN(base, msInt(f.mult));
          prod = prod ? msMulN(prod, t) : t; count += f.mult * (f.poly.length - 1);
        });
        const lead = msfMul(fr.content, MS_ONE);
        if (count === D && fr.complete && (fr.factors.length > 1 || fr.factors[0].mult > 1)) { core = msfIsOne(lead) ? prod : msMulN(msNum(lead), prod); complete = true; }
      }
    }
    if (!core) core = msPolyToAst(prim, atoms);
    let out = core;
    const k = msfMul(cont, MS_ONE);
    if (!msfIsOne(k)) out = msMulN(msNum(k), out);
    mono.forEach(([nm, e]) => { const b = atoms.has(nm) ? atoms.get(nm) : msVar(nm); out = msMulN(out, e === 1 ? b : msPowN(b, msInt(e))); });
    return { ast: out, complete };
  };
  const n = build(r.n), d = build(r.d);
  if (!n.complete || !d.complete) blocks.push(msBlock('note', 'Please note', ['Factoring was done with one letter (or two letters of the same degree). A remaining factor may still be factorable in ways this tool does not try.']));
  const dc = msPAsConst(r.d);
  return dc && msfIsOne(dc) ? n.ast : msDivN(n.ast, d.ast);
}

// ---------------------------------------------------------------- derivative and integral entry points
function msPickCalculusVar(ast, wanted) {
  const vars = msVarsOf(ast);
  const v = msPickVariable(vars, wanted, 'use');
  return v === null ? 'x' : v;
}
function msRunDerivative(text, wanted, order) {
  const ast = msParse(text);
  const v = msPickCalculusVar(ast, wanted);
  const n = Math.min(4, Math.max(1, parseInt(order, 10) || 1));
  const res = msDerivative(ast, v, n);
  // check against a numerical derivative of the previous step
  let prev = msSimplifyAst(ast);
  if (n > 1) prev = msDerivative(ast, v, n - 1).ast;
  let okPoints = 0;
  for (const x of MS_SAMPLE_POINTS) {
    const env = msWithParams({ [v]: x }, prev, v);
    msWithParams(env, res.ast, v);
    const h = 1e-6 * Math.max(1, Math.abs(x));
    const e1 = Object.assign({}, env, { [v]: x + h }), e0 = Object.assign({}, env, { [v]: x - h });
    let numD, sym;
    try { numD = (msEvalNum(prev, e1) - msEvalNum(prev, e0)) / (2 * h); sym = msEvalNum(res.ast, msWithParams(env, res.ast, v)); } catch (e) { continue; }
    if (!Number.isFinite(numD) || !Number.isFinite(sym)) continue;
    if (Math.abs(numD - sym) > 1e-4 * (1 + Math.abs(sym))) throw new MsError('I could not differentiate this safely');
    okPoints++;
  }
  const label = n === 1 ? 'd/d' + v + '[' + msPrint(ast) + ']' : 'd' + n + '/d' + v + n + '[' + msPrint(ast) + ']';
  const blocks = [msBlock('answer', 'Answer', [label + ' = ' + msPrint(res.ast)])];
  const steps = res.rules.slice();
  if (n > 1) steps.push('Differentiated ' + n + ' times, simplifying after each step.');
  if (!steps.length) steps.push('The expression does not contain ' + v + ', so its derivative is 0.');
  blocks.push(msBlock('steps', 'Rules used', steps));
  if (okPoints) blocks.push(msBlock('check', 'Check', ['The answer matches a numerical slope estimate at ' + okPoints + ' test points.']));
  return { read: 'Differentiate ' + msPrint(ast) + ' with respect to ' + v + (n > 1 ? ' (' + n + ' times)' : ''), blocks };
}
function msBoundValue(text, name) {
  const ast = msFold(msParse(text));
  if (msVarsOf(ast).size) throw new MsError('The ' + name + ' limit must be a number', 'You can use pi and e, for example 2*pi.');
  const val = msEvalNum(ast, {});
  if (!Number.isFinite(val)) throw new MsError('The ' + name + ' limit is not a valid number');
  return { ast, val };
}
function msRunIntegral(text, wanted, lower, upper) {
  const ast = msParse(text);
  const v = msPickCalculusVar(ast, wanted);
  const hasLo = String(lower || '').trim() !== '', hasHi = String(upper || '').trim() !== '';
  if (hasLo !== hasHi) throw new MsError('For a definite integral fill in both limits', 'Leave both empty for an indefinite integral.');
  const res = msIntegrateAst(ast, v);
  const blocks = [];
  if (!hasLo) {
    if (!res) throw new MsError('Could not find an integral for this expression', 'This tool handles polynomials, fractions that split into simpler fractions, e^x, sin, cos, ln, and simple products of these. Try adding limits to get a numerical value.');
    blocks.push(msBlock('answer', 'Answer', ['∫ ' + msPrint(ast) + ' d' + v + ' = ' + msPrint(res.ast) + ' + C']));
    blocks.push(msBlock('steps', 'Rules used', res.rules.length ? res.rules : ['Integrated term by term.']));
    blocks.push(msBlock('check', 'Check', ['Differentiating the answer gives back the original expression (checked at several test points).']));
    return { read: 'Integrate ' + msPrint(ast) + ' with respect to ' + v, blocks };
  }
  const lo = msBoundValue(lower, 'lower'), hi = msBoundValue(upper, 'upper');
  const f = (x) => msEvalNum(ast, msWithParams({ [v]: x }, ast, v));
  const SAMPLES = 1500;
  for (let i = 0; i <= SAMPLES; i++) {
    const x = lo.val + (hi.val - lo.val) * i / SAMPLES;
    if (!Number.isFinite(f(x))) throw new MsError('This integral is improper (the function has no value or is infinite somewhere between the limits)', 'Improper integrals are not supported.');
  }
  const simp = msSimpson(f, lo.val, hi.val, 1e-12);
  const read = 'Integrate ' + msPrint(ast) + ' d' + v + ' from ' + msPrint(lo.ast) + ' to ' + msPrint(hi.ast);
  let exactAst = null, exactVal = NaN;
  if (res) {
    try {
      exactAst = msSimplifyAst(msAdd(msSubst(res.ast, v, hi.ast), msNegN(msSubst(res.ast, v, lo.ast))));
      exactVal = msEvalNum(msAdd(msSubst(res.ast, v, hi.ast), msNegN(msSubst(res.ast, v, lo.ast))), {});
    } catch (e) { exactAst = null; }
  }
  if (res && exactAst && Number.isFinite(exactVal) && simp.ok && Math.abs(exactVal - simp.value) <= 1e-6 * (1 + Math.abs(exactVal))) {
    const lines = [read.replace('Integrate', '∫').replace(' d' + v + ' from', ' d' + v + ',').replace(' to ', ' to ') + ' = ' + msPrint(exactAst)];
    if (exactAst.t !== 'num' || !msfIsInt(exactAst.f)) lines.push('≈ ' + msFmtNum(exactVal));
    blocks.push(msBlock('answer', 'Answer', lines));
    blocks.push(msBlock('steps', 'Method', ['Found the antiderivative F(' + v + ') = ' + msPrint(res.ast), 'Answer = F(upper) - F(lower).'].concat(res.rules)));
    blocks.push(msBlock('check', 'Check', ['A separate numerical integration gives ' + msFmtNum(simp.value) + ', the same value.']));
    return { read, blocks };
  }
  if (!simp.ok) throw new MsError('I could not compute this integral reliably');
  blocks.push(msBlock('answer', 'Answer (numerical)', ['≈ ' + msFmtNum(simp.value)]));
  blocks.push(msBlock('note', 'Please note', ['No exact antiderivative was found, so the value was computed numerically (adaptive Simpson rule).']));
  return { read, blocks };
}

// ---------------------------------------------------------------- evaluate
function msHasFnOrDivision(n) {
  if (n.t === 'fn') return n.name === 'ln' || n.name === 'log' || n.name === 'tan' || msHasFnOrDivision(n.a);
  if (n.t === 'neg') return msHasFnOrDivision(n.a);
  if (n.t === 'bin') return n.op === '/' || (n.op === '^' && n.b.t === 'neg') || msHasFnOrDivision(n.a) || msHasFnOrDivision(n.b);
  return false;
}
function msRunEvaluate(text) {
  const ast = msParse(text);
  const vars = msVarsOf(ast);
  if (vars.size) throw new MsError('This has the letter ' + Array.from(vars).join(', ') + ' in it', 'Evaluate needs numbers only. Use Simplify, Solve or Derivative for letters.');
  const folded = msFold(ast);
  const val = msEvalNum(ast, {});
  const read = 'Calculate ' + msPrint(ast);
  if (!Number.isFinite(val)) {
    if (Number.isNaN(val) || msHasFnOrDivision(ast)) throw new MsError('This cannot be worked out as a real number', 'For example a division by zero, or the square root or logarithm of a number that does not allow it.');
    throw new MsError('The result is too large to show', 'Numbers above about 1.8e308 are not supported.');
  }
  const lines = [];
  if (folded.t === 'num') {
    lines.push(msPrint(folded));
    if (!msfIsInt(folded.f)) lines.push('≈ ' + msFmtNum(val));
    else if (folded.f.n.toString().length > 16) lines.push('≈ ' + msFmtNum(val));
  } else {
    let st = null;
    try { st = msPrint(msSimplifyAst(ast)); } catch (e) { st = null; }
    if (st && st !== msPrint(ast)) lines.push(st);
    lines.push('≈ ' + msFmtNum(val));
  }
  return { read, blocks: [msBlock('answer', 'Answer', lines)], data: { value: val } };
}

// ---------------------------------------------------------------- matrices
function msParseMatrix(text, label) {
  const s = msNormalize(text, { keepBrackets: true });
  if (!s) throw new MsError('Please type the matrix ' + (label || '') + ' first', 'Example: [[1,2],[3,4]]');
  let rows = [];
  if (s.includes('[')) {
    let depth = 0, cur = '', row = null;
    for (const ch of s) {
      if (ch === '[') { depth++; if (depth === 2) row = []; else if (depth > 2) throw new MsError('Matrices have rows inside one pair of outer brackets: [[1,2],[3,4]]'); continue; }
      if (ch === ']') {
        if (depth === 2) { if (cur.trim() !== '') row.push(cur.trim()); rows.push(row); cur = ''; }
        depth--; if (depth < 0) throw new MsError('Brackets do not match in the matrix'); continue;
      }
      if (ch === ',' && depth === 2) { row.push(cur.trim()); cur = ''; continue; }
      if (depth === 2) cur += ch;
    }
    if (depth !== 0) throw new MsError('Brackets do not match in the matrix');
    if (!rows.length) throw new MsError('Write a vector as [[1],[2]] or [[1,2]]');
  } else {
    rows = s.split(/;/).map(r => r.trim()).filter(r => r.length).map(r => r.split(/[\s,]+/).filter(x => x.length));
  }
  const nCols = rows[0].length;
  if (!nCols) throw new MsError('The matrix is empty');
  if (rows.length > 10 || nCols > 10) throw new MsError('Matrices up to 10 × 10 are supported');
  return rows.map(r => {
    if (r.length !== nCols) throw new MsError('All rows of the matrix must have the same number of entries');
    return r.map(x => {
      if (x === '' ) throw new MsError('An entry of the matrix is empty');
      const f = msFold(msParse(x));
      if (f.t !== 'num') throw new MsError('Matrix entries must be plain numbers or fractions, like 3, -1/2 or 0.25', 'Found: ' + x);
      return f.f;
    });
  });
}
function msMatText(M) {
  const cells = M.map(r => r.map(msfStr));
  const w = M[0].map((_, j) => Math.max(...cells.map(r => r[j].length)));
  return cells.map(r => '[ ' + r.map((c, j) => c.padStart(w[j])).join('  ') + ' ]');
}
const msMatMul = (A, B) => A.map(r => B[0].map((_, j) => r.reduce((s, x, k) => msfAdd(s, msfMul(x, B[k][j])), MS_ZERO)));
const msMatIdentity = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? MS_ONE : MS_ZERO)));
function msDet(A) {
  const n = A.length; const M = A.map(r => r.slice()); let det = MS_ONE;
  for (let c = 0; c < n; c++) {
    let p = -1; for (let r = c; r < n; r++) if (!msfIsZero(M[r][c])) { p = r; break; }
    if (p < 0) return MS_ZERO;
    if (p !== c) { [M[p], M[c]] = [M[c], M[p]]; det = msfNeg(det); }
    det = msfMul(det, M[c][c]);
    for (let r = c + 1; r < n; r++) { const f = msfDiv(M[r][c], M[c][c]); for (let k = c; k < n; k++) M[r][k] = msfSub(M[r][k], msfMul(f, M[c][k])); }
  }
  return det;
}
function msRref(A) {
  const g = msGaussSolve(A.map(r => r.concat([MS_ZERO])), A[0].length);
  return { rows: g.rows.map(r => r.slice(0, A[0].length)), rank: g.kind === 'unique' ? A[0].length : (g.pivots ? g.pivots.length : g.rows.filter(r => r.slice(0, A[0].length).some(x => !msfIsZero(x))).length) };
}
function msCharPoly(A) {              // Faddeev-LeVerrier, exact: coefficients index = power
  const n = A.length; let M = msMatIdentity(n).map(r => r.map(() => MS_ZERO)); const c = new Array(n + 1).fill(MS_ZERO); c[n] = MS_ONE;
  for (let k = 1; k <= n; k++) {
    const AM = msMatMul(A, M);
    M = AM.map((r, i) => r.map((x, j) => msfAdd(x, i === j ? c[n - k + 1] : MS_ZERO)));
    const AM2 = msMatMul(A, M);
    let tr = MS_ZERO; for (let i = 0; i < n; i++) tr = msfAdd(tr, AM2[i][i]);
    c[n - k] = msfDiv(msfNeg(tr), msFrac(BigInt(k)));
  }
  return c;
}
function msRunMatrix(op, textA, textB) {
  const A = msParseMatrix(textA, 'A');
  const n = A.length, m = A[0].length;
  const needB = ['add', 'subtract', 'multiply', 'solve'].includes(op);
  let B = null;
  if (needB) B = msParseMatrix(textB, op === 'solve' ? 'b' : 'B');
  const blocks = []; const steps = []; let data = null;
  const sq = () => { if (n !== m) throw new MsError('This needs a square matrix (same number of rows and columns)'); };
  const read = 'Matrix A (' + n + ' × ' + m + ')';
  switch (op) {
    case 'det': {
      sq(); const d = msDet(A);
      blocks.push(msBlock('answer', 'Determinant', ['det(A) = ' + msFracOrNum(d)]));
      steps.push('Used row reduction with exact fractions, tracking row swaps.' + (msfIsZero(d) ? ' The determinant is 0, so the matrix has no inverse.' : ''));
      break;
    }
    case 'inverse': {
      sq();
      const aug = A.map((r, i) => r.concat(msMatIdentity(n)[i]));
      const g = msGaussSolve(aug.map(r => r.concat([MS_ZERO])), 2 * n);
      const left = g.rows.map(r => r.slice(0, n));
      const isId = left.every((r, i) => r.every((x, j) => msfCmp(x, i === j ? MS_ONE : MS_ZERO) === 0));
      if (!isId) throw new MsError('This matrix has no inverse (its determinant is 0)');
      const inv = g.rows.map(r => r.slice(n, 2 * n));
      blocks.push(msBlock('pre', 'Inverse of A', msMatText(inv)));
      const chk = msMatMul(A, inv);
      blocks.push(msBlock('check', 'Check', ['A × (inverse) gives the identity matrix: ' + (chk.every((r, i) => r.every((x, j) => msfCmp(x, i === j ? MS_ONE : MS_ZERO) === 0)) ? 'yes' : 'NO')]));
      steps.push('Row-reduced [A | I] into [I | A⁻¹] with exact fractions. det(A) = ' + msfStr(msDet(A)) + '.');
      break;
    }
    case 'transpose': blocks.push(msBlock('pre', 'Transpose of A', msMatText(A[0].map((_, j) => A.map(r => r[j]))))); break;
    case 'trace': { sq(); let t = MS_ZERO; for (let i = 0; i < n; i++) t = msfAdd(t, A[i][i]); blocks.push(msBlock('answer', 'Trace', ['trace(A) = ' + msFracOrNum(t)])); break; }
    case 'rank': { const r = msRref(A); blocks.push(msBlock('answer', 'Rank', ['rank(A) = ' + r.rank])); blocks.push(msBlock('pre', 'Reduced row echelon form', msMatText(r.rows))); break; }
    case 'rref': { const r = msRref(A); blocks.push(msBlock('pre', 'Reduced row echelon form', msMatText(r.rows))); blocks.push(msBlock('answer', 'Rank', ['rank(A) = ' + r.rank])); break; }
    case 'add': case 'subtract': {
      if (B.length !== n || B[0].length !== m) throw new MsError('A and B must have the same size to ' + op);
      blocks.push(msBlock('pre', op === 'add' ? 'A + B' : 'A - B', msMatText(A.map((r, i) => r.map((x, j) => (op === 'add' ? msfAdd(x, B[i][j]) : msfSub(x, B[i][j])))))));
      break;
    }
    case 'multiply': {
      if (m !== B.length) throw new MsError('To multiply, the number of columns of A (' + m + ') must equal the number of rows of B (' + B.length + ')');
      blocks.push(msBlock('pre', 'A × B', msMatText(msMatMul(A, B))));
      break;
    }
    case 'power': {
      sq();
      const k = parseInt(String(textB || '').trim(), 10);
      if (!Number.isInteger(k) || k < 0 || k > 30) throw new MsError('Type a whole number from 0 to 30 as the power');
      let P = msMatIdentity(n); for (let i = 0; i < k; i++) P = msMatMul(P, A);
      blocks.push(msBlock('pre', 'A^' + k, msMatText(P)));
      break;
    }
    case 'eigen': {
      sq();
      if (n > 5) throw new MsError('Eigenvalues are supported for matrices up to 5 × 5');
      const cp = msCharPoly(A);
      const poly = msPrint(msPolyToAst(msUToP(cp, 'λ'), new Map())).replace(/λ/g, 'λ');
      const sol = msSolvePolyUni(msUTrim(cp.slice()));
      data = { roots: msDedupeRoots(sol.roots).map(r => ({ re: r.re, im: r.im })) };
      blocks.push(msBlock('answer', 'Eigenvalues', msDedupeRoots(sol.roots).map(r => 'λ ' + (r.exact ? '= ' : '≈ ') + r.text + (r.mult > 1 ? '   (repeated ' + r.mult + ' times)' : ''))));
      steps.push('Characteristic polynomial: ' + poly + ' = 0 (computed exactly).', 'Solved it for λ.');
      if (sol.approximate) blocks.push(msBlock('note', 'Please note', ['Values marked ≈ are numerical approximations.']));
      break;
    }
    case 'solve': {
      if (B[0].length === 1 || B.length === 1) { /* ok */ }
      const b = B.length === 1 && B[0].length === n ? B[0] : B.map(r => r[0]);
      if (b.length !== n || (B[0].length !== 1 && B.length !== 1)) throw new MsError('b must be a vector with ' + n + ' entries, like [[1],[2]]');
      const g = msGaussSolve(A.map((r, i) => r.concat([b[i]])), m);
      if (g.kind === 'none') blocks.push(msBlock('answer', 'Answer', ['No solution: the system A·x = b is inconsistent.']));
      else if (g.kind === 'unique') {
        blocks.push(msBlock('answer', 'Solution x', g.values.map((v, i) => 'x' + (i + 1) + ' = ' + msFracOrNum(v))));
        const chk = A.map(r => r.reduce((s, x, k) => msfAdd(s, msfMul(x, g.values[k])), MS_ZERO));
        blocks.push(msBlock('check', 'Check', ['A·x = ' + chk.map(msfStr).join(', ') + (chk.every((v, i) => msfCmp(v, b[i]) === 0) ? ' (equals b, correct)' : ' (does not equal b: check failed)')]));
      } else {
        const lines = ['Infinitely many solutions.', g.free.map(c => 'x' + (c + 1)).join(', ') + ' can be any number'];
        g.pivots.forEach((pc, ri) => { let p = msPConst(g.rows[ri][m]); g.free.forEach(fc => { p = msPSub(p, msPScale(msPVarP('x' + (fc + 1)), g.rows[ri][fc])); }); lines.push('x' + (pc + 1) + ' = ' + msPrint(msPolyToAst(p, new Map()))); });
        blocks.push(msBlock('answer', 'Answer', lines));
      }
      steps.push('Row-reduced the augmented matrix [A | b] with exact fractions.');
      break;
    }
    default: throw new MsError('Choose a matrix operation');
  }
  if (steps.length) blocks.push(msBlock('steps', 'Method', steps));
  return { read, blocks, data };
}

// ---------------------------------------------------------------- statistics
function msRunStats(text) {
  const s = msNormalize(String(text).replace(/\n/g, ' '));
  if (!s) throw new MsError('Please type some numbers first', 'Example: 4, 8, 15, 16, 23, 42');
  const tokens = s.split(/[\s,;]+/).filter(t => t.length);
  if (tokens.length > 5000) throw new MsError('Please use at most 5000 numbers');
  const xs = tokens.map(t => {
    const f = msFold(msParse(t));
    if (f.t !== 'num') throw new MsError('"' + t + '" is not a number', 'Use numbers like 5, -2.5 or 3/4, separated by commas or spaces.');
    return f.f;
  });
  const n = xs.length;
  const sorted = xs.slice().sort(msfCmp);
  const sum = xs.reduce(msfAdd, MS_ZERO);
  const mean = msfDiv(sum, msFrac(BigInt(n)));
  const medianOf = (arr) => { const k = arr.length; return k % 2 ? arr[(k - 1) / 2] : msfDiv(msfAdd(arr[k / 2 - 1], arr[k / 2]), msFrac(2n)); };
  const counts = new Map(); xs.forEach(x => counts.set(msfStr(x), (counts.get(msfStr(x)) || 0) + 1));
  const maxC = Math.max(...counts.values());
  const modes = maxC === 1 ? [] : sorted.filter((x, i) => (i === 0 || msfCmp(x, sorted[i - 1]) !== 0) && counts.get(msfStr(x)) === maxC);
  const ss = xs.reduce((a, x) => { const d = msfSub(x, mean); return msfAdd(a, msfMul(d, d)); }, MS_ZERO);
  const lines = [];
  const showF = (f) => (msfIsInt(f) ? msfStr(f) : (f.d < 10n ** 9n ? msfStr(f) + ' ≈ ' : '') + msFmtNum(msfToNum(f)));
  lines.push('Count: ' + n, 'Sum: ' + showF(sum), 'Mean: ' + showF(mean), 'Median: ' + showF(medianOf(sorted)));
  lines.push('Mode: ' + (modes.length ? modes.map(msfStr).join(', ') + ' (appears ' + maxC + ' times)' : 'none (every value appears once)'));
  lines.push('Smallest: ' + msfStr(sorted[0]), 'Largest: ' + msfStr(sorted[n - 1]), 'Range: ' + showF(msfSub(sorted[n - 1], sorted[0])));
  if (n >= 2) {
    const half = Math.floor(n / 2);
    const lower = sorted.slice(0, half), upper = sorted.slice(n % 2 ? half + 1 : half);
    const q1 = medianOf(lower), q3 = medianOf(upper);
    lines.push('Q1 (lower quartile): ' + showF(q1), 'Q3 (upper quartile): ' + showF(q3), 'Interquartile range: ' + showF(msfSub(q3, q1)));
  }
  const popVar = msfDiv(ss, msFrac(BigInt(n)));
  lines.push('Population variance: ' + showF(popVar), 'Population standard deviation: ' + msFmtNum(Math.sqrt(msfToNum(popVar))));
  if (n >= 2) {
    const sampVar = msfDiv(ss, msFrac(BigInt(n - 1)));
    lines.push('Sample variance: ' + showF(sampVar), 'Sample standard deviation: ' + msFmtNum(Math.sqrt(msfToNum(sampVar))));
  } else lines.push('Sample variance: needs at least 2 numbers');
  const num = msfToNum;
  const q = n >= 2 ? (() => { const half = Math.floor(n / 2); return [medianOf(sorted.slice(0, half)), medianOf(sorted.slice(n % 2 ? half + 1 : half))]; })() : null;
  const data = { mean: num(mean), median: num(medianOf(sorted)), min: num(sorted[0]), max: num(sorted[n - 1]), pvar: num(popVar), pstdev: Math.sqrt(num(popVar)), var: n >= 2 ? num(msfDiv(ss, msFrac(BigInt(n - 1)))) : null, stdev: n >= 2 ? Math.sqrt(num(msfDiv(ss, msFrac(BigInt(n - 1))))) : null, q1: q ? num(q[0]) : null, q3: q ? num(q[1]) : null };
  return { data, read: n + ' number' + (n === 1 ? '' : 's') + ': ' + sorted.slice(0, 12).map(msfStr).join(', ') + (n > 12 ? ', ...' : ''), blocks: [
    msBlock('answer', 'Results', lines),
    msBlock('steps', 'Formulas used', ['Mean = sum / count', 'Median = middle value of the sorted list (average of the two middle values when the count is even)', 'Variance = sum of (value - mean)² divided by n (population) or by n - 1 (sample)', 'Quartiles: the median of the lower half and of the upper half (the middle value is left out when the count is odd)'])
  ] };
}

// ---------------------------------------------------------------- one entry point for the page
function msRun(req) {
  try {
    const type = req.type;
    let res;
    const text = String(req.text === undefined || req.text === null ? '' : req.text);
    if (type !== 'matrix' && text.trim() === '') throw new MsError('Please type your question first', 'You can tap one of the examples below the box.');
    if (text.length > (type === 'stats' ? 40000 : 4000)) throw new MsError('That is too long');
    if (type === 'solve') res = msSolveText(text, req.variable);
    else if (type === 'simplify' || type === 'expand' || type === 'factor') res = msRunAlgebra(type, text);
    else if (type === 'derivative') res = msRunDerivative(text, req.variable, req.order);
    else if (type === 'integral') res = msRunIntegral(text, req.variable, req.lower, req.upper);
    else if (type === 'evaluate') res = msRunEvaluate(text);
    else if (type === 'matrix') res = msRunMatrix(req.op, text, req.text2);
    else if (type === 'stats') res = msRunStats(text);
    else throw new MsError('Choose a question type');
    const answers = res.blocks.filter(b => b.kind === 'answer' || b.kind === 'pre').map(b => b.lines.join('\n')).join('\n');
    return { ok: true, read: res.read, blocks: res.blocks, answerText: answers, data: res.data || null };
  } catch (e) {
    if (e instanceof MsError) return { ok: false, error: e.message, hint: e.hint };
    if (typeof console !== 'undefined' && console.error) console.error(e);
    return { ok: false, error: 'I could not solve this one.', hint: 'Please check how it is written, or try a simpler version.' };
  }
}

if (typeof module !== 'undefined') {
  Object.assign(module.exports, { msRun, msSplitTop, msSolvePolyUni, msScanRoots, msRunStats, msParseMatrix, msDet, msCharPoly, msSameValue, msFmtComplex });
}

// ================================================================= the page
const MS_TYPES = {
  solve: { label: 'Solve an equation or a system', placeholder: '2x + 3 = 7', hint: 'Write the equation with an = sign, like x^2 - 5x + 6 = 0. For several equations, separate them with commas: x + y = 5, x - y = 1.', fields: ['var'] },
  simplify: { label: 'Simplify', placeholder: '(x^2 - 1)/(x - 1)', hint: 'Combines like terms and cancels common factors.', fields: [] },
  expand: { label: 'Expand', placeholder: '(x + 1)^3', hint: 'Multiplies out brackets and powers.', fields: [] },
  factor: { label: 'Factor', placeholder: 'x^2 - 5x + 6', hint: 'Factors a polynomial. A whole number gives its prime factors.', fields: [] },
  derivative: { label: 'Derivative', placeholder: 'x^3 * sin(x)', hint: 'Write the expression only, like e^(2x) or ln(x^2 + 1).', fields: ['var', 'order'] },
  integral: { label: 'Integral', placeholder: 'x * e^x', hint: 'Leave the limits empty for an indefinite integral, or fill in both limits for a number. Limits may use pi and e.', fields: ['var', 'bounds'] },
  evaluate: { label: 'Calculate a number', placeholder: 'sqrt(8) + 1/3', hint: 'Numbers only. Use pi, e, sqrt(), sin(), ln(), ! for factorial and ° for degrees.', fields: [] },
  matrix: { label: 'Matrix', placeholder: '[[1, 2], [3, 4]]', hint: 'Write a matrix as [[1,2],[3,4]] (rows inside brackets). Entries can be fractions like 1/2.', fields: ['op'] },
  stats: { label: 'Statistics (list of numbers)', placeholder: '4, 8, 15, 16, 23, 42', hint: 'Type numbers separated by commas or spaces.', fields: [] }
};
const MS_EXAMPLES = {
  solve: [['2x + 3 = 7'], ['x^2 - 5x + 6 = 0'], ['x + y = 5, x - y = 1'], ['1/x + 1/(x+1) = 1'], ['sin(x) = 0.5']],
  simplify: [['(x^2 - 1)/(x - 1)'], ['2x + 3x - x'], ['1/x + 1/y']],
  expand: [['(x + 1)^3'], ['(a + b)(a - b)'], ['(2x - 3)^2']],
  factor: [['x^2 - 5x + 6'], ['x^3 - 1'], ['x^2 - y^2'], ['360']],
  derivative: [['x^3 * sin(x)'], ['e^(2x)'], ['(x + 1)/(x - 1)'], ['ln(x^2 + 1)']],
  integral: [['x * e^x'], ['1/(x^2 - 1)'], ['sin(x)^2'], ['x^2', { lower: '0', upper: '3' }]],
  evaluate: [['2 + 3 * 4'], ['sqrt(8) + 1/3'], ['sin(30°)'], ['5!/(3! * 2!)']],
  matrix: [['[[1, 2], [3, 4]]', { op: 'inverse' }], ['[[2, 1], [1, 2]]', { op: 'eigen' }], ['[[2, 1], [1, 3]]', { op: 'solve', text2: '[[3], [5]]' }]],
  stats: [['4, 8, 15, 16, 23, 42'], ['2 2 3 5 7 7 7 9']]
};
const MS_MATRIX_OPS = { det: 'Determinant', inverse: 'Inverse', transpose: 'Transpose', rank: 'Rank', rref: 'Row echelon form', trace: 'Trace', eigen: 'Eigenvalues', power: 'Power (A^n)', add: 'A + B', subtract: 'A - B', multiply: 'A × B', solve: 'Solve A·x = b' };

if (typeof module !== 'undefined') Object.assign(module.exports, { MS_TYPES, MS_EXAMPLES, MS_MATRIX_OPS });

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    const typeSel = $('ms-type'), input = $('ms-input'), input2 = $('ms-input2'), input2Row = $('ms-input2-row'), input2Label = $('ms-input2-label');
    const hint = $('ms-hint'), examples = $('ms-examples'), output = $('ms-output'), solveBtn = $('ms-solve'), clearBtn = $('ms-clear');
    const rows = { var: $('ms-row-var'), order: $('ms-row-order'), bounds: $('ms-row-bounds'), bounds2: $('ms-row-bounds2'), op: $('ms-row-op') };
    const varIn = $('ms-var'), orderSel = $('ms-order'), lower = $('ms-lower'), upper = $('ms-upper'), opSel = $('ms-op');
    let lastAnswer = '';

    Object.keys(MS_TYPES).forEach(k => { const o = document.createElement('option'); o.value = k; o.textContent = MS_TYPES[k].label; typeSel.appendChild(o); });
    Object.keys(MS_MATRIX_OPS).forEach(k => { const o = document.createElement('option'); o.value = k; o.textContent = MS_MATRIX_OPS[k]; opSel.appendChild(o); });
    opSel.value = 'det';

    function updateSecond() {
      const t = typeSel.value, op = opSel.value;
      const need = t === 'matrix' && ['add', 'subtract', 'multiply', 'solve', 'power'].includes(op);
      input2Row.classList.toggle('hidden', !need);
      if (op === 'power') { input2Label.textContent = 'Power n (a whole number from 0 to 30)'; input2.placeholder = '3'; }
      else if (op === 'solve') { input2Label.textContent = 'Vector b'; input2.placeholder = '[[3], [5]]'; }
      else { input2Label.textContent = 'Matrix B'; input2.placeholder = '[[0, 1], [1, 0]]'; }
    }
    function renderExamples() {
      examples.innerHTML = '';
      (MS_EXAMPLES[typeSel.value] || []).forEach(ex => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'ms-chip'; b.textContent = ex[0];
        b.addEventListener('click', () => {
          input.value = ex[0];
          const extra = ex[1] || {};
          varIn.value = ''; lower.value = extra.lower || ''; upper.value = extra.upper || '';
          if (extra.op) opSel.value = extra.op;
          input2.value = extra.text2 || '';
          updateSecond();
          run();
        });
        examples.appendChild(b);
      });
    }
    function applyType() {
      const cfg = MS_TYPES[typeSel.value];
      input.placeholder = cfg.placeholder;
      hint.textContent = cfg.hint;
      Object.keys(rows).forEach(k => rows[k].classList.toggle('hidden', !cfg.fields.includes(k === 'bounds2' ? 'bounds' : k)));
      solveBtn.textContent = typeSel.value === 'solve' ? 'Solve' : typeSel.value === 'evaluate' ? 'Calculate' : 'Get answer';
      updateSecond();
      renderExamples();
    }

    function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
    function renderResult(res) {
      output.innerHTML = '';
      if (!res.ok) {
        const box = el('div', 'ms-error');
        box.setAttribute('role', 'alert');
        box.appendChild(el('strong', '', res.error));
        if (res.hint) box.appendChild(el('p', '', res.hint));
        output.appendChild(box);
        lastAnswer = '';
        return;
      }
      const read = el('p', 'ms-read');
      read.appendChild(el('span', '', 'I read this as: '));
      read.appendChild(el('code', '', res.read));
      output.appendChild(read);
      res.blocks.forEach(b => {
        const sec = el('section', 'ms-block ms-block-' + b.kind);
        if (b.title) sec.appendChild(el('h3', 'ms-block-title', b.title));
        if (b.kind === 'answer') b.lines.forEach(l => sec.appendChild(el('div', 'ms-answer-line', l)));
        else if (b.kind === 'pre') { const pre = el('pre', 'ms-pre', b.lines.join('\n')); sec.appendChild(pre); }
        else if (b.kind === 'steps') { const ol = el('ol', 'ms-list'); b.lines.forEach(l => ol.appendChild(el('li', '', l))); sec.appendChild(ol); }
        else if (b.kind === 'check') { const ul = el('ul', 'ms-list ms-check'); b.lines.forEach(l => ul.appendChild(el('li', '', l))); sec.appendChild(ul); }
        else b.lines.forEach(l => sec.appendChild(el('p', 'ms-note', l)));
        output.appendChild(sec);
      });
      lastAnswer = res.answerText;
      const actions = el('div', 'ms-out-actions');
      const copy = el('button', 'ms-btn'); copy.type = 'button'; copy.id = 'ms-copy';
      copy.innerHTML = '<i class="fa-solid fa-copy" aria-hidden="true"></i> Copy answer';
      copy.addEventListener('click', copyAnswer);
      actions.appendChild(copy);
      output.appendChild(actions);
    }
    function copyAnswer() {
      const text = lastAnswer;
      if (!text) return;
      const done = () => showToast('Answer copied.', 'success');
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
      else fallbackCopy(text, done);
    }
    function fallbackCopy(text, done) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.className = 'ms-offscreen';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { showToast('Could not copy. Select the answer and copy it by hand.', 'warning'); }
      ta.remove();
    }
    function run() {
      const res = msRun({
        type: typeSel.value, text: input.value, variable: varIn.value, order: orderSel.value,
        lower: lower.value, upper: upper.value, op: opSel.value, text2: input2.value
      });
      renderResult(res);
      output.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    typeSel.addEventListener('change', () => { applyType(); });
    opSel.addEventListener('change', updateSecond);
    solveBtn.addEventListener('click', run);
    clearBtn.addEventListener('click', () => {
      input.value = ''; input2.value = ''; varIn.value = ''; lower.value = ''; upper.value = '';
      output.innerHTML = '';
      output.appendChild(el('p', 'ms-empty', 'Your answer will appear here.'));
      lastAnswer = '';
      input.focus();
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(); } });
    [input2, varIn, lower, upper].forEach(i => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); run(); } }));
    applyType();
  });
}
