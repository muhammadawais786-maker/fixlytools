// Fixlytools - Base64 Encoder / Decoder (text and files). UTF-8 safe, optional URL-safe alphabet.

function b64EncodeBytes(bytes, urlSafe) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  let out = btoa(bin);
  if (urlSafe) out = out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return out;
}

function b64EncodeText(text, urlSafe) {
  return b64EncodeBytes(new TextEncoder().encode(text), urlSafe);
}

// returns Uint8Array; throws Error with a readable message on bad input
function b64DecodeToBytes(input) {
  let s = String(input || '').trim();
  const m = /^data:[^;,]*(?:;[^;,]*)*;base64,/i.exec(s);
  if (m) s = s.slice(m[0].length);
  s = s.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!s) throw new Error('Nothing to decode.');
  if (/[^A-Za-z0-9+/=]/.test(s)) throw new Error('This is not valid Base64: it contains characters that are not allowed.');
  s = s.replace(/=+$/, '');
  if (s.length % 4 === 1) throw new Error('This is not valid Base64: the length is wrong.');
  while (s.length % 4) s += '=';
  let bin;
  try { bin = atob(s); } catch (e) { throw new Error('This is not valid Base64.'); }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function b64DecodeText(input) {
  const bytes = b64DecodeToBytes(input);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (e) {
    throw new Error('The data decoded correctly but it is not plain text (it may be an image or a file). Use "Download decoded file" instead.');
  }
}

if (typeof module !== 'undefined') {
  module.exports = { b64EncodeText, b64EncodeBytes, b64DecodeToBytes, b64DecodeText };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    const MAX_FILE = 5 * 1024 * 1024;

    // tabs
    const tabs = { text: $('b64-tab-text'), file: $('b64-tab-file') };
    const panels = { text: $('b64-panel-text'), file: $('b64-panel-file') };
    function showTab(name) {
      Object.keys(tabs).forEach((k) => {
        tabs[k].classList.toggle('nt-active', k === name);
        panels[k].classList.toggle('nt-hide', k !== name);
      });
    }
    tabs.text.addEventListener('click', () => showTab('text'));
    tabs.file.addEventListener('click', () => showTab('file'));

    // ----- text -----
    const input = $('b64-input');
    const output = $('b64-output');
    const err = $('b64-error');
    function setError(msg) { err.textContent = msg || ''; err.classList.toggle('nt-hide', !msg); }

    $('b64-encode').addEventListener('click', () => {
      setError('');
      if (!input.value) { setError('Type or paste the text you want to encode.'); return; }
      output.value = b64EncodeText(input.value, $('b64-urlsafe').checked);
    });
    $('b64-decode').addEventListener('click', () => {
      setError('');
      try { output.value = b64DecodeText(input.value); } catch (e) { output.value = ''; setError(e.message); }
    });
    $('b64-decode-file').addEventListener('click', () => {
      setError('');
      try {
        const bytes = b64DecodeToBytes(input.value);
        const blob = new Blob([bytes], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'decoded-file';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (e) { setError(e.message); }
    });
    $('b64-swap').addEventListener('click', () => { const t = input.value; input.value = output.value; output.value = t; setError(''); });
    $('b64-copy').addEventListener('click', () => ntCopyWithToast(output.value, 'Result copied.'));
    $('b64-clear').addEventListener('click', () => { input.value = ''; output.value = ''; setError(''); });

    // ----- file -----
    const fileIn = $('b64-file');
    let dataUrl = '';
    let rawB64 = '';
    fileIn.addEventListener('change', () => {
      const f = fileIn.files && fileIn.files[0];
      $('b64-file-error').classList.add('nt-hide');
      if (!f) return;
      if (f.size > MAX_FILE) {
        $('b64-file-error').textContent = 'This file is larger than 5 MB. Please choose a smaller file.';
        $('b64-file-error').classList.remove('nt-hide');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        dataUrl = String(reader.result);
        rawB64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
        $('b64-file-name').textContent = `${f.name} (${(f.size / 1024).toFixed(1)} KB)`;
        $('b64-file-out').value = $('b64-file-uri').checked ? dataUrl : rawB64;
        $('b64-file-result').classList.remove('nt-hide');
        const prev = $('b64-file-preview');
        if (/^data:image\//.test(dataUrl)) { prev.src = dataUrl; prev.classList.remove('nt-hide'); } else { prev.removeAttribute('src'); prev.classList.add('nt-hide'); }
      };
      reader.onerror = () => { $('b64-file-error').textContent = 'The file could not be read.'; $('b64-file-error').classList.remove('nt-hide'); };
      reader.readAsDataURL(f);
    });
    $('b64-file-uri').addEventListener('change', () => { if (dataUrl) $('b64-file-out').value = $('b64-file-uri').checked ? dataUrl : rawB64; });
    $('b64-file-copy').addEventListener('click', () => ntCopyWithToast($('b64-file-out').value, 'Base64 copied.'));
    $('b64-file-download').addEventListener('click', () => ntDownload($('b64-file-out').value, 'base64.txt', 'text/plain'));
  });
}
