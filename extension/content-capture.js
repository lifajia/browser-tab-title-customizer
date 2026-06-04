(function captureEarlyTitle() {
  const url = location.href;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return;
  }

  const title = document.title;
  const storageKey = `originalTitle:${url}`;

  chrome.storage.session.get(['reloadCaptureUrl']).then((data) => {
    const updates = {};

    if (data.reloadCaptureUrl === url) {
      updates[storageKey] = title;
      updates.reloadCaptureUrl = null;
      chrome.runtime.sendMessage({ type: 'ORIGINAL_TITLE_CAPTURED', url, title }).catch(() => {});
    }

    return chrome.storage.session.get(storageKey).then((existing) => {
      if (!existing[storageKey]) {
        updates[storageKey] = title;
      }

      if (Object.keys(updates).length > 0) {
        return chrome.storage.session.set(updates);
      }
    });
  }).catch(() => {});
})();
