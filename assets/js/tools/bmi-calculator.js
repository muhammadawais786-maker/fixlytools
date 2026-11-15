// Fixlytools - BMI Calculator (adults). Uses the WHO cut-offs, with an option for the WHO Asia-Pacific cut-offs.

const BMI_STANDARD = [
  { max: 16, name: 'Severe thinness', tone: 'blue' },
  { max: 17, name: 'Moderate thinness', tone: 'blue' },
  { max: 18.5, name: 'Mild thinness', tone: 'blue' },
  { max: 25, name: 'Normal weight', tone: 'green' },
  { max: 30, name: 'Overweight', tone: 'amber' },
  { max: 35, name: 'Obesity class I', tone: 'red' },
  { max: 40, name: 'Obesity class II', tone: 'red' },
  { max: Infinity, name: 'Obesity class III', tone: 'red' }
];
// WHO Asia-Pacific: overweight from 23, obese from 27.5
const BMI_ASIAN = [
  { max: 16, name: 'Severe thinness', tone: 'blue' },
  { max: 17, name: 'Moderate thinness', tone: 'blue' },
  { max: 18.5, name: 'Mild thinness', tone: 'blue' },
  { max: 23, name: 'Normal weight', tone: 'green' },
  { max: 27.5, name: 'Overweight', tone: 'amber' },
  { max: Infinity, name: 'Obese', tone: 'red' }
];

function bmiCalc(heightCm, weightKg) {
  if (!(heightCm > 0) || !(weightKg > 0)) return NaN;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

function bmiCategory(bmi, asian) {
  const table = asian ? BMI_ASIAN : BMI_STANDARD;
  return table.find((c) => bmi < c.max);
}

// the weight range (kg) that keeps BMI in the normal band for this height
function bmiHealthyRange(heightCm, asian) {
  const m = heightCm / 100;
  const hi = asian ? 23 : 25;
  return { min: 18.5 * m * m, max: (hi - 0.1) * m * m };
}

if (typeof module !== 'undefined') {
  module.exports = { bmiCalc, bmiCategory, bmiHealthyRange };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    let unit = 'metric';

    function setUnit(u) {
      unit = u;
      $('bmi-metric').classList.toggle('nt-active', u === 'metric');
      $('bmi-imperial').classList.toggle('nt-active', u === 'imperial');
      $('metric-fields').classList.toggle('nt-hide', u !== 'metric');
      $('imperial-fields').classList.toggle('nt-hide', u !== 'imperial');
      $('bmi-result').classList.add('nt-hide');
    }
    $('bmi-metric').addEventListener('click', () => setUnit('metric'));
    $('bmi-imperial').addEventListener('click', () => setUnit('imperial'));

    function readInputs() {
      if (unit === 'metric') {
        return { h: parseFloat($('h-cm').value), w: parseFloat($('w-kg').value) };
      }
      const ft = parseFloat($('h-ft').value) || 0;
      const inch = parseFloat($('h-in').value) || 0;
      const lb = parseFloat($('w-lb').value);
      return { h: (ft * 12 + inch) * 2.54, w: lb * 0.45359237 };
    }

    const toneStyle = {
      blue: ['#dbeafe', '#1d4ed8'], green: ['#d1fae5', '#047857'], amber: ['#fef3c7', '#b45309'], red: ['#fee2e2', '#b91c1c']
    };

    function calculate() {
      const { h, w } = readInputs();
      if (!(h >= 50 && h <= 272) || !(w >= 2 && w <= 650)) {
        showToast('Please enter a realistic height and weight.', 'warning');
        return;
      }
      const asian = $('bmi-asian').checked;
      const bmi = bmiCalc(h, w);
      const cat = bmiCategory(bmi, asian);
      $('bmi-value').textContent = bmi.toFixed(1);
      const badge = $('bmi-cat');
      badge.textContent = cat.name;
      badge.style.background = toneStyle[cat.tone][0];
      badge.style.color = toneStyle[cat.tone][1];

      const range = bmiHealthyRange(h, asian);
      if (unit === 'metric') {
        $('bmi-range').textContent = `${range.min.toFixed(1)} kg to ${range.max.toFixed(1)} kg`;
      } else {
        $('bmi-range').textContent = `${(range.min / 0.45359237).toFixed(1)} lb to ${(range.max / 0.45359237).toFixed(1)} lb`;
      }
      const target = (asian ? 22.9 : 24.9) * Math.pow(h / 100, 2);
      let msg;
      if (bmi < 18.5) {
        const need = 18.5 * Math.pow(h / 100, 2) - w;
        msg = unit === 'metric' ? `About ${need.toFixed(1)} kg more would reach the normal range.` : `About ${(need / 0.45359237).toFixed(1)} lb more would reach the normal range.`;
      } else if (bmi >= (asian ? 23 : 25)) {
        const need = w - target;
        msg = unit === 'metric' ? `About ${need.toFixed(1)} kg less would reach the top of the normal range.` : `About ${(need / 0.45359237).toFixed(1)} lb less would reach the top of the normal range.`;
      } else {
        msg = 'Your weight is inside the normal range for your height.';
      }
      $('bmi-advice').textContent = msg;

      // pointer on the scale (BMI 12 to 42)
      const pct = Math.max(0, Math.min(100, (bmi - 12) / 30 * 100));
      $('bmi-pointer').style.left = pct + '%';
      $('bmi-result').classList.remove('nt-hide');
      $('bmi-result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    $('bmi-btn').addEventListener('click', calculate);
    document.querySelectorAll('#bmi-form input').forEach((el) => el.addEventListener('keydown', (e) => { if (e.key === 'Enter') calculate(); }));
  });
}
