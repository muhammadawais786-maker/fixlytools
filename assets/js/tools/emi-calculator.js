// Fixlytools - EMI & Loan Calculator
document.addEventListener('DOMContentLoaded', () => {
  const loanAmountInput = document.getElementById('loan-amount');
  const interestRateInput = document.getElementById('interest-rate');
  const tenureInput = document.getElementById('loan-tenure');
  const tenureType = document.getElementById('tenure-type'); // 'years' or 'months'
  const calculateBtn = document.getElementById('calculate-btn');

  const emiOutput = document.getElementById('emi-output');
  const totalInterestOutput = document.getElementById('total-interest-output');
  const totalPaymentOutput = document.getElementById('total-payment-output');

  const principalBar = document.getElementById('principal-bar');
  const interestBar = document.getElementById('interest-bar');
  const principalPctText = document.getElementById('principal-pct');
  const interestPctText = document.getElementById('interest-pct');

  function calculateEMI() {
    const P = parseFloat(loanAmountInput.value) || 0;
    const annualRate = parseFloat(interestRateInput.value) || 0;
    let tenure = parseInt(tenureInput.value, 10) || 0;

    if (P <= 0 || annualRate <= 0 || tenure <= 0) {
      showToast('Please enter valid positive numbers for all loan fields.', 'warning');
      return;
    }

    const n = tenureType.value === 'years' ? tenure * 12 : tenure;
    const r = (annualRate / 12) / 100;

    // Formula: E = P * r * (1 + r)^n / ((1 + r)^n - 1)
    const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const totalPayment = emi * n;
    const totalInterest = totalPayment - P;

    const principalPct = Math.round((P / totalPayment) * 100);
    const interestPct = 100 - principalPct;

    // Update UI
    emiOutput.textContent = formatCurrency(emi);
    totalInterestOutput.textContent = formatCurrency(totalInterest);
    totalPaymentOutput.textContent = formatCurrency(totalPayment);

    principalBar.style.width = `${principalPct}%`;
    interestBar.style.width = `${interestPct}%`;

    principalPctText.textContent = `${principalPct}%`;
    interestPctText.textContent = `${interestPct}%`;
  }

  function formatCurrency(num) {
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  [loanAmountInput, interestRateInput, tenureInput, tenureType].forEach(elem => {
    elem.addEventListener('input', calculateEMI);
  });

  calculateBtn.addEventListener('click', calculateEMI);

  // Initial calculation
  calculateEMI();
});
