// Fixlytools - Invoice Generator (free version: everything runs in the browser)

// ---------- pure helpers (also used by the tests) ----------

// [code, name, prefix printed before amounts, decimals]. The built-in PDF font cannot print most currency symbols,
// so a currency without a safe symbol is printed with its code (e.g. "SAR 150.00").
const INV_CURRENCY_LIST = [
  ['USD', 'US Dollar', '$', 2], ['GBP', 'British Pound', '£', 2], ['EUR', 'Euro', '€', 2],
  ['CAD', 'Canadian Dollar', 'CA$', 2], ['AUD', 'Australian Dollar', 'A$', 2], ['NZD', 'New Zealand Dollar', 'NZ$', 2],
  ['CHF', 'Swiss Franc', 'CHF ', 2], ['SEK', 'Swedish Krona', 'SEK ', 2], ['NOK', 'Norwegian Krone', 'NOK ', 2],
  ['DKK', 'Danish Krone', 'DKK ', 2], ['PLN', 'Polish Zloty', 'PLN ', 2], ['CZK', 'Czech Koruna', 'CZK ', 2],
  ['HUF', 'Hungarian Forint', 'HUF ', 2], ['RON', 'Romanian Leu', 'RON ', 2], ['TRY', 'Turkish Lira', 'TRY ', 2],
  ['SGD', 'Singapore Dollar', 'S$', 2], ['HKD', 'Hong Kong Dollar', 'HK$', 2], ['JPY', 'Japanese Yen', 'JPY ', 0],
  ['KRW', 'South Korean Won', 'KRW ', 0], ['CNY', 'Chinese Yuan', 'CNY ', 2],
  ['AED', 'UAE Dirham', 'AED ', 2], ['SAR', 'Saudi Riyal', 'SAR ', 2], ['QAR', 'Qatari Riyal', 'QAR ', 2],
  ['KWD', 'Kuwaiti Dinar', 'KWD ', 3], ['BHD', 'Bahraini Dinar', 'BHD ', 3], ['OMR', 'Omani Rial', 'OMR ', 3],
  ['JOD', 'Jordanian Dinar', 'JOD ', 3], ['EGP', 'Egyptian Pound', 'EGP ', 2], ['MAD', 'Moroccan Dirham', 'MAD ', 2],
  ['TND', 'Tunisian Dinar', 'TND ', 3],
  ['PKR', 'Pakistani Rupee', 'PKR ', 2], ['INR', 'Indian Rupee', 'INR ', 2], ['BDT', 'Bangladeshi Taka', 'BDT ', 2],
  ['LKR', 'Sri Lankan Rupee', 'LKR ', 2], ['NPR', 'Nepalese Rupee', 'NPR ', 2],
  ['MYR', 'Malaysian Ringgit', 'MYR ', 2], ['IDR', 'Indonesian Rupiah', 'IDR ', 2], ['THB', 'Thai Baht', 'THB ', 2],
  ['PHP', 'Philippine Peso', 'PHP ', 2], ['VND', 'Vietnamese Dong', 'VND ', 0],
  ['ZAR', 'South African Rand', 'ZAR ', 2], ['NGN', 'Nigerian Naira', 'NGN ', 2], ['KES', 'Kenyan Shilling', 'KES ', 2],
  ['GHS', 'Ghanaian Cedi', 'GHS ', 2], ['TZS', 'Tanzanian Shilling', 'TZS ', 2], ['UGX', 'Ugandan Shilling', 'UGX ', 0],
  ['BRL', 'Brazilian Real', 'BRL ', 2], ['MXN', 'Mexican Peso', 'MXN ', 2]
];
const INV_CURRENCIES = {};
const INV_DECIMALS = {};
const INV_CURRENCY_NAMES = {};
INV_CURRENCY_LIST.forEach(([code, name, prefix, dec]) => {
  INV_CURRENCIES[code] = prefix; INV_DECIMALS[code] = dec; INV_CURRENCY_NAMES[code] = name;
});

const INV_PAY_METHODS = {
  '': '', cash: 'Cash', bank: 'Bank transfer', card: 'Card', cheque: 'Cheque', online: 'Online payment',
  wallet: 'Digital wallet', cod: 'Cash on delivery', other: 'Other'
};

const INV_DOC_TYPES = {
  invoice:  { title: 'INVOICE',          dueLabel: 'Due date',    showDue: true,  showPaid: true  },
  proforma: { title: 'PRO-FORMA INVOICE', dueLabel: 'Due date',    showDue: true,  showPaid: true  },
  quote:    { title: 'QUOTE',            dueLabel: 'Valid until', showDue: true,  showPaid: false },
  receipt:  { title: 'RECEIPT',          dueLabel: 'Due date',    showDue: false, showPaid: true  }
};

function invDecimals(currency) {
  return INV_DECIMALS[currency] !== undefined ? INV_DECIMALS[currency] : 2;
}

// rounds to the number of decimals the currency uses (default 2)
function invRound(n, dec) {
  const f = Math.pow(10, dec === undefined ? 2 : dec);
  return Math.round((Number(n) + Number.EPSILON) * f) / f;
}

function invNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function invFormatMoney(amount, currency) {
  const sym = INV_CURRENCIES[currency] !== undefined ? INV_CURRENCIES[currency] : (currency + ' ');
  const dec = invDecimals(currency);
  const abs = Math.abs(invRound(amount, dec));
  const text = abs.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return (amount < 0 ? '-' : '') + sym + text;
}

// items: [{ description, qty, price, unit }]; o: { discountType: 'percent'|'amount', discountValue, taxRate, shipping, paid, docType, currency }
function invComputeTotals(items, o) {
  const dec = invDecimals(o.currency);
  const r = (n) => invRound(n, dec);
  const lines = items.map(i => ({
    description: i.description || '',
    unit: i.unit || '',
    qty: invNum(i.qty),
    price: invNum(i.price),
    amount: r(invNum(i.qty) * invNum(i.price))
  }));
  const subtotal = r(lines.reduce((s, l) => s + l.amount, 0));

  const dv = Math.max(invNum(o.discountValue), 0);
  const discount = o.discountType === 'percent'
    ? r(subtotal * Math.min(dv, 100) / 100)
    : r(Math.min(dv, subtotal));

  const taxable = r(subtotal - discount);
  const taxRate = Math.min(Math.max(invNum(o.taxRate), 0), 100);
  const tax = r(taxable * taxRate / 100);
  const shipping = r(Math.max(invNum(o.shipping), 0));
  const total = r(taxable + tax + shipping);

  let paid = r(Math.max(invNum(o.paid), 0));
  if (o.docType === 'receipt' && paid === 0) paid = total;      // a receipt means "paid in full" unless stated
  const balance = r(total - paid);
  return { lines, subtotal, discount, taxable, taxRate, tax, shipping, total, paid, balance };
}

// ---- amount in words (English) ----
const INV_ONES = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const INV_TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function invBelowThousand(n) {
  const parts = [];
  if (n >= 100) { parts.push(INV_ONES[Math.floor(n / 100)] + ' Hundred'); n %= 100; }
  if (n >= 20) { parts.push(INV_TENS[Math.floor(n / 10)] + (n % 10 ? '-' + INV_ONES[n % 10] : '')); }
  else if (n > 0) parts.push(INV_ONES[n]);
  return parts.join(' ');
}

// whole number (up to 999,999,999,999,999) -> "One Thousand Two Hundred Thirty-Four"
function invIntToWords(n) {
  n = Math.floor(Math.abs(n));
  if (n === 0) return 'Zero';
  const units = [[1e12, 'Trillion'], [1e9, 'Billion'], [1e6, 'Million'], [1e3, 'Thousand']];
  const parts = [];
  for (const [size, name] of units) {
    if (n >= size) { parts.push(invBelowThousand(Math.floor(n / size)) + ' ' + name); n %= size; }
  }
  if (n > 0) parts.push(invBelowThousand(n));
  return parts.join(' ');
}

// e.g. "PKR One Thousand Two Hundred and 50/100 Only"
function invAmountInWords(amount, currency) {
  const dec = invDecimals(currency);
  const f = Math.pow(10, dec);
  const minor = Math.round(Math.abs(amount) * f);
  const whole = Math.floor(minor / f);
  const frac = minor - whole * f;
  if (whole > 999999999999999) return '';
  let out = currency + ' ' + invIntToWords(whole);
  if (dec > 0 && frac > 0) out += ' and ' + String(frac).padStart(dec, '0') + '/' + f;
  return out + ' Only';
}

// Turns "INV-0009" into "INV-0010" (keeps the leading zeros)
function invNextNumber(current) {
  const m = /^(.*?)(\d+)$/.exec(String(current || '').trim());
  if (!m) return current ? current + '-2' : 'INV-0001';
  const next = String(parseInt(m[2], 10) + 1).padStart(m[2].length, '0');
  return m[1] + next;
}

function invAddDays(isoDate, days) {
  const d = new Date(isoDate + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + mm + '-' + dd;
}

function invFormatDate(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  if (isNaN(d.getTime())) return isoDate || '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// The built-in PDF fonts only know Latin letters; anything else is replaced so the PDF never fails.
function invSanitize(text) {
  const extra = [0x20AC, 0x2018, 0x2019, 0x201C, 0x201D, 0x2013, 0x2014, 0x2022, 0x2026];
  let out = '';
  for (const ch of String(text == null ? '' : text)) {
    const cp = ch.codePointAt(0);
    if (ch === '\n') out += '\n';
    else if (ch === '\t') out += ' ';
    else if ((cp >= 32 && cp <= 126) || (cp >= 160 && cp <= 255) || extra.includes(cp)) out += ch;
    else out += '?';
  }
  return out;
}

// Splits text into lines that fit maxWidth (handles line breaks and very long words)
function invWrap(text, font, size, maxWidth) {
  const out = [];
  const paragraphs = invSanitize(text).split('\n');
  for (const para of paragraphs) {
    if (para.trim() === '') { out.push(''); continue; }
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      let w = word;
      while (font.widthOfTextAtSize(w, size) > maxWidth) {       // break a word that is wider than the line
        let cut = w.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > maxWidth) cut--;
        if (line) { out.push(line); line = ''; }
        out.push(w.slice(0, cut));
        w = w.slice(cut);
      }
      const test = line ? line + ' ' + w : w;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) line = test;
      else { out.push(line); line = w; }
    }
    if (line) out.push(line);
  }
  return out;
}

function invHexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  const v = m ? m[1] : '2563eb';
  return [parseInt(v.slice(0, 2), 16) / 255, parseInt(v.slice(2, 4), 16) / 255, parseInt(v.slice(4, 6), 16) / 255];
}

function invBase64ToBytes(dataUrl) {
  const b64 = String(dataUrl).split(',')[1] || '';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Builds the PDF and returns its bytes. PDFLib is passed in so tests can supply it.
async function invBuildPdf(d, PDFLib) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const type = INV_DOC_TYPES[d.docType] || INV_DOC_TYPES.invoice;
  const t = d.totals;
  const cur = d.currency;
  const money = (n) => invSanitize(invFormatMoney(n, cur));
  const accent = rgb(...invHexToRgb(d.accent));
  const dark = rgb(0.06, 0.09, 0.16);
  const grey = rgb(0.4, 0.45, 0.53);
  const line = rgb(0.85, 0.88, 0.92);

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const W = 595.28, H = 841.89, M = 48, RIGHT = W - M;
  const COL = { qty: 335, price: 435, amount: RIGHT };       // right edges of the number columns
  const DESC_W = COL.qty - 60 - M;                           // room left for the description column
  let page, y;

  const text = (s, x, yy, size, f, color) => page.drawText(invSanitize(s), { x, y: yy, size, font: f || font, color: color || dark });
  const textRight = (s, xr, yy, size, f, color) => {
    const clean = invSanitize(s);
    page.drawText(clean, { x: xr - (f || font).widthOfTextAtSize(clean, size), y: yy, size, font: f || font, color: color || dark });
  };

  function newPage() {
    page = pdf.addPage([W, H]);
    y = H - M;
  }

  function tableHeader() {
    page.drawRectangle({ x: M, y: y - 6, width: RIGHT - M, height: 22, color: accent });
    text('Description', M + 8, y + 1, 9, bold, rgb(1, 1, 1));
    textRight('Qty', COL.qty, y + 1, 9, bold, rgb(1, 1, 1));
    textRight('Unit price', COL.price, y + 1, 9, bold, rgb(1, 1, 1));
    textRight('Amount', COL.amount - 8, y + 1, 9, bold, rgb(1, 1, 1));
    y -= 26;
  }

  function ensureSpace(h, withHeader) {
    if (y - h < M + 30) {
      newPage();
      if (withHeader) tableHeader();
    }
  }

  newPage();

  // ----- header: logo or business name on the left, document title on the right -----
  let headerBottom = y;
  let drewLogo = false;
  if (d.logoDataUrl) {
    try {
      const bytes = invBase64ToBytes(d.logoDataUrl);
      const img = d.logoDataUrl.startsWith('data:image/jpeg') ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
      const scale = Math.min(150 / img.width, 60 / img.height, 1);
      const w = img.width * scale, h = img.height * scale;
      page.drawImage(img, { x: M, y: y - h, width: w, height: h });
      headerBottom = y - h;
      drewLogo = true;
    } catch (e) { /* a broken logo must never stop the invoice */ }
  }
  if (!drewLogo) {
    const name = d.from.name || 'Your business';
    text(name, M, y - 18, 18, bold, dark);
    headerBottom = y - 24;
  }
  textRight(type.title, RIGHT, y - 20, 24, bold, accent);
  y = Math.min(headerBottom, y - 34) - 24;

  // ----- from (left) and meta (right) -----
  const fromLines = [];
  if (drewLogo && d.from.name) fromLines.push({ s: d.from.name, b: true });
  invWrap(d.from.address, font, 9.5, 230).forEach(s => fromLines.push({ s }));
  if (d.from.email) fromLines.push({ s: d.from.email });
  if (d.from.phone) fromLines.push({ s: d.from.phone });
  if (d.from.taxId) fromLines.push({ s: d.from.taxId });

  const meta = [['Number', d.number], ['Date', invFormatDate(d.issueDate)]];
  if (type.showDue && d.dueDate) meta.push([type.dueLabel, invFormatDate(d.dueDate)]);
  if (d.reference) meta.push(['Reference', d.reference]);
  if (d.payMethod && INV_PAY_METHODS[d.payMethod]) meta.push(['Payment method', INV_PAY_METHODS[d.payMethod]]);

  let yl = y;
  fromLines.forEach(l => { text(l.s, M, yl, l.b ? 10.5 : 9.5, l.b ? bold : font, l.b ? dark : grey); yl -= 13; });
  let yr = y;
  meta.forEach(([k, v]) => {
    textRight(k, RIGHT - 130, yr, 9.5, font, grey);
    textRight(String(v), RIGHT, yr, 9.5, bold, dark);
    yr -= 14;
  });
  y = Math.min(yl, yr) - 16;

  // ----- bill to (left) and ship to (right) -----
  const billLines = [];
  if (d.to.name) billLines.push({ s: d.to.name, b: true });
  invWrap(d.to.address, font, 9.5, 250).forEach(s => billLines.push({ s }));
  if (d.to.phone) billLines.push({ s: 'Tel: ' + d.to.phone });
  if (d.to.email) billLines.push({ s: d.to.email });
  if (d.to.taxId) billLines.push({ s: 'Tax ID: ' + d.to.taxId });
  const shipLines = d.shipTo && d.shipTo.trim() ? invWrap(d.shipTo, font, 9.5, 225) : [];
  if (d.shipTo && d.shipTo.trim() && d.to.phone) shipLines.push('Tel: ' + d.to.phone);
  if (billLines.length || shipLines.length) {
    const X2 = 330;
    if (billLines.length) text('BILL TO', M, y, 8.5, bold, accent);
    if (shipLines.length) text('SHIP TO', X2, y, 8.5, bold, accent);
    y -= 14;
    let yb = y, ys = y;
    billLines.forEach(l => { text(l.s, M, yb, l.b ? 10.5 : 9.5, l.b ? bold : font, l.b ? dark : grey); yb -= 13; });
    shipLines.forEach(l => { text(l, X2, ys, 9.5, font, grey); ys -= 13; });
    y = Math.min(yb, ys) - 10;
  }

  // ----- items table -----
  ensureSpace(60, false);
  tableHeader();
  t.lines.forEach(l => {
    const descLines = invWrap(l.description || '-', font, 9.5, DESC_W);
    const rowH = Math.max(descLines.length * 12, 14) + 8;
    ensureSpace(rowH, true);
    descLines.forEach((s, i) => text(s, M + 8, y - 2 - i * 12, 9.5, font, dark));
    const qtyText = String(Math.round(l.qty * 1000) / 1000) + (l.unit ? ' ' + l.unit : '');
    textRight(qtyText, COL.qty, y - 2, 9.5, font, dark);
    textRight(money(l.price), COL.price, y - 2, 9.5, font, dark);
    textRight(money(l.amount), COL.amount - 8, y - 2, 9.5, font, dark);
    page.drawLine({ start: { x: M, y: y - rowH + 8 }, end: { x: RIGHT, y: y - rowH + 8 }, thickness: 0.5, color: line });
    y -= rowH;
  });
  y -= 6;

  // ----- totals -----
  const rows = [['Subtotal', money(t.subtotal)]];
  if (t.discount > 0) {
    const label = d.discountType === 'percent' ? 'Discount (' + invRound(invNum(d.discountValue)) + '%)' : 'Discount';
    rows.push([label, '-' + money(t.discount)]);
  }
  if (t.tax > 0 || t.taxRate > 0) rows.push([(d.taxLabel || 'Tax') + ' (' + invRound(t.taxRate) + '%)', money(t.tax)]);
  if (t.shipping > 0) rows.push(['Shipping', money(t.shipping)]);
  ensureSpace(rows.length * 16 + 70, false);
  rows.forEach(([k, v]) => {
    textRight(k, RIGHT - 110, y, 9.5, font, grey);
    textRight(v, RIGHT - 8, y, 9.5, font, dark);
    y -= 16;
  });
  page.drawLine({ start: { x: RIGHT - 220, y: y + 8 }, end: { x: RIGHT, y: y + 8 }, thickness: 0.8, color: line });
  y -= 6;
  textRight('Total', RIGHT - 110, y, 11, bold, dark);
  textRight(money(t.total), RIGHT - 8, y, 11, bold, dark);
  y -= 20;
  if (type.showPaid && (t.paid > 0 || d.docType !== 'receipt')) {
    if (t.paid > 0) {
      textRight('Amount paid', RIGHT - 110, y, 9.5, font, grey);
      textRight('-' + money(t.paid), RIGHT - 8, y, 9.5, font, dark);
      y -= 18;
    }
    if (t.paid > 0 || d.docType === 'invoice' || d.docType === 'proforma') {
      page.drawRectangle({ x: RIGHT - 220, y: y - 7, width: 220, height: 24, color: accent });
      const lbl = (d.docType === 'receipt' && t.balance === 0) ? 'Paid in full'
        : (d.payMethod === 'cod' && t.balance > 0 ? 'Collect on delivery' : 'Balance due');
      text(lbl, RIGHT - 212, y + 1, 10.5, bold, rgb(1, 1, 1));
      textRight(money(t.balance), RIGHT - 8, y + 1, 10.5, bold, rgb(1, 1, 1));
      y -= 36;
    }
  } else if (d.docType === 'receipt') {
    y -= 8;
  }

  // ----- notes and payment details -----
  function block(title, content) {
    if (!content || !content.trim()) return;
    const lines = invWrap(content, font, 9.5, RIGHT - M);
    ensureSpace(30, false);
    text(title.toUpperCase(), M, y, 8.5, bold, accent);
    y -= 14;
    lines.forEach(s => {
      ensureSpace(14, false);
      text(s, M, y, 9.5, font, grey);
      y -= 12.5;
    });
    y -= 10;
  }
  if (d.showWords) block('Amount in words', invAmountInWords(t.total, cur));
  block('Payment details', d.paymentInfo);
  block('Notes', d.notes);

  // ----- signature (optional) -----
  if (d.signatureDataUrl || (d.signatureLabel && d.signatureLabel.trim())) {
    ensureSpace(90, false);
    y -= 10;
    let sigW = 150;
    if (d.signatureDataUrl) {
      try {
        const simg = await pdf.embedPng(invBase64ToBytes(d.signatureDataUrl));
        const sc = Math.min(150 / simg.width, 50 / simg.height, 1);
        const w = simg.width * sc, h = simg.height * sc;
        page.drawImage(simg, { x: RIGHT - 150, y: y - h, width: w, height: h });
        y -= h + 4;
      } catch (e) { y -= 40; }
    } else { y -= 40; }
    page.drawLine({ start: { x: RIGHT - sigW, y }, end: { x: RIGHT, y }, thickness: 0.7, color: grey });
    y -= 12;
    textRight((d.signatureLabel && d.signatureLabel.trim()) || 'Authorized signature', RIGHT, y, 8.5, font, grey);
    y -= 14;
  }

  // ----- footer on every page -----
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText('Created with Fixlytools.com', { x: M, y: 28, size: 8, font, color: grey });
    const label = 'Page ' + (i + 1) + ' of ' + pages.length;
    p.drawText(label, { x: RIGHT - font.widthOfTextAtSize(label, 8), y: 28, size: 8, font, color: grey });
  });

  pdf.setTitle(invSanitize(type.title + ' ' + (d.number || '')));
  pdf.setProducer('Fixlytools.com');
  return pdf.save();
}

if (typeof module !== 'undefined') {
  module.exports = { invRound, invDecimals, invAmountInWords, invIntToWords, INV_CURRENCIES, INV_DECIMALS, invFormatMoney, invComputeTotals, invNextNumber, invAddDays, invSanitize, invWrap, invBuildPdf, INV_DOC_TYPES };
}

// ---------- page wiring ----------

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    if (!$('inv-form')) return;

    const STORE_KEY = 'fixlytools_invoice_v1';
    const MAX_ITEMS = 50;
    const SWATCHES = ['#2563eb', '#0f766e', '#7c3aed', '#be123c', '#c2410c', '#0f172a'];

    const els = {
      docType: $('inv-doctype'), number: $('inv-number'), issue: $('inv-issue'), terms: $('inv-terms'), due: $('inv-due'),
      currency: $('inv-currency'), reference: $('inv-reference'),
      fromName: $('inv-from-name'), fromAddress: $('inv-from-address'), fromEmail: $('inv-from-email'),
      fromPhone: $('inv-from-phone'), fromTax: $('inv-from-tax'),
      toName: $('inv-to-name'), toAddress: $('inv-to-address'), toEmail: $('inv-to-email'),
      toPhone: $('inv-to-phone'), toTax: $('inv-to-tax'), shipTo: $('inv-ship-to'),
      payMethod: $('inv-paymethod'), showWords: $('inv-showwords'), curSearch: $('inv-cur-search'),
      sigInput: $('inv-sig-input'), sigPreview: $('inv-sig-preview'), sigRemove: $('inv-sig-remove'), sigLabel: $('inv-sig-label'),
      itemsBox: $('inv-items'), addItem: $('inv-add-item'),
      discType: $('inv-disc-type'), discValue: $('inv-disc-value'), taxLabel: $('inv-tax-label'), taxRate: $('inv-tax-rate'),
      shipping: $('inv-shipping'), paid: $('inv-paid'),
      notes: $('inv-notes'), payInfo: $('inv-payinfo'),
      logoInput: $('inv-logo-input'), logoPreview: $('inv-logo-preview'), logoRemove: $('inv-logo-remove'),
      accent: $('inv-accent'), swatchBox: $('inv-swatches'),
      remember: $('inv-remember'), clearSaved: $('inv-clear-saved'),
      totals: $('inv-totals'), download: $('inv-download'), preview: $('inv-preview'), reset: $('inv-reset')
    };

    let logoDataUrl = '';
    let signatureDataUrl = '';
    let accent = SWATCHES[0];
    let itemSeq = 0;

    // ----- saved data -----
    function loadSaved() {
      try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { return null; }
    }
    function writeSaved(obj) {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(obj)); return true; } catch (e) { return false; }
    }

    function today() {
      const d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function updateDue() {
      const days = els.terms.value;
      if (days === 'custom') return;
      els.due.value = invAddDays(els.issue.value || today(), parseInt(days, 10));
    }

    // ----- line items -----
    function addItemRow(desc, qty, price) {
      if (els.itemsBox.children.length >= MAX_ITEMS) { showToast('You can add up to ' + MAX_ITEMS + ' lines.', 'warning'); return; }
      const id = ++itemSeq;
      const row = document.createElement('div');
      row.className = 'inv-item';
      row.innerHTML =
        '<input type="text" class="inv-input inv-desc" placeholder="Description" aria-label="Item description" maxlength="300">' +
        '<input type="number" class="inv-input inv-num inv-qty" min="0" step="any" placeholder="Qty" aria-label="Quantity">' +
        '<input type="text" class="inv-input inv-unit" maxlength="8" placeholder="Unit" aria-label="Unit, for example pcs or hours">' +
        '<input type="number" class="inv-input inv-num inv-price" min="0" step="any" placeholder="Price" aria-label="Unit price">' +
        '<div class="inv-amount" aria-label="Line amount">0.00</div>' +
        '<button type="button" class="inv-remove" aria-label="Remove line ' + id + '">&times;</button>';
      row.querySelector('.inv-desc').value = desc || '';
      row.querySelector('.inv-qty').value = qty === undefined ? '1' : qty;
      row.querySelector('.inv-price').value = price === undefined ? '' : price;
      row.addEventListener('input', refresh);
      row.querySelector('.inv-remove').addEventListener('click', () => {
        row.remove();
        if (els.itemsBox.children.length === 0) addItemRow();
        refresh();
      });
      els.itemsBox.appendChild(row);
    }

    function readItems() {
      return Array.from(els.itemsBox.children).map(row => ({
        description: row.querySelector('.inv-desc').value.trim(),
        qty: row.querySelector('.inv-qty').value,
        unit: row.querySelector('.inv-unit').value.trim(),
        price: row.querySelector('.inv-price').value
      }));
    }

    // ----- read the whole form -----
    function readForm() {
      const items = readItems();
      const opts = {
        discountType: els.discType.value, discountValue: els.discValue.value, taxRate: els.taxRate.value,
        shipping: els.shipping.value, paid: els.paid.value, docType: els.docType.value, currency: els.currency.value
      };
      return {
        docType: els.docType.value, number: els.number.value.trim(), issueDate: els.issue.value, dueDate: els.due.value,
        currency: els.currency.value, reference: els.reference.value.trim(),
        from: { name: els.fromName.value.trim(), address: els.fromAddress.value.trim(), email: els.fromEmail.value.trim(), phone: els.fromPhone.value.trim(), taxId: els.fromTax.value.trim() },
        to: { name: els.toName.value.trim(), address: els.toAddress.value.trim(), email: els.toEmail.value.trim(), phone: els.toPhone.value.trim(), taxId: els.toTax.value.trim() },
        shipTo: els.shipTo.value, payMethod: els.payMethod.value, showWords: els.showWords.checked,
        signatureDataUrl, signatureLabel: els.sigLabel.value,
        discountType: els.discType.value, discountValue: els.discValue.value,
        taxLabel: els.taxLabel.value.trim() || 'Tax',
        notes: els.notes.value, paymentInfo: els.payInfo.value,
        accent, logoDataUrl,
        totals: invComputeTotals(items, opts)
      };
    }

    function refresh() {
      const d = readForm();
      const t = d.totals;
      const cur = d.currency;
      const type = INV_DOC_TYPES[d.docType];
      Array.from(els.itemsBox.children).forEach((row, i) => {
        row.querySelector('.inv-amount').textContent = invFormatMoney(t.lines[i].amount, cur);
      });
      const rows = [['Subtotal', invFormatMoney(t.subtotal, cur), '']];
      if (t.discount > 0) rows.push(['Discount', '-' + invFormatMoney(t.discount, cur), '']);
      if (t.taxRate > 0) rows.push([d.taxLabel + ' (' + t.taxRate + '%)', invFormatMoney(t.tax, cur), '']);
      if (t.shipping > 0) rows.push(['Shipping', invFormatMoney(t.shipping, cur), '']);
      rows.push(['Total', invFormatMoney(t.total, cur), 'total']);
      if (type.showPaid && t.paid > 0) rows.push(['Amount paid', '-' + invFormatMoney(t.paid, cur), '']);
      if (type.showPaid && (t.paid > 0 || d.docType === 'invoice' || d.docType === 'proforma')) {
        rows.push([d.docType === 'receipt' && t.balance === 0 ? 'Paid in full' : (d.payMethod === 'cod' && t.balance > 0 ? 'Collect on delivery' : 'Balance due'), invFormatMoney(t.balance, cur), 'balance']);
      }
      els.totals.innerHTML = '';
      rows.forEach(([k, v, cls]) => {
        const div = document.createElement('div');
        div.className = 'row ' + cls;
        const a = document.createElement('span'); a.textContent = k;
        const b = document.createElement('span'); b.textContent = v;
        div.appendChild(a); div.appendChild(b);
        els.totals.appendChild(div);
      });
      // quote has no due-date semantics for receipts
      $('inv-due-wrap').style.display = type.showDue ? '' : 'none';
      $('inv-terms-wrap').style.display = type.showDue ? '' : 'none';
      $('inv-due-label').textContent = type.dueLabel;
      $('inv-paid-wrap').style.display = type.showPaid ? '' : 'none';
    }

    // ----- logo -----
    function setLogo(dataUrl) {
      logoDataUrl = dataUrl || '';
      if (logoDataUrl) {
        els.logoPreview.src = logoDataUrl;
        els.logoPreview.classList.remove('hidden');
        els.logoPreview.style.display = '';
        els.logoRemove.style.display = '';
      } else {
        els.logoPreview.removeAttribute('src');
        els.logoPreview.style.display = 'none';
        els.logoRemove.style.display = 'none';
      }
    }

    // reads an image file, shrinks it and returns a PNG data URL
    async function imageToDataUrl(file, maxW, maxH) {
      const img = await loadImageFile(file);
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png');
    }

    els.logoInput.addEventListener('change', async () => {
      const file = els.logoInput.files && els.logoInput.files[0];
      els.logoInput.value = '';
      if (!file) return;
      if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) { showToast('Please choose a PNG, JPG or WebP logo.', 'warning'); return; }
      try {
        setLogo(await imageToDataUrl(file, 400, 160));
        refresh();
      } catch (e) {
        showToast('This logo could not be read.', 'error');
      }
    });

    // ----- signature -----
    function setSignature(dataUrl) {
      signatureDataUrl = dataUrl || '';
      if (signatureDataUrl) {
        els.sigPreview.src = signatureDataUrl;
        els.sigPreview.style.display = '';
        els.sigRemove.style.display = '';
      } else {
        els.sigPreview.removeAttribute('src');
        els.sigPreview.style.display = 'none';
        els.sigRemove.style.display = 'none';
      }
    }
    els.sigInput.addEventListener('change', async () => {
      const file = els.sigInput.files && els.sigInput.files[0];
      els.sigInput.value = '';
      if (!file) return;
      if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) { showToast('Please choose a PNG, JPG or WebP image.', 'warning'); return; }
      try {
        setSignature(await imageToDataUrl(file, 500, 200));
        refresh();
      } catch (e) {
        showToast('This image could not be read.', 'error');
      }
    });
    els.sigRemove.addEventListener('click', () => { setSignature(''); refresh(); });

    // ----- currency list with search -----
    function fillCurrencies(filter) {
      const q = (filter || '').trim().toLowerCase();
      const current = els.currency.value;
      els.currency.innerHTML = '';
      INV_CURRENCY_LIST.forEach(([code, name]) => {
        if (q && code.toLowerCase().indexOf(q) === -1 && name.toLowerCase().indexOf(q) === -1) return;
        const opt = document.createElement('option');
        opt.value = code; opt.textContent = code + ' - ' + name;
        els.currency.appendChild(opt);
      });
      if (!els.currency.options.length) {
        const opt = document.createElement('option');
        opt.value = current || 'USD'; opt.textContent = 'No match';
        els.currency.appendChild(opt);
      }
      const keep = Array.from(els.currency.options).some(o => o.value === current);
      els.currency.value = keep ? current : els.currency.options[0].value;
    }
    els.curSearch.addEventListener('input', () => { fillCurrencies(els.curSearch.value); refresh(); });

    els.logoRemove.addEventListener('click', () => { setLogo(''); refresh(); });

    // ----- accent colour -----
    function setAccent(hex) {
      accent = hex;
      els.accent.value = hex;
      Array.from(els.swatchBox.querySelectorAll('.inv-swatch')).forEach(b => b.setAttribute('aria-pressed', b.dataset.color === hex ? 'true' : 'false'));
    }
    SWATCHES.forEach(c => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'inv-swatch'; b.style.background = c; b.dataset.color = c;
      b.setAttribute('aria-label', 'Colour ' + c); b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => setAccent(c));
      els.swatchBox.appendChild(b);
    });
    els.accent.addEventListener('input', () => setAccent(els.accent.value));

    // ----- save / restore -----
    function saveBusiness(nextNumber) {
      if (!els.remember.checked) return;
      writeSaved({
        remember: true, number: nextNumber || els.number.value.trim(), currency: els.currency.value,
        from: { name: els.fromName.value, address: els.fromAddress.value, email: els.fromEmail.value, phone: els.fromPhone.value, taxId: els.fromTax.value },
        taxLabel: els.taxLabel.value, taxRate: els.taxRate.value, payInfo: els.payInfo.value, notes: els.notes.value,
        accent, logo: logoDataUrl, terms: els.terms.value,
        payMethod: els.payMethod.value, showWords: els.showWords.checked, signature: signatureDataUrl, signatureLabel: els.sigLabel.value
      });
    }

    function applySaved(s) {
      if (!s) return;
      els.remember.checked = s.remember !== false;
      if (s.number) els.number.value = s.number;
      if (s.currency && INV_CURRENCIES[s.currency] !== undefined) els.currency.value = s.currency;
      if (s.from) {
        els.fromName.value = s.from.name || ''; els.fromAddress.value = s.from.address || '';
        els.fromEmail.value = s.from.email || ''; els.fromPhone.value = s.from.phone || ''; els.fromTax.value = s.from.taxId || '';
      }
      if (s.taxLabel) els.taxLabel.value = s.taxLabel;
      if (s.taxRate !== undefined) els.taxRate.value = s.taxRate;
      if (s.payInfo) els.payInfo.value = s.payInfo;
      if (s.notes) els.notes.value = s.notes;
      if (s.accent) setAccent(s.accent);
      if (s.logo) setLogo(s.logo);
      if (s.terms) els.terms.value = s.terms;
      if (s.payMethod !== undefined && INV_PAY_METHODS[s.payMethod] !== undefined) els.payMethod.value = s.payMethod;
      if (s.showWords !== undefined) els.showWords.checked = !!s.showWords;
      if (s.signature) setSignature(s.signature);
      if (s.signatureLabel) els.sigLabel.value = s.signatureLabel;
    }

    els.clearSaved.addEventListener('click', () => {
      try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
      els.remember.checked = false;
      showToast('Saved details were removed from this device.', 'success');
    });

    // ----- actions -----
    function validate(d) {
      const hasLine = d.totals.lines.some(l => l.description || l.amount > 0);
      if (!hasLine) { showToast('Add at least one item with a description or a price.', 'warning'); return false; }
      if (typeof PDFLib === 'undefined') {
        showToast('The PDF library could not be loaded. Please check your internet connection and reload.', 'error');
        return false;
      }
      return true;
    }

    async function makePdf() {
      const d = readForm();
      if (!validate(d)) return null;
      return { d, bytes: await invBuildPdf(d, PDFLib) };
    }

    function fileName(d) {
      const base = (d.number || 'invoice').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'invoice';
      return base + '.pdf';
    }

    els.download.addEventListener('click', async () => {
      els.download.disabled = true;
      try {
        const out = await makePdf();
        if (!out) return;
        downloadBlob(new Blob([out.bytes], { type: 'application/pdf' }), fileName(out.d));
        const next = invNextNumber(out.d.number);
        saveBusiness(next);
        if (els.remember.checked) els.number.value = next;
        showToast('PDF downloaded successfully!', 'success');
      } catch (err) {
        console.error(err);
        showToast('Could not create the PDF. Please check your entries.', 'error');
      } finally {
        els.download.disabled = false;
      }
    });

    els.preview.addEventListener('click', async () => {
      try {
        const out = await makePdf();
        if (!out) return;
        const url = URL.createObjectURL(new Blob([out.bytes], { type: 'application/pdf' }));
        const w = window.open(url, '_blank');
        if (!w) { downloadBlob(new Blob([out.bytes], { type: 'application/pdf' }), fileName(out.d)); }
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } catch (err) {
        console.error(err);
        showToast('Could not create the preview.', 'error');
      }
    });

    els.reset.addEventListener('click', () => {
      els.itemsBox.innerHTML = '';
      addItemRow();
      els.reference.value = ''; els.toName.value = ''; els.toAddress.value = ''; els.toEmail.value = '';
      els.toPhone.value = ''; els.toTax.value = ''; els.shipTo.value = '';
      els.discValue.value = ''; els.shipping.value = ''; els.paid.value = '';
      els.issue.value = today(); updateDue();
      refresh();
      showToast('Customer and items cleared. Your business details are kept.', 'info');
    });

    // ----- events -----
    ['input', 'change'].forEach(ev => {
      [els.docType, els.number, els.issue, els.due, els.currency, els.reference, els.fromName, els.fromAddress, els.fromEmail,
       els.fromPhone, els.fromTax, els.toName, els.toAddress, els.toEmail, els.discType, els.discValue, els.taxLabel,
       els.taxRate, els.shipping, els.paid, els.notes, els.payInfo, els.toPhone, els.toTax, els.shipTo, els.payMethod, els.showWords,
       els.sigLabel].forEach(el => el.addEventListener(ev, refresh));
    });
    els.terms.addEventListener('change', () => { updateDue(); refresh(); });
    els.issue.addEventListener('change', () => { updateDue(); refresh(); });
    els.due.addEventListener('change', () => { els.terms.value = 'custom'; refresh(); });
    els.addItem.addEventListener('click', () => { addItemRow(); refresh(); });

    // ----- start -----
    els.issue.value = today();
    els.number.value = 'INV-0001';
    els.terms.value = '14';
    setAccent(SWATCHES[0]);
    setLogo('');
    setSignature('');
    fillCurrencies('');
    applySaved(loadSaved());
    updateDue();
    addItemRow();
    refresh();
  });
}
