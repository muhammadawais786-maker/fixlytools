// Fixlytools - Unit Converter. Every unit stores its size in a base unit (factor); temperature is handled separately.

const UC_DATA = {
  length: { label: 'Length', icon: 'fa-ruler', base: 'm', units: [
    ['mm', 'Millimeter (mm)', 0.001], ['cm', 'Centimeter (cm)', 0.01], ['m', 'Meter (m)', 1], ['km', 'Kilometer (km)', 1000],
    ['in', 'Inch (in)', 0.0254], ['ft', 'Foot (ft)', 0.3048], ['yd', 'Yard (yd)', 0.9144], ['mi', 'Mile (mi)', 1609.344], ['nmi', 'Nautical mile', 1852]] },
  mass: { label: 'Weight', icon: 'fa-weight-hanging', base: 'kg', units: [
    ['mg', 'Milligram (mg)', 0.000001], ['g', 'Gram (g)', 0.001], ['kg', 'Kilogram (kg)', 1], ['t', 'Metric tonne (t)', 1000],
    ['oz', 'Ounce (oz)', 0.028349523125], ['lb', 'Pound (lb)', 0.45359237], ['st', 'Stone (st)', 6.35029318], ['tola', 'Tola', 0.0116638038]] },
  temperature: { label: 'Temperature', icon: 'fa-temperature-half', base: 'C', units: [['C', 'Celsius (°C)'], ['F', 'Fahrenheit (°F)'], ['K', 'Kelvin (K)']] },
  area: { label: 'Area', icon: 'fa-vector-square', base: 'm2', units: [
    ['cm2', 'Square centimeter', 0.0001], ['m2', 'Square meter (m²)', 1], ['km2', 'Square kilometer (km²)', 1000000],
    ['in2', 'Square inch', 0.00064516], ['ft2', 'Square foot (sq ft)', 0.09290304], ['yd2', 'Square yard', 0.83612736],
    ['ac', 'Acre', 4046.8564224], ['ha', 'Hectare (ha)', 10000], ['mi2', 'Square mile', 2589988.110336],
    ['marla', 'Marla (272.25 sq ft)', 25.2928526], ['kanal', 'Kanal (20 marla)', 505.857052]] },
  volume: { label: 'Volume', icon: 'fa-flask', base: 'L', units: [
    ['ml', 'Milliliter (mL)', 0.001], ['L', 'Liter (L)', 1], ['m3', 'Cubic meter (m³)', 1000],
    ['tsp', 'Teaspoon (US)', 0.00492892159375], ['tbsp', 'Tablespoon (US)', 0.01478676478125], ['floz', 'Fluid ounce (US)', 0.0295735295625],
    ['cup', 'Cup (US)', 0.2365882365], ['pt', 'Pint (US)', 0.473176473], ['qt', 'Quart (US)', 0.946352946], ['gal', 'Gallon (US)', 3.785411784], ['galuk', 'Gallon (UK)', 4.54609]] },
  speed: { label: 'Speed', icon: 'fa-gauge-high', base: 'ms', units: [
    ['ms', 'Meters per second (m/s)', 1], ['kmh', 'Kilometers per hour (km/h)', 1 / 3.6], ['mph', 'Miles per hour (mph)', 0.44704],
    ['kn', 'Knot', 1852 / 3600], ['fts', 'Feet per second (ft/s)', 0.3048], ['mach', 'Mach (at sea level)', 340.29]] },
  time: { label: 'Time', icon: 'fa-clock', base: 's', units: [
    ['msec', 'Millisecond (ms)', 0.001], ['s', 'Second (s)', 1], ['min', 'Minute (min)', 60], ['h', 'Hour (h)', 3600],
    ['d', 'Day', 86400], ['wk', 'Week', 604800], ['mo', 'Month (30.44 days)', 2629746], ['yr', 'Year (365.24 days)', 31556952]] },
  data: { label: 'Data', icon: 'fa-hard-drive', base: 'B', units: [
    ['bit', 'Bit', 0.125], ['B', 'Byte (B)', 1], ['KB', 'Kilobyte (KB = 1000 B)', 1e3], ['MB', 'Megabyte (MB = 1000 KB)', 1e6],
    ['GB', 'Gigabyte (GB)', 1e9], ['TB', 'Terabyte (TB)', 1e12], ['KiB', 'Kibibyte (KiB = 1024 B)', 1024], ['MiB', 'Mebibyte (MiB)', 1048576],
    ['GiB', 'Gibibyte (GiB)', 1073741824], ['TiB', 'Tebibyte (TiB)', 1099511627776]] },
  pressure: { label: 'Pressure', icon: 'fa-gauge', base: 'Pa', units: [
    ['Pa', 'Pascal (Pa)', 1], ['kPa', 'Kilopascal (kPa)', 1000], ['bar', 'Bar', 100000], ['psi', 'PSI', 6894.757293168],
    ['atm', 'Atmosphere (atm)', 101325], ['mmHg', 'mmHg', 133.322387415]] },
  energy: { label: 'Energy', icon: 'fa-bolt', base: 'J', units: [
    ['J', 'Joule (J)', 1], ['kJ', 'Kilojoule (kJ)', 1000], ['cal', 'Calorie (cal)', 4.184], ['kcal', 'Kilocalorie (kcal)', 4184],
    ['Wh', 'Watt-hour (Wh)', 3600], ['kWh', 'Kilowatt-hour (kWh)', 3600000], ['BTU', 'BTU', 1055.05585262]] }
};

function ucToCelsius(v, u) { return u === 'F' ? (v - 32) * 5 / 9 : u === 'K' ? v - 273.15 : v; }
function ucFromCelsius(c, u) { return u === 'F' ? c * 9 / 5 + 32 : u === 'K' ? c + 273.15 : c; }

function ucConvert(cat, value, from, to) {
  const data = UC_DATA[cat];
  if (!data) return NaN;
  if (cat === 'temperature') return ucFromCelsius(ucToCelsius(value, from), to);
  const f = data.units.find((u) => u[0] === from);
  const t = data.units.find((u) => u[0] === to);
  if (!f || !t) return NaN;
  return value * f[2] / t[2];
}

if (typeof module !== 'undefined') {
  module.exports = { UC_DATA, ucConvert };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    const tabsEl = $('uc-cats');
    const valueEl = $('uc-value');
    const fromEl = $('uc-from');
    const toEl = $('uc-to');
    const resultEl = $('uc-result');
    const eqEl = $('uc-eq');
    const tableBody = $('uc-table');
    let cat = 'length';

    const defaults = {
      length: ['km', 'mi'], mass: ['kg', 'lb'], temperature: ['C', 'F'], area: ['ft2', 'm2'], volume: ['L', 'gal'],
      speed: ['kmh', 'mph'], time: ['h', 'min'], data: ['GB', 'MB'], pressure: ['psi', 'bar'], energy: ['kcal', 'kJ']
    };

    Object.keys(UC_DATA).forEach((key) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'nt-chip';
      b.dataset.cat = key;
      b.innerHTML = `<i class="fa-solid ${UC_DATA[key].icon}" style="margin-right:6px"></i>${UC_DATA[key].label}`;
      b.addEventListener('click', () => setCat(key));
      tabsEl.appendChild(b);
    });

    function fillSelect(sel, units, chosen) {
      sel.innerHTML = '';
      units.forEach((u) => {
        const o = document.createElement('option');
        o.value = u[0];
        o.textContent = u[1];
        sel.appendChild(o);
      });
      sel.value = chosen;
    }

    function setCat(key) {
      cat = key;
      Array.from(tabsEl.children).forEach((b) => {
        const on = b.dataset.cat === key;
        b.style.background = on ? '#2563eb' : '';
        b.style.color = on ? '#ffffff' : '';
        b.style.borderColor = on ? '#2563eb' : '';
      });
      fillSelect(fromEl, UC_DATA[key].units, defaults[key][0]);
      fillSelect(toEl, UC_DATA[key].units, defaults[key][1]);
      update();
    }

    function update() {
      const v = parseFloat(valueEl.value);
      const units = UC_DATA[cat].units;
      tableBody.innerHTML = '';
      if (!isFinite(v)) {
        resultEl.textContent = '-';
        eqEl.textContent = 'Enter a number to convert.';
        return;
      }
      const r = ucConvert(cat, v, fromEl.value, toEl.value);
      const fu = units.find((u) => u[0] === fromEl.value)[1];
      const tu = units.find((u) => u[0] === toEl.value)[1];
      resultEl.textContent = ntFormatNumber(r, 10);
      eqEl.textContent = `${ntFormatNumber(v, 10)} ${fu} = ${ntFormatNumber(r, 10)} ${tu}`;
      units.forEach((u) => {
        const tr = document.createElement('tr');
        const td1 = document.createElement('td');
        const td2 = document.createElement('td');
        td1.textContent = u[1];
        td2.textContent = ntFormatNumber(ucConvert(cat, v, fromEl.value, u[0]), 10);
        td2.className = 'nt-mono';
        tr.appendChild(td1);
        tr.appendChild(td2);
        tableBody.appendChild(tr);
      });
    }

    valueEl.addEventListener('input', update);
    fromEl.addEventListener('change', update);
    toEl.addEventListener('change', update);
    $('uc-swap').addEventListener('click', () => {
      const a = fromEl.value;
      fromEl.value = toEl.value;
      toEl.value = a;
      update();
    });
    $('uc-copy').addEventListener('click', () => ntCopyWithToast(resultEl.textContent === '-' ? '' : resultEl.textContent.replace(/,/g, ''), 'Result copied.'));
    setCat('length');
  });
}
