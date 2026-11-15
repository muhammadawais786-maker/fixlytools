// Fixlytools - Barcode Generator: Code 128, Code 39, EAN-13, EAN-8 and UPC-A. Everything is drawn in the browser.
// Each encoder returns a "module string": '1' = one module of bar, '0' = one module of space.

const BC_C128 = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
];
const BC_START_B = 104, BC_START_C = 105, BC_STOP = 106;

const BC_C39 = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn', '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn',
  '7': 'nnnwnnwnw', '8': 'wnnwnnwnn', '9': 'nnwwnnwnn', 'A': 'wnnnnwnnw', 'B': 'nnwnnwnnw', 'C': 'wnwnnwnnn', 'D': 'nnnnwwnnw',
  'E': 'wnnnwwnnn', 'F': 'nnwnwwnnn', 'G': 'nnnnnwwnw', 'H': 'wnnnnwwnn', 'I': 'nnwnnwwnn', 'J': 'nnnnwwwnn', 'K': 'wnnnnnnww',
  'L': 'nnwnnnnww', 'M': 'wnwnnnnwn', 'N': 'nnnnwnnww', 'O': 'wnnnwnnwn', 'P': 'nnwnwnnwn', 'Q': 'nnnnnnwww', 'R': 'wnnnnnwwn',
  'S': 'nnwnnnwwn', 'T': 'nnnnwnwwn', 'U': 'wwnnnnnnw', 'V': 'nwwnnnnnw', 'W': 'wwwnnnnnn', 'X': 'nwnnwnnnw', 'Y': 'wwnnwnnnn',
  'Z': 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '*': 'nwnnwnwnn', '$': 'nwnwnwnnn', '/': 'nwnwnnnwn',
  '+': 'nwnnnwnwn', '%': 'nnnwnwnwn'
};

const BC_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const BC_G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const BC_R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const BC_PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

function bcWidthsToModules(widths) {
  let out = '';
  for (let i = 0; i < widths.length; i++) out += (i % 2 === 0 ? '1' : '0').repeat(+widths[i]);
  return out;
}

// GS1 check digit for the digits before it (all digits of the body, e.g. 12 for EAN-13)
function bcCheckDigit(body) {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const d = +body[body.length - 1 - i];
    sum += i % 2 === 0 ? d * 3 : d;
  }
  return (10 - (sum % 10)) % 10;
}

function bcNormalizeDigits(text, bodyLen, name) {
  const t = String(text || '').replace(/\s+/g, '');
  if (!/^\d+$/.test(t)) throw new Error(`${name} needs digits only (0 to 9).`);
  if (t.length !== bodyLen && t.length !== bodyLen + 1) throw new Error(`${name} needs ${bodyLen} digits (the check digit is added for you) or ${bodyLen + 1} digits including the check digit.`);
  const check = bcCheckDigit(t.slice(0, bodyLen));
  if (t.length === bodyLen + 1 && +t[bodyLen] !== check) throw new Error(`The check digit is wrong. For these digits it should be ${check}.`);
  return t.slice(0, bodyLen) + check;
}

function bcEan13(text) {
  const d = bcNormalizeDigits(text, 12, 'EAN-13');
  const parity = BC_PARITY[+d[0]];
  let m = '101';
  for (let i = 1; i <= 6; i++) m += (parity[i - 1] === 'L' ? BC_L : BC_G)[+d[i]];
  m += '01010';
  for (let i = 7; i <= 12; i++) m += BC_R[+d[i]];
  return { modules: m + '101', text: d };
}

function bcEan8(text) {
  const d = bcNormalizeDigits(text, 7, 'EAN-8');
  let m = '101';
  for (let i = 0; i < 4; i++) m += BC_L[+d[i]];
  m += '01010';
  for (let i = 4; i < 8; i++) m += BC_R[+d[i]];
  return { modules: m + '101', text: d };
}

function bcUpcA(text) {
  const d = bcNormalizeDigits(text, 11, 'UPC-A');
  return { modules: bcEan13('0' + d).modules, text: d };
}

function bcCode39(text) {
  const t = String(text || '').toUpperCase();
  if (!t) throw new Error('Enter the text to encode.');
  for (const ch of t) {
    if (ch === '*' || !BC_C39[ch]) throw new Error('Code 39 allows only A-Z, 0-9, space and - . $ / + %');
  }
  const all = '*' + t + '*';
  const parts = Array.from(all).map((ch) => bcWidthsToModules(BC_C39[ch].split('').map((c) => (c === 'w' ? 3 : 1))));
  return { modules: parts.join('0'), text: t };
}

// Code 128: all-digit even-length text uses Code C (two digits per symbol), everything else Code B (ASCII 32-126)
function bcCode128(text) {
  const t = String(text == null ? '' : text);
  if (!t) throw new Error('Enter the text to encode.');
  for (const ch of t) {
    const c = ch.charCodeAt(0);
    if (c < 32 || c > 126) throw new Error('Code 128 here supports standard keyboard characters (letters, digits and symbols) only.');
  }
  const values = [];
  if (/^\d+$/.test(t) && t.length % 2 === 0) {
    values.push(BC_START_C);
    for (let i = 0; i < t.length; i += 2) values.push(+t.slice(i, i + 2));
  } else {
    values.push(BC_START_B);
    for (const ch of t) values.push(ch.charCodeAt(0) - 32);
  }
  let sum = values[0];
  for (let i = 1; i < values.length; i++) sum += values[i] * i;
  values.push(sum % 103);
  values.push(BC_STOP);
  const modules = values.map((v) => bcWidthsToModules(BC_C128[v].split(''))).join('');
  return { modules, text: t, values };
}

const BC_TYPES = { code128: bcCode128, code39: bcCode39, ean13: bcEan13, ean8: bcEan8, upca: bcUpcA };

// runs of bars as [startModule, widthInModules]
function bcBars(modules) {
  const bars = [];
  let i = 0;
  while (i < modules.length) {
    if (modules[i] === '1') {
      let j = i;
      while (j < modules.length && modules[j] === '1') j++;
      bars.push([i, j - i]);
      i = j;
    } else i++;
  }
  return bars;
}

function bcLayout(modules, text, o) {
  const quiet = 10;
  const mw = o.moduleWidth;
  const textH = o.showText ? Math.round(mw * 7 + 8) : 0;
  const width = (modules.length + quiet * 2) * mw;
  const height = o.height + textH + (o.showText ? 6 : 0) + 8;
  return { quiet, mw, textH, width, height, top: 4 };
}

function bcSvg(modules, text, o) {
  const L = bcLayout(modules, text, o);
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${L.width}" height="${L.height}" viewBox="0 0 ${L.width} ${L.height}">`;
  s += `<rect width="100%" height="100%" fill="${o.bg}"/>`;
  s += `<g fill="${o.fg}">`;
  bcBars(modules).forEach(([x, w]) => { s += `<rect x="${(x + L.quiet) * L.mw}" y="${L.top}" width="${w * L.mw}" height="${o.height}"/>`; });
  s += '</g>';
  if (o.showText) {
    s += `<text x="${L.width / 2}" y="${L.top + o.height + L.textH - 2}" text-anchor="middle" font-family="monospace" font-size="${Math.round(L.mw * 7)}" fill="${o.fg}">${esc(text)}</text>`;
  }
  return s + '</svg>';
}

function bcDrawCanvas(canvas, modules, text, o) {
  const L = bcLayout(modules, text, o);
  canvas.width = L.width;
  canvas.height = L.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = o.bg;
  ctx.fillRect(0, 0, L.width, L.height);
  ctx.fillStyle = o.fg;
  bcBars(modules).forEach(([x, w]) => ctx.fillRect((x + L.quiet) * L.mw, L.top, w * L.mw, o.height));
  if (o.showText) {
    ctx.font = `${Math.round(L.mw * 7)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(text, L.width / 2, L.top + o.height + L.textH - 2);
  }
}

if (typeof module !== 'undefined') {
  module.exports = { bcCode128, bcCode39, bcEan13, bcEan8, bcUpcA, bcCheckDigit, bcBars, bcSvg, BC_C128, BC_C39, BC_TYPES };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    const typeEl = $('bc-type'), textEl = $('bc-text');
    const examples = { code128: 'FIXLYTOOLS-2026', code39: 'FIXLY 123', ean13: '590123412345', ean8: '9638507', upca: '03600029145' };
    const hints = {
      code128: 'Letters, digits and symbols. Digits only with an even count are packed more tightly.',
      code39: 'Capital letters, digits, space and - . $ / + %',
      ean13: '12 digits (the check digit is added) or 13 digits. Used on retail products worldwide.',
      ean8: '7 digits (the check digit is added) or 8 digits. For small packages.',
      upca: '11 digits (the check digit is added) or 12 digits. Used on products in the USA and Canada.'
    };
    let last = null;

    function opts() {
      return {
        moduleWidth: parseInt($('bc-width').value, 10),
        height: parseInt($('bc-height').value, 10),
        showText: $('bc-showtext').checked,
        fg: $('bc-fg').value,
        bg: $('bc-bg').value
      };
    }

    function render() {
      const err = $('bc-error');
      err.classList.add('nt-hide');
      $('bc-hint').textContent = hints[typeEl.value];
      const box = $('bc-preview');
      try {
        const r = BC_TYPES[typeEl.value](textEl.value);
        const o = opts();
        const svg = bcSvg(r.modules, r.text, o);
        const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
        box.replaceChildren(document.importNode(doc.documentElement, true));
        box.firstChild.style.maxWidth = '100%';
        box.firstChild.style.height = 'auto';
        last = { r, o, svg };
        $('bc-actions').classList.remove('nt-hide');
      } catch (e) {
        last = null;
        box.replaceChildren();
        err.textContent = e.message;
        err.classList.remove('nt-hide');
        $('bc-actions').classList.add('nt-hide');
      }
    }

    typeEl.addEventListener('change', () => { textEl.value = examples[typeEl.value]; render(); });
    ['input', 'change'].forEach((ev) => {
      [textEl, $('bc-width'), $('bc-height'), $('bc-showtext'), $('bc-fg'), $('bc-bg')].forEach((el) => el.addEventListener(ev, render));
    });
    $('bc-svg').addEventListener('click', () => { if (last) ntDownload(last.svg, 'barcode.svg', 'image/svg+xml'); });
    $('bc-png').addEventListener('click', () => {
      if (!last) return;
      const c = document.createElement('canvas');
      bcDrawCanvas(c, last.r.modules, last.r.text, last.o);
      c.toBlob((blob) => {
        if (!blob) { showToast('The image could not be created.', 'error'); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'barcode.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, 'image/png');
    });
    textEl.value = examples.code128;
    render();
  });
}
