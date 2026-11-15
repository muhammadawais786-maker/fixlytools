// Fixlytools - Color Picker and HEX / RGB / HSL / CMYK converter

function cpClamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

function cpHexToRgb(hex) {
  let h = String(hex || '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

function cpRgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => cpClamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function cpRgbToHsl(r, g, b) {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rr) h = (gg - bb) / d + (gg < bb ? 6 : 0);
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
  }
  return { h: Math.round(h) % 360, s: Math.round(s * 100), l: Math.round(l * 100) };
}

function cpHslToRgb(h, s, l) {
  const hh = ((h % 360) + 360) % 360 / 360, ss = cpClamp(s, 0, 100) / 100, ll = cpClamp(l, 0, 100) / 100;
  if (ss === 0) { const v = Math.round(ll * 255); return { r: v, g: v, b: v }; }
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return { r: Math.round(f(hh + 1 / 3) * 255), g: Math.round(f(hh) * 255), b: Math.round(f(hh - 1 / 3) * 255) };
}

function cpRgbToCmyk(r, g, b) {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const k = 1 - Math.max(rr, gg, bb);
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: Math.round((1 - rr - k) / (1 - k) * 100),
    m: Math.round((1 - gg - k) / (1 - k) * 100),
    y: Math.round((1 - bb - k) / (1 - k) * 100),
    k: Math.round(k * 100)
  };
}

function cpLuminance(r, g, b) {
  const f = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function cpContrast(rgb1, rgb2) {
  const a = cpLuminance(rgb1.r, rgb1.g, rgb1.b), b = cpLuminance(rgb2.r, rgb2.g, rgb2.b);
  const hi = Math.max(a, b), lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

// Accepts #abc, #aabbcc, rgb(1,2,3), hsl(10,20%,30%)
function cpParse(text) {
  const t = String(text || '').trim();
  let m = /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*(?:[,/]\s*[\d.]+%?\s*)?\)$/i.exec(t);
  if (m) {
    const r = +m[1], g = +m[2], b = +m[3];
    if (r > 255 || g > 255 || b > 255) return null;
    return { r, g, b };
  }
  m = /^hsla?\(\s*(-?\d{1,3}(?:\.\d+)?)\s*[, ]\s*(\d{1,3}(?:\.\d+)?)%\s*[, ]\s*(\d{1,3}(?:\.\d+)?)%\s*(?:[,/]\s*[\d.]+%?\s*)?\)$/i.exec(t);
  if (m) {
    if (+m[2] > 100 || +m[3] > 100) return null;
    return cpHslToRgb(+m[1], +m[2], +m[3]);
  }
  return cpHexToRgb(t);
}

// lighter and darker versions by mixing with white / black
function cpShades(rgb) {
  const mix = (c, t, p) => Math.round(c + (t - c) * p);
  const out = [];
  [0.8, 0.6, 0.4, 0.2].forEach((p) => out.push(cpRgbToHex(mix(rgb.r, 255, p), mix(rgb.g, 255, p), mix(rgb.b, 255, p))));
  out.push(cpRgbToHex(rgb.r, rgb.g, rgb.b));
  [0.2, 0.4, 0.6, 0.8].forEach((p) => out.push(cpRgbToHex(mix(rgb.r, 0, p), mix(rgb.g, 0, p), mix(rgb.b, 0, p))));
  return out;
}

if (typeof module !== 'undefined') {
  module.exports = { cpHexToRgb, cpRgbToHex, cpRgbToHsl, cpHslToRgb, cpRgbToCmyk, cpContrast, cpParse, cpShades, cpLuminance };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    const picker = $('cp-picker');
    const hexIn = $('cp-hex');
    const rgbIn = { r: $('cp-r'), g: $('cp-g'), b: $('cp-b') };
    const hslIn = { h: $('cp-h'), s: $('cp-s'), l: $('cp-l') };
    let current = { r: 37, g: 99, b: 235 };

    function showAll(source) {
      const hex = cpRgbToHex(current.r, current.g, current.b);
      const hsl = cpRgbToHsl(current.r, current.g, current.b);
      const cmyk = cpRgbToCmyk(current.r, current.g, current.b);
      $('cp-swatch').style.background = hex;
      if (source !== 'picker') picker.value = hex.toLowerCase();
      if (source !== 'hex') hexIn.value = hex;
      if (source !== 'rgb') { rgbIn.r.value = current.r; rgbIn.g.value = current.g; rgbIn.b.value = current.b; }
      if (source !== 'hsl') { hslIn.h.value = hsl.h; hslIn.s.value = hsl.s; hslIn.l.value = hsl.l; }
      $('cp-out-hex').textContent = hex;
      $('cp-out-rgb').textContent = `rgb(${current.r}, ${current.g}, ${current.b})`;
      $('cp-out-hsl').textContent = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
      $('cp-out-cmyk').textContent = `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`;
      $('cp-out-css').textContent = `color: ${hex};`;

      const cw = cpContrast(current, { r: 255, g: 255, b: 255 });
      const cb = cpContrast(current, { r: 0, g: 0, b: 0 });
      const grade = (c) => c >= 7 ? 'AAA' : c >= 4.5 ? 'AA' : c >= 3 ? 'AA Large only' : 'Fail';
      $('cp-con-white').textContent = `${cw.toFixed(2)}:1 (${grade(cw)})`;
      $('cp-con-black').textContent = `${cb.toFixed(2)}:1 (${grade(cb)})`;
      $('cp-sample-white').style.color = hex;
      $('cp-sample-black').style.color = hex;

      const box = $('cp-shades');
      box.innerHTML = '';
      cpShades(current).forEach((c) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.title = c;
        b.setAttribute('aria-label', 'Use ' + c);
        b.style.cssText = `background:${c};height:46px;border-radius:10px;border:1px solid rgba(100,116,139,.5);cursor:pointer`;
        b.addEventListener('click', () => { current = cpHexToRgb(c); showAll(); });
        box.appendChild(b);
      });
    }

    picker.addEventListener('input', () => { current = cpHexToRgb(picker.value); showAll('picker'); });
    hexIn.addEventListener('input', () => {
      const rgb = cpParse(hexIn.value);
      hexIn.style.outline = rgb ? '' : '2px solid #dc2626';
      if (rgb) { current = rgb; showAll('hex'); }
    });
    Object.keys(rgbIn).forEach((k) => rgbIn[k].addEventListener('input', () => {
      const v = [rgbIn.r, rgbIn.g, rgbIn.b].map((e) => cpClamp(parseInt(e.value, 10) || 0, 0, 255));
      current = { r: v[0], g: v[1], b: v[2] };
      showAll('rgb');
    }));
    Object.keys(hslIn).forEach((k) => hslIn[k].addEventListener('input', () => {
      const h = parseFloat(hslIn.h.value) || 0, s = parseFloat(hslIn.s.value) || 0, l = parseFloat(hslIn.l.value) || 0;
      current = cpHslToRgb(h, s, l);
      showAll('hsl');
    }));
    document.querySelectorAll('[data-copy]').forEach((btn) => btn.addEventListener('click', () => {
      ntCopyWithToast($(btn.dataset.copy).textContent, 'Copied: ' + $(btn.dataset.copy).textContent);
    }));
    $('cp-random').addEventListener('click', () => {
      current = { r: Math.floor(Math.random() * 256), g: Math.floor(Math.random() * 256), b: Math.floor(Math.random() * 256) };
      showAll();
    });
    if (window.EyeDropper) {
      const eb = $('cp-eyedrop');
      eb.classList.remove('nt-hide');
      eb.addEventListener('click', () => {
        new window.EyeDropper().open().then((r) => { current = cpHexToRgb(r.sRGBHex); showAll(); }).catch(() => {});
      });
    }
    showAll();
  });
}
