// Fixlytools - small helpers shared by the newer tools

function ntCopy(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error('copy failed'));
    } catch (e) { reject(e); }
  });
}

function ntCopyWithToast(text, okMsg) {
  if (!text) { showToast('Nothing to copy yet.', 'warning'); return; }
  ntCopy(text).then(
    () => showToast(okMsg || 'Copied to clipboard.', 'success'),
    () => showToast('Copy failed. Select the text and copy it by hand.', 'error')
  );
}

function ntDownload(text, filename, mime) {
  const blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Show up to 10 significant digits, without trailing zeros and without scientific noise
function ntFormatNumber(n, maxDigits) {
  if (!isFinite(n)) return '-';
  if (n === 0) return '0';
  const digits = maxDigits || 10;
  const abs = Math.abs(n);
  if (abs >= 1e15 || abs < 1e-7) return Number(n.toPrecision(Math.min(digits, 8))).toExponential().replace('e+', 'e');
  return Number(n.toPrecision(digits)).toLocaleString('en-US', { maximumSignificantDigits: digits });
}

if (typeof module !== 'undefined') {
  module.exports = { ntFormatNumber };
}
