// Fixlytools - Age Calculator and Date Difference Calculator
// Dates are handled as plain calendar dates (no time zones) so results are correct everywhere.
// The "seconds lived" figures use the visitor's local clock.

function acParseISODate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt;
}

function acTodayISO() {
  const n = new Date();
  const pad = (v) => String(v).padStart(2, '0');
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}

// whole days between two calendar dates, immune to daylight-saving shifts
function acDaysBetween(a, b) {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86400000);
}

function acComputeAge(birth, target) {
  let years = target.getFullYear() - birth.getFullYear();
  let months = target.getMonth() - birth.getMonth();
  let days = target.getDate() - birth.getDate();

  if (days < 0) {
    months--;
    const prevMonthLastDay = new Date(target.getFullYear(), target.getMonth(), 0).getDate();
    days += prevMonthLastDay;
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  let nextBday = new Date(target.getFullYear(), birth.getMonth(), birth.getDate());
  if (nextBday < target) {
    nextBday = new Date(target.getFullYear() + 1, birth.getMonth(), birth.getDate());
  }

  const totalDays = acDaysBetween(birth, target);
  return {
    years, months, days,
    bornDay: dayNames[birth.getDay()],
    daysToBirthday: acDaysBetween(target, nextBday),
    totalMonths: years * 12 + months,
    totalWeeks: Math.floor(totalDays / 7),
    totalDays,
    totalHours: totalDays * 24
  };
}

// "HH:MM" -> {h, m}; empty or invalid -> midnight
function acParseTime(value) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value || '');
  if (!m) return { h: 0, m: 0 };
  const h = +m[1], mi = +m[2];
  if (h > 23 || mi > 59) return { h: 0, m: 0 };
  return { h, m: mi };
}

// The moment of birth as a local Date
function acBirthMoment(birth, timeValue) {
  const t = acParseTime(timeValue);
  return new Date(birth.getFullYear(), birth.getMonth(), birth.getDate(), t.h, t.m, 0, 0);
}

// Elapsed time between two moments, broken down into totals
function acElapsed(fromMs, toMs) {
  const diff = Math.max(0, toMs - fromMs);
  const totalSeconds = Math.floor(diff / 1000);
  return {
    totalSeconds,
    totalMinutes: Math.floor(totalSeconds / 60),
    totalHours: Math.floor(totalSeconds / 3600),
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60
  };
}

// Difference between two calendar dates (order does not matter)
function acDateDiff(a, b, includeEnd) {
  let reversed = false;
  let from = a, to = b;
  if (a > b) { from = b; to = a; reversed = true; }
  const r = acComputeAge(from, to);
  const totalDays = r.totalDays + (includeEnd ? 1 : 0);
  return {
    reversed,
    years: r.years, months: r.months, days: r.days,
    totalMonths: r.totalMonths,
    totalDays,
    weeks: Math.floor(totalDays / 7),
    remDays: totalDays % 7,
    totalHours: totalDays * 24,
    totalMinutes: totalDays * 1440,
    totalSeconds: totalDays * 86400
  };
}

// Number of Monday-Friday days from a up to b (b not counted unless includeEnd)
function acBusinessDays(a, b, includeEnd) {
  let from = a, to = b;
  if (a > b) { from = b; to = a; }
  let count = 0;
  const cur = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  while (cur < end) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  if (includeEnd) {
    const d = end.getDay();
    if (d !== 0 && d !== 6) count++;
  }
  return count;
}

// Add or subtract days, weeks, months or years. Month and year steps keep the day of the month when
// possible and otherwise stop at the last day of the target month (31 Jan + 1 month = 28/29 Feb).
function acAddToDate(date, amount, unit, sign) {
  const n = Math.trunc(amount) * (sign < 0 ? -1 : 1);
  if (unit === 'days' || unit === 'weeks') {
    const out = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    out.setDate(out.getDate() + (unit === 'weeks' ? n * 7 : n));
    return out;
  }
  const monthsToAdd = unit === 'years' ? n * 12 : n;
  const first = new Date(date.getFullYear(), date.getMonth() + monthsToAdd, 1);
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(date.getDate(), lastDay));
}

if (typeof module !== 'undefined') {
  module.exports = {
    acParseISODate, acTodayISO, acDaysBetween, acComputeAge,
    acParseTime, acBirthMoment, acElapsed, acDateDiff, acBusinessDays, acAddToDate
  };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    const fmt = (n) => Number(n).toLocaleString('en-US');
    const longDate = (d) => d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // ---------- tabs ----------
    const tabs = { age: $('tab-age'), diff: $('tab-diff') };
    const panels = { age: $('panel-age'), diff: $('panel-diff') };
    function showTab(name) {
      Object.keys(tabs).forEach((k) => {
        const on = k === name;
        tabs[k].classList.toggle('nt-active', on);
        tabs[k].setAttribute('aria-selected', on ? 'true' : 'false');
        panels[k].classList.toggle('nt-hide', !on);
      });
    }
    tabs.age.addEventListener('click', () => showTab('age'));
    tabs.diff.addEventListener('click', () => showTab('diff'));
    if (location.hash === '#date-difference') showTab('diff');

    const today = acTodayISO();

    // ---------- Age tab ----------
    const dobInput = $('dob-input');
    const dobTime = $('dob-time');
    const targetDateInput = $('target-date-input');
    const resultContainer = $('result-container');
    targetDateInput.value = today;
    dobInput.max = today;

    let liveTimer = null;
    function stopLive() { if (liveTimer) { clearInterval(liveTimer); liveTimer = null; } }

    function paintElapsed(e) {
      $('live-seconds').textContent = fmt(e.totalSeconds);
      $('live-breakdown').textContent = `${fmt(e.days)} days, ${e.hours} hours, ${e.minutes} minutes, ${e.seconds} seconds`;
      $('tot-hours').textContent = fmt(e.totalHours);
      $('tot-minutes').textContent = fmt(e.totalMinutes);
      $('tot-seconds').textContent = fmt(e.totalSeconds);
    }

    function calculateAge() {
      stopLive();
      if (!dobInput.value) {
        showToast('Please select your Date of Birth.', 'warning');
        return;
      }
      const birthDate = acParseISODate(dobInput.value);
      const targetDate = acParseISODate(targetDateInput.value || today);
      if (!birthDate) { showToast('The Date of Birth is not a valid date.', 'error'); return; }
      if (!targetDate) { showToast('The target date is not a valid date.', 'error'); return; }
      if (birthDate > targetDate) { showToast('Date of birth cannot be after the target date.', 'error'); return; }

      const r = acComputeAge(birthDate, targetDate);
      $('res-years').textContent = r.years;
      $('res-months').textContent = r.months;
      $('res-days').textContent = r.days;
      $('res-bornday').textContent = r.bornDay;
      $('res-nextbday').textContent = r.daysToBirthday === 0 ? 'Today is the birthday!' : `${r.daysToBirthday} days away`;
      $('tot-months').textContent = fmt(r.totalMonths);
      $('tot-weeks').textContent = fmt(r.totalWeeks);
      $('tot-days').textContent = fmt(r.totalDays);

      const birthMs = acBirthMoment(birthDate, dobTime.value).getTime();
      const isToday = acTodayISO() === targetDateInput.value;
      const liveNote = $('live-note');
      if (isToday) {
        paintElapsed(acElapsed(birthMs, Date.now()));
        liveTimer = setInterval(() => paintElapsed(acElapsed(birthMs, Date.now())), 1000);
        liveNote.textContent = 'Live: this counter updates every second.';
      } else {
        const t = acParseISODate(targetDateInput.value);
        paintElapsed(acElapsed(birthMs, t.getTime()));
        liveNote.textContent = 'Shown as of midnight on the chosen date. Set the date to today for the live counter.';
      }

      resultContainer.classList.remove('nt-hide');
      resultContainer.scrollIntoView({ behavior: 'smooth' });
    }
    $('calculate-btn').addEventListener('click', calculateAge);

    // ---------- Date Difference tab ----------
    const startInput = $('diff-start');
    const endInput = $('diff-end');
    startInput.value = today;
    endInput.value = today;

    function calculateDiff() {
      const a = acParseISODate(startInput.value);
      const b = acParseISODate(endInput.value);
      if (!a || !b) { showToast('Please choose both dates.', 'warning'); return; }
      const include = $('diff-include').checked;
      const d = acDateDiff(a, b, include);
      const bd = acBusinessDays(a, b, include);
      $('diff-main').textContent = `${d.years} years, ${d.months} months, ${d.days} days`;
      $('diff-sub').textContent = d.reversed ? 'The end date is earlier than the start date, so the dates were swapped.' : 'Between the two dates';
      $('diff-days').textContent = fmt(d.totalDays);
      $('diff-weeks').textContent = `${fmt(d.weeks)} weeks, ${d.remDays} days`;
      $('diff-months').textContent = fmt(d.totalMonths);
      $('diff-business').textContent = fmt(bd);
      $('diff-hours').textContent = fmt(d.totalHours);
      $('diff-minutes').textContent = fmt(d.totalMinutes);
      $('diff-seconds').textContent = fmt(d.totalSeconds);
      $('diff-result').classList.remove('nt-hide');
    }
    $('diff-btn').addEventListener('click', calculateDiff);

    // ---------- Add / subtract ----------
    const addBase = $('add-base');
    addBase.value = today;
    function calculateAdd() {
      const base = acParseISODate(addBase.value);
      const amount = parseFloat($('add-amount').value);
      if (!base) { showToast('Please choose a start date.', 'warning'); return; }
      if (!isFinite(amount) || amount < 0 || amount > 100000) { showToast('Enter a number between 0 and 100000.', 'warning'); return; }
      const sign = $('add-op').value === 'sub' ? -1 : 1;
      const out = acAddToDate(base, amount, $('add-unit').value, sign);
      $('add-result-date').textContent = longDate(out);
      $('add-result').classList.remove('nt-hide');
    }
    $('add-btn').addEventListener('click', calculateAdd);
  });
}
