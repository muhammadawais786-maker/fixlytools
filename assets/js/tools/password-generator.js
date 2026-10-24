// Fixlytools - Password Generator

const PW_UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const PW_LOWER = 'abcdefghijklmnopqrstuvwxyz';
const PW_NUMBERS = '0123456789';
const PW_SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';
const PW_AMBIGUOUS = /[il1Lo0O]/g;

// Unbiased random integer in [0, max) using rejection sampling on crypto random values
function pwRandomInt(max, cryptoObj) {
  const range = 0x100000000;
  const limit = range - (range % max);
  const buf = new Uint32Array(1);
  let x;
  do {
    cryptoObj.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return x % max;
}

// groups: array of character sets that are enabled. Guarantees at least one character from each group.
function pwGenerate(groups, length, cryptoObj) {
  const all = groups.join('');
  const chars = [];
  groups.forEach(g => chars.push(g[pwRandomInt(g.length, cryptoObj)]));
  while (chars.length < length) chars.push(all[pwRandomInt(all.length, cryptoObj)]);
  for (let i = chars.length - 1; i > 0; i--) {          // Fisher-Yates shuffle
    const j = pwRandomInt(i + 1, cryptoObj);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.slice(0, length).join('');
}

// 0 (very weak) .. 4 (very strong), from the estimated entropy of the character pool
function pwStrengthLevel(poolSize, length) {
  if (!poolSize || !length) return 0;
  const bits = length * Math.log2(poolSize);
  if (bits >= 100) return 4;
  if (bits >= 75) return 3;
  if (bits >= 55) return 2;
  if (bits >= 35) return 1;
  return 0;
}

if (typeof module !== 'undefined') {
  module.exports = { pwRandomInt, pwGenerate, pwStrengthLevel };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const passwordOutput = document.getElementById('password-output');
    const lengthSlider = document.getElementById('length-slider');
    const lengthValue = document.getElementById('length-value');
    const uppercaseCheck = document.getElementById('include-uppercase');
    const lowercaseCheck = document.getElementById('include-lowercase');
    const numbersCheck = document.getElementById('include-numbers');
    const symbolsCheck = document.getElementById('include-symbols');
    const excludeAmbiguousCheck = document.getElementById('exclude-ambiguous');
    const generateBtn = document.getElementById('generate-btn');
    const copyBtn = document.getElementById('copy-btn');
    const strengthMeter = document.getElementById('strength-meter');
    const strengthText = document.getElementById('strength-text');

    const LEVELS = [
      { label: 'Very Weak', color: 'bg-rose-500', width: '20%' },
      { label: 'Weak', color: 'bg-orange-500', width: '40%' },
      { label: 'Moderate', color: 'bg-amber-500', width: '60%' },
      { label: 'Strong', color: 'bg-teal-500', width: '80%' },
      { label: 'Very Strong', color: 'bg-emerald-500', width: '100%' }
    ];
    let hasPassword = false;

    function updateStrength(level) {
      const l = LEVELS[level];
      strengthMeter.className = `h-2 rounded-full transition-all duration-300 ${l.color}`;
      strengthMeter.style.width = l.width;
      strengthText.textContent = l.label;
    }

    function generatePassword() {
      const groups = [];
      if (uppercaseCheck.checked) groups.push(PW_UPPER);
      if (lowercaseCheck.checked) groups.push(PW_LOWER);
      if (numbersCheck.checked) groups.push(PW_NUMBERS);
      if (symbolsCheck.checked) groups.push(PW_SYMBOLS);

      const usable = groups
        .map(g => excludeAmbiguousCheck.checked ? g.replace(PW_AMBIGUOUS, '') : g)
        .filter(g => g.length > 0);

      if (usable.length === 0) {
        passwordOutput.value = 'Please select at least one character type';
        hasPassword = false;
        updateStrength(0);
        return;
      }

      const length = parseInt(lengthSlider.value, 10);
      passwordOutput.value = pwGenerate(usable, length, window.crypto);
      hasPassword = true;
      updateStrength(pwStrengthLevel(usable.join('').length, length));
    }

    lengthSlider.addEventListener('input', () => {
      lengthValue.textContent = lengthSlider.value;
      generatePassword();
    });

    [uppercaseCheck, lowercaseCheck, numbersCheck, symbolsCheck, excludeAmbiguousCheck].forEach(elem => {
      elem.addEventListener('change', generatePassword);
    });

    generateBtn.addEventListener('click', generatePassword);

    copyBtn.addEventListener('click', () => {
      if (!hasPassword) return;
      copyText(passwordOutput.value)
        .then(() => showToast('Password copied to clipboard!', 'success'))
        .catch(() => showToast('Could not copy. Please select the password and copy it manually.', 'error'));
    });

    generatePassword();
  });
}
