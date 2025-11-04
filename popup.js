const STORAGE_KEY = 'geminiRemovedResponses';
const MAX_IFRAME_HEIGHT = 360;
const MIN_IFRAME_HEIGHT = 140;

const responseListEl = document.getElementById('response-list');
const emptyStateEl = document.getElementById('empty-state');
const clearButtonEl = document.getElementById('clear-log');
const templateEl = document.getElementById('response-item-template');

init();

function init() {
  if (!responseListEl || !emptyStateEl || !clearButtonEl || !templateEl) {
    console.warn('Popup missing required DOM nodes.');
    return;
  }

  clearButtonEl.addEventListener('click', handleClearClick);

  if (chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener(handleStorageChange);
  }

  refreshList();
}

function handleStorageChange(changes, areaName) {
  if (areaName !== 'local' || !Object.prototype.hasOwnProperty.call(changes, STORAGE_KEY)) {
    return;
  }

  const nextItems = Array.isArray(changes[STORAGE_KEY].newValue)
    ? changes[STORAGE_KEY].newValue
    : [];
  renderList(nextItems);
}

function refreshList() {
  if (!chrome?.storage?.local) {
    renderList([]);
    return;
  }

  responseListEl.setAttribute('aria-busy', 'true');
  chrome.storage.local.get({ [STORAGE_KEY]: [] }, (result) => {
    if (chrome.runtime && chrome.runtime.lastError) {
      console.warn(
        'Failed to read stored <model-response> snapshots.',
        chrome.runtime.lastError
      );
      renderList([]);
      return;
    }

    const items = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
    renderList(items);
  });
}

function renderList(items) {
  responseListEl.textContent = '';
  responseListEl.setAttribute('aria-busy', 'false');

  const hasItems = items.length > 0;
  emptyStateEl.hidden = hasItems;
  clearButtonEl.disabled = !hasItems;

  if (!hasItems) {
    return;
  }

  const sorted = items
    .slice()
    .sort((a, b) => (b?.capturedAt || 0) - (a?.capturedAt || 0));

  for (const entry of sorted) {
    appendEntry(entry);
  }
}

function appendEntry(entry) {
  const { html = '', capturedAt = Date.now(), length = html.length } = entry || {};
  const fragment = templateEl.content.cloneNode(true);
  const itemEl = fragment.querySelector('.response-item');
  const timestampEl = fragment.querySelector('.timestamp');
  const lengthEl = fragment.querySelector('.length');
  const frameEl = fragment.querySelector('.preview-frame');
  const rawEl = fragment.querySelector('.raw-html');

  if (!itemEl || !timestampEl || !lengthEl || !frameEl || !rawEl) {
    return;
  }

  const timestamp = new Date(capturedAt);
  timestampEl.textContent = formatTimestamp(timestamp);
  timestampEl.dateTime = timestamp.toISOString();
  lengthEl.textContent = `${length} chars`;

  rawEl.textContent = html;

  frameEl.setAttribute('sandbox', 'allow-same-origin');
  frameEl.srcdoc = buildFrameDocument(html);
  frameEl.addEventListener('load', () => adjustFrameHeight(frameEl), { once: true });

  responseListEl.appendChild(fragment);
}

function buildFrameDocument(html) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <base target="_blank">
    <style>
      :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
      body { margin: 12px; font-size: 14px; line-height: 1.5; }
      pre, code { font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace; }
      img, video { max-width: 100%; height: auto; }
      table { border-collapse: collapse; max-width: 100%; }
      td, th { border: 1px solid rgba(128,128,128,0.4); padding: 4px 6px; }
    </style>
  </head>
  <body>${html}</body>
</html>`;
}

function adjustFrameHeight(frameEl) {
  try {
    const doc = frameEl.contentDocument;
    if (!doc) {
      return;
    }
    const body = doc.body;
    const scrollHeight = body ? body.scrollHeight : 0;
    const height = Math.min(MAX_IFRAME_HEIGHT, Math.max(MIN_IFRAME_HEIGHT, scrollHeight));
    frameEl.style.height = `${height}px`;
  } catch (error) {
    console.warn('Failed to size preview frame.', error);
  }
}

function handleClearClick() {
  if (!chrome?.storage?.local) {
    renderList([]);
    return;
  }

  clearButtonEl.disabled = true;
  responseListEl.setAttribute('aria-busy', 'true');

  chrome.storage.local.remove(STORAGE_KEY, () => {
    if (chrome.runtime && chrome.runtime.lastError) {
      console.warn('Failed to clear stored <model-response> snapshots.', chrome.runtime.lastError);
    }
    renderList([]);
  });
}

function formatTimestamp(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return 'Unknown';
  }
  try {
    return date.toLocaleString();
  } catch (error) {
    return date.toISOString();
  }
}
