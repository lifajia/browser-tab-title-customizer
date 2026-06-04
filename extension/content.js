let lockedTitle = null;
let titleObserver = null;
let originalTitle = document.title;

function clearTitleLock() {
  lockedTitle = null;

  if (titleObserver) {
    titleObserver.disconnect();
    titleObserver = null;
  }
}

function setDocumentTitle(title) {
  if (document.title !== title) {
    document.title = title;
  }

  const titleEl = document.querySelector('title');
  if (titleEl && titleEl.textContent !== title) {
    titleEl.textContent = title;
  }
}

function ensureTitleObserver() {
  if (titleObserver) {
    return;
  }

  titleObserver = new MutationObserver(() => {
    if (lockedTitle && document.title !== lockedTitle) {
      setDocumentTitle(lockedTitle);
    }
  });

  const titleEl = document.querySelector('title');
  if (titleEl) {
    titleObserver.observe(titleEl, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  titleObserver.observe(document.head || document.documentElement, {
    childList: true,
    subtree: true
  });
}

function applyTitle(title) {
  if (!title) {
    return;
  }

  lockedTitle = title;
  setDocumentTitle(title);
  ensureTitleObserver();
}

async function shouldSkipTitleApply() {
  try {
    const result = await chrome.storage.session.get('skipTitleApplyUrl');
    return result.skipTitleApplyUrl === location.href;
  } catch {
    return false;
  }
}

async function syncOriginalTitleFromSession() {
  try {
    const key = `originalTitle:${location.href}`;
    const result = await chrome.storage.session.get(key);
    if (result[key]) {
      originalTitle = result[key];
    }
  } catch {
    // ignore
  }
}

async function requestTitleFromBackground() {
  const url = window.location.href;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return;
  }

  if (await shouldSkipTitleApply()) {
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({ type: 'RESOLVE_TITLE', url });
    if (response?.ok && response.title) {
      applyTitle(response.title);
    }
  } catch {
    // extension context invalidated
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SET_TITLE') {
    applyTitle(message.title);
    return;
  }

  if (message.type === 'RESTORE_TITLE') {
    clearTitleLock();
    originalTitle = message.title;
    setDocumentTitle(message.title);
    chrome.storage.session.set({ [`originalTitle:${location.href}`]: message.title }).catch(() => {});
    return;
  }

  if (message.type === 'GET_ORIGINAL_TITLE') {
    return originalTitle;
  }
});

syncOriginalTitleFromSession().then(() => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', requestTitleFromBackground);
  } else {
    requestTitleFromBackground();
  }
});
