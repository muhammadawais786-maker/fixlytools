// Fixlytools - Speech to Text. Uses the browser's built-in speech recognition (Chrome, Edge, Safari).
// In Chrome and Edge the audio is processed by the browser vendor's speech service, not by Fixlytools.

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const out = $('stt-text');
    const startBtn = $('stt-start');
    const stopBtn = $('stt-stop');
    const status = $('stt-status');
    const langEl = $('stt-lang');
    const interimEl = $('stt-interim');

    if (!SR) {
      $('stt-unsupported').classList.remove('nt-hide');
      startBtn.disabled = true;
      stopBtn.disabled = true;
      langEl.disabled = true;
    }

    // default language from the browser when we offer it
    try {
      const nav = (navigator.language || 'en-US');
      const has = Array.from(langEl.options).some((o) => o.value === nav);
      if (has) langEl.value = nav;
    } catch (e) { /* keep default */ }

    let rec = null;
    let listening = false;
    let finalText = '';
    let restarts = 0;

    function needsSpace(s) { return s && !/\s$/.test(s); }

    function build() {
      out.value = finalText;
    }

    function start() {
      if (!SR || listening) return;
      finalText = out.value;
      rec = new SR();
      rec.lang = langEl.value;
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        listening = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        langEl.disabled = true;
        status.textContent = 'Listening... speak now.';
        $('stt-dot').classList.remove('nt-hide');
      };
      rec.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          const piece = r[0].transcript;
          if (r.isFinal) {
            finalText += (needsSpace(finalText) ? ' ' : '') + piece.trim();
            restarts = 0;
          } else {
            interim += piece;
          }
        }
        build();
        interimEl.textContent = interim;
        out.scrollTop = out.scrollHeight;
      };
      rec.onerror = (e) => {
        const map = {
          'not-allowed': 'Microphone access was blocked. Allow the microphone for this site in your browser settings and try again.',
          'service-not-allowed': 'The browser blocked speech recognition for this page.',
          'audio-capture': 'No microphone was found. Connect a microphone and try again.',
          'network': 'The speech service could not be reached. Check your internet connection.',
          'language-not-supported': 'This language is not supported by your browser.'
        };
        if (e.error === 'no-speech' || e.error === 'aborted') return;
        status.textContent = map[e.error] || ('Speech recognition error: ' + e.error);
        listening = false;
        resetButtons();
      };
      rec.onend = () => {
        interimEl.textContent = '';
        if (listening && restarts < 30) {
          // the browser stops after a long silence; continue until the user presses Stop
          restarts++;
          try { rec.start(); } catch (err) { listening = false; resetButtons(); }
          return;
        }
        listening = false;
        resetButtons();
      };
      try { rec.start(); } catch (err) { status.textContent = 'Could not start the microphone.'; }
    }

    function resetButtons() {
      startBtn.disabled = !SR;
      stopBtn.disabled = true;
      langEl.disabled = !SR;
      $('stt-dot').classList.add('nt-hide');
      if (!/blocked|found|reached|error|supported|Could not/.test(status.textContent)) status.textContent = out.value ? 'Stopped. You can edit the text below.' : 'Ready.';
    }

    function stop() {
      listening = false;
      if (rec) { try { rec.stop(); } catch (e) { /* already stopped */ } }
      resetButtons();
    }

    startBtn.addEventListener('click', start);
    stopBtn.addEventListener('click', stop);
    out.addEventListener('input', () => { finalText = out.value; });
    $('stt-copy').addEventListener('click', () => ntCopyWithToast(out.value, 'Text copied.'));
    $('stt-download').addEventListener('click', () => {
      if (!out.value.trim()) { showToast('There is no text to download yet.', 'warning'); return; }
      ntDownload(out.value, 'fixlytools-speech.txt', 'text/plain');
    });
    $('stt-clear').addEventListener('click', () => { stop(); out.value = ''; finalText = ''; interimEl.textContent = ''; status.textContent = 'Ready.'; });
    window.addEventListener('pagehide', () => { listening = false; if (rec) { try { rec.abort(); } catch (e) { /* ignore */ } } });
    status.textContent = SR ? 'Ready.' : '';
  });
}
