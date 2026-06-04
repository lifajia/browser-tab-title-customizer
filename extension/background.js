importScripts('lib/matcher.js');

const STORAGE_KEY = 'mappings';
const SKIP_TITLE_APPLY_URL_KEY = 'skipTitleApplyUrl';
const FETCH_TITLE_TIMEOUT_MS = 15000;
let bookmarkEntriesCache = null;

function originalTitleStorageKey(pageUrl) {
  return `originalTitle:${pageUrl}`;
}

async function getStoredOriginalTitle(pageUrl) {
  const key = originalTitleStorageKey(pageUrl);
  const result = await chrome.storage.session.get(key);
  return result[key]?.trim() || '';
}

async function saveStoredOriginalTitle(pageUrl, title) {
  const trimmed = title?.trim();
  if (!pageUrl || !trimmed) {
    return;
  }

  await chrome.storage.session.set({ [originalTitleStorageKey(pageUrl)]: trimmed });
}

async function getRawMappings() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || {};
}

function normalizeStoredMappings(raw) {
  return TitleMatcher.mappingsObjectToEntries(raw);
}

async function getMappings() {
  return normalizeStoredMappings(await getRawMappings());
}

async function saveMapping(pattern, mode, title) {
  const entries = await getMappings();
  const entry = { pattern, mode: TitleMatcher.normalizeMode(mode), title };
  const key = TitleMatcher.mappingKey(entry);
  const nextEntries = entries.filter((item) => TitleMatcher.mappingKey(item) !== key);
  nextEntries.push(entry);
  await chrome.storage.local.set({ [STORAGE_KEY]: nextEntries });
  return nextEntries;
}

function invalidateBookmarkCache() {
  bookmarkEntriesCache = null;
}

function flattenBookmarks(nodes, results = []) {
  for (const node of nodes) {
    if (node.url && TitleMatcher.isValidHttpUrl(node.url)) {
      results.push({
        id: node.id,
        url: node.url,
        title: node.title || node.url,
        parentId: node.parentId
      });
    }
    if (node.children) {
      flattenBookmarks(node.children, results);
    }
  }
  return results;
}

function flattenBookmarkFolders(nodes, parentPath = '', results = []) {
  for (const node of nodes) {
    if (node.url) {
      continue;
    }

    const path = parentPath ? `${parentPath} / ${node.title}` : node.title;

    if (node.id !== '0') {
      results.push({ id: node.id, path });
    }

    if (node.children) {
      flattenBookmarkFolders(node.children, node.id === '0' ? '' : path, results);
    }
  }

  return results;
}

async function getBookmarkEntries() {
  if (bookmarkEntriesCache) {
    return bookmarkEntriesCache;
  }

  const tree = await chrome.bookmarks.getTree();
  bookmarkEntriesCache = flattenBookmarks(tree);
  return bookmarkEntriesCache;
}

async function getBookmarkFolders() {
  const tree = await chrome.bookmarks.getTree();
  return flattenBookmarkFolders(tree);
}

async function resolveBookmarkPath(parentId) {
  const segments = [];
  let currentId = parentId;

  while (currentId && currentId !== '0') {
    const [node] = await chrome.bookmarks.get(currentId);
    if (!node) {
      break;
    }

    segments.unshift(node.title);
    currentId = node.parentId;
  }

  return segments.join(' / ');
}

async function enrichBookmarkWithPath(bookmark) {
  if (!bookmark) {
    return null;
  }

  const folderPath = await resolveBookmarkPath(bookmark.parentId);
  return { ...bookmark, folderPath };
}

function findBookmarkForPage(pageUrl, bookmarkEntries) {
  let exactMatch = null;
  let prefixMatch = null;

  for (const bookmark of bookmarkEntries) {
    if (bookmark.url === pageUrl) {
      exactMatch = bookmark;
      break;
    }

    if (pageUrl.startsWith(bookmark.url) && (!prefixMatch || bookmark.url.length > prefixMatch.url.length)) {
      prefixMatch = bookmark;
    }
  }

  return exactMatch || prefixMatch || null;
}

function resolveBookmarkUrl(pageUrl, pattern, mode) {
  const normalizedMode = TitleMatcher.normalizeMode(mode);

  if (normalizedMode === 'prefix' && TitleMatcher.isValidHttpUrl(pattern)) {
    return pattern;
  }

  return pageUrl;
}

async function syncBookmarkForPage({ pageUrl, pattern, mode, title, parentId }) {
  const bookmarkEntries = await getBookmarkEntries();
  const existing = findBookmarkForPage(pageUrl, bookmarkEntries);

  if (existing) {
    await chrome.bookmarks.update(existing.id, { title });
    invalidateBookmarkCache();
    const folderPath = await resolveBookmarkPath(existing.parentId);
    return { action: 'updated', bookmarkId: existing.id, folderPath };
  }

  if (!parentId) {
    const error = new Error('errorSelectBookmarkFolder');
    error.errorKey = 'errorSelectBookmarkFolder';
    throw error;
  }

  const url = resolveBookmarkUrl(pageUrl, pattern, mode);
  const created = await chrome.bookmarks.create({
    parentId,
    title,
    url
  });

  invalidateBookmarkCache();
  const folderPath = await resolveBookmarkPath(parentId);
  return { action: 'created', bookmarkId: created.id, folderPath };
}

async function resolveTitle(pageUrl) {
  if (!TitleMatcher.isValidHttpUrl(pageUrl)) {
    return null;
  }

  const storageEntries = await getMappings();
  const storageTitle = TitleMatcher.findBestTitleMatch(pageUrl, storageEntries);

  if (storageTitle) {
    return storageTitle;
  }

  const bookmarkEntries = await getBookmarkEntries();
  const bookmarkOnlyEntries = bookmarkEntries.map(({ url, title }) => ({
    pattern: url,
    mode: 'prefix',
    title
  }));

  return TitleMatcher.findBestTitleMatch(pageUrl, bookmarkOnlyEntries);
}

async function removeMappingsForPage(pageUrl) {
  const entries = await getMappings();
  const nextEntries = entries.filter(
    (entry) => !TitleMatcher.matchesPattern(pageUrl, entry.pattern, entry.mode)
  );
  await chrome.storage.local.set({ [STORAGE_KEY]: nextEntries });
  return nextEntries;
}

async function getOriginalTitleFromContent(tabId) {
  try {
    const title = await chrome.tabs.sendMessage(tabId, { type: 'GET_ORIGINAL_TITLE' });
    if (typeof title === 'string' && title.trim()) {
      return title.trim();
    }
  } catch {
    // content script may not be ready
  }

  return '';
}

function parseTitleFromHtml(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) {
    return '';
  }

  return match[1].replace(/\s+/g, ' ').trim();
}

async function fetchTitleFromHtml(pageUrl, timeoutMs = FETCH_TITLE_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(pageUrl, {
      credentials: 'include',
      redirect: 'follow',
      signal: controller.signal
    });

    if (!response.ok) {
      return '';
    }

    const html = await response.text();
    return parseTitleFromHtml(html);
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('errorResetTimeout');
      timeoutError.errorKey = 'errorResetTimeout';
      throw timeoutError;
    }

    return '';
  } finally {
    clearTimeout(timer);
  }
}

async function resolveOriginalTitle(pageUrl, tabId) {
  const storedTitle = await getStoredOriginalTitle(pageUrl);
  if (storedTitle) {
    return storedTitle;
  }

  const contentTitle = tabId ? await getOriginalTitleFromContent(tabId) : '';
  if (contentTitle) {
    await saveStoredOriginalTitle(pageUrl, contentTitle);
    return contentTitle;
  }

  try {
    const fetchedTitle = await fetchTitleFromHtml(pageUrl);
    if (fetchedTitle) {
      await saveStoredOriginalTitle(pageUrl, fetchedTitle);
      return fetchedTitle;
    }
  } catch {
    // ignore fetch errors during popup preload
  }

  return '';
}

async function restoreTitleOnTab(tabId, title) {
  if (!title) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tabId, { type: 'RESTORE_TITLE', title });
  } catch {
    // content script may not be ready; ignore
  }
}

async function applyTitleToTab(tabId, title) {
  if (!title) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tabId, { type: 'SET_TITLE', title });
  } catch {
    // content script may not be ready; ignore
  }
}

async function refreshAndCaptureOriginal(pageUrl, tabId) {
  await removeMappingsForPage(pageUrl);
  await chrome.storage.session.set({
    [SKIP_TITLE_APPLY_URL_KEY]: pageUrl,
    reloadCaptureUrl: pageUrl
  });
  await chrome.tabs.reload(tabId);
}

async function handleTabComplete(tabId, tab) {
  if (!tab?.url || !TitleMatcher.isValidHttpUrl(tab.url)) {
    return;
  }

  const session = await chrome.storage.session.get([SKIP_TITLE_APPLY_URL_KEY]);
  if (session[SKIP_TITLE_APPLY_URL_KEY] === tab.url) {
    await chrome.storage.session.remove([SKIP_TITLE_APPLY_URL_KEY]);

    let originalTitle = await getStoredOriginalTitle(tab.url);
    if (!originalTitle) {
      originalTitle = await getOriginalTitleFromContent(tabId);
    }

    if (originalTitle) {
      await saveStoredOriginalTitle(tab.url, originalTitle);
      await restoreTitleOnTab(tabId, originalTitle);
    }

    return;
  }

  const title = await resolveTitle(tab.url);
  if (title) {
    await applyTitleToTab(tabId, title);
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    handleTabComplete(tabId, tab);
  }
});

chrome.bookmarks.onCreated.addListener(invalidateBookmarkCache);
chrome.bookmarks.onRemoved.addListener(invalidateBookmarkCache);
chrome.bookmarks.onChanged.addListener(invalidateBookmarkCache);
chrome.bookmarks.onMoved.addListener(invalidateBookmarkCache);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SAVE_MAPPING') {
    const { pattern, mode, title, pageUrl, parentId, tabId } = message;
    const patternResult = TitleMatcher.validatePattern(pattern?.trim(), mode);
    const titleResult = TitleMatcher.validateTitle(title);

    if (!patternResult.ok) {
      sendResponse({
        ok: false,
        errorKey: patternResult.errorKey,
        errorArgs: patternResult.errorArgs
      });
      return true;
    }

    if (!titleResult.ok) {
      sendResponse({
        ok: false,
        errorKey: titleResult.errorKey,
        errorArgs: titleResult.errorArgs
      });
      return true;
    }

    if (!TitleMatcher.isValidHttpUrl(pageUrl)) {
      sendResponse({ ok: false, errorKey: 'errorPageUrlInvalid' });
      return true;
    }

    const normalizedPattern = pattern.trim();
    const normalizedTitle = titleResult.title;
    const normalizedMode = patternResult.mode;

    saveMapping(normalizedPattern, normalizedMode, normalizedTitle)
      .then(async () => {
        if (tabId) {
          await applyTitleToTab(tabId, normalizedTitle);
        }

        const bookmarkResult = await syncBookmarkForPage({
          pageUrl,
          pattern: normalizedPattern,
          mode: normalizedMode,
          title: normalizedTitle,
          parentId
        });

        sendResponse({ ok: true, bookmark: bookmarkResult });
      })
      .catch((err) => {
        sendResponse({ ok: false, errorKey: err.errorKey || 'errorSaveFailed' });
      });

    return true;
  }

  if (message.type === 'GET_MAPPING_FOR_URL') {
    getMappings()
      .then((entries) => {
        const entry = TitleMatcher.findBestMappingEntry(message.url, entries);
        sendResponse({ ok: true, entry });
      })
      .catch((err) => {
        sendResponse({ ok: false, errorKey: 'errorSaveFailed' });
      });

    return true;
  }

  if (message.type === 'GET_BOOKMARK_STATUS') {
    Promise.all([getBookmarkEntries(), getBookmarkFolders()])
      .then(async ([entries, folders]) => {
        const bookmark = findBookmarkForPage(message.url, entries);
        const enrichedBookmark = await enrichBookmarkWithPath(bookmark);
        sendResponse({ ok: true, bookmark: enrichedBookmark, folders });
      })
      .catch((err) => {
        sendResponse({ ok: false, error: err.message });
      });

    return true;
  }

  if (message.type === 'GET_ORIGINAL_TITLE_FOR_URL') {
    resolveOriginalTitle(message.url, message.tabId)
      .then((originalTitle) => {
        sendResponse({ ok: true, originalTitle });
      })
      .catch((err) => {
        sendResponse({ ok: false, error: err.message });
      });

    return true;
  }

  if (message.type === 'FETCH_ORIGINAL_TITLE') {
    fetchTitleFromHtml(message.url)
      .then(async (originalTitle) => {
        if (originalTitle) {
          await saveStoredOriginalTitle(message.url, originalTitle);
        }
        sendResponse({ ok: true, originalTitle });
      })
      .catch((err) => {
        sendResponse({ ok: false, errorKey: err.errorKey || 'errorResetFailed' });
      });

    return true;
  }

  if (message.type === 'RESET_TO_ORIGINAL_TITLE') {
    const { pageUrl, tabId } = message;

    if (!TitleMatcher.isValidHttpUrl(pageUrl) || !tabId) {
      sendResponse({ ok: false, errorKey: 'errorPageInvalid' });
      return true;
    }

    removeMappingsForPage(pageUrl)
      .then(async () => fetchTitleFromHtml(pageUrl, FETCH_TITLE_TIMEOUT_MS))
      .then(async (originalTitle) => {
        if (!originalTitle) {
          sendResponse({ ok: false, errorKey: 'errorResetFailed' });
          return;
        }

        await saveStoredOriginalTitle(pageUrl, originalTitle);
        await restoreTitleOnTab(tabId, originalTitle);
        sendResponse({ ok: true, originalTitle });
      })
      .catch((err) => {
        sendResponse({ ok: false, errorKey: err.errorKey || 'errorResetFailed' });
      });

    return true;
  }

  if (message.type === 'REFRESH_AND_CAPTURE_ORIGINAL') {
    const { pageUrl, tabId } = message;

    if (!TitleMatcher.isValidHttpUrl(pageUrl) || !tabId) {
      sendResponse({ ok: false, errorKey: 'errorPageInvalid' });
      return true;
    }

    refreshAndCaptureOriginal(pageUrl, tabId)
      .then(() => {
        sendResponse({ ok: true, reloaded: true });
      })
      .catch((err) => {
        sendResponse({ ok: false, error: err.message });
      });

    return true;
  }

  if (message.type === 'ORIGINAL_TITLE_CAPTURED') {
    saveStoredOriginalTitle(message.url, message.title)
      .then(() => {
        sendResponse({ ok: true });
      })
      .catch((err) => {
        sendResponse({ ok: false, error: err.message });
      });

    return true;
  }

  if (message.type === 'RESOLVE_TITLE') {
    resolveTitle(message.url)
      .then((title) => {
        sendResponse({ ok: true, title });
      })
      .catch((err) => {
        sendResponse({ ok: false, error: err.message });
      });

    return true;
  }

  return false;
});
