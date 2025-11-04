const SETTINGS_STORAGE_KEY = 'geminiAutoscrollSettings';
const DEFAULT_SETTINGS = {
  autoScroll: true,
  autoSave: true,
};

const autoScrollCheckbox = document.getElementById('auto-scroll');
const autoSaveCheckbox = document.getElementById('auto-save');
const resetButton = document.getElementById('reset-defaults');
const statusLabel = document.getElementById('status-label');

let statusTimeoutId = null;
let currentSettings = { ...DEFAULT_SETTINGS };

init();

function init() {
  if (!autoScrollCheckbox || !autoSaveCheckbox || !resetButton || !statusLabel) {
    console.warn('Options page is missing required DOM nodes.');
    return;
  }

  autoScrollCheckbox.addEventListener('change', handleToggleChange);
  autoSaveCheckbox.addEventListener('change', handleToggleChange);
  resetButton.addEventListener('click', handleResetDefaults);

  loadSettings();
}

function loadSettings() {
  if (!chrome?.storage?.local) {
    applySettings(DEFAULT_SETTINGS);
    return;
  }

  chrome.storage.local.get({ [SETTINGS_STORAGE_KEY]: DEFAULT_SETTINGS }, (result) => {
    if (chrome.runtime && chrome.runtime.lastError) {
      console.warn('Failed to load settings, using defaults.', chrome.runtime.lastError);
      applySettings(DEFAULT_SETTINGS);
      setStatus('Failed to load settings. Using defaults.');
      return;
    }

    applySettings(result[SETTINGS_STORAGE_KEY] || DEFAULT_SETTINGS);
  });
}

function applySettings(settings) {
  currentSettings = {
    ...DEFAULT_SETTINGS,
    ...(settings || {}),
  };

  autoScrollCheckbox.checked = currentSettings.autoScroll !== false;
  autoSaveCheckbox.checked = currentSettings.autoSave !== false;
}

function handleToggleChange() {
  const updated = {
    autoScroll: autoScrollCheckbox.checked,
    autoSave: autoSaveCheckbox.checked,
  };
  persistSettings(updated);
}

function handleResetDefaults() {
  applySettings(DEFAULT_SETTINGS);
  persistSettings(DEFAULT_SETTINGS);
}

function persistSettings(settings) {
  if (!chrome?.storage?.local) {
    applySettings(settings);
    setStatus('Storage unavailable. Applied locally only.');
    return;
  }

  currentSettings = {
    ...DEFAULT_SETTINGS,
    ...(settings || {}),
  };

  chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: currentSettings }, () => {
    if (chrome.runtime && chrome.runtime.lastError) {
      console.warn('Failed to save settings.', chrome.runtime.lastError);
      setStatus('Could not save settings.');
      return;
    }
    setStatus('Settings saved.');
  });
}

function setStatus(message) {
  statusLabel.textContent = message || '';
  clearTimeout(statusTimeoutId);
  if (message) {
    statusTimeoutId = setTimeout(() => {
      statusLabel.textContent = '';
    }, 2500);
  }
}
