// Fixlytools - Lorem Ipsum Generator. The generator takes a random function so it can be tested with a fixed seed.

const LI_WORDS = ('lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum curabitur pretium tincidunt lacus nunc malesuada vestibulum ante primis faucibus orci luctus ultrices posuere cubilia curae donec aliquet nibh vitae sapien pellentesque habitant morbi tristique senectus netus fames turpis egestas integer feugiat scelerisque varius duis at consectetur lorem donec massa sapien faucibus et molestie ac feugiat sed lectus vestibulum mattis ullamcorper velit sed ullamcorper morbi tincidunt ornare massa eget egestas purus viverra accumsan').split(' ');

const LI_CLASSIC = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';

function liRandInt(rng, min, max) { return min + Math.floor(rng() * (max - min + 1)); }

function liWords(count, rng) {
  const out = [];
  let prev = '';
  for (let i = 0; i < count; i++) {
    let w = LI_WORDS[liRandInt(rng, 0, LI_WORDS.length - 1)];
    if (w === prev) w = LI_WORDS[(LI_WORDS.indexOf(w) + 1) % LI_WORDS.length];
    out.push(w);
    prev = w;
  }
  return out;
}

function liSentence(rng) {
  const n = liRandInt(rng, 6, 16);
  const words = liWords(n, rng);
  // one comma in longer sentences
  if (n >= 9) {
    const at = liRandInt(rng, 3, n - 4);
    words[at] = words[at] + ',';
  }
  const s = words.join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1) + '.';
}

function liParagraph(rng) {
  const n = liRandInt(rng, 3, 7);
  const out = [];
  for (let i = 0; i < n; i++) out.push(liSentence(rng));
  return out.join(' ');
}

// type: 'paragraphs' | 'sentences' | 'words'
function liGenerate(type, count, startClassic, html, rng) {
  const r = rng || Math.random;
  const n = Math.max(1, Math.floor(count));
  let parts = [];
  if (type === 'words') {
    let words = liWords(n, r);
    if (startClassic) {
      const classic = LI_CLASSIC.toLowerCase().replace(/[.,]/g, '').split(' ');
      words = classic.concat(words).slice(0, n);
    }
    return words.join(' ');
  }
  if (type === 'sentences') {
    for (let i = 0; i < n; i++) parts.push(liSentence(r));
    if (startClassic) parts[0] = LI_CLASSIC;
    return parts.join(' ');
  }
  for (let i = 0; i < n; i++) parts.push(liParagraph(r));
  if (startClassic) parts[0] = LI_CLASSIC + ' ' + parts[0].split('. ').slice(1).join('. ');
  if (startClassic && !/[.]$/.test(parts[0])) parts[0] += '.';
  return html ? parts.map((p) => `<p>${p}</p>`).join('\n') : parts.join('\n\n');
}

// small deterministic generator for tests
function liSeeded(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

if (typeof module !== 'undefined') {
  module.exports = { liGenerate, liSentence, liParagraph, liWords, liSeeded, LI_CLASSIC };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    const typeEl = $('li-type');
    const countEl = $('li-count');
    const out = $('li-out');
    const MAX = { paragraphs: 100, sentences: 500, words: 10000 };

    function generate() {
      const type = typeEl.value;
      let n = parseInt(countEl.value, 10);
      if (!isFinite(n) || n < 1) n = 1;
      if (n > MAX[type]) { n = MAX[type]; countEl.value = n; }
      $('li-html-row').classList.toggle('nt-hide', type !== 'paragraphs');
      out.value = liGenerate(type, n, $('li-classic').checked, type === 'paragraphs' && $('li-html').checked);
      const words = out.value.trim().split(/\s+/).filter(Boolean).length;
      $('li-stats').textContent = `${words.toLocaleString('en-US')} words, ${out.value.length.toLocaleString('en-US')} characters`;
    }

    typeEl.addEventListener('change', () => {
      countEl.value = typeEl.value === 'words' ? 50 : typeEl.value === 'sentences' ? 5 : 3;
      generate();
    });
    countEl.addEventListener('input', generate);
    $('li-classic').addEventListener('change', generate);
    $('li-html').addEventListener('change', generate);
    $('li-generate').addEventListener('click', generate);
    $('li-copy').addEventListener('click', () => ntCopyWithToast(out.value, 'Text copied.'));
    $('li-download').addEventListener('click', () => ntDownload(out.value, 'lorem-ipsum.txt', 'text/plain'));
    generate();
  });
}
