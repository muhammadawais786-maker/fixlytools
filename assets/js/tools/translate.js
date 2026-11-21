// Fixlytools - Translate
// Engines: (1) Cloudflare Workers AI through /api/translate, (2) MyMemory free API as fallback,
// (3) Chrome's on-device Translator (works offline after the language pack is downloaded, desktop Chrome/Edge only).
(function () {
  const LANGS = [
    ['en', 'English'], ['ur', 'Urdu - اردو'], ['ar', 'Arabic - العربية'], ['hi', 'Hindi - हिन्दी'], ['fa', 'Persian - فارسی'],
    ['pa', 'Punjabi'], ['ps', 'Pashto - پښتو'], ['sd', 'Sindhi - سنڌي'], ['bn', 'Bengali'], ['ta', 'Tamil'], ['te', 'Telugu'], ['mr', 'Marathi'],
    ['gu', 'Gujarati'], ['ne', 'Nepali'], ['tr', 'Turkish'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['it', 'Italian'],
    ['pt', 'Portuguese'], ['ru', 'Russian'], ['uk', 'Ukrainian'], ['pl', 'Polish'], ['nl', 'Dutch'], ['sv', 'Swedish'], ['el', 'Greek'],
    ['he', 'Hebrew'], ['zh', 'Chinese'], ['ja', 'Japanese'], ['ko', 'Korean'], ['id', 'Indonesian'], ['ms', 'Malay'], ['th', 'Thai'],
    ['vi', 'Vietnamese'], ['sw', 'Swahili'], ['ro', 'Romanian'], ['cs', 'Czech'], ['hu', 'Hungarian'], ['da', 'Danish'], ['fi', 'Finnish']
  ];
  const RTL = ['ar', 'ur', 'fa', 'he', 'ps', 'sd'];
  const MAX_TOTAL = 20000;

  const $ = (id) => document.getElementById(id);
  const src = $('tr-src'), dst = $('tr-dst'), inp = $('tr-in'), out = $('tr-out'), engineSel = $('tr-engine');
  const dots = $('tr-dots'), status = $('tr-status'), stats = $('tr-stats'), used = $('tr-used'), warn = $('tr-warn');
  if (!inp) return;

  function fill(sel, withAuto) {
    if (withAuto) sel.add(new Option('Detect language', 'auto'));
    LANGS.forEach((l) => sel.add(new Option(l[1], l[0])));
  }
  fill(src, true); fill(dst, false);
  dst.insertBefore(new Option('Select language', ''), dst.firstChild);
  src.value = 'auto'; dst.value = '';

  // offline option only where the browser has the API
  const hasLocal = 'Translator' in self;
  if (hasLocal) engineSel.add(new Option('On this device (offline, Chrome/Edge desktop)', 'local'));
  const warnText = {
    online: 'Online modes send your text to Cloudflare (Workers AI), Google Cloud Translation (when enabled) or, as a backup, to MyMemory, only to translate it. They do not receive your files or your name. For private text choose the on-device mode where available.',
    local: 'On-device mode: your text stays in your browser and is not sent anywhere. The language pack downloads once, then it works offline.'
  };
  function showWarn() { warn.textContent = engineSel.value === 'local' ? warnText.local : warnText.online; warn.className = 'nt-note' + (engineSel.value === 'local' ? ' nt-note-blue' : ''); }
  engineSel.addEventListener('change', showWarn); showWarn();

  function setDir() {
    // empty boxes always keep their hint on the left; written text follows its language
    inp.dir = !inp.value ? 'ltr' : (RTL.indexOf(src.value) >= 0 ? 'rtl' : 'auto');
    out.dir = (out.value && RTL.indexOf(dst.value) >= 0) ? 'rtl' : 'ltr';
  }
  src.addEventListener('change', setDir); dst.addEventListener('change', setDir); setDir();
  function updateStats() { stats.textContent = inp.value.length.toLocaleString() + ' / ' + MAX_TOTAL.toLocaleString() + ' characters'; }
  inp.addEventListener('input', updateStats); updateStats();

  function detect(text) {
    const n = (re) => (text.match(re) || []).length;
    const arab = n(/[؀-ۿ]/g), latin = n(/[A-Za-z]/g), deva = n(/[ऀ-ॿ]/g);
    const total = text.replace(/\s/g, '').length || 1;
    if (n(/[぀-ヿ]/g)) return 'ja';
    if (n(/[가-힯]/g)) return 'ko';
    if (n(/[一-鿿]/g)) return 'zh';
    if (n(/[Ѐ-ӿ]/g) / total > 0.3) return 'ru';
    if (n(/[֐-׿]/g) / total > 0.3) return 'he';
    if (deva / total > 0.3) return 'hi';
    if (n(/[ঀ-৿]/g) / total > 0.3) return 'bn';
    if (arab / total > 0.3) {
      // Urdu only if it has Urdu-only letters or common Urdu words (Quranic Arabic also uses ی ہ ھ)
      if (/[ٹڈڑںے]/.test(text) || /(^|\s)(کے|کی|ہے|ہیں|میں|اور|سے|کو|نہیں|تھا|ہوں|یہ|وہ|ہو|کہ|پر|ایک)(\s|$|[،۔])/.test(text)) return 'ur';
      if (/[پچژگ]/.test(text)) return 'fa';
      return 'ar';
    }
    if (latin) return 'en';
    return 'en';
  }

  // split into pieces no longer than max characters, at paragraph / sentence / word borders
  function chunk(text, max) {
    const parts = [];
    text.split(/(\n+)/).forEach((seg) => {
      if (!seg) return;
      if (/^\n+$/.test(seg) || seg.length <= max) { parts.push(seg); return; }
      let cur = '';
      seg.split(/(?<=[.!?؟۔।])\s+/).forEach((s) => {
        if ((cur + ' ' + s).length > max && cur) { parts.push(cur); cur = ''; }
        if (s.length > max) {
          for (let i = 0; i < s.length; i += max) parts.push(s.slice(i, i + max));
        } else cur = cur ? cur + ' ' + s : s;
      });
      if (cur) parts.push(cur);
    });
    return parts;
  }

  let lastEngine = 'cloudflare';
  async function viaCloudflare(text, s, t) {
    const r = await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, source: s, target: t }) });
    if (!r.ok) throw new Error('cf ' + r.status);
    const d = await r.json();
    if (!d.translation) throw new Error('cf empty');
    lastEngine = d.engine || 'cloudflare';
    return d.translation;
  }
  async function viaMyMemory(text, s, t) {
    const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=' + encodeURIComponent(s + '|' + t);
    const r = await fetch(url);
    if (!r.ok) throw new Error('mm ' + r.status);
    const d = await r.json();
    const tx = d && d.responseData && d.responseData.translatedText;
    if (String(d.responseStatus) !== '200' || !tx || /^MYMEMORY WARNING/i.test(tx)) throw new Error('mm limit');
    return tx;
  }

  let translator = null, translatorKey = '';
  async function viaLocal(chunks, s, t) {
    const key = s + '>' + t;
    if (!translator || translatorKey !== key) {
      const av = await Translator.availability({ sourceLanguage: s, targetLanguage: t });
      if (av === 'unavailable') throw new Error('pair');
      translator = await Translator.create({
        sourceLanguage: s, targetLanguage: t,
        monitor(m) { m.addEventListener('downloadprogress', (e) => { status.textContent = 'Downloading the language pack: ' + Math.round((e.loaded || 0) * 100) + '%'; }); }
      });
      translatorKey = key;
    }
    const res = [];
    for (let i = 0; i < chunks.length; i++) {
      res.push(/^\n+$/.test(chunks[i]) ? chunks[i] : await translator.translate(chunks[i]));
      status.textContent = 'Translating... ' + Math.round(((i + 1) / chunks.length) * 100) + '%';
    }
    return res.join('');
  }

  // Quran / Hadith Arabic carries vowel marks (tashkeel) that confuse translation models; remove them before translating
  function stripMarks(t) { return t.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u08D3-\u08FF]/g, '').replace(/[\uFD3E\uFD3F]/g, ''); }
  let seq = 0, timer = null;
  function schedule(ms) { clearTimeout(timer); timer = setTimeout(run, ms); }
  async function run() {
    clearTimeout(timer);
    const rawText = inp.value.trim();
    const text = stripMarks(rawText).replace(/[ \t]{2,}/g, ' ').trim();
    const my = ++seq;
    if (!rawText) { out.value = ''; used.textContent = ''; status.textContent = ''; dots.hidden = true; return; }
    if (text.length > MAX_TOTAL) { dots.hidden = true; showToast('Please keep the text under ' + MAX_TOTAL.toLocaleString() + ' characters.', 'warning'); return; }
    let s = src.value; const t = dst.value;
    if (!t) { dots.hidden = true; status.textContent = 'Choose the language you want to translate into (To).'; return; }
    if (s === 'auto') { s = detect(text); }
    if (s === t) { out.value = rawText; used.textContent = 'Source and target language are the same.'; dots.hidden = true; return; }
    dots.hidden = false; used.textContent = ''; status.textContent = '';
    try {
      let result = '', label = '';
      if (engineSel.value === 'local') {
        try { result = await viaLocal(chunk(text, 1500), s, t); label = 'On-device (offline) translation'; }
        catch (e) {
          if (e && e.message === 'pair') throw new Error('This language pair is not available offline in your browser. Choose the online mode.');
          throw new Error('The on-device translator could not start. Choose the online mode.');
        }
      } else {
        const pieces = chunk(text, 900);
        let engine = 'cf';
        const outParts = [];
        for (let i = 0; i < pieces.length; i++) {
          if (my !== seq) return;
          const p = pieces[i];
          if (/^\n+$/.test(p) || !p.trim()) { outParts.push(p); continue; }
          let tr = null;
          if (engine === 'cf') {
            try { tr = await viaCloudflare(p, s, t); } catch (e) { engine = 'mm'; }
          }
          if (tr === null) {
            // MyMemory takes about 500 characters per request
            const small = chunk(p, 450); const sub = [];
            for (const q of small) sub.push(/^\n+$/.test(q) ? q : await viaMyMemory(q, s, t).catch((e) => { throw new Error('Translation is busy or the free daily limit was reached. Please try again later.'); }));
            tr = sub.join(' ');
          }
          outParts.push(tr);
        }
        result = outParts.join('');
        label = engine !== 'cf' ? 'Translated with MyMemory (backup service)'
          : lastEngine === 'google' ? 'Translated with Google Cloud Translation'
          : lastEngine === 'cloudflare-pivot' ? 'Translated with Cloudflare Workers AI (through English for better accuracy)'
          : 'Translated with Cloudflare Workers AI';
      }
      if (my !== seq) return;
      out.value = result; used.textContent = label; setDir();
    } catch (e) {
      if (my !== seq) return;
      showToast(e && e.message ? e.message : 'Translation failed. Please try again.', 'error');
    } finally { if (my === seq) dots.hidden = true; }
  }
  // automatic: translate by itself after typing stops, straight away after a paste or a language change
  inp.addEventListener('input', () => { setDir(); schedule(500); });
  inp.addEventListener('paste', () => setTimeout(() => schedule(50), 0));
  src.addEventListener('change', () => { if (inp.value.trim()) schedule(50); });
  dst.addEventListener('change', () => { if (inp.value.trim()) schedule(50); });
  engineSel.addEventListener('change', () => { if (inp.value.trim()) schedule(50); });

  $('tr-swap').addEventListener('click', () => {
    if (!dst.value) { showToast('Choose the To language first.', 'warning'); return; }
    const s = src.value === 'auto' ? detect(inp.value) : src.value;
    src.value = dst.value; dst.value = s;
    const o = out.value; out.value = ''; if (o) inp.value = o;
    setDir(); updateStats(); if (inp.value.trim()) schedule(50);
  });
  $('tr-copy').addEventListener('click', () => ntCopyWithToast(out.value, 'Translation copied.'));
  $('tr-clear').addEventListener('click', () => { seq++; dots.hidden = true; inp.value = ''; out.value = ''; setDir(); used.textContent = ''; status.textContent = ''; updateStats(); inp.focus(); });
  $('tr-paste').addEventListener('click', async () => {
    try { inp.value = await navigator.clipboard.readText(); updateStats(); schedule(50); } catch (e) { showToast('Paste with Ctrl+V or long-press in the box.', 'info'); }
  });
  $('tr-speak').addEventListener('click', () => {
    if (!out.value) { showToast('Translate something first.', 'warning'); return; }
    if (!('speechSynthesis' in window)) { showToast('Speech is not supported in this browser.', 'warning'); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(out.value); u.lang = dst.value; speechSynthesis.speak(u);
  });
})();
