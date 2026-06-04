const patternInput = document.getElementById('patternInput');
const titleInput = document.getElementById('titleInput');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const statusHint = document.getElementById('statusHint');
const bookmarkPath = document.getElementById('bookmarkPath');
const bookmarkStatus = document.getElementById('bookmarkStatus');
const mappingHint = document.getElementById('mappingHint');
const messageEl = document.getElementById('message');
const modeGroup = document.getElementById('modeGroup');
const patternLabel = document.getElementById('patternLabel');
const patternHint = document.getElementById('patternHint');
const titleCounter = document.getElementById('titleCounter');
const folderField = document.getElementById('folderField');
const folderSelect = document.getElementById('folderSelect');
const siteDomain = document.getElementById('siteDomain');
const githubLink = document.getElementById('githubLink');
const readmeLink = document.getElementById('readmeLink');

const GITHUB_REPO_URL = 'https://github.com/lifajia/tab-title-customizer';
const README_URL = 'https://github.com/lifajia/tab-title-customizer#readme';

let currentTab = null;
let existingBookmark = null;
let savedOriginalTitle = '';
let dynamicHintState = null;
let hasStorageMapping = false;

function translateResponseError(response) {
  if (response?.errorKey) {
    return I18n.translateError(response.errorKey, response.errorArgs || []);
  }
  return I18n.t('errorSaveFailed');
}

function translateValidationError(result) {
  if (result?.errorKey) {
    return I18n.translateError(result.errorKey, result.errorArgs || []);
  }
  return I18n.t('errorSaveFailed');
}

function getSelectedMode() {
  const selected = modeGroup.querySelector('input[name="matchMode"]:checked');
  return selected ? selected.value : 'prefix';
}

function setSelectedMode(mode) {
  const input = modeGroup.querySelector(`input[name="matchMode"][value="${mode}"]`);
  if (input) {
    input.checked = true;
  }
  updateModeUi();
}

function updateModeUi() {
  const mode = getSelectedMode();
  const config = I18n.getModeConfig(mode);

  patternLabel.textContent = config.label;
  patternInput.placeholder = config.placeholder;
  patternHint.textContent = config.hint;
  patternInput.type = mode === 'prefix' ? 'url' : 'text';
}

function updateTitleCounter() {
  const length = titleInput.value.length;
  titleCounter.textContent = `${length} / ${TitleMatcher.TITLE_MAX_LENGTH}`;
}

function formatSiteDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function applyDefaultTitleValue(preferredTitle = '') {
  const source = (preferredTitle || savedOriginalTitle || '').trim();
  const defaultTitle = source.slice(0, TitleMatcher.TITLE_MAX_LENGTH);
  if (defaultTitle) {
    titleInput.value = defaultTitle;
  }
  titleInput.placeholder = I18n.t('titlePlaceholder');
  updateTitleCounter();
}

function showMessage(text, type) {
  messageEl.hidden = false;
  messageEl.textContent = text;
  messageEl.className = `message message--${type}`;
}

function hideMessage() {
  messageEl.hidden = true;
  messageEl.className = 'message';
}

function setMappingHint(text) {
  if (text) {
    mappingHint.hidden = false;
    mappingHint.textContent = text;
  } else {
    mappingHint.hidden = true;
    mappingHint.textContent = '';
    dynamicHintState = null;
  }
}

function setMappingHintKey(key, ...args) {
  dynamicHintState = key ? { key, args } : null;
  if (key) {
    setMappingHint(I18n.t(key, ...args));
  } else {
    setMappingHint('');
  }
}

function refreshDynamicTexts() {
  I18n.applyStaticTexts();
  updateModeUi();
  updateBookmarkUi();

  if (dynamicHintState) {
    setMappingHint(I18n.t(dynamicHintState.key, ...dynamicHintState.args));
  }

  if (!titleInput.value && !hasStorageMapping) {
    const preferred = existingBookmark?.title || currentTab?.title || '';
    applyDefaultTitleValue(preferred);
  }
}

function populateFolderSelect(folders) {
  folderSelect.innerHTML = '';

  folders.forEach((folder) => {
    const option = document.createElement('option');
    option.value = folder.id;
    option.textContent = folder.path;
    folderSelect.appendChild(option);
  });

  const bookmarksBar = folders.find((folder) =>
    folder.path === '书签栏'
    || folder.path === 'Bookmarks bar'
    || folder.path === 'Bookmarks Bar'
  );

  if (bookmarksBar) {
    folderSelect.value = bookmarksBar.id;
  } else if (folders[0]) {
    folderSelect.value = folders[0].id;
  }
}

function updateBookmarkUi() {
  if (existingBookmark) {
    folderField.hidden = true;
    bookmarkStatus.hidden = false;

    if (existingBookmark.folderPath) {
      bookmarkPath.hidden = false;
      bookmarkPath.textContent = `${I18n.t('bookmarkPathPrefix')}${existingBookmark.folderPath}`;
    } else {
      bookmarkPath.hidden = true;
      bookmarkPath.textContent = '';
    }

    statusHint.textContent = I18n.t('bookmarkExistsHint');
    setMappingHint('');
    document.body.classList.add('has-bookmark');
    return;
  }

  document.body.classList.remove('has-bookmark');
  folderField.hidden = false;
  bookmarkStatus.hidden = true;
  bookmarkPath.hidden = true;
  bookmarkPath.textContent = '';
  statusHint.textContent = '';
}

async function loadSavedOriginalTitle(tab) {
  const response = await chrome.runtime.sendMessage({
    type: 'GET_ORIGINAL_TITLE_FOR_URL',
    url: tab.url,
    tabId: tab.id
  });

  if (response?.ok && response.originalTitle) {
    return response.originalTitle.trim();
  }

  return '';
}

async function initPopup() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;
  hasStorageMapping = false;

  if (!tab?.url || !TitleMatcher.isValidHttpUrl(tab.url)) {
    siteDomain.textContent = I18n.t('unsupportedPage');
    patternInput.value = '';
    patternInput.disabled = true;
    titleInput.disabled = true;
    saveBtn.disabled = true;
    resetBtn.disabled = true;
    folderField.hidden = true;
    bookmarkStatus.hidden = true;
    showMessage(I18n.t('errorUnsupportedPage'), 'error');
    return;
  }

  siteDomain.textContent = formatSiteDomain(tab.url);
  savedOriginalTitle = await loadSavedOriginalTitle(tab);
  if (!savedOriginalTitle) {
    savedOriginalTitle = tab.title || '';
  }

  patternInput.value = tab.url;

  const bookmarkStatusResponse = await chrome.runtime.sendMessage({
    type: 'GET_BOOKMARK_STATUS',
    url: tab.url
  });

  if (bookmarkStatusResponse?.ok) {
    existingBookmark = bookmarkStatusResponse.bookmark;
    populateFolderSelect(bookmarkStatusResponse.folders || []);
    updateBookmarkUi();
  }

  const response = await chrome.runtime.sendMessage({
    type: 'GET_MAPPING_FOR_URL',
    url: tab.url
  });

  if (response?.ok && response.entry) {
    hasStorageMapping = true;
    patternInput.value = response.entry.pattern;
    titleInput.value = response.entry.title;
    setSelectedMode(response.entry.mode || 'prefix');
    updateTitleCounter();

    if (!existingBookmark) {
      setMappingHintKey('mappingExists', response.entry.title);
    }
  } else if (!existingBookmark) {
    applyDefaultTitleValue();
  } else {
    const preferred = existingBookmark.title || currentTab?.title || '';
    applyDefaultTitleValue(preferred);
  }
}

async function handleReset() {
  hideMessage();

  if (!currentTab?.id) {
    return;
  }

  resetBtn.disabled = true;

  const response = await chrome.runtime.sendMessage({
    type: 'RESET_TO_ORIGINAL_TITLE',
    pageUrl: currentTab.url,
    tabId: currentTab.id
  });

  resetBtn.disabled = false;

  if (response?.ok) {
    savedOriginalTitle = (response.originalTitle || '').trim();
    hasStorageMapping = false;
    const restoredTitle = savedOriginalTitle.slice(0, TitleMatcher.TITLE_MAX_LENGTH);
    titleInput.value = restoredTitle;
    updateTitleCounter();
    setMappingHint('');
    showMessage(I18n.t('resetSuccess'), 'success');
  } else {
    showMessage(translateResponseError(response), 'error');
  }
}

async function handleSave() {
  hideMessage();

  const pattern = patternInput.value.trim();
  const title = titleInput.value;
  const mode = getSelectedMode();
  const patternResult = TitleMatcher.validatePattern(pattern, mode);
  const titleResult = TitleMatcher.validateTitle(title);

  if (!patternResult.ok) {
    showMessage(translateValidationError(patternResult), 'error');
    return;
  }

  if (!titleResult.ok) {
    showMessage(translateValidationError(titleResult), 'error');
    return;
  }

  if (!existingBookmark && !folderSelect.value) {
    showMessage(I18n.t('errorSelectFolder'), 'error');
    return;
  }

  saveBtn.disabled = true;

  const response = await chrome.runtime.sendMessage({
    type: 'SAVE_MAPPING',
    pattern,
    mode,
    title: titleResult.title,
    pageUrl: currentTab.url,
    parentId: folderSelect.value,
    tabId: currentTab?.id
  });

  saveBtn.disabled = false;

  if (response?.ok) {
    hasStorageMapping = true;

    if (response.bookmark?.action === 'updated') {
      existingBookmark = {
        ...existingBookmark,
        title: titleResult.title,
        folderPath: response.bookmark.folderPath || existingBookmark.folderPath
      };
      updateBookmarkUi();
      showMessage(I18n.t('saveSuccessUpdated'), 'success');
    } else if (response.bookmark?.action === 'created') {
      existingBookmark = {
        id: response.bookmark.bookmarkId,
        title: titleResult.title,
        url: currentTab.url,
        folderPath: response.bookmark.folderPath || folderSelect.selectedOptions[0]?.textContent || ''
      };
      updateBookmarkUi();
      showMessage(I18n.t('saveSuccessCreated'), 'success');
    } else {
      showMessage(I18n.t('saveSuccess'), 'success');
    }

    setMappingHintKey('mappingOverwrite');
  } else {
    showMessage(translateResponseError(response), 'error');
  }
}

async function handleLocaleChange(preference) {
  await I18n.setPreference(preference);
  refreshDynamicTexts();
  fitPopupHeight();
}

function bindLangSwitch() {
  document.querySelectorAll('[data-locale]').forEach((btn) => {
    btn.addEventListener('click', () => {
      handleLocaleChange(btn.dataset.locale);
    });
  });
}

function bindExternalLinks() {
  [githubLink, readmeLink].forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      chrome.tabs.create({ url: link.href });
    });
  });
}

function fitPopupHeight() {
  document.documentElement.style.height = `${document.documentElement.scrollHeight}px`;
}

modeGroup.addEventListener('change', updateModeUi);
titleInput.addEventListener('input', updateTitleCounter);
saveBtn.addEventListener('click', handleSave);
resetBtn.addEventListener('click', handleReset);

async function bootstrap() {
  await I18n.init();
  I18n.applyStaticTexts();
  bindLangSwitch();
  bindExternalLinks();
  updateModeUi();
  await initPopup();
  fitPopupHeight();
}

bootstrap();
