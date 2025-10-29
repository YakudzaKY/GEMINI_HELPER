// --- Selectors ---
const SCROLL_CONTAINER_SELECTOR = 'infinite-scroller[data-test-id="chat-history-container"]';
const STOP_BUTTON_ICON_SELECTOR = 'mat-icon[fonticon="stop"]';

// Elements that signal meaningful content getting added to the chat.
const TARGET_TAGS = ['P', 'IMG', 'TABLE', 'UL', 'OL', 'LI', 'PRE', 'CODE'];
const TARGET_TAGS_SET = new Set(TARGET_TAGS);

const OBSERVER_DEBOUNCE_MS = 100;
const NEAR_BOTTOM_THRESHOLD_PX = 1;
const SCROLL_SMOOTH_DISTANCE_THRESHOLD_PX = 150;
const MIN_SCROLL_INTERVAL_MS = 250;
const MAX_NODES_TO_INSPECT = 400;

let scrollContainer = null;
let debounceTimer = null;
let pendingAnimationFrame = null;
let throttleTimeoutId = null;
let lastScrollTime = 0;

const bodyObserver = new MutationObserver(handleMutations);
observeBodyWhenReady();

// Initial scroll after load gives the chat a chance to settle.
setTimeout(smartScrollToBottom, 500);

function observeBodyWhenReady() {
  if (document.body) {
    bodyObserver.observe(document.body, { childList: true, subtree: true });
    console.log('Observer attached to document body.');
    return;
  }

  window.addEventListener(
    'DOMContentLoaded',
    () => {
      if (document.body) {
        bodyObserver.observe(document.body, { childList: true, subtree: true });
        console.log('Observer attached to document body after DOMContentLoaded.');
      }
    },
    { once: true }
  );
}

function handleMutations(mutationsList) {
  const container = getScrollContainer();
  if (!container) {
    return;
  }

  let shouldScroll = false;

  for (const mutation of mutationsList) {
    if (mutation.type !== 'childList' || mutation.addedNodes.length === 0) {
      continue;
    }

    const targetElement =
      mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;

    if (!targetElement) {
      continue;
    }

    if (targetElement !== container && !container.contains(targetElement)) {
      continue;
    }

    if (addedNodesContainTargets(mutation.addedNodes)) {
      shouldScroll = true;
      break;
    }
  }

  if (shouldScroll) {
    debouncedScroll();
  }
}

function addedNodesContainTargets(addedNodes) {
  for (const node of addedNodes) {
    if (nodeHasTargetTag(node)) {
      return true;
    }
  }
  return false;
}

function nodeHasTargetTag(node) {
  const stack = [];
  let inspected = 0;

  if (node.nodeType === Node.ELEMENT_NODE) {
    stack.push(node);
  } else if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        stack.push(child);
      }
    }
  }

  while (stack.length > 0) {
    const current = stack.pop();

    if (current.nodeType !== Node.ELEMENT_NODE) {
      continue;
    }

    inspected += 1;
    if (inspected > MAX_NODES_TO_INSPECT) {
      return true;
    }

    const tagName = current.nodeName.toUpperCase();
    if (TARGET_TAGS_SET.has(tagName)) {
      return true;
    }

    for (let i = current.children.length - 1; i >= 0; i -= 1) {
      stack.push(current.children[i]);
    }
  }

  return false;
}

function debouncedScroll() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (pendingAnimationFrame !== null) {
      return;
    }

    const raf = window.requestAnimationFrame || window.webkitRequestAnimationFrame;
    if (typeof raf === 'function') {
      pendingAnimationFrame = raf(() => {
        pendingAnimationFrame = null;
        smartScrollToBottom();
      });
      return;
    }

    smartScrollToBottom();
  }, OBSERVER_DEBOUNCE_MS);
}

// --- Scroll Logic ---
function smartScrollToBottom() {
  const now = typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
  const elapsed = now - lastScrollTime;

  if (elapsed < MIN_SCROLL_INTERVAL_MS) {
    if (throttleTimeoutId === null) {
      throttleTimeoutId = setTimeout(() => {
        throttleTimeoutId = null;
        smartScrollToBottom();
      }, MIN_SCROLL_INTERVAL_MS - elapsed);
    }
    return;
  }

  const stopButtonVisible = document.querySelector(STOP_BUTTON_ICON_SELECTOR);
  if (!stopButtonVisible) {
    return;
  }

  const container = getScrollContainer();
  if (!container) {
    console.warn('Scroll container not found during scroll attempt.');
    return;
  }
  lastScrollTime = now;

  const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
  if (distanceFromBottom <= NEAR_BOTTOM_THRESHOLD_PX) {
    return;
  }

  const behavior = distanceFromBottom <= SCROLL_SMOOTH_DISTANCE_THRESHOLD_PX ? 'smooth' : 'auto';
  container.scrollTo({
    top: container.scrollHeight,
    behavior,
  });
}

function getScrollContainer() {
  if (scrollContainer && scrollContainer.isConnected) {
    return scrollContainer;
  }

  scrollContainer = document.querySelector(SCROLL_CONTAINER_SELECTOR);
  return scrollContainer;
}
