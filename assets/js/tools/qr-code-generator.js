// Fixlytools - QR Code Generator
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

  let qrCodeObj = null;

  qrType.addEventListener('change', () => {
    if (qrType.value === 'wifi') {
      textInputContainer.classList.add('hidden');
      wifiInputContainer.classList.remove('hidden');
    } else {
      wifiInputContainer.classList.add('hidden');
      textInputContainer.classList.remove('hidden');
    }
    generateQR();
  });

  [qrTextInput, wifiSsid, wifiPass, wifiType, fgColor, bgColor, qrSize].forEach(elem => {
    elem.addEventListener('input', generateQR);
  });

  function getPayload() {
    if (qrType.value === 'wifi') {
      const ssid = wifiSsid.value.trim();
      const pass = wifiPass.value;
      const type = wifiType.value;
      if (!ssid) return 'WIFI:S:MyNetwork;;';
      return `WIFI:T:${type};S:${ssid};P:${pass};;`;
    }
    return qrTextInput.value.trim() || 'https://fixlytools.com';
  }

  function generateQR() {
    const payload = getPayload();
    const size = parseInt(qrSize.value, 10);
    const colorDark = fgColor.value;
    const colorLight = bgColor.value;

    qrCanvasContainer.innerHTML = '';
    qrCodeObj = new QRCode(qrCanvasContainer, {
      text: payload,
      width: size,
      height: size,
      colorDark: colorDark,
      colorLight: colorLight,
      correctLevel: QRCode.CorrectLevel.H
    });
  }

  downloadPngBtn.addEventListener('click', () => {
    const img = qrCanvasContainer.querySelector('img');
    const canvas = qrCanvasContainer.querySelector('canvas');
    let url = '';

    if (canvas) {
      url = canvas.toDataURL('image/png');
    } else if (img && img.src) {
      url = img.src;
    }

    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = `fixlytools-qr-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('QR Code downloaded successfully!', 'success');
    } else {
      showToast('Failed to generate image. Please try again.', 'error');
    }
  });

  // Initial trigger
  setTimeout(generateQR, 100);
});
