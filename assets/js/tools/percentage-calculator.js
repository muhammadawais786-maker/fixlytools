// Fixlytools - Percentage Calculator. Pure functions first (they are also used by the tests).

// X% of Y
function pcOf(percent, whole) { return whole * percent / 100; }

// X is what percent of Y
function pcWhatPercent(part, whole) { return whole === 0 ? NaN : part / whole * 100; }

// percentage change from a to b (positive = increase)
function pcChange(from, to) { return from === 0 ? NaN : (to - from) / Math.abs(from) * 100; }

// increase (sign = 1) or decrease (sign = -1) a value by a percentage
function pcAdjust(value, percent, sign) { return value * (1 + (sign < 0 ? -1 : 1) * percent / 100); }

// X is Y percent of what number
function pcTotalFromPart(part, percent) { return percent === 0 ? NaN : part / (percent / 100); }

if (typeof module !== 'undefined') {
  module.exports = { pcOf, pcWhatPercent, pcChange, pcAdjust, pcTotalFromPart };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    const num = (id) => parseFloat($(id).value);
    const fmt = (n) => ntFormatNumber(n, 10);
    const bad = (...v) => v.some((x) => !isFinite(x));

    function setOut(id, text, sub) {
      $(id).textContent = text;
      const s = $(id + '-sub');
      if (s) s.textContent = sub || '';
    }

    function calc1() {
      const p = num('p1-a'), w = num('p1-b');
      if (bad(p, w)) return setOut('p1-out', '-', 'Enter both numbers.');
      setOut('p1-out', fmt(pcOf(p, w)), `${fmt(p)}% of ${fmt(w)} = ${fmt(w)} x ${fmt(p)} / 100`);
    }
    function calc2() {
      const a = num('p2-a'), b = num('p2-b');
      if (bad(a, b)) return setOut('p2-out', '-', 'Enter both numbers.');
      if (b === 0) return setOut('p2-out', '-', 'The second number cannot be zero.');
      setOut('p2-out', fmt(pcWhatPercent(a, b)) + '%', `${fmt(a)} / ${fmt(b)} x 100`);
    }
    function calc3() {
      const a = num('p3-a'), b = num('p3-b');
      if (bad(a, b)) return setOut('p3-out', '-', 'Enter both numbers.');
      if (a === 0) return setOut('p3-out', '-', 'The starting value cannot be zero.');
      const c = pcChange(a, b);
      const word = c > 0 ? 'increase' : c < 0 ? 'decrease' : 'no change';
      setOut('p3-out', (c > 0 ? '+' : '') + fmt(c) + '%', `A ${word} from ${fmt(a)} to ${fmt(b)} (difference ${fmt(b - a)})`);
    }
    function calc4() {
      const v = num('p4-a'), p = num('p4-b');
      if (bad(v, p)) return setOut('p4-out', '-', 'Enter both numbers.');
      const up = $('p4-op').value !== 'dec';
      const r = pcAdjust(v, p, up ? 1 : -1);
      setOut('p4-out', fmt(r), `${fmt(v)} ${up ? 'increased' : 'decreased'} by ${fmt(p)}% (${up ? '+' : '-'}${fmt(Math.abs(r - v))})`);
    }
    function calc5() {
      const part = num('p5-a'), p = num('p5-b');
      if (bad(part, p)) return setOut('p5-out', '-', 'Enter both numbers.');
      if (p === 0) return setOut('p5-out', '-', 'The percentage cannot be zero.');
      setOut('p5-out', fmt(pcTotalFromPart(part, p)), `${fmt(part)} is ${fmt(p)}% of this number`);
    }

    const map = { p1: calc1, p2: calc2, p3: calc3, p4: calc4, p5: calc5 };
    Object.keys(map).forEach((k) => {
      document.querySelectorAll(`[data-calc="${k}"]`).forEach((el) => el.addEventListener('input', map[k]));
      document.querySelectorAll(`[data-calc="${k}"]`).forEach((el) => el.addEventListener('change', map[k]));
      map[k]();
    });
  });
}
