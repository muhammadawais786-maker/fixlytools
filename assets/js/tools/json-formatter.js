// Fixlytools - JSON Formatter & Validator
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

  function validateJSON(text) {
    if (!text.trim()) {
      statusBanner.className = 'hidden';
      return null;
    }

    try {
      const parsed = JSON.parse(text);
      statusBanner.className = 'p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 border border-emerald-200 dark:border-emerald-800';
      statusBanner.innerHTML = '<i class="fa-solid fa-circle-check text-sm"></i> Valid JSON! No syntax errors found.';
      return parsed;
    } catch (err) {
      statusBanner.className = 'p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2 border border-rose-200 dark:border-rose-800';
      statusBanner.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-sm"></i> Invalid JSON: ${err.message}`;
      return null;
    }
  }

  beautifyBtn.addEventListener('click', () => {
    const parsed = validateJSON(jsonInput.value);
    if (parsed !== null) {
      const spaces = parseInt(spaceSelect.value, 10);
      jsonInput.value = JSON.stringify(parsed, null, spaces);
      showToast('JSON beautified successfully!', 'success');
    }
  });

  minifyBtn.addEventListener('click', () => {
    const parsed = validateJSON(jsonInput.value);
    if (parsed !== null) {
      jsonInput.value = JSON.stringify(parsed);
      showToast('JSON minified successfully!', 'success');
    }
  });

  validateBtn.addEventListener('click', () => {
    validateJSON(jsonInput.value);
  });

  sampleBtn.addEventListener('click', () => {
    const sample = {
      project: "Fixlytools",
      domain: "fixlytools.com",
      status: "Production Ready",
      features: [
        "100% Client-Side",
        "Fast Execution",
        "Privacy-First"
      ],
      metrics: {
        totalTools: 15,
        rating: 5.0,
        unlimitedFreeUse: true
      }
    };
    jsonInput.value = JSON.stringify(sample, null, 2);
    validateJSON(jsonInput.value);
  });

  copyBtn.addEventListener('click', () => {
    if (!jsonInput.value.trim()) return;
    navigator.clipboard.writeText(jsonInput.value).then(() => {
      showToast('JSON copied to clipboard!', 'success');
    });
  });

  downloadBtn.addEventListener('click', () => {
    if (!jsonInput.value.trim()) return;
    const blob = new Blob([jsonInput.value], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fixlytools-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  clearBtn.addEventListener('click', () => {
    jsonInput.value = '';
    statusBanner.className = 'hidden';
  });

  jsonInput.addEventListener('input', () => {
    if (jsonInput.value.trim().length > 0) {
      validateJSON(jsonInput.value);
    } else {
      statusBanner.className = 'hidden';
    }
  });
});
