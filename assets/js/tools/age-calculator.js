// Fixlytools - Age Calculator
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

  // Set default target date to today
  const today = new Date().toISOString().split('T')[0];
  targetDateInput.value = today;

  function calculateAge() {
    const dobVal = dobInput.value;
    const targetVal = targetDateInput.value;

    if (!dobVal) {
      showToast('Please select your Date of Birth.', 'warning');
      return;
    }

    const birthDate = new Date(dobVal);
    const targetDate = new Date(targetVal);

    if (birthDate > targetDate) {
      showToast('Date of birth cannot be in the future relative to the target date.', 'error');
      return;
    }

    // Exact years, months, days
    let years = targetDate.getFullYear() - birthDate.getFullYear();
    let months = targetDate.getMonth() - birthDate.getMonth();
    let days = targetDate.getDate() - birthDate.getDate();

    if (days < 0) {
      months--;
      // Days in previous month
      const prevMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 0);
      days += prevMonth.getDate();
    }

    if (months < 0) {
      years--;
      months += 12;
    }

    // Day of the week
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const bornDay = daysOfWeek[birthDate.getDay()];

    // Next Birthday calculation
    const currentYear = targetDate.getFullYear();
    let nextBday = new Date(currentYear, birthDate.getMonth(), birthDate.getDate());
    if (nextBday < targetDate) {
      nextBday = new Date(currentYear + 1, birthDate.getMonth(), birthDate.getDate());
    }
    const diffTime = Math.abs(nextBday - targetDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Total metrics
    const totalDiffTime = Math.abs(targetDate - birthDate);
    const totDays = Math.floor(totalDiffTime / (1000 * 60 * 60 * 24));
    const totWeeks = Math.floor(totDays / 7);
    const totMonths = (years * 12) + months;
    const totHours = totDays * 24;

    // Display
    yearsElem.textContent = years;
    monthsElem.textContent = months;
    daysElem.textContent = days;
    bornDayElem.textContent = bornDay;
    nextBdayElem.textContent = `${diffDays} days away`;

    totalMonthsElem.textContent = totMonths.toLocaleString();
    totalWeeksElem.textContent = totWeeks.toLocaleString();
    totalDaysElem.textContent = totDays.toLocaleString();
    totalHoursElem.textContent = totHours.toLocaleString();

    resultContainer.classList.remove('hidden');
    resultContainer.scrollIntoView({ behavior: 'smooth' });
  }

  calculateBtn.addEventListener('click', calculateAge);
});
