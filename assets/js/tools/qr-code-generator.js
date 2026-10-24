// Fixlytools - QR Code Generator

// Wi-Fi QR codes need these characters escaped with a backslash: \ ; , : "
function qrEscapeWifi(value) {
  return String(value).replace(/([\\;,:"])/g, '\\$1');
}

function qrWifiPayload(ssid, password, type) {
  if (!ssid) return 'WIFI:S:MyNetwork;;';
  if (type === 'nopass') return `WIFI:T:nopass;S:${qrEscapeWifi(ssid)};;`;
  return `WIFI:T:${type};S:${qrEscapeWifi(ssid)};P:${qrEscapeWifi(password)};;`;
}

if (typeof module !== 'undefined') {
  module.exports = { qrEscapeWifi, qrWifiPayload };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const qrType = document.getElementById('qr-type');
    const textInputContainer = document.getElementById('text-input-container');
    const wifiInputContainer = document.getElementById('wifi-input-container');
    const qrTextInput = document.getElementById('qr-text');
    const wifiSsid = document.getElementById('wifi-ssid');
    const wifiPass = document.getElementById('wifi-pass');
    const wifiType = document.getElementById('wifi-type');

    const fgColor = document.getElementById('fg-color');
    const bgColor = document.getElementById('bg-color');
    const qrSize = document.getElementById('qr-size');
    const qrCanvasContainer = document.getElementById('qr-canvas-container');
    const downloadPngBtn = document.getElementById('download-png');

    let hasQr = false;

    function updateTypeVisibility() {
      const isWifi = qrType.value === 'wifi';
      textInputContainer.classList.toggle('hidden', isWifi);
      wifiInputContainer.classList.toggle('hidden', !isWifi);
      // an open network has no password
      wifiPass.disabled = wifiType.value === 'nopass';
    }

    function getPayload() {
      if (qrType.value === 'wifi') {
        return qrWifiPayload(wifiSsid.value.trim(), wifiPass.value, wifiType.value);
      }
      return qrTextInput.value.trim() || 'https://fixlytools.com';
    }

    function showMessage(text) {
      qrCanvasContainer.innerHTML = '';
      const p = document.createElement('p');
      p.className = 'text-xs text-rose-500 text-center max-w-[260px]';
      p.textContent = text;
      qrCanvasContainer.appendChild(p);
      hasQr = false;
    }

    function generateQR() {
      if (typeof QRCode === 'undefined') {
        showMessage('The QR library could not be loaded. Please check your internet connection and reload the page.');
        return;
      }
      const payload = getPayload();
      const size = parseInt(qrSize.value, 10);

      // Use the strongest error correction that still fits the text, then fall back to weaker levels
      const levels = ['H', 'Q', 'M', 'L'];
      for (const level of levels) {
        qrCanvasContainer.innerHTML = '';
        try {
          new QRCode(qrCanvasContainer, {
            text: payload,
            width: size,
            height: size,
            colorDark: fgColor.value,
            colorLight: bgColor.value,
            correctLevel: QRCode.CorrectLevel[level]
          });
          hasQr = true;
          return;
        } catch (err) {
          // text too long for this level: try the next one
        }
      }
      showMessage('This text is too long for a QR code. Please shorten it.');
    }

    qrType.addEventListener('change', () => { updateTypeVisibility(); generateQR(); });
    wifiType.addEventListener('change', updateTypeVisibility);

    [qrTextInput, wifiSsid, wifiPass, wifiType, fgColor, bgColor, qrSize].forEach(elem => {
      elem.addEventListener('input', generateQR);
      elem.addEventListener('change', generateQR);
    });

    downloadPngBtn.addEventListener('click', () => {
      const canvas = qrCanvasContainer.querySelector('canvas');
      const img = qrCanvasContainer.querySelector('img');
      let url = '';
      if (hasQr && canvas) url = canvas.toDataURL('image/png');
      else if (hasQr && img && img.src) url = img.src;

      if (!url) {
        showToast('There is no QR code to download yet.', 'error');
        return;
      }
      const a = document.createElement('a');
      a.href = url;
      a.download = `fixlytools-qr-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('QR Code downloaded successfully!', 'success');
    });

    updateTypeVisibility();
    setTimeout(generateQR, 100);
  });
}
