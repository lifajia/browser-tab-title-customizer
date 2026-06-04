const LOCALE_STORAGE_KEY = 'uiLocale';
const SUPPORTED_LOCALES = ['en', 'zh_CN'];

const MESSAGES = {
  en: {
    extTitle: 'Tab Title Customizer',
    matchModeLabel: 'Match mode',
    matchModeAria: 'Match mode',
    modePrefix: 'Prefix',
    modeSuffix: 'Suffix',
    modeContains: 'Contains',
    modeRegex: 'Regex',
    patternLabelPrefix: 'Rule (prefix URL)',
    patternLabelSuffix: 'Rule (suffix)',
    patternLabelContains: 'Rule (contains)',
    patternLabelRegex: 'Rule (regex)',
    patternHintPrefix: 'Match when page URL starts with this value',
    patternHintSuffix: 'Match when page URL ends with this text',
    patternHintContains: 'Match when page URL contains this text',
    patternHintRegex: 'Match when page URL satisfies this regular expression',
    placeholderPrefix: 'https://example.com/path',
    placeholderSuffix: '/library/2010 or index.html',
    placeholderContains: 'library/2010',
    placeholderRegex: '^https://example\\.com/library/\\d+$',
    titleLabel: 'Custom title (max 40 chars)',
    titlePlaceholder: 'Enter custom title',
    resetBtn: 'Reset',
    resetTooltip: 'Restore to original page title',
    linkGithub: 'GitHub repository',
    linkReadme: 'README documentation',
    footerVersion: 'v1.0',
    bookmarkFolderLabel: 'Save to bookmark folder',
    bookmarkPathPrefix: 'Bookmark location: ',
    bookmarkExistsHint: 'This page is already bookmarked. Save will update the bookmark name.',
    saveBtn: 'Save and apply',
    langAuto: 'Auto',
    langZh: '中',
    langEn: 'EN',
    unsupportedPage: 'Unsupported page',
    errorUnsupportedPage: 'This page is not supported (non http/https page).',
    mappingExists: 'Mapping "$1" exists. Save will overwrite it.',
    mappingFromBookmark: 'Current title comes from a bookmark. Save will write to local storage.',
    mappingOverwrite: 'Mapping exists. Save will overwrite it.',
    resetSuccess: 'Restored to the original page title.',
    errorResetFailed: 'Reset failed. Please try again.',
    errorResetTimeout: 'Reset failed: timed out fetching page title (15s).',
    errorSelectFolder: 'Please select a bookmark folder.',
    saveSuccessUpdated: 'Saved. Title applied and bookmark name updated.',
    saveSuccessCreated: 'Saved. Title applied and added to bookmarks.',
    saveSuccess: 'Saved. Title applied.',
    errorSaveFailed: 'Save failed. Please try again.',
    errorPatternEmpty: 'Match rule cannot be empty.',
    errorPrefixUrlInvalid: 'Prefix mode requires a valid http/https URL.',
    errorRegexInvalid: 'Invalid regular expression.',
    errorTitleEmpty: 'Please enter a custom title.',
    errorTitleTooLong: 'Title cannot exceed $1 characters.',
    errorPageUrlInvalid: 'Current page URL is invalid.',
    errorPageInvalid: 'Current page is invalid.',
    errorOriginalNotFound: 'Original title not found. Please refresh the page and try again.',
    errorSelectBookmarkFolder: 'Please select a bookmark folder.',
    resettingPage: 'Refreshing page to capture original title…'
  },
  zh_CN: {
    extTitle: '标签页标题自定义',
    matchModeLabel: '匹配模式',
    matchModeAria: '匹配模式',
    modePrefix: '前缀',
    modeSuffix: '后缀',
    modeContains: '包含',
    modeRegex: '正则',
    patternLabelPrefix: '匹配规则（前缀 URL）',
    patternLabelSuffix: '匹配规则（后缀）',
    patternLabelContains: '匹配规则（包含）',
    patternLabelRegex: '匹配规则（正则）',
    patternHintPrefix: '页面 URL 以该地址开头时匹配',
    patternHintSuffix: '页面 URL 以该文本结尾时匹配',
    patternHintContains: '页面 URL 包含该文本时匹配',
    patternHintRegex: '页面 URL 满足该正则表达式时匹配',
    placeholderPrefix: 'https://example.com/path',
    placeholderSuffix: '/library/2010 或 index.html',
    placeholderContains: 'library/2010',
    placeholderRegex: '^https://example\\.com/library/\\d+$',
    titleLabel: '自定义标题（最多 40 字）',
    titlePlaceholder: '输入自定义标题',
    resetBtn: '重置',
    resetTooltip: '重置为原始页面标题',
    linkGithub: 'GitHub 仓库',
    linkReadme: 'README 文档',
    footerVersion: 'v1.0',
    bookmarkFolderLabel: '保存到书签文件夹',
    bookmarkPathPrefix: '书签位置：',
    bookmarkExistsHint: '当前页面已在书签中，保存将更新书签名称。',
    saveBtn: '保存并应用',
    langAuto: '自动',
    langZh: '中',
    langEn: 'EN',
    unsupportedPage: '不支持当前页面',
    errorUnsupportedPage: '当前页面不支持修改标题（非 http/https 页面）。',
    mappingExists: '已存在映射「$1」，保存将覆盖原映射。',
    mappingFromBookmark: '当前标题来自书签映射，保存后将写入本地 storage。',
    mappingOverwrite: '已存在映射，保存将覆盖原映射。',
    resetSuccess: '已恢复为页面原始标题。',
    errorResetFailed: '重置失败，请重试。',
    errorResetTimeout: '重置失败：获取页面标题超时（15 秒）。',
    errorSelectFolder: '请选择书签文件夹。',
    saveSuccessUpdated: '保存成功，标题已应用，书签名称已更新。',
    saveSuccessCreated: '保存成功，标题已应用，并已加入书签。',
    saveSuccess: '保存成功，标题已应用。',
    errorSaveFailed: '保存失败，请重试。',
    errorPatternEmpty: '匹配规则不能为空',
    errorPrefixUrlInvalid: '前缀模式请输入有效的 http/https URL',
    errorRegexInvalid: '正则表达式无效',
    errorTitleEmpty: '请输入自定义标题',
    errorTitleTooLong: '标题不能超过 $1 个字符',
    errorPageUrlInvalid: '当前页面 URL 无效',
    errorPageInvalid: '当前页面无效',
    errorOriginalNotFound: '未找到原始标题，请刷新页面后重试',
    errorSelectBookmarkFolder: '请选择书签文件夹',
    resettingPage: '正在刷新页面以获取原始标题…'
  }
};

const I18n = {
  locale: 'en',
  preference: 'auto',

  resolveLocale(preference) {
    if (SUPPORTED_LOCALES.includes(preference)) {
      return preference;
    }

    const uiLang = (chrome.i18n?.getUILanguage?.() || navigator.language || 'en').toLowerCase();
    return uiLang.startsWith('zh') ? 'zh_CN' : 'en';
  },

  async init() {
    const stored = await chrome.storage.local.get(LOCALE_STORAGE_KEY);
    this.preference = stored[LOCALE_STORAGE_KEY] || 'auto';
    this.locale = this.resolveLocale(this.preference);
    document.documentElement.lang = this.locale === 'zh_CN' ? 'zh-CN' : 'en';
  },

  async setPreference(preference) {
    this.preference = preference;
    this.locale = this.resolveLocale(preference);
    document.documentElement.lang = this.locale === 'zh_CN' ? 'zh-CN' : 'en';
    await chrome.storage.local.set({ [LOCALE_STORAGE_KEY]: preference });
  },

  t(key, ...args) {
    const template = MESSAGES[this.locale]?.[key] || MESSAGES.en[key] || key;
    return args.reduce(
      (text, value, index) => text.replace(`$${index + 1}`, String(value ?? '')),
      template
    );
  },

  translateError(errorKey, errorArgs = []) {
    if (!errorKey) {
      return '';
    }
    return this.t(errorKey, ...errorArgs);
  },

  applyStaticTexts() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = this.t(el.dataset.i18n);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.placeholder = this.t(el.dataset.i18nPlaceholder);
    });

    document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      el.setAttribute('aria-label', this.t(el.dataset.i18nAria));
    });

    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      el.setAttribute('title', this.t(el.dataset.i18nTitle));
    });

    const versionEl = document.querySelector('[data-i18n-version]');
    if (versionEl) {
      versionEl.textContent = this.t('footerVersion');
    }

    const titleEl = document.querySelector('title');
    if (titleEl) {
      titleEl.textContent = this.t('extTitle');
    }

    this.updateLangButtons();
  },

  updateLangButtons() {
    document.querySelectorAll('[data-locale]').forEach((btn) => {
      const locale = btn.dataset.locale;
      btn.classList.toggle('lang-switch__btn--active', locale === this.preference);
      btn.setAttribute('aria-pressed', locale === this.preference ? 'true' : 'false');
    });
  },

  getModeConfig(mode) {
    const keyMap = {
      prefix: {
        label: 'patternLabelPrefix',
        placeholder: 'placeholderPrefix',
        hint: 'patternHintPrefix'
      },
      suffix: {
        label: 'patternLabelSuffix',
        placeholder: 'placeholderSuffix',
        hint: 'patternHintSuffix'
      },
      contains: {
        label: 'patternLabelContains',
        placeholder: 'placeholderContains',
        hint: 'patternHintContains'
      },
      regex: {
        label: 'patternLabelRegex',
        placeholder: 'placeholderRegex',
        hint: 'patternHintRegex'
      }
    };

    const keys = keyMap[mode] || keyMap.prefix;
    return {
      label: this.t(keys.label),
      placeholder: this.t(keys.placeholder),
      hint: this.t(keys.hint)
    };
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.I18n = I18n;
}
