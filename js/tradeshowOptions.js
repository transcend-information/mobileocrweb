const tradeshowOptions = [
  { value: 'initOptionSelect', label: '-- Select Tradeshow --' },
  { value: 'Computex2026', label: 'Computex 2026' },
  { value: 'SPSItalia2026', label: 'SPS Italia 2026' },
  { value: 'Mobco2026', label: 'Mobco 2026' },
  { value: 'HardwarePioneersMax2026', label: 'Hardware Pioneers Max 2026' },
  { value: 'Interop2026', label: 'Interop 2026' },
  { value: 'SCIIF2026', label: 'SCIIF 2026' },
  { value: 'AutomationXperience2026', label: 'Automation Xperience 2026' },
  { value: 'Automate2026', label: 'Automate 2026' },
  { value: 'VisionChina2026', label: 'Vision China 2026' },
  { value: 'EdgeTechWest2026', label: 'EdgeTech+ West 2026' },
  { value: 'WAIC2026', label: 'WAIC 2026' },
  { value: 'FMS2026', label: 'FMS 2026' },
  { value: 'AutomationTaipei2026', label: 'Automation Taipei 2026' },
  { value: 'AGICIOTE2026', label: '2026 AGIC & IOTE' },
  { value: 'AllAboutAutomation2026', label: 'All about Automation 2026' },
];

function populateTradeshowSelect(selectId = 'tradeshowSelect') {
  const select = document.getElementById(selectId);
  if (!select) return;

  select.innerHTML = '';

  tradeshowOptions.forEach(({ value, label }) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => populateTradeshowSelect());
} else {
  populateTradeshowSelect();
}

window.tradeshowOptions = tradeshowOptions;
window.populateTradeshowSelect = populateTradeshowSelect;
