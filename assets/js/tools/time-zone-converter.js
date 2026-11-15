// Fixlytools - Time Zone Converter. Uses the time zone database built into the browser (Intl), so no data is sent anywhere.

const tzFormatters = {};
function tzFmt(tz) {
  if (!tzFormatters[tz]) {
    tzFormatters[tz] = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric'
    });
  }
  return tzFormatters[tz];
}

// wall-clock parts of an instant in a zone
function tzParts(ts, tz) {
  const o = {};
  tzFmt(tz).formatToParts(new Date(ts)).forEach((p) => { if (p.type !== 'literal') o[p.type] = +p.value; });
  if (o.hour === 24) o.hour = 0;
  return o;
}

// offset of the zone from UTC in minutes at the given instant (east of UTC is positive)
function tzOffsetMinutes(tz, ts) {
  const p = tzParts(ts, tz);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUTC - Math.floor(ts / 1000) * 1000) / 60000);
}

// the instant (ms) at which the wall clock in `tz` shows the given date and time
function tzLocalToInstant(y, mo, d, h, mi, tz) {
  const guess = Date.UTC(y, mo - 1, d, h, mi, 0);
  let ts = guess - tzOffsetMinutes(tz, guess) * 60000;
  // the offset may differ at the corrected instant (daylight saving changes), so correct once more
  const off2 = tzOffsetMinutes(tz, ts);
  ts = guess - off2 * 60000;
  return ts;
}

function tzOffsetLabel(min) {
  const sign = min < 0 ? '-' : '+';
  const a = Math.abs(min);
  const h = Math.floor(a / 60), m = a % 60;
  return 'UTC' + sign + h + (m ? ':' + String(m).padStart(2, '0') : '');
}

function tzDurationText(min) {
  const a = Math.abs(min);
  const h = Math.floor(a / 60), m = a % 60;
  const parts = [];
  if (h) parts.push(h + (h === 1 ? ' hour' : ' hours'));
  if (m) parts.push(m + (m === 1 ? ' minute' : ' minutes'));
  return parts.join(' ') || '0 hours';
}

function tzDiffSentence(nameA, offA, nameB, offB) {
  const diff = offB - offA;
  if (diff === 0) return `${nameA} and ${nameB} have the same time right now.`;
  return `${nameB} is ${tzDurationText(diff)} ${diff > 0 ? 'ahead of' : 'behind'} ${nameA}.`;
}

function tzFindCountry(list, tz) {
  const exact = list.find((c) => c.zones.some((z) => z.tz === tz));
  return exact || null;
}

function tzFormatInstant(ts, tz, hour12) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: !!hour12
  }).format(new Date(ts));
}

function tzTimeOnly(ts, tz, hour12, seconds) {
  const o = { timeZone: tz, hour: hour12 ? 'numeric' : '2-digit', minute: '2-digit', hour12: !!hour12 };
  if (seconds) o.second = '2-digit';
  return new Intl.DateTimeFormat('en-US', o).format(new Date(ts));
}

if (typeof module !== 'undefined') {
  module.exports = { tzOffsetMinutes, tzLocalToInstant, tzOffsetLabel, tzDurationText, tzDiffSentence, tzFindCountry, tzParts };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    const list = TZ_COUNTRIES;
    const fromC = $('tz-from-country'), toC = $('tz-to-country');
    const fromZ = $('tz-from-zone'), toZ = $('tz-to-zone');
    const whenEl = $('tz-when');
    const fmtEl = $('tz-format');

    function fillCountries(sel) {
      sel.innerHTML = '';
      list.forEach((c) => {
        const o = document.createElement('option');
        o.value = c.code;
        o.textContent = c.name;
        sel.appendChild(o);
      });
    }
    fillCountries(fromC);
    fillCountries(toC);

    function byCode(code) { return list.find((c) => c.code === code); }

    function fillZones(countrySel, zoneSel, preferTz) {
      const c = byCode(countrySel.value);
      zoneSel.innerHTML = '';
      c.zones.forEach((z) => {
        const o = document.createElement('option');
        o.value = z.tz;
        o.textContent = z.label || z.tz.split('/').pop().replace(/_/g, ' ');
        zoneSel.appendChild(o);
      });
      if (preferTz && c.zones.some((z) => z.tz === preferTz)) zoneSel.value = preferTz;
      zoneSel.parentElement.classList.toggle('nt-hide', c.zones.length < 2);
    }

    function pad(n) { return String(n).padStart(2, '0'); }
    function nowInZoneValue(tz) {
      const p = tzParts(Date.now(), tz);
      return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
    }

    function displayName(countrySel, zoneSel) {
      const c = byCode(countrySel.value);
      if (c.zones.length > 1) {
        const z = c.zones.find((x) => x.tz === zoneSel.value);
        return `${c.name} (${z && z.label ? z.label : zoneSel.value})`;
      }
      return c.name;
    }

    function convert() {
      const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(whenEl.value);
      if (!m) { $('tz-result').classList.add('nt-hide'); return; }
      const hour12 = fmtEl.value === '12';
      const ts = tzLocalToInstant(+m[1], +m[2], +m[3], +m[4], +m[5], fromZ.value);
      const offA = tzOffsetMinutes(fromZ.value, ts);
      const offB = tzOffsetMinutes(toZ.value, ts);
      const nameA = displayName(fromC, fromZ), nameB = displayName(toC, toZ);

      $('tz-big').textContent = tzTimeOnly(ts, toZ.value, hour12, false);
      $('tz-big-date').textContent = new Intl.DateTimeFormat('en-US', { timeZone: toZ.value, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(ts));
      $('tz-diff').textContent = tzDiffSentence(nameA, offA, nameB, offB);
      $('tz-from-name').textContent = nameA;
      $('tz-from-time').textContent = tzFormatInstant(ts, fromZ.value, hour12);
      $('tz-from-off').textContent = tzOffsetLabel(offA);
      $('tz-to-name').textContent = nameB;
      $('tz-to-time').textContent = tzFormatInstant(ts, toZ.value, hour12);
      $('tz-to-off').textContent = tzOffsetLabel(offB);
      $('tz-result').classList.remove('nt-hide');
    }

    function onFromCountry(preferTz) { fillZones(fromC, fromZ, preferTz); whenEl.value = nowInZoneValue(fromZ.value); convert(); }

    fromC.addEventListener('change', () => onFromCountry());
    toC.addEventListener('change', () => { fillZones(toC, toZ); convert(); });
    fromZ.addEventListener('change', () => { whenEl.value = nowInZoneValue(fromZ.value); convert(); });
    toZ.addEventListener('change', convert);
    whenEl.addEventListener('input', convert);
    fmtEl.addEventListener('change', () => { convert(); tickClocks(); });
    $('tz-now').addEventListener('click', () => { whenEl.value = nowInZoneValue(fromZ.value); convert(); });
    $('tz-swap').addEventListener('click', () => {
      const fc = fromC.value, fz = fromZ.value, tc = toC.value, tzv = toZ.value;
      fromC.value = tc; fillZones(fromC, fromZ, tzv);
      toC.value = fc; fillZones(toC, toZ, fz);
      convert();
    });

    // starting values: ?from=PK&to=GB, otherwise the visitor's own zone and a sensible partner
    const qs = new URLSearchParams(location.search);
    let detected = null;
    try { detected = tzFindCountry(list, Intl.DateTimeFormat().resolvedOptions().timeZone); } catch (e) { detected = null; }
    const qFrom = (qs.get('from') || '').toUpperCase(), qTo = (qs.get('to') || '').toUpperCase();
    const startFrom = byCode(qFrom) ? qFrom : (detected ? detected.code : 'PK');
    let startTo = byCode(qTo) ? qTo : (startFrom === 'GB' ? 'US' : 'GB');
    fromC.value = startFrom;
    let preferFrom = null;
    if (!byCode(qFrom) && detected) preferFrom = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fillZones(fromC, fromZ, preferFrom);
    toC.value = startTo;
    fillZones(toC, toZ);
    whenEl.value = nowInZoneValue(fromZ.value);
    convert();

    // popular pair buttons
    document.querySelectorAll('[data-from][data-to]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      fromC.value = a.dataset.from; fillZones(fromC, fromZ);
      toC.value = a.dataset.to; fillZones(toC, toZ);
      whenEl.value = nowInZoneValue(fromZ.value);
      convert();
      $('tz-result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }));

    // live world clock
    const clocks = [
      ['Pakistan', 'Asia/Karachi'], ['India', 'Asia/Kolkata'], ['United Arab Emirates', 'Asia/Dubai'], ['Saudi Arabia', 'Asia/Riyadh'],
      ['United Kingdom', 'Europe/London'], ['Germany', 'Europe/Berlin'], ['Turkey', 'Europe/Istanbul'], ['USA (New York)', 'America/New_York'],
      ['USA (Los Angeles)', 'America/Los_Angeles'], ['Canada (Toronto)', 'America/Toronto'], ['China', 'Asia/Shanghai'], ['Australia (Sydney)', 'Australia/Sydney']
    ];
    const grid = $('tz-clocks');
    clocks.forEach(([name, tz], i) => {
      const d = document.createElement('div');
      d.className = 'nt-card';
      d.innerHTML = `<span class="nt-card-label"></span><span class="nt-card-value nt-mono" data-clock="${i}"></span><span class="nt-hint" data-clockoff="${i}"></span>`;
      d.firstChild.textContent = name;
      grid.appendChild(d);
    });
    function tickClocks() {
      const hour12 = fmtEl.value === '12';
      const now = Date.now();
      clocks.forEach(([name, tz], i) => {
        grid.querySelector(`[data-clock="${i}"]`).textContent = tzTimeOnly(now, tz, hour12, true);
        grid.querySelector(`[data-clockoff="${i}"]`).textContent = tzOffsetLabel(tzOffsetMinutes(tz, now));
      });
    }
    tickClocks();
    setInterval(tickClocks, 1000);
  });
}
