// Fixlytools - Invoice Generator (free version: everything runs in the browser)

// ---------- pure helpers (also used by the tests) ----------

const INV_CURRENCIES = {
  USD: '$', GBP: '£', EUR: '€', CAD: 'CA$', AUD: 'A$', NZD: 'NZ$',
  CHF: 'CHF ', SEK: 'SEK ', NOK: 'NOK ', DKK: 'DKK ', PLN: 'PLN ', INR: 'INR ',
  AED: 'AED ', SGD: 'S$', ZAR: 'ZAR ', PKR: 'PKR '
};

const INV_DOC_TYPES = {
  invoice:  { title: 'INVOICE',          dueLabel: 'Due date',    showDue: true,  showPaid: true  },
  proforma: { title: 'PRO-FORMA INVOICE', dueLabel: 'Due date',    showDue: true,  showPaid: true  },
  quote:    { title: 'QUOTE',            dueLabel: 'Valid until', showDue: true,  showPaid: false },
  receipt:  { title: 'RECEIPT',          dueLabel: 'Due date',    showDue: false, showPaid: true  }
};

function invRound(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function invNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function invFormatMoney(amount, currency) {
  const sym = INV_CURRENCIES[currency] !== undefined ? INV_CURRENCIES[currency] : (currency + ' ');
  const abs = Math.abs(invRound(amount));
  const text = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (amount < 0 ? '-' : '') + sym + text;
}

// items: [{ description, qty, price }]; o: { discountType: 'percent'|'amount', discountValue, taxRate, shipping, paid, docType }
function invComputeTotals(items, o) {
  const lines = items.map(i => ({
    description: i.description || '',
    qty: invNum(i.qty),
    price: invNum(i.price),
    amount: invRound(invNum(i.qty) * invNum(i.price))
  }));
  const subtotal = invRound(lines.reduce((s, l) => s + l.amount, 0));

  const dv = Math.max(invNum(o.discountValue), 0);
  const discount = o.discountType === 'percent'
    ? invRound(subtotal * Math.min(dv, 100) / 100)
    : invRound(Math.min(dv, subtotal));

  const taxable = invRound(subtotal - discount);
  const taxRate = Math.min(Math.max(invNum(o.taxRate), 0), 100);
  const tax = invRound(taxable * taxRate / 100);
  const shipping = invRound(Math.max(invNum(o.shipping), 0));
  const total = invRound(taxable + tax + shipping);

  let paid = invRound(Math.max(invNum(o.paid), 0));
  if (o.docType === 'receipt' && paid === 0) paid = total;      // a receipt means "paid in full" unless stated
  const balance = invRound(total - paid);
  return { lines, subtotal, discount, taxable, taxRate, tax, shipping, total, paid, balance };
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

  let yl = y;
  fromLines.forEach(l => { text(l.s, M, yl, l.b ? 10.5 : 9.5, l.b ? bold : font, l.b ? dark : grey); yl -= 13; });
  let yr = y;
  meta.forEach(([k, v]) => {
    textRight(k, RIGHT - 130, yr, 9.5, font, grey);
    textRight(String(v), RIGHT, yr, 9.5, bold, dark);
    yr -= 14;
  });
  y = Math.min(yl, yr) - 16;

  // ----- bill to -----
  if (d.to.name || d.to.address || d.to.email) {
    text('BILL TO', M, y, 8.5, bold, accent);
    y -= 14;
    if (d.to.name) { text(d.to.name, M, y, 10.5, bold, dark); y -= 13; }
    invWrap(d.to.address, font, 9.5, 260).forEach(s => { text(s, M, y, 9.5, font, grey); y -= 13; });
    if (d.to.email) { text(d.to.email, M, y, 9.5, font, grey); y -= 13; }
    y -= 10;
  }

  // ----- items table -----
  ensureSpace(60, false);
  tableHeader();
  t.lines.forEach(l => {
    const descLines = invWrap(l.description || '-', font, 9.5, DESC_W);
    const rowH = Math.max(descLines.length * 12, 14) + 8;
    ensureSpace(rowH, true);
    descLines.forEach((s, i) => text(s, M + 8, y - 2 - i * 12, 9.5, font, dark));
    const qtyText = String(Math.round(l.qty * 1000) / 1000);
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
      const lbl = (d.docType === 'receipt' && t.balance === 0) ? 'Paid in full' : 'Balance due';
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
  block('Payment details', d.paymentInfo);
  block('Notes', d.notes);

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
  module.exports = { invRound, invFormatMoney, invComputeTotals, invNextNumber, invAddDays, invSanitize, invWrap, invBuildPdf, INV_DOC_TYPES };
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
        price: row.querySelector('.inv-price').value
      }));
    }

    // ----- read the whole form -----
    function readForm() {
      const items = readItems();
      const opts = {
        discountType: els.discType.value, discountValue: els.discValue.value, taxRate: els.taxRate.value,
        shipping: els.shipping.value, paid: els.paid.value, docType: els.docType.value
      };
      return {
        docType: els.docType.value, number: els.number.value.trim(), issueDate: els.issue.value, dueDate: els.due.value,
        currency: els.currency.value, reference: els.reference.value.trim(),
        from: { name: els.fromName.value.trim(), address: els.fromAddress.value.trim(), email: els.fromEmail.value.trim(), phone: els.fromPhone.value.trim(), taxId: els.fromTax.value.trim() },
        to: { name: els.toName.value.trim(), address: els.toAddress.value.trim(), email: els.toEmail.value.trim() },
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
        rows.push([d.docType === 'receipt' && t.balance === 0 ? 'Paid in full' : 'Balance due', invFormatMoney(t.balance, cur), 'balance']);
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

    els.logoInput.addEventListener('change', async () => {
      const file = els.logoInput.files && els.logoInput.files[0];
      els.logoInput.value = '';
      if (!file) return;
      if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) { showToast('Please choose a PNG, JPG or WebP logo.', 'warning'); return; }
      try {
        const img = await loadImageFile(file);
        const maxW = 400, maxH = 160;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        setLogo(canvas.toDataURL('image/png'));
        refresh();
      } catch (e) {
        showToast('This logo could not be read.', 'error');
      }
    });
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
        accent, logo: logoDataUrl, terms: els.terms.value
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
      els.discValue.value = ''; els.shipping.value = ''; els.paid.value = '';
      els.issue.value = today(); updateDue();
      refresh();
      showToast('Customer and items cleared. Your business details are kept.', 'info');
    });

    // ----- events -----
    ['input', 'change'].forEach(ev => {
      [els.docType, els.number, els.issue, els.due, els.currency, els.reference, els.fromName, els.fromAddress, els.fromEmail,
       els.fromPhone, els.fromTax, els.toName, els.toAddress, els.toEmail, els.discType, els.discValue, els.taxLabel,
       els.taxRate, els.shipping, els.paid, els.notes, els.payInfo].forEach(el => el.addEventListener(ev, refresh));
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
    applySaved(loadSaved());
    updateDue();
    addItemRow();
    refresh();
  });
}
