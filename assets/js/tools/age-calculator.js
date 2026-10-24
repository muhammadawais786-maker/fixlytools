// Fixlytools - Age Calculator
// All dates are handled as plain calendar dates (no time zones), so results are correct everywhere.

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

if (typeof module !== 'undefined') {
  module.exports = { acParseISODate, acTodayISO, acDaysBetween, acComputeAge };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const dobInput = document.getElementById('dob-input');
    const targetDateInput = document.getElementById('target-date-input');
    const calculateBtn = document.getElementById('calculate-btn');
    const resultContainer = document.getElementById('result-container');

    const yearsElem = document.getElementById('res-years');
    const monthsElem = document.getElementById('res-months');
    const daysElem = document.getElementById('res-days');
    const bornDayElem = document.getElementById('res-bornday');
    const nextBdayElem = document.getElementById('res-nextbday');

    const totalMonthsElem = document.getElementById('tot-months');
    const totalWeeksElem = document.getElementById('tot-weeks');
    const totalDaysElem = document.getElementById('tot-days');
    const totalHoursElem = document.getElementById('tot-hours');

    const today = acTodayISO();
    targetDateInput.value = today;
    dobInput.max = today;

    function calculateAge() {
      if (!dobInput.value) {
        showToast('Please select your Date of Birth.', 'warning');
        return;
      }
      const birthDate = acParseISODate(dobInput.value);
      const targetDate = acParseISODate(targetDateInput.value || today);

      if (!birthDate) {
        showToast('The Date of Birth is not a valid date.', 'error');
        return;
      }
      if (!targetDate) {
        showToast('The target date is not a valid date.', 'error');
        return;
      }
      if (birthDate > targetDate) {
        showToast('Date of birth cannot be after the target date.', 'error');
        return;
      }

      const r = acComputeAge(birthDate, targetDate);

      yearsElem.textContent = r.years;
      monthsElem.textContent = r.months;
      daysElem.textContent = r.days;
      bornDayElem.textContent = r.bornDay;
      nextBdayElem.textContent = r.daysToBirthday === 0 ? 'Today is the birthday!' : `${r.daysToBirthday} days away`;

      totalMonthsElem.textContent = r.totalMonths.toLocaleString();
      totalWeeksElem.textContent = r.totalWeeks.toLocaleString();
      totalDaysElem.textContent = r.totalDays.toLocaleString();
      totalHoursElem.textContent = r.totalHours.toLocaleString();

      resultContainer.classList.remove('hidden');
      resultContainer.scrollIntoView({ behavior: 'smooth' });
    }

    calculateBtn.addEventListener('click', calculateAge);
  });
}
