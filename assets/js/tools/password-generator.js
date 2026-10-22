// Fixlytools - Password Generator
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

  const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const LOWER = 'abcdefghijklmnopqrstuvwxyz';
  const NUMBERS = '0123456789';
  const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const AMBIGUOUS = /[il1Lo0O]/g;

  function generatePassword() {
    let charset = '';
    if (uppercaseCheck.checked) charset += UPPER;
    if (lowercaseCheck.checked) charset += LOWER;
    if (numbersCheck.checked) charset += NUMBERS;
    if (symbolsCheck.checked) charset += SYMBOLS;

    if (excludeAmbiguousCheck.checked) {
      charset = charset.replace(AMBIGUOUS, '');
    }

    if (!charset) {
      passwordOutput.value = 'Please select at least one character type';
      updateStrength(0);
      return;
    }

    const length = parseInt(lengthSlider.value, 10);
    const randomValues = new Uint32Array(length);
    window.crypto.getRandomValues(randomValues);

    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset[randomValues[i] % charset.length];
    }

    passwordOutput.value = password;
    calculateStrength(password);
  }

  function calculateStrength(password) {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 14) score += 1;
    if (password.length >= 20) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    updateStrength(score);
  }

  function updateStrength(score) {
    let label = 'Very Weak';
    let color = 'bg-rose-500';
    let width = '20%';

    if (score >= 5) {
      label = 'Very Strong';
      color = 'bg-emerald-500';
      width = '100%';
    } else if (score >= 4) {
      label = 'Strong';
      color = 'bg-teal-500';
      width = '80%';
    } else if (score >= 3) {
      label = 'Moderate';
      color = 'bg-amber-500';
      width = '60%';
    } else if (score >= 2) {
      label = 'Weak';
      color = 'bg-orange-500';
      width = '40%';
    }

    strengthMeter.className = `h-2 rounded-full transition-all duration-300 ${color}`;
    strengthMeter.style.width = width;
    strengthText.textContent = label;
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
    if (!passwordOutput.value || passwordOutput.value.includes('Please select')) return;
    navigator.clipboard.writeText(passwordOutput.value).then(() => {
      showToast('Password copied to clipboard!', 'success');
    });
  });

  // Initial generation
  generatePassword();
});
