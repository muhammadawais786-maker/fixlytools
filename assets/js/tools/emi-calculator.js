// Fixlytools - EMI & Loan Calculator

// P = principal, annualRate in %, n = number of monthly instalments. Handles 0% interest.
function emiCalculate(P, annualRate, n) {
  if (!(P > 0) || !(annualRate >= 0) || !(n > 0)) return null;
  const r = annualRate / 12 / 100;
  const emi = r === 0
    ? P / n
    : (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  if (!isFinite(emi)) return null;
  const totalPayment = emi * n;
  const totalInterest = totalPayment - P;
  const principalPct = Math.round((P / totalPayment) * 100);
  return { emi, totalPayment, totalInterest, principalPct, interestPct: 100 - principalPct };
}

function emiFormat(num) {
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

if (typeof module !== 'undefined') {
  module.exports = { emiCalculate, emiFormat };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const loanAmountInput = document.getElementById('loan-amount');
    const interestRateInput = document.getElementById('interest-rate');
    const tenureInput = document.getElementById('loan-tenure');
    const tenureType = document.getElementById('tenure-type');
    const calculateBtn = document.getElementById('calculate-btn');

    const emiOutput = document.getElementById('emi-output');
    const totalInterestOutput = document.getElementById('total-interest-output');
    const totalPaymentOutput = document.getElementById('total-payment-output');

    const principalBar = document.getElementById('principal-bar');
    const interestBar = document.getElementById('interest-bar');
    const principalPctText = document.getElementById('principal-pct');
    const interestPctText = document.getElementById('interest-pct');

    function clearOutputs() {
      emiOutput.textContent = '0.00';
      totalInterestOutput.textContent = '0.00';
      totalPaymentOutput.textContent = '0.00';
      principalPctText.textContent = '0%';
      interestPctText.textContent = '0%';
    }

    // fromButton = true shows a message when the numbers are not valid; while typing we stay quiet
    function calculateEMI(fromButton) {
      const P = parseFloat(loanAmountInput.value);
      const rate = parseFloat(interestRateInput.value);
      const tenure = parseFloat(tenureInput.value);
      const n = tenureType.value === 'years' ? Math.round(tenure * 12) : Math.round(tenure);

      const result = emiCalculate(P, rate, n);
      if (!result || n > 1200) {
        clearOutputs();
        if (fromButton === true) {
          showToast('Please enter a loan amount above 0, an interest rate of 0 or more, and a tenure above 0 (maximum 100 years).', 'warning');
        }
        return;
      }

      emiOutput.textContent = emiFormat(result.emi);
      totalInterestOutput.textContent = emiFormat(result.totalInterest);
      totalPaymentOutput.textContent = emiFormat(result.totalPayment);

      principalBar.style.width = `${result.principalPct}%`;
      interestBar.style.width = `${result.interestPct}%`;
      principalPctText.textContent = `${result.principalPct}%`;
      interestPctText.textContent = `${result.interestPct}%`;
    }

    [loanAmountInput, interestRateInput, tenureInput, tenureType].forEach(elem => {
      elem.addEventListener('input', () => calculateEMI(false));
    });
    calculateBtn.addEventListener('click', () => calculateEMI(true));

    calculateEMI(false);
  });
}
