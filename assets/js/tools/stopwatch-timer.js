// Fixlytools - Stopwatch and Countdown Timer. Time is measured from clock timestamps, so it stays accurate even if the tab is in the background.

function swPad(n, len) { return String(n).padStart(len || 2, '0'); }

// stopwatch format HH:MM:SS.cc (hours only shown when needed is decided by the caller)
function swFormat(ms, centis) {
  const total = Math.max(0, Math.floor(ms));
  const h = Math.floor(total / 3600000);
  const m = Math.floor((total % 3600000) / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const c = Math.floor((total % 1000) / 10);
  return `${swPad(h)}:${swPad(m)}:${swPad(s)}${centis ? '.' + swPad(c) : ''}`;
}

// countdown shows whole seconds, rounded up so that it reads 00:00:00 only when time is really up
function swFormatCountdown(ms) {
  const secs = Math.max(0, Math.ceil(ms / 1000));
  return swFormat(secs * 1000, false);
}

function swParseHMS(h, m, s) {
  const n = (v) => { const x = parseInt(v, 10); return isFinite(x) && x > 0 ? x : 0; };
  const total = (n(h) * 3600 + n(m) * 60 + n(s)) * 1000;
  return Math.min(total, (99 * 3600 + 59 * 60 + 59) * 1000);
}

// laps: array of lap durations (ms). Returns indexes of fastest and slowest, or null when fewer than 3 laps.
function swLapExtremes(laps) {
  if (laps.length < 3) return null;
  let min = 0, max = 0;
  laps.forEach((v, i) => { if (v < laps[min]) min = i; if (v > laps[max]) max = i; });
  return min === max ? null : { fastest: min, slowest: max };
}

if (typeof module !== 'undefined') {
  module.exports = { swFormat, swFormatCountdown, swParseHMS, swLapExtremes };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    const baseTitle = document.title;

    // ---------- tabs ----------
    const tabs = { sw: $('st-tab-sw'), tm: $('st-tab-tm') };
    const panels = { sw: $('st-panel-sw'), tm: $('st-panel-tm') };
    function showTab(name) {
      Object.keys(tabs).forEach((k) => {
        tabs[k].classList.toggle('nt-active', k === name);
        tabs[k].setAttribute('aria-selected', k === name ? 'true' : 'false');
        panels[k].classList.toggle('nt-hide', k !== name);
      });
    }
    tabs.sw.addEventListener('click', () => showTab('sw'));
    tabs.tm.addEventListener('click', () => showTab('tm'));
    if (location.hash === '#timer') showTab('tm');

    // ---------- stopwatch ----------
    const swDisplay = $('sw-display');
    let swRunning = false, swElapsedBefore = 0, swStartedAt = 0, swTimer = null;
    let laps = [], lastLapTotal = 0;

    function swElapsed() { return swElapsedBefore + (swRunning ? performance.now() - swStartedAt : 0); }
    function swPaint() { swDisplay.textContent = swFormat(swElapsed(), true); }

    function renderLaps() {
      const body = $('sw-laps');
      body.innerHTML = '';
      $('sw-laps-wrap').classList.toggle('nt-hide', laps.length === 0);
      const ext = swLapExtremes(laps.map((l) => l.lap));
      let total = 0;
      const rows = laps.map((l, i) => { total += l.lap; return { i, lap: l.lap, total }; }).reverse();
      rows.forEach((r) => {
        const tr = document.createElement('tr');
        const cells = [`Lap ${r.i + 1}`, swFormat(r.lap, true), swFormat(r.total, true)];
        cells.forEach((t, ci) => {
          const td = document.createElement('td');
          td.textContent = t;
          if (ci > 0) td.className = 'nt-mono';
          if (ci === 1 && ext && r.i === ext.fastest) td.style.color = '#059669';
          if (ci === 1 && ext && r.i === ext.slowest) td.style.color = '#dc2626';
          tr.appendChild(td);
        });
        body.appendChild(tr);
      });
    }

    function swStart() {
      if (swRunning) return;
      swRunning = true;
      swStartedAt = performance.now();
      swTimer = setInterval(swPaint, 30);
      $('sw-start').innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
      $('sw-start').classList.add('nt-btn-yellow');
      $('sw-lap').disabled = false;
      $('sw-reset').disabled = false;
    }
    function swPause() {
      if (!swRunning) return;
      swElapsedBefore = swElapsed();
      swRunning = false;
      clearInterval(swTimer);
      swPaint();
      $('sw-start').innerHTML = '<i class="fa-solid fa-play"></i> Resume';
      $('sw-start').classList.remove('nt-btn-yellow');
      $('sw-lap').disabled = true;
    }
    $('sw-start').addEventListener('click', () => (swRunning ? swPause() : swStart()));
    $('sw-lap').addEventListener('click', () => {
      if (!swRunning) return;
      const now = swElapsed();
      laps.push({ lap: now - lastLapTotal });
      lastLapTotal = now;
      renderLaps();
    });
    $('sw-reset').addEventListener('click', () => {
      swRunning = false;
      clearInterval(swTimer);
      swElapsedBefore = 0;
      laps = [];
      lastLapTotal = 0;
      swPaint();
      renderLaps();
      $('sw-start').innerHTML = '<i class="fa-solid fa-play"></i> Start';
      $('sw-start').classList.remove('nt-btn-yellow');
      $('sw-lap').disabled = true;
      $('sw-reset').disabled = true;
    });
    $('sw-copy').addEventListener('click', () => {
      if (!laps.length) { showToast('There are no laps to copy yet.', 'warning'); return; }
      let total = 0;
      const lines = laps.map((l, i) => { total += l.lap; return `Lap ${i + 1}\t${swFormat(l.lap, true)}\t${swFormat(total, true)}`; });
      ntCopyWithToast(['Lap\tLap time\tTotal'].concat(lines).join('\n'), 'Laps copied.');
    });
    swPaint();

    // ---------- timer ----------
    const tmDisplay = $('tm-display');
    const hEl = $('tm-h'), mEl = $('tm-m'), sEl = $('tm-s');
    let tmRunning = false, tmRemaining = 0, tmEnd = 0, tmTotal = 0, tmTick = null, alarmTimer = null, audio = null;

    function tmRemainNow() { return tmRunning ? Math.max(0, tmEnd - Date.now()) : tmRemaining; }

    function tmPaint() {
      const left = tmRemainNow();
      tmDisplay.textContent = swFormatCountdown(left);
      const pct = tmTotal > 0 ? Math.max(0, Math.min(100, (1 - left / tmTotal) * 100)) : 0;
      $('tm-bar').style.width = pct + '%';
      if (tmRunning) document.title = swFormatCountdown(left) + ' - ' + baseTitle;
      if (tmRunning && left <= 0) tmFinish();
    }

    function beepOnce() {
      if (!audio) return;
      try {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, audio.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.4, audio.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(audio.destination);
        osc.start();
        osc.stop(audio.currentTime + 0.3);
      } catch (e) { /* sound is optional */ }
    }

    function stopAlarm() {
      if (alarmTimer) { clearInterval(alarmTimer); alarmTimer = null; }
      $('tm-alarm').classList.add('nt-hide');
      document.title = baseTitle;
    }

    function tmFinish() {
      tmRunning = false;
      clearInterval(tmTick);
      tmRemaining = 0;
      tmDisplay.textContent = '00:00:00';
      $('tm-bar').style.width = '100%';
      $('tm-start').innerHTML = '<i class="fa-solid fa-play"></i> Start';
      $('tm-start').disabled = false;
      document.title = "Time's up! - " + baseTitle;
      $('tm-alarm').classList.remove('nt-hide');
      if ($('tm-sound').checked) {
        let n = 0;
        const ring = () => { beepOnce(); setTimeout(beepOnce, 300); setTimeout(beepOnce, 600); if (++n >= 10) stopAlarm(); };
        ring();
        alarmTimer = setInterval(ring, 1500);
      }
      try { if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]); } catch (e) { /* optional */ }
    }

    function tmStart() {
      stopAlarm();
      if (tmRunning) return;
      if (tmRemaining <= 0) {
        tmTotal = swParseHMS(hEl.value, mEl.value, sEl.value);
        if (tmTotal <= 0) { showToast('Set a time greater than zero first.', 'warning'); return; }
        tmRemaining = tmTotal;
      }
      try {
        if (!audio) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) audio = new AC(); }
        if (audio && audio.state === 'suspended') audio.resume();
      } catch (e) { audio = null; }
      tmRunning = true;
      tmEnd = Date.now() + tmRemaining;
      tmTick = setInterval(tmPaint, 200);
      $('tm-start').innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
      $('tm-reset').disabled = false;
      $('tm-setup').classList.add('nt-hide');
      tmPaint();
    }
    function tmPause() {
      if (!tmRunning) return;
      tmRemaining = Math.max(0, tmEnd - Date.now());
      tmRunning = false;
      clearInterval(tmTick);
      tmPaint();
      document.title = baseTitle;
      $('tm-start').innerHTML = '<i class="fa-solid fa-play"></i> Resume';
    }
    function tmReset() {
      stopAlarm();
      tmRunning = false;
      clearInterval(tmTick);
      tmRemaining = 0;
      tmTotal = 0;
      tmDisplay.textContent = swFormatCountdown(swParseHMS(hEl.value, mEl.value, sEl.value));
      $('tm-bar').style.width = '0%';
      $('tm-start').innerHTML = '<i class="fa-solid fa-play"></i> Start';
      $('tm-reset').disabled = true;
      $('tm-setup').classList.remove('nt-hide');
      document.title = baseTitle;
    }

    function previewSetup() {
      if (!tmRunning && tmRemaining <= 0) tmDisplay.textContent = swFormatCountdown(swParseHMS(hEl.value, mEl.value, sEl.value));
    }
    [hEl, mEl, sEl].forEach((el) => el.addEventListener('input', previewSetup));
    document.querySelectorAll('[data-minutes]').forEach((b) => b.addEventListener('click', () => {
      const mins = parseInt(b.dataset.minutes, 10);
      hEl.value = Math.floor(mins / 60);
      mEl.value = mins % 60;
      sEl.value = 0;
      previewSetup();
    }));
    $('tm-start').addEventListener('click', () => (tmRunning ? tmPause() : tmStart()));
    $('tm-reset').addEventListener('click', tmReset);
    $('tm-alarm-stop').addEventListener('click', () => { stopAlarm(); tmReset(); });
    previewSetup();
    window.addEventListener('pagehide', () => { document.title = baseTitle; });
  });
}
