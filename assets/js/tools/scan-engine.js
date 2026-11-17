// Fixlytools - scanner engine: page edge detection, perspective straightening and scanner-style filters.
// Pure functions on ImageData-like objects { data: Uint8ClampedArray (RGBA), width, height }. No page or network access.

const SE_FILTERS = [
  { id: 'original', label: 'Original' },
  { id: 'lighten', label: 'Lighten' },
  { id: 'enhance', label: 'Enhance' },
  { id: 'noshadow', label: 'No shadow' },
  { id: 'bw', label: 'B&W' },
  { id: 'eco', label: 'Eco' },
  { id: 'gray', label: 'Grayscale' },
  { id: 'invert', label: 'Invert' }
];

function seLuma(r, g, b) { return 0.299 * r + 0.587 * g + 0.114 * b; }
function seClamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }

// ---------------------------------------------------------------- edge detection

// box blur of a gray plane (uses an integral image); returns a new Float32Array
function seBlurGray(gray, w, h, r) {
  const iw = w + 1;
  const integral = new Float64Array(iw * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += gray[y * w + x];
      integral[(y + 1) * iw + x + 1] = integral[y * iw + x + 1] + row;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const sum = integral[y1 * iw + x1] - integral[y0 * iw + x1] - integral[y1 * iw + x0] + integral[y0 * iw + x0];
      out[y * w + x] = sum / ((x1 - x0) * (y1 - y0));
    }
  }
  return out;
}

function seOtsu(gray, n) {
  const hist = new Float64Array(256);
  for (let i = 0; i < n; i++) hist[Math.max(0, Math.min(255, Math.round(gray[i])))]++;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, best = 0, bestT = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = n - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) { best = between; bestT = t; }
  }
  return bestT;
}

// largest 4-connected component of a binary mask; returns { count, xs: extreme points info } or null
function seLargestComponent(mask, w, h) {
  const label = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  let bestCount = 0, bestLabel = 0, cur = 0;
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || label[i]) continue;
    cur++;
    let sp = 0, count = 0;
    stack[sp++] = i; label[i] = cur;
    while (sp) {
      const p = stack[--sp];
      count++;
      const x = p % w, y = (p - x) / w;
      if (x > 0 && mask[p - 1] && !label[p - 1]) { label[p - 1] = cur; stack[sp++] = p - 1; }
      if (x < w - 1 && mask[p + 1] && !label[p + 1]) { label[p + 1] = cur; stack[sp++] = p + 1; }
      if (y > 0 && mask[p - w] && !label[p - w]) { label[p - w] = cur; stack[sp++] = p - w; }
      if (y < h - 1 && mask[p + w] && !label[p + w]) { label[p + w] = cur; stack[sp++] = p + w; }
    }
    if (count > bestCount) { bestCount = count; bestLabel = cur; }
  }
  if (!bestCount) return null;
  let tl = null, tr = null, br = null, bl = null;
  let minS = Infinity, maxS = -Infinity, minD = Infinity, maxD = -Infinity;
  for (let i = 0; i < w * h; i++) {
    if (label[i] !== bestLabel) continue;
    const x = i % w, y = (i - x) / w;
    const s = x + y, d = x - y;
    if (s < minS) { minS = s; tl = { x, y }; }
    if (s > maxS) { maxS = s; br = { x, y }; }
    if (d > maxD) { maxD = d; tr = { x, y }; }
    if (d < minD) { minD = d; bl = { x, y }; }
  }
  return { count: bestCount, corners: [tl, tr, br, bl] };
}

function sePolyArea(c) {
  let a = 0;
  for (let i = 0; i < 4; i++) { const p = c[i], q = c[(i + 1) % 4]; a += p.x * q.y - q.x * p.y; }
  return Math.abs(a) / 2;
}

function seIsConvex(c) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = c[i], b = c[(i + 1) % 4], d = c[(i + 2) % 4];
    const cross = (b.x - a.x) * (d.y - b.y) - (b.y - a.y) * (d.x - b.x);
    if (Math.abs(cross) < 1e-9) return false;
    const s = cross > 0 ? 1 : -1;
    if (sign && s !== sign) return false;
    sign = s;
  }
  return true;
}

function seFullFrame() { return [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]; }

// Finds the page in a (small) picture. Returns { found, corners } with corners normalised to 0..1 in the order
// top-left, top-right, bottom-right, bottom-left. When no clear page is found, corners are the full frame.
// shrinks a binary mask by r pixels (square window) so thin bridges between the page and its surroundings break
function seErode(mask, w, h, r) {
  const tmp = new Uint8Array(w * h), out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let run = 0;
    for (let x = 0; x < w; x++) {
      run = mask[y * w + x] ? run + 1 : 0;
      tmp[y * w + x] = run >= 2 * r + 1 ? 1 : 0;   // marks the right end of a long enough run
    }
    // spread: a pixel survives when the pixel r to its right ends a long run
    for (let x = 0; x < w; x++) tmp[y * w + x] = (x + r < w && tmp[y * w + x + r]) ? 1 : 0;
  }
  for (let x = 0; x < w; x++) {
    let run = 0;
    for (let y = 0; y < h; y++) {
      run = tmp[y * w + x] ? run + 1 : 0;
      out[y * w + x] = run >= 2 * r + 1 ? 1 : 0;
    }
    for (let y = 0; y < h; y++) out[y * w + x] = (y + r < h && out[(y + r) * w + x]) ? 1 : 0;
  }
  return out;
}

function seDetectCorners(img) {
  const w = img.width, h = img.height, n = w * h;
  const gray = new Float32Array(n);
  for (let i = 0, p = 0; p < n; i += 4, p++) gray[p] = seLuma(img.data[i], img.data[i + 1], img.data[i + 2]);
  const blur = seBlurGray(gray, w, h, Math.max(2, Math.round(Math.min(w, h) / 90)));
  const t = seOtsu(blur, n);
  const candidates = [];
  for (const bright of [true, false]) {
    const mask = new Uint8Array(n);
    for (let i = 0; i < n; i++) mask[i] = bright ? (blur[i] > t ? 1 : 0) : (blur[i] <= t ? 1 : 0);
    const r = Math.max(2, Math.round(Math.min(w, h) / 70));
    const comp = seLargestComponent(seErode(mask, w, h, r), w, h);
    if (!comp) continue;
    // the erosion pulled the outline in by r pixels: push each corner back out
    const ccx = comp.corners.reduce((a, q) => a + q.x, 0) / 4, ccy = comp.corners.reduce((a, q) => a + q.y, 0) / 4;
    comp.corners = comp.corners.map((q) => {
      const dx = q.x - ccx, dy = q.y - ccy, len = Math.hypot(dx, dy) || 1;
      return { x: q.x + (dx / len) * r * 1.2, y: q.y + (dy / len) * r * 1.2 };
    });
    const frac = comp.count / n;
    const quadArea = sePolyArea(comp.corners);
    const fill = quadArea > 0 ? comp.count / quadArea : 0;
    const quadFrac = quadArea / n;
    const ok = frac >= 0.12 && quadFrac >= 0.2 && fill >= 0.62 && seIsConvex(comp.corners);
    // a pale page (bright) is the normal case; the dark variant only wins when the bright one is not usable
    candidates.push({ bright, ok, fill, quadFrac, corners: comp.corners });
  }
  const pick = candidates.find((c) => c.bright && c.ok) || candidates.find((c) => c.ok);
  if (!pick || pick.quadFrac > 0.97) return { found: false, corners: seFullFrame(), debug: candidates.map((c) => ({ b: c.bright, ok: c.ok, fill: +c.fill.toFixed(2), qf: +c.quadFrac.toFixed(2) })) };
  // pull the corners a little inwards so no dark rim is left from the blur
  const inset = 0.004;
  const cx = pick.corners.reduce((a, p) => a + p.x, 0) / 4, cy = pick.corners.reduce((a, p) => a + p.y, 0) / 4;
  const norm = pick.corners.map((p) => ({
    x: Math.max(0, Math.min(1, (p.x + (cx - p.x) * inset * 2 + 0.5) / w)),
    y: Math.max(0, Math.min(1, (p.y + (cy - p.y) * inset * 2 + 0.5) / h))
  }));
  return { found: true, corners: norm };
}

function seIsFullFrame(corners) {
  const f = seFullFrame();
  return corners.every((p, i) => Math.abs(p.x - f[i].x) < 0.004 && Math.abs(p.y - f[i].y) < 0.004);
}

// ---------------------------------------------------------------- perspective warp

// Output size (pixels) of the straightened page from its four corners in source pixels, limited to maxSide.
function seQuadSize(c, maxSide) {
  const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  let w = Math.max(d(c[0], c[1]), d(c[3], c[2]));
  let h = Math.max(d(c[0], c[3]), d(c[1], c[2]));
  w = Math.max(1, w); h = Math.max(1, h);
  const s = Math.min(1, maxSide / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

// Solves the 8 coefficients of the projective map from the output rectangle (0..W, 0..H) to the source corners.
function seHomography(c, W, H) {
  const dst = [[0, 0], [W, 0], [W, H], [0, H]];
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [u, v] = dst[i];
    const x = c[i].x, y = c[i].y;
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]); b.push(x);
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]); b.push(y);
  }
  // Gaussian elimination with partial pivoting
  for (let col = 0; col < 8; col++) {
    let piv = col;
    for (let r = col + 1; r < 8; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    if (Math.abs(A[piv][col]) < 1e-12) return null;
    [A[col], A[piv]] = [A[piv], A[col]]; [b[col], b[piv]] = [b[piv], b[col]];
    for (let r = col + 1; r < 8; r++) {
      const f = A[r][col] / A[col][col];
      for (let k = col; k < 8; k++) A[r][k] -= f * A[col][k];
      b[r] -= f * b[col];
    }
  }
  const x = new Array(8).fill(0);
  for (let r = 7; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < 8; k++) s -= A[r][k] * x[k];
    x[r] = s / A[r][r];
  }
  return x;
}

// Cuts the page out of the source and straightens it. corners are in SOURCE PIXELS (tl, tr, br, bl).
function seWarp(src, corners, outW, outH) {
  const hm = seHomography(corners, outW, outH);
  const out = { data: new Uint8ClampedArray(outW * outH * 4), width: outW, height: outH };
  if (!hm) return out;
  const sd = src.data, sw = src.width, sh = src.height, od = out.data;
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const d = hm[6] * x + hm[7] * y + 1;
      let sx = (hm[0] * x + hm[1] * y + hm[2]) / d;
      let sy = (hm[3] * x + hm[4] * y + hm[5]) / d;
      sx = Math.max(0, Math.min(sw - 1.001, sx));
      sy = Math.max(0, Math.min(sh - 1.001, sy));
      const x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0;
      const i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4;
      const o = (y * outW + x) * 4;
      for (let k = 0; k < 3; k++) {
        const top = sd[i00 + k] + (sd[i10 + k] - sd[i00 + k]) * fx;
        const bot = sd[i01 + k] + (sd[i11 + k] - sd[i01 + k]) * fx;
        od[o + k] = top + (bot - top) * fy;
      }
      od[o + 3] = 255;
    }
  }
  return out;
}

// ---------------------------------------------------------------- filters

// Estimates the brightness of the blank paper at every pixel (large smooth background) and divides it out.
// Makes the paper evenly white and removes shadows. Colours are kept.
function seFlatten(img) {
  const w = img.width, h = img.height, d = img.data;
  const cell = Math.max(4, Math.round(Math.max(w, h) / 120));
  const gw = Math.ceil(w / cell), gh = Math.ceil(h / cell);
  const grid = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      let sum = 0, cnt = 0;
      const x1 = Math.min(w, (gx + 1) * cell), y1 = Math.min(h, (gy + 1) * cell);
      for (let y = gy * cell; y < y1; y += 2) {
        for (let x = gx * cell; x < x1; x += 2) {
          const i = (y * w + x) * 4;
          sum += seLuma(d[i], d[i + 1], d[i + 2]); cnt++;
        }
      }
      grid[gy * gw + gx] = cnt ? sum / cnt : 255;
    }
  }
  // grey dilation (brightest nearby cell) so that text does not darken the estimate, then smoothing
  const rad = 3;
  const tmp = new Float32Array(gw * gh), dil = new Float32Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    let m = 0;
    for (let k = Math.max(0, x - rad); k <= Math.min(gw - 1, x + rad); k++) m = Math.max(m, grid[y * gw + k]);
    tmp[y * gw + x] = m;
  }
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    let m = 0;
    for (let k = Math.max(0, y - rad); k <= Math.min(gh - 1, y + rad); k++) m = Math.max(m, tmp[k * gw + x]);
    dil[y * gw + x] = m;
  }
  const bg = seBlurGray(dil, gw, gh, 1);
  for (let y = 0; y < h; y++) {
    const gyf = Math.max(0, Math.min(gh - 1, (y + 0.5) / cell - 0.5));
    const gy0 = gyf | 0, gy1 = Math.min(gh - 1, gy0 + 1), fy = gyf - gy0;
    for (let x = 0; x < w; x++) {
      const gxf = Math.max(0, Math.min(gw - 1, (x + 0.5) / cell - 0.5));
      const gx0 = gxf | 0, gx1 = Math.min(gw - 1, gx0 + 1), fx = gxf - gx0;
      const a = bg[gy0 * gw + gx0] + (bg[gy0 * gw + gx1] - bg[gy0 * gw + gx0]) * fx;
      const b = bg[gy1 * gw + gx0] + (bg[gy1 * gw + gx1] - bg[gy1 * gw + gx0]) * fx;
      const B = Math.max(40, a + (b - a) * fy);
      const k = 255 / B;
      const i = (y * w + x) * 4;
      d[i] = seClamp(d[i] * k); d[i + 1] = seClamp(d[i + 1] * k); d[i + 2] = seClamp(d[i + 2] * k);
    }
  }
}

// Linear levels with a gentle S: input lo..hi becomes 0..255
function seLevels(d, lo, hi, gamma) {
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) {
    let t = (v - lo) / (hi - lo);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    lut[v] = 255 * Math.pow(t, gamma || 1);
  }
  for (let i = 0; i < d.length; i += 4) { d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]]; }
}

function seToGray(d) {
  for (let i = 0; i < d.length; i += 4) { const v = seLuma(d[i], d[i + 1], d[i + 2]) + 0.5; d[i] = d[i + 1] = d[i + 2] = v; }
}

function seThreshold(d) {
  const hist = new Float64Array(256);
  let n = 0;
  for (let i = 0; i < d.length; i += 4) { hist[d[i]]++; n++; }
  // Otsu, then keep the cut-off within a sensible range for a normalised page
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, best = 0, th = 150;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue;
    const wF = n - wB; if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) { best = between; th = t; }
  }
  th = Math.max(110, Math.min(205, th + 12));
  for (let i = 0; i < d.length; i += 4) { const v = d[i] > th ? 255 : 0; d[i] = d[i + 1] = d[i + 2] = v; }
}

// mode: one of SE_FILTERS ids. Changes img.data in place.
function seApplyFilter(img, mode) {
  const d = img.data;
  switch (mode) {
    case 'lighten': seLevels(d, 0, 205, 0.85); break;
    case 'enhance': seFlatten(img); seLevels(d, 55, 225, 1.15); break;
    case 'noshadow': seFlatten(img); seLevels(d, 0, 240, 1); break;
    case 'bw': seFlatten(img); seToGray(d); seThreshold(d); break;
    case 'eco': seFlatten(img); seToGray(d); seLevels(d, 90, 235, 1); break;
    case 'gray': seFlatten(img); seToGray(d); seLevels(d, 40, 235, 1.05); break;
    case 'invert': for (let i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; } break;
    default: break;
  }
}

// brightness and contrast in -100..100, applied after the filter
function seAdjust(img, brightness, contrast) {
  const b = (brightness || 0) * 1.28;
  const c = contrast || 0;
  if (!b && !c) return;
  const f = c >= 0 ? 1 + c / 50 : 1 + c / 100;
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) lut[v] = (v - 128) * f + 128 + b;
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) { d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]]; }
}

if (typeof module !== 'undefined') {
  module.exports = { SE_FILTERS, seDetectCorners, seIsFullFrame, seFullFrame, seQuadSize, seHomography, seWarp, seApplyFilter, seAdjust, seIsConvex, sePolyArea };
}
