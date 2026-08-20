const tradeshowOptions = [
  { value: 'initOptionSelect', label: '-- Select Tradeshow --' },
  { value: 'AutomationTaipei2026', label: 'TW - Automation Taipei 2026' },
  { value: 'AGICIOTE2026', label: 'SZ - 2026 AGIC & IOTE' },
  { value: 'AllAboutAutomation2026', label: 'GM - 2026 All about Automation' },
  { value: 'GSXGlobalSecurityExchange2026', label: 'US - 2026 GSX Global Security Exchange' },
  { value: 'SIDO2026', label: 'NL - 2026 SIDO' },
  { value: 'WoTS2026', label: 'NL - 2026 WoTS' },
  { value: 'G2E2026', label: 'US - 2026 G2E' },
  { value: 'RisconTokyo2026', label: 'JP - Riscon Tokyo 2026' },
  { value: 'CMEF2026', label: 'SZ - CMEF 2026' },
  { value: 'CIIF2026', label: 'SH - CIIF 2026' },
  { value: 'EnergyTaiwan2026', label: 'TW - Energy Taiwan 2026' },
  { value: 'SecurityChin2026', label: 'BJ - Security Chin 2026' },
  { value: 'AdvancedEngineering2026', label: 'UK - 2026 Advanced Engineering (AES)' },
  { value: 'EmbeddedWorldNorthAmerica2026', label: 'US - Embedded World North America 2026' },
  { value: 'RobotWorld2026', label: 'KR - ROBOT WORLD 2026' },
  { value: 'Electronica2026', label: 'GM - Electronica 2026' },
  { value: 'Supercomputing2026', label: 'US - Supercomputing 2026' },
  { value: 'EdgeTechPlus2026', label: 'JP - EdgeTech+ 2026' },
  { value: 'SPS2026', label: 'GM - SPS 2026' },
  { value: 'Others', label: 'Others' }
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
