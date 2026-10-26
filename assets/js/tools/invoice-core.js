// Fixlytools - Invoice Generator: calculation + PDF engine (no libraries, runs fully in the browser).
// Everything here is a pure function so it can be tested in Node as well as used by the page.

// ---------------------------------------------------------------- currencies
const INV_CURRENCIES = {
  USD: { symbol: '$', name: 'US Dollar' },
  GBP: { symbol: '£', name: 'British Pound' },
  EUR: { symbol: '€', name: 'Euro' },
  CAD: { symbol: 'CA$', name: 'Canadian Dollar' },
  AUD: { symbol: 'A$', name: 'Australian Dollar' },
  NZD: { symbol: 'NZ$', name: 'New Zealand Dollar' },
  SGD: { symbol: 'S$', name: 'Singapore Dollar' },
  CHF: { symbol: 'CHF ', name: 'Swiss Franc' },
  AED: { symbol: 'AED ', name: 'UAE Dirham' },
  INR: { symbol: 'INR ', name: 'Indian Rupee' },
  PKR: { symbol: 'Rs ', name: 'Pakistani Rupee' }
};

// ---------------------------------------------------------------- money maths (integer cents, no float drift)
function invNum(value) {
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}
function invToCents(value) {
  return Math.round(invNum(value) * 100);
}

function invComputeTotals(model) {
  const lines = (model.items || []).map(item => {
    const qty = invNum(item.qty);
    const rateCents = invToCents(item.rate);
    return { qty, rateCents, cents: Math.round(qty * rateCents) };
  });
  const subtotal = lines.reduce((sum, l) => sum + l.cents, 0);

  let discount = 0;
  const dv = Math.max(0, invNum(model.discountValue));
  if (model.discountType === 'amount') discount = Math.min(invToCents(dv), Math.max(0, subtotal));
  else discount = Math.round(Math.max(0, subtotal) * Math.min(dv, 100) / 100);

  const taxable = subtotal - discount;
  const taxRate = Math.max(0, invNum(model.taxRate));
  const tax = Math.round(taxable * taxRate / 100);
  const shipping = invToCents(model.shipping);
  const total = taxable + tax + shipping;
  const paid = invToCents(model.paid);
  return { lines, subtotal, discount, taxable, tax, shipping, total, paid, balance: total - paid };
}

function invFormatMoney(cents, currency) {
  const cur = INV_CURRENCIES[currency] || INV_CURRENCIES.USD;
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (negative ? '-' : '') + cur.symbol + grouped + '.' + frac;
}

function invFormatQty(qty) {
  return String(+invNum(qty).toFixed(4));
}

function invAddDays(isoDate, days) {
  const d = new Date(isoDate + 'T00:00:00Z');
  if (isNaN(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// "2026-10-25" -> "25 Oct 2026" (unambiguous for US, UK and European readers)
function invFormatDate(iso) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return parseInt(m[3], 10) + ' ' + months[parseInt(m[2], 10) - 1] + ' ' + m[1];
}

// ---------------------------------------------------------------- text encoding + measuring (PDF standard fonts = Windows-1252)
const INV_CP1252 = {
  0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88,
  0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93,
  0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B,
  0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F
};

// Returns { bytes: number[], lossy: boolean }. Characters the PDF fonts cannot show become "?".
function invEncode(str) {
  const bytes = [];
  let lossy = false;
  for (const ch of String(str)) {
    const cp = ch.codePointAt(0);
    let b;
    if (cp === 9) b = 32;                                  // tab
    else if (cp >= 32 && cp < 127) b = cp;
    else if (cp >= 160 && cp <= 255) b = cp;
    else if (INV_CP1252[cp] !== undefined) b = INV_CP1252[cp];
    else if (cp === 0x00A0) b = 32;
    else { b = 63; lossy = true; }
    bytes.push(b);
  }
  return { bytes, lossy };
}

// Helvetica / Helvetica-Bold advance widths (per 1000 em) for code points 32..255 in Windows-1252
const INV_W_REG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,761,556,0,222,556,333,1000,556,556,333,1000,667,333,1000,0,611,0,0,222,222,333,333,350,556,1000,333,1000,500,333,944,0,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500];
const INV_W_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,761,556,0,278,556,500,1000,556,556,333,1000,667,333,1000,0,611,0,0,278,278,500,500,350,556,1000,333,1000,556,333,944,0,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556];

function invByteWidth(b, bold) {
  const table = bold ? INV_W_BOLD : INV_W_REG;
  const w = table[b - 32];
  return w ? w : (table[63 - 32]);   // unknown -> width of "?"
}

function invMeasure(str, bold, size) {
  const { bytes } = invEncode(str);
  let total = 0;
  for (const b of bytes) total += invByteWidth(b, bold);
  return total * size / 1000;
}

// Splits text into lines that fit maxWidth. Keeps blank lines and breaks very long words.
function invWrap(str, bold, size, maxWidth) {
  const out = [];
  const paragraphs = String(str).replace(/\r\n?/g, '\n').split('\n');
  for (const para of paragraphs) {
    if (para.trim() === '') { out.push(''); continue; }
    let line = '';
    for (const word of para.split(/ +/)) {
      if (!word) continue;
      const candidate = line ? line + ' ' + word : word;
      if (invMeasure(candidate, bold, size) <= maxWidth) { line = candidate; continue; }
      if (line) { out.push(line); line = ''; }
      if (invMeasure(word, bold, size) <= maxWidth) { line = word; continue; }
      // a single word wider than the line: split by characters
      let piece = '';
      for (const ch of word) {
        if (invMeasure(piece + ch, bold, size) > maxWidth && piece) { out.push(piece); piece = ''; }
        piece += ch;
      }
      line = piece;
    }
    out.push(line);
  }
  return out;
}

// ---------------------------------------------------------------- PDF writer
function invHexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  const h = m ? m[1] : '2563eb';
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}
function invColor(rgb) { return rgb.map(v => v.toFixed(3)).join(' '); }
function invN(n) { return (Math.round(n * 100) / 100).toFixed(2); }

function invPdfString(str) {
  const { bytes } = invEncode(str);
  let s = '(';
  for (const b of bytes) {
    if (b === 0x5C) s += '\\\\';
    else if (b === 0x28) s += '\\(';
    else if (b === 0x29) s += '\\)';
    else if (b < 32 || b > 126) s += '\\' + b.toString(8).padStart(3, '0');
    else s += String.fromCharCode(b);
  }
  return s + ')';
}

const INV_PAGE_SIZES = { A4: [595.28, 841.89], LETTER: [612, 792] };

// model: see invoice-generator.js. logo: { bytes: Uint8Array (JPEG), width, height } or null.
// Returns { bytes: Uint8Array, pages: number, lossy: boolean }
function invBuildPdf(model) {
  const [pageW, pageH] = INV_PAGE_SIZES[model.pageSize] || INV_PAGE_SIZES.A4;
  const M = 48;
  const contentW = pageW - 2 * M;
  const bottomLimit = pageH - M - 24;
  const accent = invHexToRgb(model.accent);
  const GREY = [0.35, 0.37, 0.40], DARK = [0.09, 0.10, 0.12], LIGHT = [0.89, 0.91, 0.94];
  const totals = invComputeTotals(model);
  const money = c => invFormatMoney(c, model.currency);
  let lossy = false;
  const track = s => { if (invEncode(s).lossy) lossy = true; return s; };

  const pages = [];
  let ops = null;
  let y = M;

  function newPage() { ops = []; pages.push(ops); y = M; }
  function text(str, x, baseline, o) {
    o = o || {};
    const size = o.size || 10;
    str = track(str);
    let px = x;
    if (o.align === 'right') px = x - invMeasure(str, o.bold, size);
    else if (o.align === 'center') px = x - invMeasure(str, o.bold, size) / 2;
    ops.push('BT /' + (o.bold ? 'F2' : 'F1') + ' ' + size + ' Tf ' + invColor(o.color || DARK) + ' rg ' +
      invN(px) + ' ' + invN(pageH - baseline) + ' Td ' + invPdfString(str) + ' Tj ET');
  }
  function rect(x, top, w, h, color) {
    ops.push(invColor(color) + ' rg ' + invN(x) + ' ' + invN(pageH - top - h) + ' ' + invN(w) + ' ' + invN(h) + ' re f');
  }
  function hline(x1, x2, top, color, width) {
    ops.push(invColor(color) + ' RG ' + (width || 0.6) + ' w ' + invN(x1) + ' ' + invN(pageH - top) + ' m ' + invN(x2) + ' ' + invN(pageH - top) + ' l S');
  }
  function ensure(space) { if (y + space > bottomLimit) newPage(); }

  newPage();

  // ---- header: logo / business name on the left, document title on the right
  const headTop = y;
  let leftY = y;
  let logoDrawn = null;
  if (model.logo && model.logo.bytes) {
    const maxW = 170, maxH = 64;
    const scale = Math.min(maxW / model.logo.width, maxH / model.logo.height, 1);
    const w = model.logo.width * scale, h = model.logo.height * scale;
    logoDrawn = { x: M, top: leftY, w, h };
    ops.push('q ' + invN(w) + ' 0 0 ' + invN(h) + ' ' + invN(M) + ' ' + invN(pageH - leftY - h) + ' cm /Im1 Do Q');
    leftY += h + 8;
  }
  const from = model.from || {};
  const fromLines = [];
  if (from.name) fromLines.push({ t: from.name, bold: true, size: 11, color: DARK });
  invWrap(from.address || '', false, 9.5, 250).forEach(l => { if (l !== '' || fromLines.length) fromLines.push({ t: l, size: 9.5, color: GREY }); });
  if (from.email) fromLines.push({ t: from.email, size: 9.5, color: GREY });
  if (from.phone) fromLines.push({ t: from.phone, size: 9.5, color: GREY });
  if (from.taxId) fromLines.push({ t: (model.taxIdLabel || 'Tax ID') + ': ' + from.taxId, size: 9.5, color: GREY });
  fromLines.forEach(l => {
    leftY += l.size + 3;
    if (l.t) text(l.t, M, leftY, { bold: l.bold, size: l.size, color: l.color });
  });

  let rightY = headTop + 26;
  text((model.docType || 'INVOICE').toUpperCase(), pageW - M, rightY, { bold: true, size: 26, color: accent, align: 'right' });
  if (model.number) {
    rightY += 18;
    text('# ' + model.number, pageW - M, rightY, { size: 11, color: GREY, align: 'right' });
  }
  y = Math.max(leftY, rightY) + 26;

  // ---- bill to + meta
  const infoTop = y;
  let billY = infoTop;
  text('BILL TO', M, billY + 9, { bold: true, size: 8.5, color: accent });
  billY += 9;
  const to = model.to || {};
  const toLines = [];
  if (to.name) toLines.push({ t: to.name, bold: true, size: 11, color: DARK });
  invWrap(to.address || '', false, 9.5, 240).forEach(l => toLines.push({ t: l, size: 9.5, color: GREY }));
  if (to.email) toLines.push({ t: to.email, size: 9.5, color: GREY });
  toLines.forEach(l => { billY += l.size + 3; if (l.t) text(l.t, M, billY, { bold: l.bold, size: l.size, color: l.color }); });

  const metaRows = [];
  if (model.date) metaRows.push([model.dateLabel || 'Date', invFormatDate(model.date)]);
  if (model.dueDate) metaRows.push([model.dueLabel || 'Due date', invFormatDate(model.dueDate)]);
  if (model.terms) metaRows.push(['Terms', model.terms]);
  if (model.poNumber) metaRows.push(['PO number', model.poNumber]);
  let metaY = infoTop;
  metaRows.forEach(r => {
    metaY += 15;
    text(r[0], pageW - M - 190, metaY, { size: 9.5, color: GREY });
    text(r[1], pageW - M, metaY, { size: 9.5, bold: true, align: 'right' });
  });
  y = Math.max(billY, metaY) + 28;

  // ---- items table
  const amountRight = pageW - M - 8;
  const rateRight = amountRight - 95;
  const qtyRight = rateRight - 85;
  const descX = M + 8;
  const descW = qtyRight - 55 - descX;

  function tableHeader() {
    rect(M, y, contentW, 22, accent);
    text('DESCRIPTION', descX, y + 15, { bold: true, size: 8.5, color: [1, 1, 1] });
    text('QTY', qtyRight, y + 15, { bold: true, size: 8.5, color: [1, 1, 1], align: 'right' });
    text('RATE', rateRight, y + 15, { bold: true, size: 8.5, color: [1, 1, 1], align: 'right' });
    text('AMOUNT', amountRight, y + 15, { bold: true, size: 8.5, color: [1, 1, 1], align: 'right' });
    y += 22;
  }
  tableHeader();
  (model.items || []).forEach((item, i) => {
    const line = totals.lines[i];
    const descLines = invWrap(item.desc || '', false, 10, descW);
    const rowH = Math.max(1, descLines.length) * 13 + 12;
    if (y + rowH > bottomLimit) { newPage(); tableHeader(); }
    descLines.forEach((l, k) => { if (l) text(l, descX, y + 15 + k * 13, { size: 10 }); });
    text(invFormatQty(line.qty), qtyRight, y + 15, { size: 10, align: 'right' });
    text(money(line.rateCents), rateRight, y + 15, { size: 10, align: 'right' });
    text(money(line.cents), amountRight, y + 15, { size: 10, align: 'right', bold: true });
    y += rowH;
    hline(M, M + contentW, y, LIGHT, 0.6);
  });

  // ---- totals
  const rows = [['Subtotal', money(totals.subtotal)]];
  if (totals.discount > 0) {
    const label = model.discountType === 'amount' ? 'Discount' : 'Discount (' + invFormatQty(model.discountValue) + '%)';
    rows.push([label, '-' + money(totals.discount)]);
  }
  if (invNum(model.taxRate) > 0) rows.push([(model.taxLabel || 'Tax') + ' (' + invFormatQty(model.taxRate) + '%)', money(totals.tax)]);
  if (totals.shipping !== 0) rows.push(['Shipping', money(totals.shipping)]);
  const hasPaid = totals.paid !== 0;
  const totalsH = rows.length * 17 + 14 + 24 + (hasPaid ? 17 + 8 + 28 : 0) + 10;
  y += 12;
  ensure(totalsH);
  const tx = pageW - M - 230;
  rows.forEach(r => {
    y += 17;
    text(r[0], tx, y, { size: 10, color: GREY });
    text(r[1], pageW - M, y, { size: 10, align: 'right' });
  });
  y += 8;
  hline(tx, pageW - M, y, [0.8, 0.82, 0.86], 0.8);
  y += 18;
  text('Total' + (model.currencyInTotal ? ' (' + model.currency + ')' : ''), tx, y, { bold: true, size: 12 });
  text(money(totals.total), pageW - M, y, { bold: true, size: 12, align: 'right' });
  if (hasPaid) {
    y += 17;
    text('Amount paid', tx, y, { size: 10, color: GREY });
    text('-' + money(totals.paid), pageW - M, y, { size: 10, align: 'right' });
    y += 10;
    rect(tx - 8, y, 238, 26, accent);
    text('Balance due', tx, y + 17, { bold: true, size: 11, color: [1, 1, 1] });
    text(money(totals.balance), pageW - M - 8, y + 17, { bold: true, size: 11, color: [1, 1, 1], align: 'right' });
    y += 26;
  }
  y += 28;

  // ---- notes and payment details (paginated line by line)
  function block(title, body) {
    if (!body || !String(body).trim()) return;
    ensure(40);
    text(title, M, y + 9, { bold: true, size: 9.5, color: accent });
    y += 16;
    invWrap(body, false, 9.5, contentW).forEach(l => {
      ensure(14);
      y += 13;
      if (l) text(l, M, y, { size: 9.5, color: GREY });
    });
    y += 14;
  }
  block(model.paymentTitle || 'Payment details', model.payment);
  block('Notes', model.notes);

  // ---- footer on every page
  const total = pages.length;
  pages.forEach((p, idx) => {
    ops = p;
    if (model.showBrand !== false) text('Created free with Fixlytools.com', pageW / 2, pageH - 28, { size: 8, color: [0.55, 0.57, 0.6], align: 'center' });
    if (total > 1) text('Page ' + (idx + 1) + ' of ' + total, pageW - M, pageH - 28, { size: 8, color: [0.55, 0.57, 0.6], align: 'right' });
  });

  // ---- assemble the file
  const enc = s => { const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 255; return a; };
  const chunks = [];
  let offset = 0;
  const offsets = [];
  const push = bytes => { chunks.push(bytes); offset += bytes.length; };
  const hasLogo = !!(model.logo && model.logo.bytes);

  // object numbers: 1 catalog, 2 pages, 3 F1, 4 F2, [5 image], then content/page pairs, then info
  let nextId = 5;
  const imgId = hasLogo ? nextId++ : 0;
  const pageIds = [], contentIds = [];
  pages.forEach(() => { contentIds.push(nextId++); pageIds.push(nextId++); });
  const infoId = nextId++;
  const objCount = nextId;

  function obj(id, bodyBytesList) {
    offsets[id] = offset;
    push(enc(id + ' 0 obj\n'));
    bodyBytesList.forEach(push);
    push(enc('\nendobj\n'));
  }

  push(enc('%PDF-1.4\n'));
  push(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));
  obj(1, [enc('<< /Type /Catalog /Pages 2 0 R >>')]);
  obj(2, [enc('<< /Type /Pages /Kids [' + pageIds.map(i => i + ' 0 R').join(' ') + '] /Count ' + pages.length + ' >>')]);
  obj(3, [enc('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')]);
  obj(4, [enc('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')]);
  if (hasLogo) {
    obj(imgId, [
      enc('<< /Type /XObject /Subtype /Image /Width ' + model.logo.width + ' /Height ' + model.logo.height +
        ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + model.logo.bytes.length + ' >>\nstream\n'),
      model.logo.bytes,
      enc('\nendstream')
    ]);
  }
  pages.forEach((p, i) => {
    const content = enc(p.join('\n'));
    obj(contentIds[i], [enc('<< /Length ' + content.length + ' >>\nstream\n'), content, enc('\nendstream')]);
    obj(pageIds[i], [enc('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + invN(pageW) + ' ' + invN(pageH) + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>' +
      (hasLogo ? ' /XObject << /Im1 ' + imgId + ' 0 R >>' : '') + ' >> /Contents ' + contentIds[i] + ' 0 R >>')]);
  });
  const title = invPdfString((model.docType || 'Invoice') + (model.number ? ' ' + model.number : ''));
  obj(infoId, [enc('<< /Title ' + title + ' /Producer (Fixlytools.com) /Creator (Fixlytools Invoice Generator) >>')]);

  const xrefAt = offset;
  let xref = 'xref\n0 ' + objCount + '\n0000000000 65535 f \n';
  for (let id = 1; id < objCount; id++) xref += String(offsets[id]).padStart(10, '0') + ' 00000 n \n';
  xref += 'trailer\n<< /Size ' + objCount + ' /Root 1 0 R /Info ' + infoId + ' 0 R >>\nstartxref\n' + xrefAt + '\n%%EOF\n';
  push(enc(xref));

  const out = new Uint8Array(offset);
  let pos = 0;
  chunks.forEach(c => { out.set(c, pos); pos += c.length; });
  return { bytes: out, pages: pages.length, lossy };
}

if (typeof module !== 'undefined') {
  module.exports = {
    INV_CURRENCIES, invNum, invToCents, invComputeTotals, invFormatMoney, invFormatQty, invAddDays, invFormatDate,
    invEncode, invMeasure, invWrap, invBuildPdf
  };
}
