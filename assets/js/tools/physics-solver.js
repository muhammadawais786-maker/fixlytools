// Fixlytools - Physics Solver
// Pick a formula, fill in what you know, solve for the unknown. Every formula is data (see PY_FORMULAS):
// variables with unit type and allowed range, one solved form per variable, and a text template used to show the working.
// No eval and no new Function anywhere: the formulas are normal JavaScript functions written in this file.

// ---------- constants ----------
// g: standard gravity, exact by definition (CGPM 1901).  G, k: CODATA 2018 recommended values (k = 1 / (4 pi eps0)).
// R: molar gas constant = N_A x k_B, exact since the 2019 SI redefinition (8.31446261815324, shown rounded).
const PY_CONSTS = { g: 9.80665, G: 6.6743e-11, k: 8.9875517923e9, R: 8.314462618 };
const PY_G_CHOICES = { standard: 9.80665, rounded: 9.81 };

// ---------- units ----------
// Every unit is either a factor to the SI base unit or { to, from, label } for units with an offset (temperature).
const PY_UNITS = {
  length: { def: 'm', u: { mm: 1e-3, cm: 1e-2, m: 1, km: 1e3, in: 0.0254, ft: 0.3048, mi: 1609.344 } },
  wavelength: { def: 'nm', u: { nm: 1e-9, 'µm': 1e-6, mm: 1e-3, cm: 1e-2, m: 1 } },
  mass: { def: 'kg', u: { mg: 1e-6, g: 1e-3, kg: 1, lb: 0.45359237 } },
  time: { def: 's', u: { ms: 1e-3, s: 1, min: 60, h: 3600 } },
  speed: { def: 'm/s', u: { 'm/s': 1, 'km/h': 1 / 3.6, mph: 0.44704, 'ft/s': 0.3048 } },
  accel: { def: 'm/s²', u: { 'm/s²': 1, 'cm/s²': 1e-2, 'ft/s²': 0.3048 } },
  force: { def: 'N', u: { N: 1, kN: 1e3, lbf: 4.4482216152605 } },
  energy: { def: 'J', u: { J: 1, kJ: 1e3, cal: 4.184, kcal: 4184, kWh: 3.6e6 } },
  power: { def: 'W', u: { W: 1, kW: 1e3, hp: 745.69987158227022 } },
  pressure: { def: 'Pa', u: { Pa: 1, kPa: 1e3, bar: 1e5, atm: 101325, psi: 6894.757293168, mmHg: 133.322387415 } },
  temperature: { def: 'K', u: {
    K: { to: v => v, from: v => v, label: 'K' },
    C: { to: v => v + 273.15, from: v => v - 273.15, label: '°C' },
    F: { to: v => (v - 32) * 5 / 9 + 273.15, from: v => (v - 273.15) * 9 / 5 + 32, label: '°F' }
  } },
  deltaT: { def: 'K', u: { K: 1, C: { f: 1, label: '°C' }, F: { f: 5 / 9, label: '°F' } } },
  angle: { def: 'deg', u: { deg: { f: Math.PI / 180, label: '°' }, rad: 1 } },
  area: { def: 'm²', u: { 'm²': 1, 'cm²': 1e-4, 'mm²': 1e-6, 'ft²': 0.09290304, 'in²': 6.4516e-4 } },
  volume: { def: 'm³', u: { 'm³': 1, L: 1e-3, mL: 1e-6, 'cm³': 1e-6 } },
  density: { def: 'kg/m³', u: { 'kg/m³': 1, 'g/cm³': 1000 } },
  momentum: { def: 'kg·m/s', u: { 'kg·m/s': 1 } },
  impulse: { def: 'N·s', u: { 'N·s': 1 } },
  charge: { def: 'C', u: { C: 1, mC: 1e-3, 'µC': 1e-6, nC: 1e-9 } },
  current: { def: 'A', u: { A: 1, mA: 1e-3, 'µA': 1e-6 } },
  voltage: { def: 'V', u: { V: 1, mV: 1e-3, kV: 1e3 } },
  resistance: { def: 'Ω', u: { 'Ω': 1, 'kΩ': 1e3, 'MΩ': 1e6 } },
  frequency: { def: 'Hz', u: { Hz: 1, kHz: 1e3, MHz: 1e6, GHz: 1e9 } },
  specheat: { def: 'J/(kg·K)', u: { 'J/(kg·K)': 1, 'kJ/(kg·K)': 1e3, 'J/(g·K)': 1e3 } },
  amount: { def: 'mol', u: { mol: 1, mmol: 1e-3 } },
  none: { def: '', u: {} }
};

function pyUnitList(dim) {
  const d = PY_UNITS[dim];
  return d ? Object.keys(d.u) : [];
}

function pyDefaultUnit(dim) {
  return PY_UNITS[dim] ? PY_UNITS[dim].def : '';
}

function pyUnitLabel(dim, unit) {
  const e = PY_UNITS[dim] && PY_UNITS[dim].u[unit];
  return e && typeof e === 'object' && e.label ? e.label : unit;
}

function pyToSI(dim, unit, v) {
  if (dim === 'none') return v;
  const e = PY_UNITS[dim] && PY_UNITS[dim].u[unit];
  if (e === undefined) throw new Error('Unknown unit: ' + dim + ' ' + unit);
  if (typeof e === 'number') return v * e;
  return e.to ? e.to(v) : v * e.f;
}

function pyFromSI(dim, unit, v) {
  if (dim === 'none') return v;
  const e = PY_UNITS[dim] && PY_UNITS[dim].u[unit];
  if (e === undefined) throw new Error('Unknown unit: ' + dim + ' ' + unit);
  if (typeof e === 'number') return v / e;
  return e.from ? e.from(v) : v / e.f;
}

function pyConvert(dim, from, to, v) {
  return pyFromSI(dim, to, pyToSI(dim, from, v));
}

// ---------- reading and showing numbers ----------

// "12", "-3.5", "1e-3", ".5" are numbers. Commas, words and empty text are not.
function pyParseNumber(text) {
  const t = String(text === undefined || text === null ? '' : text).trim().replace(/\u2212/g, '-').replace(/\s+/g, '');
  if (!t) return { empty: true };
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) {
    const n = Number(t);
    if (isFinite(n)) return { value: n };
  }
  return { invalid: true };
}

function pySup(text) {
  const map = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '+': '' };
  return String(text).split('').map(ch => (map[ch] !== undefined ? map[ch] : ch)).join('');
}

// Rounds to `sig` significant figures. Plain digits for normal sizes, "1.23 × 10⁸" for very large or small numbers.
function pyFormat(v, sig) {
  if (v === 0 || Object.is(v, -0)) return '0';
  if (!isFinite(v)) return 'too large to show';
  const s = Math.min(Math.max(Math.round(sig || 4), 1), 15);
  const r = Number(v.toPrecision(s));
  const a = Math.abs(r);
  if (a >= 1e-4 && a < 1e7) return String(r);
  const parts = r.toExponential(s - 1).split('e');
  const mant = parts[0].indexOf('.') >= 0 ? parts[0].replace(/\.?0+$/, '') : parts[0];
  return `${mant} × 10${pySup(String(parseInt(parts[1], 10)))}`;
}

// ---------- errors and small maths helpers ----------

class PyError extends Error {}

function pyFail(message) {
  throw new PyError(message);
}

function pyDiv(num, den, what) {
  if (den === 0) pyFail(`${what} cannot be zero here, because the formula would divide by zero.`);
  return num / den;
}

function pySin(r) { const s = Math.sin(r); return Math.abs(s) < 1e-15 ? 0 : s; }
function pyCos(r) { const c = Math.cos(r); return Math.abs(c) < 1e-15 ? 0 : c; }

function pyAsin(v, message) {
  if (v > 1 + 1e-12 || v < -1 - 1e-12) pyFail(message);
  return Math.asin(Math.max(-1, Math.min(1, v)));
}

function pyAcos(v, message) {
  if (v > 1 + 1e-12 || v < -1 - 1e-12) pyFail(message);
  return Math.acos(Math.max(-1, Math.min(1, v)));
}

function pySqrt(v, message) {
  if (v < 0) {
    if (v > -1e-12) return 0;
    pyFail(message);
  }
  return Math.sqrt(v);
}

// Real roots of A x² + B x + C = 0 (stable form). Returns an ascending array.
function pyQuad(A, B, C, noSolutionMessage) {
  if (A === 0) {
    if (B === 0) pyFail(C === 0 ? 'Every value fits these numbers, so there is no single answer.' : noSolutionMessage);
    return [-C / B];
  }
  const disc = B * B - 4 * A * C;
  if (disc < 0) pyFail(noSolutionMessage);
  if (disc === 0) return [-B / (2 * A)];
  const q = -0.5 * (B + (B >= 0 ? 1 : -1) * Math.sqrt(disc));
  const r1 = q / A;
  const r2 = q !== 0 ? C / q : -B / A;
  return r1 < r2 ? [r1, r2] : [r2, r1];
}

// ---------- the formulas ----------

function V(k, s, n, d, c, opt) {
  return { k, s, n, d, c: c || 'any', opt: !!opt };
}

// solve[k] = [function (x, c) -> number | [numbers or { v, note }], template for the working]
// In a template {name} is replaced by a value: first a variable of the formula, then a constant (g, G, k, R).
const PY_FORMULAS = [
  // ----- motion -----
  { id: 'velocity-time', group: 'Motion', name: 'Velocity, acceleration and time', eq: 'v = u + a·t',
    vars: [V('v', 'v', 'Final velocity', 'speed'), V('u', 'u', 'Initial velocity', 'speed'), V('a', 'a', 'Acceleration', 'accel'), V('t', 't', 'Time', 'time', 'nonneg')],
    solve: {
      v: [x => x.u + x.a * x.t, '{u} + {a} × {t}'],
      u: [x => x.v - x.a * x.t, '{v} − {a} × {t}'],
      a: [x => pyDiv(x.v - x.u, x.t, 'Time'), '({v} − {u}) / {t}'],
      t: [x => pyDiv(x.v - x.u, x.a, 'Acceleration'), '({v} − {u}) / {a}']
    } },
  { id: 'displacement-time', group: 'Motion', name: 'Displacement from initial speed and acceleration', eq: 's = u·t + ½·a·t²',
    vars: [V('s', 's', 'Displacement', 'length'), V('u', 'u', 'Initial velocity', 'speed'), V('a', 'a', 'Acceleration', 'accel'), V('t', 't', 'Time', 'time', 'nonneg')],
    solve: {
      s: [x => x.u * x.t + 0.5 * x.a * x.t * x.t, '{u} × {t} + ½ × {a} × {t}²'],
      u: [x => pyDiv(x.s - 0.5 * x.a * x.t * x.t, x.t, 'Time'), '({s} − ½ × {a} × {t}²) / {t}'],
      a: [x => pyDiv(2 * (x.s - x.u * x.t), x.t * x.t, 'Time'), '2 × ({s} − {u} × {t}) / {t}²'],
      t: [x => pyQuad(0.5 * x.a, x.u, -x.s, 'No real solution: with these values the object never reaches that displacement.'), '(−{u} ± √({u}² + 2 × {a} × {s})) / {a}']
    } },
  { id: 'velocity-squared', group: 'Motion', name: 'Velocity without time', eq: 'v² = u² + 2·a·s',
    vars: [V('v', 'v', 'Final velocity', 'speed'), V('u', 'u', 'Initial velocity', 'speed'), V('a', 'a', 'Acceleration', 'accel'), V('s', 's', 'Displacement', 'length')],
    solve: {
      v: [x => { const r = pySqrt(x.u * x.u + 2 * x.a * x.s, 'No real solution: the object stops and turns back before it covers that displacement.'); return r === 0 ? [0] : [{ v: r, note: 'moving in the positive direction' }, { v: -r, note: 'moving in the negative direction' }]; }, '±√({u}² + 2 × {a} × {s})'],
      u: [x => { const r = pySqrt(x.v * x.v - 2 * x.a * x.s, 'No real solution: these values cannot go together.'); return r === 0 ? [0] : [{ v: r, note: 'started in the positive direction' }, { v: -r, note: 'started in the negative direction' }]; }, '±√({v}² − 2 × {a} × {s})'],
      a: [x => pyDiv(x.v * x.v - x.u * x.u, 2 * x.s, 'Displacement'), '({v}² − {u}²) / (2 × {s})'],
      s: [x => pyDiv(x.v * x.v - x.u * x.u, 2 * x.a, 'Acceleration'), '({v}² − {u}²) / (2 × {a})']
    } },
  { id: 'displacement-average', group: 'Motion', name: 'Displacement from average velocity', eq: 's = (u + v)·t / 2',
    vars: [V('s', 's', 'Displacement', 'length'), V('u', 'u', 'Initial velocity', 'speed'), V('v', 'v', 'Final velocity', 'speed'), V('t', 't', 'Time', 'time', 'nonneg')],
    solve: {
      s: [x => (x.u + x.v) * x.t / 2, '({u} + {v}) × {t} / 2'],
      u: [x => pyDiv(2 * x.s, x.t, 'Time') - x.v, '2 × {s} / {t} − {v}'],
      v: [x => pyDiv(2 * x.s, x.t, 'Time') - x.u, '2 × {s} / {t} − {u}'],
      t: [x => pyDiv(2 * x.s, x.u + x.v, 'The sum of the two velocities'), '2 × {s} / ({u} + {v})']
    } },
  { id: 'average-speed', group: 'Motion', name: 'Average speed', eq: 'v = d / t',
    vars: [V('v', 'v', 'Average speed', 'speed', 'nonneg'), V('d', 'd', 'Distance travelled', 'length', 'nonneg'), V('t', 't', 'Time', 'time', 'pos')],
    solve: {
      v: [x => x.d / x.t, '{d} / {t}'],
      d: [x => x.v * x.t, '{v} × {t}'],
      t: [x => pyDiv(x.d, x.v, 'Average speed'), '{d} / {v}']
    } },

  // ----- projectile -----
  { id: 'projectile-time', group: 'Projectile motion (level ground, no air resistance)', name: 'Time of flight', eq: 'T = 2·v₀·sin θ / g', usesG: true,
    vars: [V('T', 'T', 'Time of flight', 'time', 'nonneg'), V('v0', 'v₀', 'Launch speed', 'speed', 'pos'), V('th', 'θ', 'Launch angle', 'angle', 'a90')],
    solve: {
      T: [(x, c) => 2 * x.v0 * pySin(x.th) / c.g, '2 × {v0} × sin({th}) / {g}'],
      v0: [(x, c) => pyDiv(x.T * c.g, 2 * pySin(x.th), 'The sine of the launch angle'), '{T} × {g} / (2 × sin({th}))'],
      th: [(x, c) => pyAsin(x.T * c.g / (2 * x.v0), 'This time of flight is longer than this speed can give (the longest is 2·v₀/g, straight up).'), 'asin({T} × {g} / (2 × {v0}))']
    } },
  { id: 'projectile-height', group: 'Projectile motion (level ground, no air resistance)', name: 'Maximum height', eq: 'H = v₀²·sin²θ / (2g)', usesG: true,
    vars: [V('H', 'H', 'Maximum height', 'length', 'nonneg'), V('v0', 'v₀', 'Launch speed', 'speed', 'pos'), V('th', 'θ', 'Launch angle', 'angle', 'a90')],
    solve: {
      H: [(x, c) => x.v0 * x.v0 * pySin(x.th) ** 2 / (2 * c.g), '{v0}² × sin({th})² / (2 × {g})'],
      v0: [(x, c) => pyDiv(Math.sqrt(2 * c.g * x.H), pySin(x.th), 'The sine of the launch angle'), '√(2 × {g} × {H}) / sin({th})'],
      th: [(x, c) => pyAsin(Math.sqrt(2 * c.g * x.H) / x.v0, 'This height is more than this speed can reach (the highest is v₀²/(2g), straight up).'), 'asin(√(2 × {g} × {H}) / {v0})']
    } },
  { id: 'projectile-range', group: 'Projectile motion (level ground, no air resistance)', name: 'Range', eq: 'R = v₀²·sin 2θ / g', usesG: true,
    vars: [V('R', 'R', 'Range', 'length', 'nonneg'), V('v0', 'v₀', 'Launch speed', 'speed', 'pos'), V('th', 'θ', 'Launch angle', 'angle', 'a90')],
    solve: {
      R: [(x, c) => x.v0 * x.v0 * pySin(2 * x.th) / c.g, '{v0}² × sin(2 × {th}) / {g}'],
      v0: [(x, c) => { const s2 = pySin(2 * x.th); const q = pyDiv(x.R * c.g, s2, 'The sine of twice the launch angle'); return pySqrt(q, 'No real solution for these values.'); }, '√({R} × {g} / sin(2 × {th}))'],
      th: [(x, c) => {
        const h = pyAsin(x.R * c.g / (x.v0 * x.v0), 'This range is longer than this speed can reach (the longest is v₀²/g, at 45°).') / 2;
        const lo = h, hi = Math.PI / 2 - h;
        return Math.abs(hi - lo) < 1e-12 ? [lo] : [{ v: lo, note: 'low, flat trajectory' }, { v: hi, note: 'high, steep trajectory' }];
      }, 'asin({R} × {g} / {v0}²) / 2  (and 90° minus that)']
    } },

  // ----- forces and energy -----
  { id: 'newton-second', group: 'Forces and energy', name: "Newton's second law", eq: 'F = m·a',
    vars: [V('F', 'F', 'Net force', 'force'), V('m', 'm', 'Mass', 'mass', 'pos'), V('a', 'a', 'Acceleration', 'accel')],
    solve: {
      F: [x => x.m * x.a, '{m} × {a}'],
      m: [x => pyDiv(x.F, x.a, 'Acceleration'), '{F} / {a}'],
      a: [x => x.F / x.m, '{F} / {m}']
    } },
  { id: 'weight', group: 'Forces and energy', name: 'Weight', eq: 'W = m·g', usesG: true,
    vars: [V('W', 'W', 'Weight (force)', 'force', 'nonneg'), V('m', 'm', 'Mass', 'mass', 'pos')],
    solve: {
      W: [(x, c) => x.m * c.g, '{m} × {g}'],
      m: [(x, c) => x.W / c.g, '{W} / {g}']
    } },
  { id: 'momentum', group: 'Forces and energy', name: 'Momentum', eq: 'p = m·v',
    vars: [V('p', 'p', 'Momentum', 'momentum'), V('m', 'm', 'Mass', 'mass', 'pos'), V('v', 'v', 'Velocity', 'speed')],
    solve: {
      p: [x => x.m * x.v, '{m} × {v}'],
      m: [x => pyDiv(x.p, x.v, 'Velocity'), '{p} / {v}'],
      v: [x => x.p / x.m, '{p} / {m}']
    } },
  { id: 'work', group: 'Forces and energy', name: 'Work done by a force', eq: 'W = F·d·cos θ',
    vars: [V('W', 'W', 'Work', 'energy'), V('F', 'F', 'Force', 'force', 'nonneg'), V('d', 'd', 'Distance moved', 'length', 'nonneg'), V('th', 'θ', 'Angle between force and movement', 'angle', 'a180')],
    solve: {
      W: [x => x.F * x.d * pyCos(x.th), '{F} × {d} × cos({th})'],
      F: [x => pyDiv(x.W, x.d * pyCos(x.th), 'Distance × cos θ'), '{W} / ({d} × cos({th}))'],
      d: [x => pyDiv(x.W, x.F * pyCos(x.th), 'Force × cos θ'), '{W} / ({F} × cos({th}))'],
      th: [x => pyAcos(pyDiv(x.W, x.F * x.d, 'Force × distance'), 'The work is larger than force × distance, which is impossible for any angle.'), 'acos({W} / ({F} × {d}))']
    } },
  { id: 'power', group: 'Forces and energy', name: 'Power', eq: 'P = W / t',
    vars: [V('P', 'P', 'Power', 'power', 'nonneg'), V('W', 'W', 'Work or energy', 'energy', 'nonneg'), V('t', 't', 'Time', 'time', 'pos')],
    solve: {
      P: [x => x.W / x.t, '{W} / {t}'],
      W: [x => x.P * x.t, '{P} × {t}'],
      t: [x => pyDiv(x.W, x.P, 'Power'), '{W} / {P}']
    } },
  { id: 'kinetic-energy', group: 'Forces and energy', name: 'Kinetic energy', eq: 'K = ½·m·v²',
    vars: [V('K', 'K', 'Kinetic energy', 'energy', 'nonneg'), V('m', 'm', 'Mass', 'mass', 'pos'), V('v', 'v', 'Speed', 'speed', 'nonneg')],
    solve: {
      K: [x => 0.5 * x.m * x.v * x.v, '½ × {m} × {v}²'],
      m: [x => pyDiv(2 * x.K, x.v * x.v, 'Speed'), '2 × {K} / {v}²'],
      v: [x => Math.sqrt(2 * x.K / x.m), '√(2 × {K} / {m})']
    } },
  { id: 'potential-energy', group: 'Forces and energy', name: 'Gravitational potential energy', eq: 'U = m·g·h', usesG: true,
    vars: [V('U', 'U', 'Potential energy', 'energy'), V('m', 'm', 'Mass', 'mass', 'pos'), V('h', 'h', 'Height', 'length')],
    solve: {
      U: [(x, c) => x.m * c.g * x.h, '{m} × {g} × {h}'],
      m: [(x, c) => pyDiv(x.U, c.g * x.h, 'Height'), '{U} / ({g} × {h})'],
      h: [(x, c) => x.U / (x.m * c.g), '{U} / ({m} × {g})']
    } },
  { id: 'impulse', group: 'Forces and energy', name: 'Impulse', eq: 'J = F·t',
    vars: [V('J', 'J', 'Impulse', 'impulse'), V('F', 'F', 'Force', 'force'), V('t', 't', 'Time', 'time', 'pos')],
    solve: {
      J: [x => x.F * x.t, '{F} × {t}'],
      F: [x => x.J / x.t, '{J} / {t}'],
      t: [x => pyDiv(x.J, x.F, 'Force'), '{J} / {F}']
    } },
  { id: 'gravitation', group: 'Forces and energy', name: "Newton's law of gravitation", eq: 'F = G·m₁·m₂ / r²',
    vars: [V('F', 'F', 'Gravitational force', 'force', 'pos'), V('m1', 'm₁', 'First mass', 'mass', 'pos'), V('m2', 'm₂', 'Second mass', 'mass', 'pos'), V('r', 'r', 'Distance between centres', 'length', 'pos')],
    solve: {
      F: [(x, c) => c.G * x.m1 * x.m2 / (x.r * x.r), '{G} × {m1} × {m2} / {r}²'],
      m1: [(x, c) => x.F * x.r * x.r / (c.G * x.m2), '{F} × {r}² / ({G} × {m2})'],
      m2: [(x, c) => x.F * x.r * x.r / (c.G * x.m1), '{F} × {r}² / ({G} × {m1})'],
      r: [(x, c) => Math.sqrt(c.G * x.m1 * x.m2 / x.F), '√({G} × {m1} × {m2} / {F})']
    } },

  // ----- circular motion -----
  { id: 'centripetal-acceleration', group: 'Circular motion', name: 'Centripetal acceleration', eq: 'a = v² / r',
    vars: [V('a', 'a', 'Centripetal acceleration', 'accel', 'nonneg'), V('v', 'v', 'Speed', 'speed', 'nonneg'), V('r', 'r', 'Radius', 'length', 'pos')],
    solve: {
      a: [x => x.v * x.v / x.r, '{v}² / {r}'],
      v: [x => Math.sqrt(x.a * x.r), '√({a} × {r})'],
      r: [x => pyDiv(x.v * x.v, x.a, 'Acceleration'), '{v}² / {a}']
    } },
  { id: 'centripetal-force', group: 'Circular motion', name: 'Centripetal force', eq: 'F = m·v² / r',
    vars: [V('F', 'F', 'Centripetal force', 'force', 'nonneg'), V('m', 'm', 'Mass', 'mass', 'pos'), V('v', 'v', 'Speed', 'speed', 'nonneg'), V('r', 'r', 'Radius', 'length', 'pos')],
    solve: {
      F: [x => x.m * x.v * x.v / x.r, '{m} × {v}² / {r}'],
      m: [x => pyDiv(x.F * x.r, x.v * x.v, 'Speed'), '{F} × {r} / {v}²'],
      v: [x => Math.sqrt(x.F * x.r / x.m), '√({F} × {r} / {m})'],
      r: [x => pyDiv(x.m * x.v * x.v, x.F, 'Force'), '{m} × {v}² / {F}']
    } },

  // ----- pressure and density -----
  { id: 'density', group: 'Pressure and density', name: 'Density', eq: 'ρ = m / V',
    vars: [V('rho', 'ρ', 'Density', 'density', 'pos'), V('m', 'm', 'Mass', 'mass', 'pos'), V('V', 'V', 'Volume', 'volume', 'pos')],
    solve: {
      rho: [x => x.m / x.V, '{m} / {V}'],
      m: [x => x.rho * x.V, '{rho} × {V}'],
      V: [x => x.m / x.rho, '{m} / {rho}']
    } },
  { id: 'pressure', group: 'Pressure and density', name: 'Pressure', eq: 'P = F / A',
    vars: [V('P', 'P', 'Pressure', 'pressure', 'nonneg'), V('F', 'F', 'Force', 'force', 'nonneg'), V('A', 'A', 'Area', 'area', 'pos')],
    solve: {
      P: [x => x.F / x.A, '{F} / {A}'],
      F: [x => x.P * x.A, '{P} × {A}'],
      A: [x => pyDiv(x.F, x.P, 'Pressure'), '{F} / {P}']
    } },
  { id: 'fluid-pressure', group: 'Pressure and density', name: 'Pressure at a depth in a fluid', eq: 'P = ρ·g·h', usesG: true,
    vars: [V('P', 'P', 'Pressure from the fluid', 'pressure', 'nonneg'), V('rho', 'ρ', 'Fluid density', 'density', 'pos'), V('h', 'h', 'Depth', 'length', 'nonneg')],
    solve: {
      P: [(x, c) => x.rho * c.g * x.h, '{rho} × {g} × {h}'],
      rho: [(x, c) => pyDiv(x.P, c.g * x.h, 'Depth'), '{P} / ({g} × {h})'],
      h: [(x, c) => x.P / (x.rho * c.g), '{P} / ({rho} × {g})']
    } },

  // ----- electricity -----
  { id: 'ohms-law', group: 'Electricity', name: "Ohm's law", eq: 'V = I·R',
    vars: [V('V', 'V', 'Voltage', 'voltage'), V('I', 'I', 'Current', 'current'), V('Res', 'R', 'Resistance', 'resistance', 'pos')],
    solve: {
      V: [x => x.I * x.Res, '{I} × {Res}'],
      I: [x => x.V / x.Res, '{V} / {Res}'],
      Res: [x => pyDiv(x.V, x.I, 'Current'), '{V} / {I}']
    } },
  { id: 'electric-power', group: 'Electricity', name: 'Electric power', eq: 'P = V·I',
    vars: [V('P', 'P', 'Power', 'power'), V('V', 'V', 'Voltage', 'voltage'), V('I', 'I', 'Current', 'current')],
    solve: {
      P: [x => x.V * x.I, '{V} × {I}'],
      V: [x => pyDiv(x.P, x.I, 'Current'), '{P} / {I}'],
      I: [x => pyDiv(x.P, x.V, 'Voltage'), '{P} / {V}']
    } },
  { id: 'resistors-series', group: 'Electricity', name: 'Resistors in series (2 or 3)', eq: 'R_total = R₁ + R₂ + R₃',
    vars: [V('Rt', 'R_total', 'Total resistance', 'resistance', 'pos'), V('R1', 'R₁', 'Resistor 1', 'resistance', 'pos'), V('R2', 'R₂', 'Resistor 2', 'resistance', 'pos'), V('R3', 'R₃', 'Resistor 3 (leave empty if not used)', 'resistance', 'pos', true)],
    solve: {
      Rt: [x => x.R1 + x.R2 + (x.R3 || 0), '{R1} + {R2}[ + {R3}]'],
      R1: [x => x.Rt - x.R2 - (x.R3 || 0), '{Rt} − {R2}[ − {R3}]'],
      R2: [x => x.Rt - x.R1 - (x.R3 || 0), '{Rt} − {R1}[ − {R3}]'],
      R3: [x => x.Rt - x.R1 - x.R2, '{Rt} − {R1} − {R2}']
    } },
  { id: 'resistors-parallel', group: 'Electricity', name: 'Resistors in parallel (2 or 3)', eq: '1/R_total = 1/R₁ + 1/R₂ + 1/R₃',
    vars: [V('Rt', 'R_total', 'Total resistance', 'resistance', 'pos'), V('R1', 'R₁', 'Resistor 1', 'resistance', 'pos'), V('R2', 'R₂', 'Resistor 2', 'resistance', 'pos'), V('R3', 'R₃', 'Resistor 3 (leave empty if not used)', 'resistance', 'pos', true)],
    solve: {
      Rt: [x => 1 / (1 / x.R1 + 1 / x.R2 + (x.R3 ? 1 / x.R3 : 0)), '1 / (1/{R1} + 1/{R2}[ + 1/{R3}])'],
      R1: [x => pyParallelRest(x.Rt, [x.R2, x.R3]), '1 / (1/{Rt} − 1/{R2}[ − 1/{R3}])'],
      R2: [x => pyParallelRest(x.Rt, [x.R1, x.R3]), '1 / (1/{Rt} − 1/{R1}[ − 1/{R3}])'],
      R3: [x => pyParallelRest(x.Rt, [x.R1, x.R2]), '1 / (1/{Rt} − 1/{R1} − 1/{R2})']
    } },
  { id: 'coulomb', group: 'Electricity', name: "Coulomb's law (magnitudes)", eq: 'F = k·q₁·q₂ / r²',
    vars: [V('F', 'F', 'Force between the charges', 'force', 'pos'), V('q1', 'q₁', 'First charge (size only)', 'charge', 'pos'), V('q2', 'q₂', 'Second charge (size only)', 'charge', 'pos'), V('r', 'r', 'Distance', 'length', 'pos')],
    solve: {
      F: [(x, c) => c.k * x.q1 * x.q2 / (x.r * x.r), '{k} × {q1} × {q2} / {r}²'],
      q1: [(x, c) => x.F * x.r * x.r / (c.k * x.q2), '{F} × {r}² / ({k} × {q2})'],
      q2: [(x, c) => x.F * x.r * x.r / (c.k * x.q1), '{F} × {r}² / ({k} × {q1})'],
      r: [(x, c) => Math.sqrt(c.k * x.q1 * x.q2 / x.F), '√({k} × {q1} × {q2} / {F})']
    } },
  { id: 'charge-current', group: 'Electricity', name: 'Charge and current', eq: 'Q = I·t',
    vars: [V('Q', 'Q', 'Charge', 'charge'), V('I', 'I', 'Current', 'current'), V('t', 't', 'Time', 'time', 'pos')],
    solve: {
      Q: [x => x.I * x.t, '{I} × {t}'],
      I: [x => x.Q / x.t, '{Q} / {t}'],
      t: [x => pyDiv(x.Q, x.I, 'Current'), '{Q} / {I}']
    } },

  // ----- waves and optics -----
  { id: 'wave-speed', group: 'Waves and optics', name: 'Wave speed', eq: 'v = f·λ',
    vars: [V('v', 'v', 'Wave speed', 'speed', 'pos'), V('f', 'f', 'Frequency', 'frequency', 'pos'), V('l', 'λ', 'Wavelength', 'wavelength', 'pos')],
    solve: {
      v: [x => x.f * x.l, '{f} × {l}'],
      f: [x => x.v / x.l, '{v} / {l}'],
      l: [x => x.v / x.f, '{v} / {f}']
    } },
  { id: 'thin-lens', group: 'Waves and optics', name: 'Lens and mirror equation (real-is-positive)', eq: '1/f = 1/u + 1/v',
    vars: [V('f', 'f', 'Focal length', 'length', 'nonzero'), V('u', 'u', 'Object distance', 'length', 'nonzero'), V('v', 'v', 'Image distance', 'length', 'nonzero')],
    solve: {
      f: [x => { const s = 1 / x.u + 1 / x.v; if (s === 0) pyFail('1/u + 1/v is zero, so the focal length would be infinite (like a flat mirror or a plain window).'); return 1 / s; }, '1 / (1/{u} + 1/{v})'],
      u: [x => { const s = 1 / x.f - 1 / x.v; if (s === 0) pyFail('The object would have to be infinitely far away (the rays arrive parallel).'); return 1 / s; }, '1 / (1/{f} − 1/{v})'],
      v: [x => { const s = 1 / x.f - 1 / x.u; if (s === 0) pyFail('The image forms at infinity, because the object is exactly at the focal point.'); return 1 / s; }, '1 / (1/{f} − 1/{u})']
    } },
  { id: 'snell', group: 'Waves and optics', name: "Snell's law of refraction", eq: 'n₁·sin θ₁ = n₂·sin θ₂',
    vars: [V('n1', 'n₁', 'Refractive index of material 1', 'none', 'pos'), V('a1', 'θ₁', 'Angle of incidence', 'angle', 'a90'), V('n2', 'n₂', 'Refractive index of material 2', 'none', 'pos'), V('a2', 'θ₂', 'Angle of refraction', 'angle', 'a90')],
    solve: {
      n1: [x => pyDiv(x.n2 * pySin(x.a2), pySin(x.a1), 'The sine of the angle of incidence'), '{n2} × sin({a2}) / sin({a1})'],
      a1: [x => pyAsin(x.n2 * pySin(x.a2) / x.n1, PY_TIR), 'asin({n2} × sin({a2}) / {n1})'],
      n2: [x => pyDiv(x.n1 * pySin(x.a1), pySin(x.a2), 'The sine of the angle of refraction'), '{n1} × sin({a1}) / sin({a2})'],
      a2: [x => pyAsin(x.n1 * pySin(x.a1) / x.n2, PY_TIR), 'asin({n1} × sin({a1}) / {n2})']
    } },

  // ----- heat and gases -----
  { id: 'heat', group: 'Heat and gases', name: 'Heat needed to change temperature', eq: 'Q = m·c·ΔT',
    vars: [V('Q', 'Q', 'Heat', 'energy'), V('m', 'm', 'Mass', 'mass', 'pos'), V('c', 'c', 'Specific heat capacity', 'specheat', 'pos'), V('dT', 'ΔT', 'Temperature change', 'deltaT')],
    solve: {
      Q: [x => x.m * x.c * x.dT, '{m} × {c} × {dT}'],
      m: [x => pyDiv(x.Q, x.c * x.dT, 'Temperature change'), '{Q} / ({c} × {dT})'],
      c: [x => pyDiv(x.Q, x.m * x.dT, 'Temperature change'), '{Q} / ({m} × {dT})'],
      dT: [x => x.Q / (x.m * x.c), '{Q} / ({m} × {c})']
    } },
  { id: 'ideal-gas', group: 'Heat and gases', name: 'Ideal gas law', eq: 'P·V = n·R·T',
    vars: [V('P', 'P', 'Pressure', 'pressure', 'pos'), V('V', 'V', 'Volume', 'volume', 'pos'), V('n', 'n', 'Amount of gas', 'amount', 'pos'), V('T', 'T', 'Temperature', 'temperature', 'pos')],
    solve: {
      P: [(x, c) => x.n * c.R * x.T / x.V, '{n} × {R} × {T} / {V}'],
      V: [(x, c) => x.n * c.R * x.T / x.P, '{n} × {R} × {T} / {P}'],
      n: [(x, c) => x.P * x.V / (c.R * x.T), '{P} × {V} / ({R} × {T})'],
      T: [(x, c) => x.P * x.V / (x.n * c.R), '{P} × {V} / ({n} × {R})']
    } },
  { id: 'boyle', group: 'Heat and gases', name: "Boyle's law (constant temperature)", eq: 'P₁·V₁ = P₂·V₂',
    vars: [V('P1', 'P₁', 'Starting pressure', 'pressure', 'pos'), V('V1', 'V₁', 'Starting volume', 'volume', 'pos'), V('P2', 'P₂', 'Final pressure', 'pressure', 'pos'), V('V2', 'V₂', 'Final volume', 'volume', 'pos')],
    solve: {
      P1: [x => x.P2 * x.V2 / x.V1, '{P2} × {V2} / {V1}'],
      V1: [x => x.P2 * x.V2 / x.P1, '{P2} × {V2} / {P1}'],
      P2: [x => x.P1 * x.V1 / x.V2, '{P1} × {V1} / {V2}'],
      V2: [x => x.P1 * x.V1 / x.P2, '{P1} × {V1} / {P2}']
    } },
  { id: 'charles', group: 'Heat and gases', name: "Charles's law (constant pressure)", eq: 'V₁ / T₁ = V₂ / T₂',
    vars: [V('V1', 'V₁', 'Starting volume', 'volume', 'pos'), V('T1', 'T₁', 'Starting temperature', 'temperature', 'pos'), V('V2', 'V₂', 'Final volume', 'volume', 'pos'), V('T2', 'T₂', 'Final temperature', 'temperature', 'pos')],
    solve: {
      V1: [x => x.V2 * x.T1 / x.T2, '{V2} × {T1} / {T2}'],
      T1: [x => x.T2 * x.V1 / x.V2, '{T2} × {V1} / {V2}'],
      V2: [x => x.V1 * x.T2 / x.T1, '{V1} × {T2} / {T1}'],
      T2: [x => x.T1 * x.V2 / x.V1, '{T1} × {V2} / {V1}']
    } }
];

const PY_TIR = 'Total internal reflection: at this angle the light does not pass into the second material, it is reflected back.';

// 1 / (1/Rt - sum of 1/other), for the unknown resistor in a parallel group (empty resistors are skipped)
function pyParallelRest(Rt, others) {
  let den = 1 / Rt;
  const scale = den;
  others.forEach(r => { if (r) den -= 1 / r; });
  if (den <= scale * 1e-12) pyFail('These values cannot fit together: in parallel the total resistance must be smaller than every single resistor.');
  return 1 / den;
}

function pyFormula(id) {
  return PY_FORMULAS.find(f => f.id === id) || null;
}

// ---------- solving ----------

// What is wrong with a result (null = fine). Value in SI.
function pyProblem(v, spec, scale) {
  const tiny = 1e-12 * (scale || 1);
  switch (spec.c) {
    case 'pos': return v > 0 ? null : (spec.d === 'temperature' ? 'at or below absolute zero' : 'zero or negative');
    case 'nonneg': return v >= -tiny ? null : 'negative';
    case 'nonzero': return v !== 0 ? null : 'zero';
    case 'a90': return v >= -1e-12 && v <= Math.PI / 2 + 1e-12 ? null : 'outside 0° to 90°';
    case 'a180': return v >= -1e-12 && v <= Math.PI + 1e-12 ? null : 'outside 0° to 180°';
    default: return null;
  }
}

// Solves one variable. xSI = the other values in SI units. Returns [{ v, valid, note }]. Throws PyError for impossible cases.
function pySolveSI(f, key, xSI, consts) {
  const spec = f.vars.find(v => v.k === key);
  const entry = f.solve[key];
  if (!spec || !entry) throw new PyError('This quantity cannot be solved for in this formula.');
  let raw;
  try {
    raw = entry[0](xSI, consts || PY_CONSTS);
  } catch (err) {
    if (err instanceof PyError) throw err;
    throw new PyError('This combination of values cannot be calculated.');
  }
  const list = (Array.isArray(raw) ? raw : [raw]).map(r => (typeof r === 'object' && r !== null ? r : { v: r }));
  let scale = 0;
  Object.keys(xSI).forEach(k => { if (typeof xSI[k] === 'number') scale = Math.max(scale, Math.abs(xSI[k])); });
  if (list.some(r => r.v === Infinity || r.v === -Infinity)) throw new PyError('The result is too large to show. Check the numbers and their units.');
  const out = [];
  list.forEach(r => {
    if (typeof r.v !== 'number' || !isFinite(r.v)) return;
    let v = r.v;
    if (spec.c === 'nonneg' && v < 0 && v >= -1e-12 * (scale || 1)) v = 0;
    const problem = pyProblem(v, spec, scale);
    out.push({ v, valid: !problem, problem, note: problem ? `not possible here (${problem})` : (r.note || '') });
  });
  if (!out.length) throw new PyError('This combination of values has no real answer. Check the numbers and the units.');
  if (!out.some(r => r.valid)) {
    if (out.length === 1) throw new PyError(`The ${spec.n.toLowerCase()} would come out ${out[0].problem}, which is not physically possible. Check your values and their signs.`);
    throw new PyError(`None of the mathematical answers is physically possible (${out.map(r => r.problem).join(' and ')}). Check your values.`);
  }
  const valid = out.filter(r => r.valid);
  if (valid.length > 1) valid.forEach(r => { r.note = r.note ? r.note : 'one of two possible answers'; });
  return out;
}

function pyMessageForConstraint(spec) {
  switch (spec.c) {
    case 'pos': return spec.d === 'temperature' ? `${spec.n} must be above absolute zero (0 K, which is −273.15 °C or −459.67 °F).` : `${spec.n} must be greater than zero.`;
    case 'nonneg': return `${spec.n} cannot be negative.`;
    case 'nonzero': return `${spec.n} cannot be zero.`;
    case 'a90': return `${spec.n} must be between 0° and 90°.`;
    case 'a180': return `${spec.n} must be between 0° and 180°.`;
    default: return `${spec.n} is not valid.`;
  }
}

function pyWorkNumber(spec, siValue) {
  const shown = spec.d === 'angle' ? pyFormat(siValue * 180 / Math.PI, 6) + '°' : pyFormat(siValue, 6);
  return !(siValue >= 0) ? `(${shown})` : shown;
}

// The two text lines that show how the answer was found: the formula in symbols, then with the numbers put in
function pyWorkingLines(f, key, xSI, consts) {
  const spec = f.vars.find(v => v.k === key);
  const symbolOf = {};
  f.vars.forEach(v => { symbolOf[v.k] = v.s; });
  // [ ... ] marks a part that is only used when all its values were given (optional resistors)
  const expanded = f.solve[key][1].replace(/\[([^\]]*)\]/g, (m, inner) => ((inner.match(/\{(\w+)\}/g) || []).every(tok => xSI[tok.slice(1, -1)] !== undefined) ? inner : ''));
  const symbolic = expanded.replace(/\{(\w+)\}/g, (m, k) => (symbolOf[k] !== undefined ? symbolOf[k] : k));
  const numeric = expanded.replace(/\{(\w+)\}/g, (m, k) => {
    const v = f.vars.find(x => x.k === k);
    if (v && xSI[k] !== undefined) return pyWorkNumber(v, xSI[k]);
    if (consts[k] !== undefined) return pyFormat(consts[k], 6);
    return k;
  });
  return [`${spec.s} = ${symbolic}`, `${spec.s} = ${numeric}`];
}

// The whole job: raw text from the form -> result or message.
// req = { formula, solveFor, values: { key: 'text' }, units: { key: 'unit id' }, outUnit, sig, g }
function pyRun(req) {
  const f = pyFormula(req.formula);
  if (!f) return { ok: false, message: 'Please choose a formula.' };
  const target = f.vars.find(v => v.k === req.solveFor && !v.opt);
  if (!target) return { ok: false, message: 'Please choose what to solve for.' };
  const consts = Object.assign({}, PY_CONSTS, { g: req.g || PY_CONSTS.g });
  const sig = [3, 4, 6].indexOf(Number(req.sig)) >= 0 ? Number(req.sig) : 4;

  const missing = [];
  const xSI = {};
  for (const v of f.vars) {
    if (v.k === target.k) continue;
    const parsed = pyParseNumber((req.values || {})[v.k]);
    if (parsed.empty) { if (!v.opt) missing.push(v.n); continue; }
    if (parsed.invalid) return { ok: false, message: `"${String((req.values || {})[v.k]).trim()}" is not a valid number for ${v.n}. Use digits with a dot for decimals, for example 9.81 or 1.5e3.` };
    let si;
    try { si = pyToSI(v.d, (req.units || {})[v.k] || pyDefaultUnit(v.d), parsed.value); }
    catch (err) { return { ok: false, message: `The unit chosen for ${v.n} is not known.` }; }
    if (!isFinite(si)) return { ok: false, message: `${v.n} is too large to use.` };
    xSI[v.k] = si;
  }
  if (missing.length === 1) return { ok: false, message: `Enter a value for ${missing[0]}. Only the quantity you solve for can be left empty.` };
  if (missing.length > 1) return { ok: false, message: `${missing.length} values are missing (${missing.join(', ')}). Fill in every quantity except the one you solve for.` };
  for (const v of f.vars) {
    if (v.k === target.k || xSI[v.k] === undefined) continue;
    const problem = pyProblem(xSI[v.k], v, 0);
    if (problem) return { ok: false, message: pyMessageForConstraint(v) };
  }

  let roots;
  try { roots = pySolveSI(f, target.k, xSI, consts); }
  catch (err) {
    if (err instanceof PyError) return { ok: false, message: err.message };
    return { ok: false, message: 'This combination of values cannot be calculated.' };
  }
  const outUnit = req.outUnit && pyUnitList(target.d).indexOf(req.outUnit) >= 0 ? req.outUnit : pyDefaultUnit(target.d);
  const label = pyUnitLabel(target.d, outUnit);
  const unitText = target.d === 'none' ? '' : (label === '°' ? label : ' ' + label);
  const rows = roots.map(r => {
    const shown = pyFromSI(target.d, outUnit, r.v);
    return { si: r.v, value: shown, text: pyFormat(shown, sig) + unitText, valid: r.valid, note: r.note };
  });
  const validRows = rows.filter(r => r.valid);
  const headline = validRows.length === 1 ? `${target.s} = ${validRows[0].text}` : validRows.map((r, i) => `${target.s}${'₁₂₃₄'[i] || ''} = ${r.text}`).join('   or   ');
  const working = pyWorkingLines(f, target.k, xSI, consts);
  const lines = [];
  if (validRows.length === 1) lines.push(`${target.s} = ${validRows[0].text}`);
  else validRows.forEach((r, i) => lines.push(`${target.s}${'₁₂₃₄'[i] || ''} = ${r.text}${r.note ? '  (' + r.note + ')' : ''}`));
  return {
    ok: true, formula: f, target, rows, headline, working: working.concat(lines), sig,
    summary: [`${f.name}: ${f.eq}`, headline].concat(rows.filter(r => !r.valid).map(r => `Not valid: ${r.text} (${r.note})`)).join('\n')
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    PY_CONSTS, PY_G_CHOICES, PY_UNITS, PY_FORMULAS, PyError,
    pyUnitList, pyDefaultUnit, pyUnitLabel, pyToSI, pyFromSI, pyConvert,
    pyParseNumber, pySup, pyFormat, pyDiv, pySin, pyCos, pyAsin, pyAcos, pyQuad,
    pyFormula, pyProblem, pySolveSI, pyWorkingLines, pyRun
  };
}

// ---------- page wiring ----------

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    const formulaSelect = $('py-formula');
    const equationBox = $('py-equation');
    const solveSelect = $('py-solve-for');
    const varsBox = $('py-vars');
    const sigSelect = $('py-sig');
    const gWrap = $('py-g-wrap');
    const gSelect = $('py-g');
    const calcBtn = $('py-calc-btn');
    const clearBtn = $('py-clear-btn');
    const resultBox = $('py-result');
    const copyBtn = $('py-copy-btn');

    let formula = PY_FORMULAS[0];
    let solveFor = formula.vars[0].k;
    const memory = {};      // typed values and units, kept while you switch formulas (only in this page, never stored)
    let lastSummary = '';

    function remember() {
      const m = memory[formula.id] || (memory[formula.id] = { values: {}, units: {} });
      formula.vars.forEach(v => {
        const input = $('py-in-' + v.k), unit = $('py-un-' + v.k);
        if (input && !input.disabled) m.values[v.k] = input.value;
        if (unit) m.units[v.k] = unit.value;
      });
    }

    function fillFormulaList() {
      const groups = [];
      PY_FORMULAS.forEach(f => { if (groups.indexOf(f.group) < 0) groups.push(f.group); });
      formulaSelect.innerHTML = groups.map(g => `<optgroup label="${escapeHtml(g)}">${PY_FORMULAS.filter(f => f.group === g).map(f => `<option value="${f.id}">${escapeHtml(f.name)}  (${escapeHtml(f.eq)})</option>`).join('')}</optgroup>`).join('');
      formulaSelect.value = formula.id;
    }

    function renderForm() {
      equationBox.textContent = formula.eq;
      gWrap.classList.toggle('hidden', !formula.usesG);
      solveSelect.innerHTML = formula.vars.filter(v => !v.opt).map(v => `<option value="${v.k}">${escapeHtml(v.n)} (${escapeHtml(v.s)})</option>`).join('');
      solveSelect.value = solveFor;
      const m = memory[formula.id] || { values: {}, units: {} };
      varsBox.innerHTML = formula.vars.map(v => {
        const unknown = v.k === solveFor;
        const units = pyUnitList(v.d);
        const chosen = m.units[v.k] && units.indexOf(m.units[v.k]) >= 0 ? m.units[v.k] : pyDefaultUnit(v.d);
        const unitHtml = units.length ? `<select id="py-un-${v.k}" class="py-unit" aria-label="Unit for ${escapeHtml(v.n)}">${units.map(u => `<option value="${escapeHtml(u)}"${u === chosen ? ' selected' : ''}>${escapeHtml(pyUnitLabel(v.d, u))}</option>`).join('')}</select>` : '<span class="py-nounit">no unit</span>';
        const value = unknown ? '' : escapeHtml(m.values[v.k] || '');
        return `<div class="py-row${unknown ? ' py-unknown' : ''}">
          <label class="py-label" for="py-in-${v.k}">${escapeHtml(v.n)} <span class="py-sym">(${escapeHtml(v.s)})</span>${unknown ? ' <span class="py-tag">to find</span>' : ''}</label>
          <div class="py-fields">
            <input id="py-in-${v.k}" class="py-input" type="text" inputmode="decimal" autocomplete="off" spellcheck="false"${unknown ? ' disabled placeholder="Result appears below"' : ` value="${value}"`}>
            ${unitHtml}
          </div></div>`;
      }).join('');
    }

    function showResult(res) {
      if (!res.ok) {
        resultBox.innerHTML = `<p class="py-error">${escapeHtml(res.message)}</p>`;
        copyBtn.classList.add('hidden');
        lastSummary = '';
        showToast(res.message, 'warning');
        return;
      }
      const valid = res.rows.filter(r => r.valid);
      let html = '<div class="py-answers">';
      html += valid.map((r, i) => `<p class="py-answer">${escapeHtml(res.target.s)}${valid.length > 1 ? '₁₂₃₄'[i] || '' : ''} = <strong>${escapeHtml(r.text)}</strong>${r.note ? ` <span class="py-note">${escapeHtml(r.note)}</span>` : ''}</p>`).join('');
      html += res.rows.filter(r => !r.valid).map(r => `<p class="py-answer py-invalid">${escapeHtml(res.target.s)} = ${escapeHtml(r.text)} <span class="py-note">${escapeHtml(r.note)}</span></p>`).join('');
      html += '</div>';
      html += `<p class="py-work-title">Working (values converted to SI units; angles shown in degrees)</p><pre class="py-work">${escapeHtml(formula.eq + '\n' + res.working.join('\n'))}</pre>`;
      resultBox.innerHTML = html;
      lastSummary = res.summary;
      copyBtn.classList.remove('hidden');
    }

    function calculate() {
      const values = {}, units = {};
      formula.vars.forEach(v => {
        const input = $('py-in-' + v.k), unit = $('py-un-' + v.k);
        if (input && !input.disabled) values[v.k] = input.value;
        if (unit) units[v.k] = unit.value;
      });
      remember();
      const outEl = $('py-un-' + solveFor);
      showResult(pyRun({ formula: formula.id, solveFor, values, units, outUnit: outEl ? outEl.value : '', sig: sigSelect.value, g: PY_G_CHOICES[gSelect.value] }));
    }

    function resetResult() {
      resultBox.innerHTML = '<p class="py-empty">Choose a formula, fill in what you know and press Calculate. The answer and the working appear here.</p>';
      copyBtn.classList.add('hidden');
      lastSummary = '';
    }

    formulaSelect.addEventListener('change', () => {
      remember();
      formula = pyFormula(formulaSelect.value) || formula;
      solveFor = formula.vars[0].k;
      renderForm();
      resetResult();
    });
    solveSelect.addEventListener('change', () => {
      remember();
      solveFor = solveSelect.value;
      renderForm();
      resetResult();
    });
    varsBox.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); calculate(); }
    });
    calcBtn.addEventListener('click', calculate);
    clearBtn.addEventListener('click', () => {
      delete memory[formula.id];
      renderForm();
      resetResult();
    });
    copyBtn.addEventListener('click', () => {
      if (!lastSummary) return;
      copyText(lastSummary).then(() => showToast('Result copied.', 'success'), () => showToast('Could not copy. Select the text and copy it manually.', 'error'));
    });

    fillFormulaList();
    renderForm();
    resetResult();
  });
}
