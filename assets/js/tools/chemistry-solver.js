// Fixlytools - Chemistry Solver
// Pure functions use the prefix "ch". No libraries, no eval, no new Function.
//
// Atomic weights: IUPAC / CIAAW "Abridged Standard Atomic Weights" (https://ciaaw.org/abridged-atomic-weights.htm),
// the 2021 table (IUPAC Technical Report, Pure Appl. Chem. 2022), conventional abridged values.
// Elements that have no standard atomic weight (no stable isotopes: Tc, Pm, Po-Og except Th, Pa, U) carry the mass number of
// a long-lived isotope in the usual way, written in brackets in the periodic table; they are marked with flag 1 below.
// The mass numbers of elements 103-118 come from the usual periodic table listing and were not re-checked against the CIAAW page.

// [Z, symbol, name, weight, flag]  flag 1 = mass number of a long-lived isotope (no standard atomic weight)
var CH_ELEMENTS = [
  [1, 'H', 'Hydrogen', 1.008, 0], [2, 'He', 'Helium', 4.0026, 0], [3, 'Li', 'Lithium', 6.94, 0], [4, 'Be', 'Beryllium', 9.0122, 0],
  [5, 'B', 'Boron', 10.81, 0], [6, 'C', 'Carbon', 12.011, 0], [7, 'N', 'Nitrogen', 14.007, 0], [8, 'O', 'Oxygen', 15.999, 0],
  [9, 'F', 'Fluorine', 18.998, 0], [10, 'Ne', 'Neon', 20.180, 0], [11, 'Na', 'Sodium', 22.990, 0], [12, 'Mg', 'Magnesium', 24.305, 0],
  [13, 'Al', 'Aluminium', 26.982, 0], [14, 'Si', 'Silicon', 28.085, 0], [15, 'P', 'Phosphorus', 30.974, 0], [16, 'S', 'Sulfur', 32.06, 0],
  [17, 'Cl', 'Chlorine', 35.45, 0], [18, 'Ar', 'Argon', 39.95, 0], [19, 'K', 'Potassium', 39.098, 0], [20, 'Ca', 'Calcium', 40.078, 0],
  [21, 'Sc', 'Scandium', 44.956, 0], [22, 'Ti', 'Titanium', 47.867, 0], [23, 'V', 'Vanadium', 50.942, 0], [24, 'Cr', 'Chromium', 51.996, 0],
  [25, 'Mn', 'Manganese', 54.938, 0], [26, 'Fe', 'Iron', 55.845, 0], [27, 'Co', 'Cobalt', 58.933, 0], [28, 'Ni', 'Nickel', 58.693, 0],
  [29, 'Cu', 'Copper', 63.546, 0], [30, 'Zn', 'Zinc', 65.38, 0], [31, 'Ga', 'Gallium', 69.723, 0], [32, 'Ge', 'Germanium', 72.630, 0],
  [33, 'As', 'Arsenic', 74.922, 0], [34, 'Se', 'Selenium', 78.971, 0], [35, 'Br', 'Bromine', 79.904, 0], [36, 'Kr', 'Krypton', 83.798, 0],
  [37, 'Rb', 'Rubidium', 85.468, 0], [38, 'Sr', 'Strontium', 87.62, 0], [39, 'Y', 'Yttrium', 88.906, 0], [40, 'Zr', 'Zirconium', 91.222, 0],
  [41, 'Nb', 'Niobium', 92.906, 0], [42, 'Mo', 'Molybdenum', 95.95, 0], [43, 'Tc', 'Technetium', 98, 1], [44, 'Ru', 'Ruthenium', 101.07, 0],
  [45, 'Rh', 'Rhodium', 102.91, 0], [46, 'Pd', 'Palladium', 106.42, 0], [47, 'Ag', 'Silver', 107.87, 0], [48, 'Cd', 'Cadmium', 112.41, 0],
  [49, 'In', 'Indium', 114.82, 0], [50, 'Sn', 'Tin', 118.71, 0], [51, 'Sb', 'Antimony', 121.76, 0], [52, 'Te', 'Tellurium', 127.60, 0],
  [53, 'I', 'Iodine', 126.90, 0], [54, 'Xe', 'Xenon', 131.29, 0], [55, 'Cs', 'Caesium', 132.91, 0], [56, 'Ba', 'Barium', 137.33, 0],
  [57, 'La', 'Lanthanum', 138.91, 0], [58, 'Ce', 'Cerium', 140.12, 0], [59, 'Pr', 'Praseodymium', 140.91, 0], [60, 'Nd', 'Neodymium', 144.24, 0],
  [61, 'Pm', 'Promethium', 145, 1], [62, 'Sm', 'Samarium', 150.36, 0], [63, 'Eu', 'Europium', 151.96, 0], [64, 'Gd', 'Gadolinium', 157.25, 0],
  [65, 'Tb', 'Terbium', 158.93, 0], [66, 'Dy', 'Dysprosium', 162.50, 0], [67, 'Ho', 'Holmium', 164.93, 0], [68, 'Er', 'Erbium', 167.26, 0],
  [69, 'Tm', 'Thulium', 168.93, 0], [70, 'Yb', 'Ytterbium', 173.05, 0], [71, 'Lu', 'Lutetium', 174.97, 0], [72, 'Hf', 'Hafnium', 178.49, 0],
  [73, 'Ta', 'Tantalum', 180.95, 0], [74, 'W', 'Tungsten', 183.84, 0], [75, 'Re', 'Rhenium', 186.21, 0], [76, 'Os', 'Osmium', 190.23, 0],
  [77, 'Ir', 'Iridium', 192.22, 0], [78, 'Pt', 'Platinum', 195.08, 0], [79, 'Au', 'Gold', 196.97, 0], [80, 'Hg', 'Mercury', 200.59, 0],
  [81, 'Tl', 'Thallium', 204.38, 0], [82, 'Pb', 'Lead', 207.2, 0], [83, 'Bi', 'Bismuth', 208.98, 0], [84, 'Po', 'Polonium', 209, 1],
  [85, 'At', 'Astatine', 210, 1], [86, 'Rn', 'Radon', 222, 1], [87, 'Fr', 'Francium', 223, 1], [88, 'Ra', 'Radium', 226, 1],
  [89, 'Ac', 'Actinium', 227, 1], [90, 'Th', 'Thorium', 232.04, 0], [91, 'Pa', 'Protactinium', 231.04, 0], [92, 'U', 'Uranium', 238.03, 0],
  [93, 'Np', 'Neptunium', 237, 1], [94, 'Pu', 'Plutonium', 244, 1], [95, 'Am', 'Americium', 243, 1], [96, 'Cm', 'Curium', 247, 1],
  [97, 'Bk', 'Berkelium', 247, 1], [98, 'Cf', 'Californium', 251, 1], [99, 'Es', 'Einsteinium', 252, 1], [100, 'Fm', 'Fermium', 257, 1],
  [101, 'Md', 'Mendelevium', 258, 1], [102, 'No', 'Nobelium', 259, 1], [103, 'Lr', 'Lawrencium', 266, 1], [104, 'Rf', 'Rutherfordium', 267, 1],
  [105, 'Db', 'Dubnium', 268, 1], [106, 'Sg', 'Seaborgium', 269, 1], [107, 'Bh', 'Bohrium', 270, 1], [108, 'Hs', 'Hassium', 277, 1],
  [109, 'Mt', 'Meitnerium', 278, 1], [110, 'Ds', 'Darmstadtium', 281, 1], [111, 'Rg', 'Roentgenium', 282, 1], [112, 'Cn', 'Copernicium', 285, 1],
  [113, 'Nh', 'Nihonium', 286, 1], [114, 'Fl', 'Flerovium', 289, 1], [115, 'Mc', 'Moscovium', 290, 1], [116, 'Lv', 'Livermorium', 293, 1],
  [117, 'Ts', 'Tennessine', 294, 1], [118, 'Og', 'Oganesson', 294, 1]
];

var CH_BY_SYMBOL = {};
CH_ELEMENTS.forEach(function (e) {
  CH_BY_SYMBOL[e[1]] = { z: e[0], symbol: e[1], name: e[2], weight: e[3], approx: e[4] === 1 };
});

var CH_AVOGADRO = 6.02214076e23;
var CH_R_SI = 8.314462618;               // J / (mol K), exact SI value
var CH_ATM_PA = 101325;
var CH_MMHG_PA = 101325 / 760;
var CH_KW = 1e-14;                      // at 25 C
var CH_MAX_COUNT = 1000000;

function chFail(msg) { return { ok: false, error: msg }; }

// ---------- formula parser ----------

var CH_SUBSCRIPTS = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };

function chNormalizeFormula(text) {
  return String(text == null ? '' : text)
    .replace(/[₀-₉]/g, function (c) { return CH_SUBSCRIPTS[c]; })
    .replace(/[·•∙⋅*]/g, '.')
    .replace(/[（]/g, '(').replace(/[）]/g, ')')
    .replace(/[［]/g, '[').replace(/[］]/g, ']')
    .trim();
}

// Parses one part (no hydrate dot) into counts. Returns { ok, counts } or { ok: false, error }.
function chParseBody(body) {
  var pos = 0;
  var closers = { '(': ')', '[': ']', '{': '}' };

  function readNumber() {
    var m = /^\d+/.exec(body.slice(pos));
    if (!m) return null;
    pos += m[0].length;
    var n = parseInt(m[0], 10);
    if (n < 1) throw chFail('A count of 0 is not allowed (found "' + m[0] + '")');
    if (n > CH_MAX_COUNT) throw chFail('A count is too large (found "' + m[0] + '")');
    return n;
  }

  function add(into, from, times) {
    Object.keys(from).forEach(function (k) {
      into[k] = (into[k] || 0) + from[k] * times;
      if (into[k] > CH_MAX_COUNT * 10) throw chFail('The formula has too many atoms');
    });
  }

  function parseSeq(closer, depth) {
    var counts = {};
    var any = false;
    while (pos < body.length) {
      var ch = body.charAt(pos);
      if (closer && ch === closer) return counts;
      if (ch === ')' || ch === ']' || ch === '}') {
        throw chFail(closer ? 'Brackets do not match: expected "' + closer + '" but found "' + ch + '"' : 'There is a closing bracket "' + ch + '" without an opening bracket');
      }
      if (closers[ch]) {
        if (depth > 20) throw chFail('Brackets are nested too deeply');
        pos++;
        var inner = parseSeq(closers[ch], depth + 1);
        if (pos >= body.length) throw chFail('Missing closing bracket "' + closers[ch] + '"');
        pos++;                                   // consume the closer
        if (Object.keys(inner).length === 0) throw chFail('There is an empty pair of brackets');
        var n = readNumber();
        add(counts, inner, n === null ? 1 : n);
        any = true;
        continue;
      }
      if (/[A-Z]/.test(ch)) {
        var sym = ch;
        var next = body.charAt(pos + 1);
        if (/[a-z]/.test(next)) {
          if (CH_BY_SYMBOL[ch + next]) sym = ch + next;
          else if (!CH_BY_SYMBOL[ch]) throw chFail('Unknown element symbol: "' + ch + next + '"');
          else throw chFail('Unknown element symbol: "' + ch + next + '". Element symbols are case-sensitive: write a second letter in lower case only when it belongs to the symbol');
        } else if (!CH_BY_SYMBOL[ch]) {
          throw chFail('Unknown element symbol: "' + ch + '"');
        }
        pos += sym.length;
        var c = readNumber();
        counts[sym] = (counts[sym] || 0) + (c === null ? 1 : c);
        any = true;
        continue;
      }
      if (/[a-z]/.test(ch)) throw chFail('Element symbols start with a capital letter (found "' + ch + '")');
      if (/\d/.test(ch)) throw chFail('A number must follow an element or a closing bracket (found "' + ch + '")');
      if (ch === '+' || ch === '-') throw chFail('Charges and ions are not supported (found "' + ch + '")');
      if (/\s/.test(ch)) throw chFail('Formulas cannot contain spaces');
      throw chFail('Not understood: "' + ch + '"');
    }
    if (closer) throw chFail('Missing closing bracket "' + closer + '"');
    if (!any) throw chFail('Type a formula');
    return counts;
  }

  try {
    var counts = parseSeq(null, 0);
    return { ok: true, counts: counts };
  } catch (e) {
    if (e && e.ok === false) return e;
    return chFail('Could not read this formula');
  }
}

// Splits at hydrate dots (outside brackets) and parses each part, which may start with a whole-number coefficient.
function chParseFormula(text) {
  var s = chNormalizeFormula(text);
  if (s === '') return chFail('Type a formula');
  if (s.length > 200) return chFail('The formula is too long');
  var parts = [];
  var depth = 0;
  var start = 0;
  for (var i = 0; i < s.length; i++) {
    var c = s.charAt(i);
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === '.' && depth === 0) { parts.push(s.slice(start, i)); start = i + 1; }
  }
  parts.push(s.slice(start));
  var total = {};
  var order = [];
  for (var p = 0; p < parts.length; p++) {
    var part = parts[p];
    var coef = 1;
    var m = /^(\d+)(.*)$/.exec(part);
    if (m && p > 0) {
      coef = parseInt(m[1], 10);
      part = m[2];
      if (coef < 1) return chFail('A hydrate coefficient must be at least 1');
    }
    if (part === '') return chFail(p === 0 ? 'Type a formula' : 'There is nothing after a dot');
    var r = chParseBody(part);
    if (!r.ok) return r;
    Object.keys(r.counts).forEach(function (k) {
      if (!(k in total)) order.push(k);
      total[k] = (total[k] || 0) + r.counts[k] * coef;
    });
  }
  return { ok: true, counts: total, order: order };
}

// ---------- molar mass and composition ----------

function chMolarMass(counts, order) {
  var keys = order || Object.keys(counts);
  var rows = [];
  var total = 0;
  var approx = false;
  keys.forEach(function (sym) {
    var el = CH_BY_SYMBOL[sym];
    var sub = el.weight * counts[sym];
    rows.push({ symbol: sym, name: el.name, count: counts[sym], weight: el.weight, subtotal: sub, approx: el.approx });
    total += sub;
    if (el.approx) approx = true;
  });
  return { rows: rows, total: total, approx: approx };
}

function chMolarMassOf(formula) {
  var p = chParseFormula(formula);
  if (!p.ok) return p;
  var m = chMolarMass(p.counts, p.order);
  return { ok: true, rows: m.rows, total: m.total, approx: m.approx };
}

function chPercentComposition(formula) {
  var m = chMolarMassOf(formula);
  if (!m.ok) return m;
  m.rows.forEach(function (r) { r.percent = r.subtotal / m.total * 100; });
  return m;
}

// ---------- number formatting ----------

// Formats with a number of significant figures; exponent form for very large or small numbers.
function chSig(x, sig) {
  if (typeof x !== 'number' || !isFinite(x)) return '—';
  if (x === 0) return '0';
  var s = sig || 6;
  var abs = Math.abs(x);
  if (abs >= 1e9 || abs < 1e-4) {
    var e = x.toExponential(s - 1);
    var parts = e.split('e');
    var mant = parts[0].indexOf('.') !== -1 ? parts[0].replace(/\.?0+$/, '') : parts[0];
    var exp = parts[1].replace('+', '');
    return mant + ' × 10^' + exp;
  }
  var str = Number(x.toPrecision(s)).toString();
  if (/e/.test(str)) str = x.toFixed(Math.max(0, s - 1 - Math.floor(Math.log10(abs))));
  return str;
}

// ---------- mole conversions ----------

// kinds: 'g', 'mol', 'particles'. Returns { ok, value } or { ok: false, error }.
function chConvertMole(from, to, value, molarMass) {
  if (!isFinite(value)) return chFail('Enter a number');
  if (value < 0) return chFail('The amount cannot be negative');
  var needMass = (from === 'g') !== (to === 'g');
  if (needMass && !(molarMass > 0)) return chFail('A molar mass above 0 is needed to convert between grams and moles or particles');
  var mol;
  if (from === 'g') mol = value / molarMass;
  else if (from === 'mol') mol = value;
  else mol = value / CH_AVOGADRO;
  var out;
  if (to === 'g') out = mol * molarMass;
  else if (to === 'mol') out = mol;
  else out = mol * CH_AVOGADRO;
  return { ok: true, value: out, mol: mol };
}

// ---------- equation balancer (exact rational arithmetic with BigInt) ----------

function chBigGcd(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) { var t = a % b; a = b; b = t; }
  return a;
}

function chFrac(n, d) {
  if (d === undefined) d = 1n;
  if (d < 0n) { n = -n; d = -d; }
  var g = chBigGcd(n, d);
  if (g > 1n) { n /= g; d /= g; }
  return { n: n, d: d };
}
function chFracSub(a, b) { return chFrac(a.n * b.d - b.n * a.d, a.d * b.d); }
function chFracMul(a, b) { return chFrac(a.n * b.n, a.d * b.d); }
function chFracDiv(a, b) { return chFrac(a.n * b.d, a.d * b.n); }
function chFracZero(a) { return a.n === 0n; }

// Splits "A + B -> C + D" into { left: [...], right: [...] } of species strings.
function chSplitEquation(text) {
  var s = String(text == null ? '' : text)
    .replace(/[→⟶⇒➔⟹]/g, '->')
    .replace(/=>/g, '->')
    .replace(/[₂]/g, '2');
  s = chNormalizeFormulaKeepDots(s);
  var sides;
  if (s.indexOf('->') !== -1) sides = s.split('->');
  else if (s.indexOf('=') !== -1) sides = s.split('=');
  else return chFail('Write the equation with an arrow, for example Fe + O2 -> Fe2O3');
  if (sides.length !== 2) return chFail('Use exactly one arrow (or one "=") in the equation');
  var out = [];
  for (var i = 0; i < 2; i++) {
    var species = sides[i].split('+').map(function (x) { return x.replace(/\s+/g, ''); });
    for (var j = 0; j < species.length; j++) {
      if (species[j] === '') return chFail('There is a missing substance next to a "+" sign or an arrow');
    }
    out.push(species);
  }
  return { ok: true, left: out[0], right: out[1] };
}

function chNormalizeFormulaKeepDots(s) {
  return s.replace(/[₀-₉]/g, function (c) { return CH_SUBSCRIPTS[c]; });
}

function chBalance(text) {
  var sp = chSplitEquation(text);
  if (!sp.ok) return sp;
  var all = sp.left.concat(sp.right);
  if (all.length > 12) return chFail('Too many substances (the limit is 12)');
  var parsed = [];
  for (var i = 0; i < all.length; i++) {
    if (/^\d/.test(all[i])) return chFail('Write each substance without a coefficient, for example H2 + O2 -> H2O (found "' + all[i] + '")');
    var p = chParseFormula(all[i]);
    if (!p.ok) return chFail(p.error + ' (in "' + all[i] + '")');
    parsed.push(p.counts);
  }
  var elements = [];
  parsed.forEach(function (c) { Object.keys(c).forEach(function (k) { if (elements.indexOf(k) === -1) elements.push(k); }); });
  var nLeft = sp.left.length;
  // element matrix: rows = elements, columns = substances (products negative)
  var rows = elements.map(function (el) {
    return parsed.map(function (c, j) { return chFrac(BigInt((c[el] || 0) * (j < nLeft ? 1 : -1))); });
  });
  var cols = all.length;
  // reduced row echelon form
  var pivotCols = [];
  var r = 0;
  for (var c = 0; c < cols && r < rows.length; c++) {
    var piv = -1;
    for (var k = r; k < rows.length; k++) { if (!chFracZero(rows[k][c])) { piv = k; break; } }
    if (piv === -1) continue;
    var tmp = rows[r]; rows[r] = rows[piv]; rows[piv] = tmp;
    var pv = rows[r][c];
    rows[r] = rows[r].map(function (x) { return chFracDiv(x, pv); });
    for (var k2 = 0; k2 < rows.length; k2++) {
      if (k2 !== r && !chFracZero(rows[k2][c])) {
        var f = rows[k2][c];
        rows[k2] = rows[k2].map(function (x, idx) { return chFracSub(x, chFracMul(f, rows[r][idx])); });
      }
    }
    pivotCols.push(c);
    r++;
  }
  var free = [];
  for (var cc = 0; cc < cols; cc++) { if (pivotCols.indexOf(cc) === -1) free.push(cc); }
  if (free.length === 0) return chFail('These substances cannot be balanced into this equation.');
  if (free.length > 1) return chFail('This equation has more than one balanced form. Give more specific reactants and products.');
  var fc = free[0];
  var vec = [];
  for (var j = 0; j < cols; j++) vec.push(chFrac(0n));
  vec[fc] = chFrac(1n);
  pivotCols.forEach(function (pc, rowIdx) { vec[pc] = chFrac(-rows[rowIdx][fc].n, rows[rowIdx][fc].d); });
  // scale to the smallest whole numbers
  var lcm = 1n;
  vec.forEach(function (x) { lcm = lcm / chBigGcd(lcm, x.d) * x.d; });
  var ints = vec.map(function (x) { return x.n * (lcm / x.d); });
  var g = 0n;
  ints.forEach(function (x) { g = chBigGcd(g, x); });
  ints = ints.map(function (x) { return x / g; });
  var allPos = ints.every(function (x) { return x > 0n; });
  var allNeg = ints.every(function (x) { return x < 0n; });
  if (!allPos && !allNeg) return chFail('These substances cannot be balanced into this equation.');
  if (allNeg) ints = ints.map(function (x) { return -x; });
  var coeffs = ints.map(function (x) { return Number(x); });
  if (coeffs.some(function (x) { return x > 1000000; })) return chFail('The balanced coefficients are too large to show');
  function side(list, offset) {
    return list.map(function (s, i) { var cf = coeffs[offset + i]; return (cf === 1 ? '' : cf) + s; }).join(' + ');
  }
  return {
    ok: true,
    coeffs: coeffs,
    left: sp.left,
    right: sp.right,
    text: side(sp.left, 0) + ' → ' + side(sp.right, nLeft)
  };
}

// ---------- solutions ----------

// Molarity M = n / V. Pass exactly one of n (mol), V (L), M (mol/L) as null. Returns { ok, key, value }.
function chMolarity(n, V, M) {
  var blanks = [n, V, M].filter(function (x) { return x === null; }).length;
  if (blanks !== 1) return chFail('Leave exactly one of the three boxes empty');
  var vals = [n, V, M];
  for (var i = 0; i < 3; i++) {
    if (vals[i] !== null && !(vals[i] > 0) ) return chFail('Every value must be a number above 0');
  }
  if (n === null) return { ok: true, key: 'n', value: M * V };
  if (V === null) return { ok: true, key: 'V', value: n / M };
  return { ok: true, key: 'M', value: n / V };
}

// Dilution C1 V1 = C2 V2. Exactly one of the four is null (all in consistent units).
function chDilution(C1, V1, C2, V2) {
  var vals = [C1, V1, C2, V2];
  var blanks = vals.filter(function (x) { return x === null; }).length;
  if (blanks !== 1) return chFail('Leave exactly one of the four boxes empty');
  for (var i = 0; i < 4; i++) {
    if (vals[i] !== null && !(vals[i] > 0)) return chFail('Every value must be a number above 0');
  }
  if (C1 === null) return { ok: true, key: 'C1', value: C2 * V2 / V1 };
  if (V1 === null) return { ok: true, key: 'V1', value: C2 * V2 / C1 };
  if (C2 === null) return { ok: true, key: 'C2', value: C1 * V1 / V2 };
  return { ok: true, key: 'V2', value: C1 * V1 / C2 };
}

// ---------- pH at 25 C ----------

// kind: 'pH' | 'pOH' | 'H' | 'OH'. Returns { ok, pH, pOH, H, OH }.
function chPh(kind, value) {
  if (!isFinite(value)) return chFail('Enter a number');
  var pH;
  if (kind === 'pH') pH = value;
  else if (kind === 'pOH') pH = 14 - value;
  else if (kind === 'H') {
    if (!(value > 0)) return chFail('The concentration must be above 0');
    pH = -Math.log10(value);
  } else if (kind === 'OH') {
    if (!(value > 0)) return chFail('The concentration must be above 0');
    pH = 14 + Math.log10(value);
  } else return chFail('Choose what you know');
  if (Math.abs(pH) > 100) return chFail('That value is out of a sensible range');
  var pOH = 14 - pH;
  var H = kind === 'H' ? value : Math.pow(10, -pH);
  var OH = kind === 'OH' ? value : Math.pow(10, -pOH);
  return { ok: true, pH: pH, pOH: pOH, H: H, OH: OH };
}

// Strong acid or base of concentration c (mol/L) that releases `n` H+ or OH- per formula unit.
// Uses the water autoionisation term so very dilute solutions stay correct.
function chStrongPh(type, c, n) {
  if (!(c > 0)) return chFail('The concentration must be above 0');
  var k = n > 0 ? n : 1;
  var total = c * k;
  var x = (total + Math.sqrt(total * total + 4 * CH_KW)) / 2;     // [H+] for an acid or [OH-] for a base
  if (type === 'acid') return chPh('H', x);
  if (type === 'base') return chPh('OH', x);
  return chFail('Choose acid or base');
}

// ---------- ideal gas law ----------

var CH_P_UNITS = { atm: CH_ATM_PA, kPa: 1000, mmHg: CH_MMHG_PA, Pa: 1 };
var CH_V_UNITS = { L: 1e-3, mL: 1e-6 };

function chToKelvin(value, unit) {
  if (unit === 'C') return value + 273.15;
  return value;
}
function chFromKelvin(k, unit) {
  return unit === 'C' ? k - 273.15 : k;
}

// Solves PV = nRT. Pass exactly one of P, V, n, T as null; units: pUnit, vUnit, tUnit.
function chIdealGas(P, V, n, T, units) {
  var u = units || { p: 'atm', v: 'L', t: 'K' };
  var vals = [P, V, n, T];
  var blanks = vals.filter(function (x) { return x === null; }).length;
  if (blanks !== 1) return chFail('Leave exactly one of pressure, volume, moles and temperature empty');
  var p = P === null ? null : P * CH_P_UNITS[u.p];
  var v = V === null ? null : V * CH_V_UNITS[u.v];
  var t = T === null ? null : chToKelvin(T, u.t);
  if (p !== null && !(p > 0)) return chFail('Pressure must be above 0');
  if (v !== null && !(v > 0)) return chFail('Volume must be above 0');
  if (n !== null && !(n > 0)) return chFail('The amount of gas must be above 0');
  if (t !== null && !(t > 0)) return chFail('The absolute temperature must be above 0 K (below -273.15 °C is impossible)');
  if (P === null) return { ok: true, key: 'P', value: n * CH_R_SI * t / v / CH_P_UNITS[u.p] };
  if (V === null) return { ok: true, key: 'V', value: n * CH_R_SI * t / p / CH_V_UNITS[u.v] };
  if (n === null) return { ok: true, key: 'n', value: p * v / (CH_R_SI * t) };
  return { ok: true, key: 'T', value: chFromKelvin(p * v / (n * CH_R_SI), u.t) };
}

if (typeof module !== 'undefined') {
  module.exports = {
    CH_ELEMENTS, CH_BY_SYMBOL, CH_AVOGADRO, CH_R_SI, chParseFormula, chMolarMass, chMolarMassOf, chPercentComposition, chSig,
    chConvertMole, chSplitEquation, chBalance, chMolarity, chDilution, chPh, chStrongPh, chIdealGas, chToKelvin, chNormalizeFormula
  };
}

// ---------- page wiring ----------

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function () {
    var $ = function (id) { return document.getElementById(id); };
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.ch-tab'));
    var panels = Array.prototype.slice.call(document.querySelectorAll('.ch-panel'));
    if (!tabs.length) return;

    function showTab(id, focus) {
      tabs.forEach(function (t) {
        var on = t.getAttribute('data-panel') === id;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        if (on && focus) t.focus();
      });
      panels.forEach(function (p) { p.hidden = p.id !== id; });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { showTab(t.getAttribute('data-panel'), false); });
      t.addEventListener('keydown', function (e) {
        var j = -1;
        if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') j = (i + tabs.length - 1) % tabs.length;
        else if (e.key === 'Home') j = 0;
        else if (e.key === 'End') j = tabs.length - 1;
        if (j >= 0) { e.preventDefault(); showTab(tabs[j].getAttribute('data-panel'), true); }
      });
    });

    function num(id) {
      var raw = $(id).value.trim().replace(',', '.');
      if (raw === '') return null;
      var v = Number(raw);
      return isFinite(v) ? v : NaN;
    }
    function setOut(id, html, isError) {
      var el = $(id);
      el.innerHTML = html;
      el.classList.toggle('ch-error', !!isError);
    }
    function err(id, msg) { setOut(id, '<p>' + escapeHtml(msg) + '</p>', true); }
    function copyBtn(text) {
      return '<button type="button" class="ch-copy" data-copy="' + escapeHtml(text) + '">Copy</button>';
    }
    function tableHtml(head, rowsHtml) {
      return '<div class="ch-table-wrap"><table class="ch-table"><thead><tr>' + head.map(function (h) { return '<th scope="col">' + h + '</th>'; }).join('') + '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div>';
    }
    document.addEventListener('click', function (e) {
      var b = e.target.closest('.ch-copy');
      if (!b) return;
      var text = b.getAttribute('data-copy');
      copyText(text).then(function () { showToast('Copied', 'success'); }).catch(function () { showToast('Could not copy', 'error'); });
    });
    function chips(containerId, inputId, onPick) {
      var c = $(containerId);
      if (!c) return;
      c.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-v]');
        if (!b) return;
        $(inputId).value = b.getAttribute('data-v');
        if (onPick) onPick();
      });
    }
    function enter(inputId, fn) {
      $(inputId).addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); fn(); } });
    }

    // --- molar mass ---
    function doMolar() {
      var r = chMolarMassOf($('ch-mm-input').value);
      if (!r.ok) { err('ch-mm-out', r.error); return; }
      var rows = r.rows.map(function (x) {
        return '<tr><td>' + escapeHtml(x.symbol) + ' <span class="ch-dim">' + escapeHtml(x.name) + '</span></td><td>' + x.count + '</td><td>' + chSig(x.weight, 7) + (x.approx ? '*' : '') + '</td><td>' + chSig(x.subtotal, 7) + '</td></tr>';
      }).join('');
      var note = r.approx ? '<p class="ch-note">* This element has no standard atomic weight; the mass number of a long-lived isotope is used.</p>' : '';
      setOut('ch-mm-out', '<p class="ch-big">Molar mass: <strong>' + chSig(r.total, 7) + ' g/mol</strong> ' + copyBtn(chSig(r.total, 7)) + '</p>' +
        tableHtml(['Element', 'Atoms', 'Atomic weight (g/mol)', 'Subtotal (g/mol)'], rows) + note, false);
    }
    $('ch-mm-go').addEventListener('click', doMolar);
    enter('ch-mm-input', doMolar);
    chips('ch-mm-chips', 'ch-mm-input', doMolar);

    // --- percent composition ---
    function doPercent() {
      var r = chPercentComposition($('ch-pc-input').value);
      if (!r.ok) { err('ch-pc-out', r.error); return; }
      var rows = r.rows.map(function (x) {
        return '<tr><td>' + escapeHtml(x.symbol) + ' <span class="ch-dim">' + escapeHtml(x.name) + '</span></td><td>' + chSig(x.subtotal, 6) + '</td><td>' + x.percent.toFixed(2) + ' %</td></tr>';
      }).join('');
      setOut('ch-pc-out', '<p class="ch-big">Molar mass: <strong>' + chSig(r.total, 7) + ' g/mol</strong></p>' +
        tableHtml(['Element', 'Mass in one mole (g)', 'Percent by mass'], rows), false);
    }
    $('ch-pc-go').addEventListener('click', doPercent);
    enter('ch-pc-input', doPercent);
    chips('ch-pc-chips', 'ch-pc-input', doPercent);

    // --- mole conversions ---
    function doMole() {
      var from = $('ch-mo-from').value;
      var to = $('ch-mo-to').value;
      var value = num('ch-mo-value');
      if (value === null || isNaN(value)) { err('ch-mo-out', 'Enter the amount you have as a number'); return; }
      var mm = null;
      var formula = $('ch-mo-formula').value.trim();
      var typed = num('ch-mo-mm');
      if (typed !== null) {
        if (isNaN(typed) || !(typed > 0)) { err('ch-mo-out', 'The molar mass must be a number above 0'); return; }
        mm = typed;
      } else if (formula !== '') {
        var m = chMolarMassOf(formula);
        if (!m.ok) { err('ch-mo-out', m.error); return; }
        mm = m.total;
      }
      var r = chConvertMole(from, to, value, mm);
      if (!r.ok) { err('ch-mo-out', r.error); return; }
      var unit = { g: 'g', mol: 'mol', particles: 'particles' };
      var text = chSig(r.value, 6) + ' ' + unit[to];
      setOut('ch-mo-out', '<p class="ch-big"><strong>' + escapeHtml(text) + '</strong> ' + copyBtn(text) + '</p>' +
        '<p class="ch-note">Working: ' + escapeHtml(chSig(value, 6) + ' ' + unit[from]) + (mm ? ' with molar mass ' + chSig(mm, 7) + ' g/mol' : '') + ', Avogadro constant 6.02214076 × 10^23 per mol.</p>', false);
    }
    $('ch-mo-go').addEventListener('click', doMole);
    ['ch-mo-value', 'ch-mo-formula', 'ch-mo-mm'].forEach(function (id) { enter(id, doMole); });

    // --- balancer ---
    function doBalance() {
      var r = chBalance($('ch-bal-input').value);
      if (!r.ok) { err('ch-bal-out', r.error); return; }
      setOut('ch-bal-out', '<p class="ch-big"><strong>' + escapeHtml(r.text) + '</strong> ' + copyBtn(r.text) + '</p>' +
        '<p class="ch-note">Coefficients in order: ' + r.coeffs.join(', ') + '. Checked by counting atoms on both sides.</p>', false);
    }
    $('ch-bal-go').addEventListener('click', doBalance);
    enter('ch-bal-input', doBalance);
    chips('ch-bal-chips', 'ch-bal-input', doBalance);

    // --- solutions ---
    function molarityRun() {
      var nRaw = num('ch-so-n'), V = num('ch-so-v'), M = num('ch-so-m');
      if ([nRaw, V, M].some(function (x) { return x !== null && isNaN(x); })) { err('ch-so-out', 'Use numbers only'); return; }
      var nUnit = $('ch-so-n-unit').value, vUnit = $('ch-so-v-unit').value, mUnit = $('ch-so-m-unit').value;
      var mm = null;
      if (nUnit === 'g') {
        var f = $('ch-so-formula').value.trim();
        var typed = num('ch-so-mm');
        if (typed !== null && typed > 0) mm = typed;
        else if (f !== '') {
          var pm = chMolarMassOf(f);
          if (!pm.ok) { err('ch-so-out', pm.error); return; }
          mm = pm.total;
        }
        if (mm === null) { err('ch-so-out', 'To use grams, type a formula or a molar mass'); return; }
      }
      var nMol = nRaw === null ? null : (nUnit === 'g' ? nRaw / mm : (nUnit === 'mmol' ? nRaw / 1000 : nRaw));
      var VL = V === null ? null : (vUnit === 'mL' ? V / 1000 : V);
      var ML = M === null ? null : (mUnit === 'mmol/L' ? M / 1000 : M);
      var r = chMolarity(nMol, VL, ML);
      if (!r.ok) { err('ch-so-out', r.error); return; }
      var text;
      if (r.key === 'M') text = 'Molarity = ' + chSig(mUnit === 'mmol/L' ? r.value * 1000 : r.value, 6) + ' ' + mUnit;
      else if (r.key === 'V') text = 'Volume = ' + chSig(vUnit === 'mL' ? r.value * 1000 : r.value, 6) + ' ' + vUnit;
      else {
        var shown = nUnit === 'g' ? r.value * mm : (nUnit === 'mmol' ? r.value * 1000 : r.value);
        text = (nUnit === 'g' ? 'Mass needed = ' : 'Amount = ') + chSig(shown, 6) + ' ' + nUnit;
      }
      setOut('ch-so-out', '<p class="ch-big"><strong>' + escapeHtml(text) + '</strong> ' + copyBtn(text) + '</p><p class="ch-note">Using M = n / V' + (mm ? ' and n = mass / molar mass (' + chSig(mm, 7) + ' g/mol)' : '') + '.</p>', false);
    }
    $('ch-so-go').addEventListener('click', molarityRun);

    function dilutionRun() {
      var c1 = num('ch-di-c1'), v1 = num('ch-di-v1'), c2 = num('ch-di-c2'), v2 = num('ch-di-v2');
      if ([c1, v1, c2, v2].some(function (x) { return x !== null && isNaN(x); })) { err('ch-di-out', 'Use numbers only'); return; }
      var cu1 = $('ch-di-c1-unit').value, cu2 = $('ch-di-c2-unit').value, vu1 = $('ch-di-v1-unit').value, vu2 = $('ch-di-v2-unit').value;
      var cf = function (v, u) { return v === null ? null : (u === 'mmol/L' ? v / 1000 : v); };
      var vf = function (v, u) { return v === null ? null : (u === 'mL' ? v / 1000 : v); };
      var r = chDilution(cf(c1, cu1), vf(v1, vu1), cf(c2, cu2), vf(v2, vu2));
      if (!r.ok) { err('ch-di-out', r.error); return; }
      var text;
      if (r.key === 'C1') text = 'C1 = ' + chSig(cu1 === 'mmol/L' ? r.value * 1000 : r.value, 6) + ' ' + cu1;
      else if (r.key === 'C2') text = 'C2 = ' + chSig(cu2 === 'mmol/L' ? r.value * 1000 : r.value, 6) + ' ' + cu2;
      else if (r.key === 'V1') text = 'V1 = ' + chSig(vu1 === 'mL' ? r.value * 1000 : r.value, 6) + ' ' + vu1;
      else text = 'V2 = ' + chSig(vu2 === 'mL' ? r.value * 1000 : r.value, 6) + ' ' + vu2;
      setOut('ch-di-out', '<p class="ch-big"><strong>' + escapeHtml(text) + '</strong> ' + copyBtn(text) + '</p><p class="ch-note">Using C1 × V1 = C2 × V2. Check that the stronger solution is C1 and the diluted one is C2.</p>', false);
    }
    $('ch-di-go').addEventListener('click', dilutionRun);
    $('ch-so-n-unit').addEventListener('change', function () { $('ch-so-gram-row').hidden = $('ch-so-n-unit').value !== 'g'; });

    // --- pH ---
    function phRun() {
      var kind = $('ch-ph-kind').value;
      var v = num('ch-ph-value');
      if (v === null || isNaN(v)) { err('ch-ph-out', 'Enter a number'); return; }
      var r = chPh(kind, v);
      if (!r.ok) { err('ch-ph-out', r.error); return; }
      var note = (r.pH < 0 || r.pH > 14) ? '<p class="ch-note">The pH is outside 0 to 14. That is possible for very strong solutions, but real measurements are less exact there.</p>' : '';
      setOut('ch-ph-out', tableHtml(['Quantity', 'Value'],
        '<tr><td>pH</td><td>' + chSig(r.pH, 5) + '</td></tr><tr><td>pOH</td><td>' + chSig(r.pOH, 5) + '</td></tr><tr><td>[H+] (mol/L)</td><td>' + chSig(r.H, 4) + '</td></tr><tr><td>[OH-] (mol/L)</td><td>' + chSig(r.OH, 4) + '</td></tr>') +
        '<p class="ch-note">At 25 °C: pH + pOH = 14 and Kw = 1 × 10^-14.</p>' + note, false);
    }
    $('ch-ph-go').addEventListener('click', phRun);
    enter('ch-ph-value', phRun);

    function strongRun() {
      var c = num('ch-st-c');
      if (c === null || isNaN(c)) { err('ch-st-out', 'Enter the concentration in mol/L'); return; }
      var r = chStrongPh($('ch-st-type').value, c, Number($('ch-st-n').value));
      if (!r.ok) { err('ch-st-out', r.error); return; }
      setOut('ch-st-out', '<p class="ch-big">pH = <strong>' + chSig(r.pH, 4) + '</strong> &nbsp; pOH = ' + chSig(r.pOH, 4) + ' ' + copyBtn(chSig(r.pH, 4)) + '</p>' +
        '<p class="ch-note">[H+] = ' + chSig(r.H, 4) + ' mol/L, [OH-] = ' + chSig(r.OH, 4) + ' mol/L. Assumes the acid or base is fully dissociated.</p>', false);
    }
    $('ch-st-go').addEventListener('click', strongRun);
    enter('ch-st-c', strongRun);

    // --- ideal gas ---
    function gasRun() {
      var P = num('ch-ga-p'), V = num('ch-ga-v'), n = num('ch-ga-n'), T = num('ch-ga-t');
      if ([P, V, n, T].some(function (x) { return x !== null && isNaN(x); })) { err('ch-ga-out', 'Use numbers only'); return; }
      var units = { p: $('ch-ga-p-unit').value, v: $('ch-ga-v-unit').value, t: $('ch-ga-t-unit').value };
      var r = chIdealGas(P, V, n, T, units);
      if (!r.ok) { err('ch-ga-out', r.error); return; }
      var label = { P: 'Pressure', V: 'Volume', n: 'Amount of gas', T: 'Temperature' }[r.key];
      var unit = { P: units.p, V: units.v, n: 'mol', T: units.t === 'C' ? '°C' : 'K' }[r.key];
      var text = label + ' = ' + chSig(r.value, 6) + ' ' + unit;
      setOut('ch-ga-out', '<p class="ch-big"><strong>' + escapeHtml(text) + '</strong> ' + copyBtn(text) + '</p><p class="ch-note">Using PV = nRT with R = 8.314462618 J/(mol·K) = 0.082057 L·atm/(mol·K). Temperatures are converted to kelvin.</p>', false);
    }
    $('ch-ga-go').addEventListener('click', gasRun);
    ['ch-ga-p', 'ch-ga-v', 'ch-ga-n', 'ch-ga-t'].forEach(function (id) { enter(id, gasRun); });

    showTab('ch-panel-molar', false);
  });
}
