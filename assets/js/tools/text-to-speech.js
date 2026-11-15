// Fixlytools - Text to Speech. Uses the voices already installed in the visitor's browser/device.
// The text never leaves the device.

// Split long text into chunks (browsers cut off very long utterances). Breaks at sentence ends first.
function ttsChunks(text, max) {
  const limit = max || 200;
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?۔؟…]+[.!?۔؟…]*\s*/g) || [clean];
  const chunks = [];
  let cur = '';
  const push = () => { if (cur.trim()) chunks.push(cur.trim()); cur = ''; };
  sentences.forEach((s) => {
    if (s.length > limit) {
      push();
      const words = s.split(' ');
      words.forEach((w) => {
        if ((cur + ' ' + w).length > limit) push();
        cur += (cur ? ' ' : '') + w;
      });
      push();
    } else if ((cur + s).length > limit) {
      push();
      cur = s;
    } else {
      cur += s;
    }
  });
  push();
  return chunks;
}

if (typeof module !== 'undefined') {
  module.exports = { ttsChunks };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    const supported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
    const textEl = $('tts-text');
    const voiceEl = $('tts-voice');
    const langEl = $('tts-lang');
    const rateEl = $('tts-rate');
    const pitchEl = $('tts-pitch');
    const volEl = $('tts-volume');
    const speakBtn = $('tts-speak');
    const pauseBtn = $('tts-pause');
    const stopBtn = $('tts-stop');
    const status = $('tts-status');
    const count = $('tts-count');

    if (!supported) {
      $('tts-unsupported').classList.remove('nt-hide');
      [speakBtn, pauseBtn, stopBtn].forEach((b) => { b.disabled = true; });
      return;
    }

    const synth = window.speechSynthesis;
    let voices = [];
    let session = 0; // increases on every new speak/stop so old callbacks are ignored

    function langName(code) {
      try {
        const base = code.split(/[-_]/)[0];
        return new Intl.DisplayNames(['en'], { type: 'language' }).of(base) || code;
      } catch (e) { return code; }
    }

    function loadVoices() {
      voices = synth.getVoices();
      if (!voices.length) return;
      const prevLang = langEl.value;
      const langs = new Map();
      voices.forEach((v) => {
        const base = v.lang.split(/[-_]/)[0].toLowerCase();
        if (!langs.has(base)) langs.set(base, langName(v.lang));
      });
      langEl.innerHTML = '';
      const all = document.createElement('option');
      all.value = 'all';
      all.textContent = 'All languages';
      langEl.appendChild(all);
      Array.from(langs.entries()).sort((a, b) => a[1].localeCompare(b[1])).forEach(([code, name]) => {
        const o = document.createElement('option');
        o.value = code;
        o.textContent = name;
        langEl.appendChild(o);
      });
      if (prevLang && langs.has(prevLang)) {
        langEl.value = prevLang;
      } else {
        const browserBase = (navigator.language || 'en').split('-')[0].toLowerCase();
        langEl.value = langs.has(browserBase) ? browserBase : 'all';
      }
      fillVoices();
    }

    function fillVoices() {
      const filter = langEl.value;
      const prev = voiceEl.value;
      voiceEl.innerHTML = '';
      const list = voices.filter((v) => filter === 'all' || v.lang.split(/[-_]/)[0].toLowerCase() === filter);
      list.forEach((v) => {
        const o = document.createElement('option');
        o.value = v.voiceURI;
        o.textContent = `${v.name} (${v.lang})`;
        voiceEl.appendChild(o);
      });
      if (prev && list.some((v) => v.voiceURI === prev)) {
        voiceEl.value = prev;
      } else {
        const def = list.find((v) => v.default);
        if (def) voiceEl.value = def.voiceURI;
      }
      $('tts-no-voice').classList.toggle('nt-hide', list.length > 0);
    }

    loadVoices();
    if (typeof synth.addEventListener === 'function') synth.addEventListener('voiceschanged', loadVoices);
    else synth.onvoiceschanged = loadVoices;
    // some browsers fill the list a moment after load
    setTimeout(loadVoices, 400);
    setTimeout(loadVoices, 1500);
    langEl.addEventListener('change', fillVoices);

    function showRange(el, outId, suffix) { $(outId).textContent = Number(el.value).toFixed(1) + suffix; }
    rateEl.addEventListener('input', () => showRange(rateEl, 'tts-rate-v', 'x'));
    pitchEl.addEventListener('input', () => showRange(pitchEl, 'tts-pitch-v', ''));
    volEl.addEventListener('input', () => showRange(volEl, 'tts-volume-v', ''));

    textEl.addEventListener('input', () => {
      const n = textEl.value.length;
      count.textContent = `${n.toLocaleString('en-US')} characters`;
    });

    function setIdle() {
      speakBtn.disabled = false;
      pauseBtn.disabled = true;
      stopBtn.disabled = true;
      pauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
    }

    function speak() {
      const text = textEl.value.trim();
      if (!text) { showToast('Type or paste some text first.', 'warning'); return; }
      const voice = voices.find((v) => v.voiceURI === voiceEl.value);
      const chunks = ttsChunks(text, 200);
      synth.cancel();
      const my = ++session;
      let i = 0;
      speakBtn.disabled = true;
      pauseBtn.disabled = false;
      stopBtn.disabled = false;
      status.textContent = 'Speaking...';

      function next() {
        if (my !== session) return;
        if (i >= chunks.length) { status.textContent = 'Finished.'; setIdle(); return; }
        const u = new SpeechSynthesisUtterance(chunks[i]);
        if (voice) { u.voice = voice; u.lang = voice.lang; }
        u.rate = parseFloat(rateEl.value);
        u.pitch = parseFloat(pitchEl.value);
        u.volume = parseFloat(volEl.value);
        u.onend = () => { i++; next(); };
        u.onerror = (e) => {
          if (my !== session) return;
          if (e && (e.error === 'canceled' || e.error === 'interrupted')) return;
          status.textContent = 'This voice could not play the text. Try another voice.';
          setIdle();
        };
        synth.speak(u);
      }
      next();
    }

    function togglePause() {
      if (synth.paused) {
        synth.resume();
        pauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
        status.textContent = 'Speaking...';
      } else {
        synth.pause();
        pauseBtn.innerHTML = '<i class="fa-solid fa-play"></i> Resume';
        status.textContent = 'Paused.';
      }
    }

    function stop() {
      session++;
      synth.cancel();
      status.textContent = 'Stopped.';
      setIdle();
    }

    speakBtn.addEventListener('click', speak);
    pauseBtn.addEventListener('click', togglePause);
    stopBtn.addEventListener('click', stop);
    $('tts-clear').addEventListener('click', () => { stop(); textEl.value = ''; count.textContent = '0 characters'; status.textContent = ''; });
    $('tts-sample').addEventListener('click', () => {
      textEl.value = 'Hello! This is a sample of the text to speech tool on Fixlytools. You can change the voice, the speed and the pitch.';
      textEl.dispatchEvent(new Event('input'));
    });
    window.addEventListener('pagehide', () => synth.cancel());
    setIdle();
  });
}
