// Fixlytools - JSON Formatter & Validator

// Adds "line X, column Y" to an error message when the browser only reports a character position
function jsonLocateError(text, message) {
  if (/line\s+\d+/i.test(message)) return message;
  const m = /position\s+(\d+)/i.exec(message);
  if (!m) return message;
  const pos = Math.min(parseInt(m[1], 10), text.length);
  const before = text.slice(0, pos);
  const line = before.split('\n').length;
  const column = pos - (before.lastIndexOf('\n') + 1) + 1;
  return `${message} (line ${line}, column ${column})`;
}

// True when the JSON text contains whole numbers with more than 15 digits, which JavaScript cannot store exactly
function jsonHasUnsafeNumbers(text) {
  const withoutStrings = text.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  const matches = withoutStrings.match(/-?\d{16,}/g) || [];
  return matches.some(n => !Number.isSafeInteger(Number(n)));
}

if (typeof module !== 'undefined') {
  module.exports = { jsonLocateError, jsonHasUnsafeNumbers };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const jsonInput = document.getElementById('json-input');
    const statusBanner = document.getElementById('status-banner');
    const beautifyBtn = document.getElementById('beautify-btn');
    const minifyBtn = document.getElementById('minify-btn');
    const validateBtn = document.getElementById('validate-btn');
    const sampleBtn = document.getElementById('sample-btn');
    const copyBtn = document.getElementById('copy-btn');
    const downloadBtn = document.getElementById('download-btn');
    const clearBtn = document.getElementById('clear-btn');
    const spaceSelect = document.getElementById('space-select');

    const OK_CLASS = 'p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 border border-emerald-200 dark:border-emerald-800';
    const ERR_CLASS = 'p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2 border border-rose-200 dark:border-rose-800';
    const WARN_CLASS = 'p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center gap-2 border border-amber-200 dark:border-amber-800';

    // The message is inserted as plain text, so nothing typed into the box can be interpreted as HTML
    function setBanner(cls, icon, message) {
      statusBanner.className = cls;
      statusBanner.textContent = '';
      const i = document.createElement('i');
      i.className = `fa-solid ${icon} text-sm`;
      statusBanner.appendChild(i);
      statusBanner.appendChild(document.createTextNode(' ' + message));
    }

    function validateJSON(text) {
      if (!text.trim()) {
        statusBanner.className = 'hidden';
        return { ok: false, empty: true };
      }
      try {
        const parsed = JSON.parse(text);
        if (jsonHasUnsafeNumbers(text)) {
          setBanner(WARN_CLASS, 'fa-triangle-exclamation', 'Valid JSON, but it has numbers with more than 15 digits. Formatting may change their last digits. Copy such values as text.');
        } else {
          setBanner(OK_CLASS, 'fa-circle-check', 'Valid JSON! No syntax errors found.');
        }
        return { ok: true, parsed };
      } catch (err) {
        setBanner(ERR_CLASS, 'fa-triangle-exclamation', 'Invalid JSON: ' + jsonLocateError(text, err.message));
        return { ok: false };
      }
    }

    beautifyBtn.addEventListener('click', () => {
      const r = validateJSON(jsonInput.value);
      if (r.ok) {
        const spaces = parseInt(spaceSelect.value, 10);
        jsonInput.value = JSON.stringify(r.parsed, null, spaces);
        showToast('JSON beautified successfully!', 'success');
      } else if (r.empty) {
        showToast('Please paste some JSON first.', 'warning');
      }
    });

    minifyBtn.addEventListener('click', () => {
      const r = validateJSON(jsonInput.value);
      if (r.ok) {
        jsonInput.value = JSON.stringify(r.parsed);
        showToast('JSON minified successfully!', 'success');
      } else if (r.empty) {
        showToast('Please paste some JSON first.', 'warning');
      }
    });

    validateBtn.addEventListener('click', () => {
      const r = validateJSON(jsonInput.value);
      if (r.empty) showToast('Please paste some JSON first.', 'warning');
    });

    sampleBtn.addEventListener('click', () => {
      const sample = {
        project: "Fixlytools",
        domain: "fixlytools.com",
        status: "Production Ready",
        features: ["100% Client-Side", "Fast Execution", "Privacy-First"],
        metrics: { totalTools: 15, unlimitedFreeUse: true }
      };
      jsonInput.value = JSON.stringify(sample, null, 2);
      validateJSON(jsonInput.value);
    });

    copyBtn.addEventListener('click', () => {
      if (!jsonInput.value.trim()) return;
      copyText(jsonInput.value)
        .then(() => showToast('JSON copied to clipboard!', 'success'))
        .catch(() => showToast('Could not copy. Please select the text and copy it manually.', 'error'));
    });

    downloadBtn.addEventListener('click', () => {
      if (!jsonInput.value.trim()) return;
      downloadBlob(new Blob([jsonInput.value], { type: 'application/json' }), `fixlytools-${Date.now()}.json`);
    });

    clearBtn.addEventListener('click', () => {
      jsonInput.value = '';
      statusBanner.className = 'hidden';
    });

    jsonInput.addEventListener('input', () => {
      if (jsonInput.value.trim().length > 0) validateJSON(jsonInput.value);
      else statusBanner.className = 'hidden';
    });
  });
}
