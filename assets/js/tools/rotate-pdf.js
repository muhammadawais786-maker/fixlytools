// Fixlytools - Rotate PDF (pdf-lib only, runs in the browser)

function rotpdfParsePageRange(rangeStr, maxPages) {
  const indices = new Set();
  const invalid = [];
  const parts = String(rangeStr || '').split(',').map(p => p.trim()).filter(Boolean);

  for (const part of parts) {
    let m;
    if ((m = /^(\d+)$/.exec(part))) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= maxPages) indices.add(n - 1); else invalid.push(part);
    } else if ((m = /^(\d+)\s*-\s*(\d*)$/.exec(part))) {
      const start = parseInt(m[1], 10);
      const end = m[2] === '' ? maxPages : parseInt(m[2], 10);
      const from = Math.min(start, end);
      const to = Math.max(start, end);
      if (to < 1 || from > maxPages) { invalid.push(part); continue; }
      for (let i = Math.max(1, from); i <= Math.min(maxPages, to); i++) indices.add(i - 1);
    } else {
      invalid.push(part);
    }
  }
  return { indices: Array.from(indices).sort((a, b) => a - b), invalid };
}

// Any number -> 0, 90, 180 or 270 (rounded to the nearest quarter turn).
function rotpdfNormalizeAngle(deg) {
  const n = Number(deg);
  if (!isFinite(n)) return 0;
  const q = Math.round(n / 90) * 90;
  return ((q % 360) + 360) % 360;
}

// Existing page rotation + extra clockwise rotation -> new rotation for setRotation().
function rotpdfNewRotation(current, delta) {
  return rotpdfNormalizeAngle(rotpdfNormalizeAngle(current) + rotpdfNormalizeAngle(delta));
}

// rules: [{ range: "1-3, 5" | "" (empty = all pages), angle: 90 | 180 | 270 }]
// Rules that overlap add up (a page in two rules gets both rotations).
function rotpdfBuildDeltas(total, rules) {
  const deltas = new Array(total).fill(0);
  const errors = [];
  rules.forEach((rule, n) => {
    const label = 'Rule ' + (n + 1);
    const angle = rotpdfNormalizeAngle(rule.angle);
    if (angle === 0) { errors.push(label + ': choose 90, 180 or 270 degrees.'); return; }
    const text = String(rule.range || '').trim();
    let indices;
    if (text === '') {
      indices = Array.from({ length: total }, (_, i) => i);
    } else {
      const parsed = rotpdfParsePageRange(text, total);
      if (parsed.invalid.length > 0) {
        errors.push(label + ': cannot use ' + parsed.invalid.join(', ') + ' (this PDF has ' + total + ' page' + (total === 1 ? '' : 's') + ').');
        return;
      }
      if (parsed.indices.length === 0) { errors.push(label + ': no valid pages found.'); return; }
      indices = parsed.indices;
    }
    indices.forEach(i => { deltas[i] = rotpdfNormalizeAngle(deltas[i] + angle); });
  });
  return { deltas, errors };
}

function rotpdfLoadErrorMessage(err) {
  const msg = err && err.message ? String(err.message) : '';
  if (/encrypt/i.test(msg)) return 'This PDF is password-protected. Remove the password first, then try again.';
  return 'Could not read this PDF. It may be damaged or not a valid PDF file.';
}

if (typeof module !== 'undefined') {
  module.exports = { rotpdfParsePageRange, rotpdfNormalizeAngle, rotpdfNewRotation, rotpdfBuildDeltas, rotpdfLoadErrorMessage };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const workspace = document.getElementById('workspace');
    const pdfInfo = document.getElementById('pdf-info');
    const rulesEl = document.getElementById('rotpdf-rules');
    const addRuleBtn = document.getElementById('rotpdf-add-rule');
    const rotateBtn = document.getElementById('rotpdf-btn');
    const resetBtn = document.getElementById('reset-btn');
    const BTN_HTML = '<i class="fa-solid fa-rotate"></i> Rotate & Download';

    let currentFile = null;
    let pdfDoc = null;
    let totalPages = 0;

    function renumberRules() {
      Array.from(rulesEl.children).forEach((row, i) => {
        row.querySelector('input').setAttribute('aria-label', 'Pages for rule ' + (i + 1) + ' (leave empty for all pages)');
        row.querySelector('select').setAttribute('aria-label', 'Rotation for rule ' + (i + 1));
        const rm = row.querySelector('button');
        rm.setAttribute('aria-label', 'Remove rule ' + (i + 1));
        rm.classList.toggle('hidden', rulesEl.children.length === 1);
      });
    }

    function addRule(rangeValue, angleValue) {
      const row = document.createElement('div');
      row.className = 'rotpdf-rule';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'rotpdf-input';
      input.placeholder = 'All pages, or e.g. 1-3, 5';
      input.value = rangeValue || '';
      input.autocomplete = 'off';

      const select = document.createElement('select');
      select.className = 'rotpdf-select';
      [['90', '90\u00B0 clockwise'], ['180', '180\u00B0'], ['270', '90\u00B0 counter-clockwise']].forEach(([v, text]) => {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = text;
        select.appendChild(o);
      });
      select.value = String(angleValue || 90);

      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'rotpdf-remove';
      rm.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      rm.addEventListener('click', () => {
        if (rulesEl.children.length > 1) { row.remove(); renumberRules(); }
      });

      row.appendChild(input);
      row.appendChild(select);
      row.appendChild(rm);
      rulesEl.appendChild(row);
      renumberRules();
    }

    function readRules() {
      return Array.from(rulesEl.children).map(row => ({
        range: row.querySelector('input').value,
        angle: parseInt(row.querySelector('select').value, 10)
      }));
    }

    async function handleFiles(files) {
      const file = files.find(isPdfFile);
      if (!file) { showToast('Please choose a PDF file.', 'warning'); return; }
      if (typeof PDFLib === 'undefined') {
        showToast('The PDF library could not be loaded. Please check your internet connection and reload.', 'error');
        return;
      }
      try {
        const buf = await file.arrayBuffer();
        pdfDoc = await PDFLib.PDFDocument.load(buf);
        currentFile = file;
        totalPages = pdfDoc.getPageCount();
        pdfInfo.textContent = file.name + ' (' + formatBytes(file.size) + ', ' + totalPages + ' page' + (totalPages === 1 ? '' : 's') + ')';
        rulesEl.innerHTML = '';
        addRule('', 90);
        dropzone.classList.add('hidden');
        workspace.classList.remove('hidden');
      } catch (err) {
        pdfDoc = null;
        showToast(rotpdfLoadErrorMessage(err), 'error');
      }
    }

    setupDropzone(dropzone, fileInput, handleFiles);
    addRuleBtn.addEventListener('click', () => {
      if (rulesEl.children.length >= 8) { showToast('You can use up to 8 rules.', 'info'); return; }
      addRule('', 90);
    });

    rotateBtn.addEventListener('click', async () => {
      if (!pdfDoc) return;
      const { deltas, errors } = rotpdfBuildDeltas(totalPages, readRules());
      if (errors.length > 0) { showToast(errors[0], 'warning'); return; }
      const changed = deltas.filter(d => d !== 0).length;
      if (changed === 0) {
        showToast('The rotations cancel each other out, so nothing would change.', 'warning');
        return;
      }

      rotateBtn.disabled = true;
      rotateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Rotating...';
      try {
        // Work on a fresh copy so the loaded document can be rotated again with different settings.
        const bytesIn = await pdfDoc.save();
        const work = await PDFLib.PDFDocument.load(bytesIn);
        deltas.forEach((delta, i) => {
          if (delta === 0) return;
          const page = work.getPage(i);
          const next = rotpdfNewRotation(page.getRotation().angle, delta);
          page.setRotation(PDFLib.degrees(next));
        });
        const bytes = await work.save();
        downloadBlob(new Blob([bytes], { type: 'application/pdf' }), 'fixlytools-' + baseName(currentFile.name) + '-rotated.pdf');
        showToast('Rotated ' + changed + ' page' + (changed === 1 ? '' : 's') + '. Your original file was not changed.', 'success');
      } catch (err) {
        console.error(err);
        showToast('Something went wrong while rotating. The file may be damaged.', 'error');
      } finally {
        rotateBtn.disabled = false;
        rotateBtn.innerHTML = BTN_HTML;
      }
    });

    resetBtn.addEventListener('click', () => {
      currentFile = null;
      pdfDoc = null;
      rulesEl.innerHTML = '';
      workspace.classList.add('hidden');
      dropzone.classList.remove('hidden');
    });
  });
}
