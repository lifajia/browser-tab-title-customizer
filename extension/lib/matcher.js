/**
 * URL/规则匹配：支持前缀、后缀、包含、正则；多条命中取 pattern 最长者。
 */

const MATCH_MODES = ['prefix', 'suffix', 'contains', 'regex'];
const TITLE_MAX_LENGTH = 40;

function isValidHttpUrl(url) {
  return typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'));
}

function normalizeMode(mode) {
  return MATCH_MODES.includes(mode) ? mode : 'prefix';
}

function validatePattern(pattern, mode) {
  const normalizedMode = normalizeMode(mode);

  if (!pattern || typeof pattern !== 'string') {
    return { ok: false, errorKey: 'errorPatternEmpty' };
  }

  if (normalizedMode === 'prefix' && !isValidHttpUrl(pattern)) {
    return { ok: false, errorKey: 'errorPrefixUrlInvalid' };
  }

  if (normalizedMode === 'regex') {
    try {
      // eslint-disable-next-line no-new
      new RegExp(pattern);
    } catch {
      return { ok: false, errorKey: 'errorRegexInvalid' };
    }
  }

  return { ok: true, mode: normalizedMode };
}

function validateTitle(title) {
  const trimmed = title?.trim();

  if (!trimmed) {
    return { ok: false, errorKey: 'errorTitleEmpty' };
  }

  if (trimmed.length > TITLE_MAX_LENGTH) {
    return { ok: false, errorKey: 'errorTitleTooLong', errorArgs: [TITLE_MAX_LENGTH] };
  }

  return { ok: true, title: trimmed };
}

function matchesPattern(pageUrl, pattern, mode) {
  const normalizedMode = normalizeMode(mode);

  switch (normalizedMode) {
    case 'prefix':
      return isValidHttpUrl(pattern) && pageUrl.startsWith(pattern);
    case 'suffix':
      return pageUrl.endsWith(pattern);
    case 'contains':
      return pageUrl.includes(pattern);
    case 'regex':
      try {
        return new RegExp(pattern).test(pageUrl);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

function getEntrySpecificity(entry) {
  return entry?.pattern?.length || 0;
}

function isBetterMatch(candidate, currentBest) {
  if (!currentBest) {
    return true;
  }

  const candidateScore = getEntrySpecificity(candidate);
  const bestScore = getEntrySpecificity(currentBest);

  if (candidateScore !== bestScore) {
    return candidateScore > bestScore;
  }

  return normalizeMode(candidate.mode) === 'prefix' && normalizeMode(currentBest.mode) !== 'prefix';
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const pattern = entry.pattern ?? entry.url;
  const title = entry.title;
  const mode = normalizeMode(entry.mode);

  if (!pattern || !title) {
    return null;
  }

  return { pattern, mode, title };
}

function findBestMappingEntry(pageUrl, entries) {
  if (!isValidHttpUrl(pageUrl) || !Array.isArray(entries)) {
    return null;
  }

  let best = null;

  for (const rawEntry of entries) {
    const entry = normalizeEntry(rawEntry);
    if (!entry) {
      continue;
    }

    if (matchesPattern(pageUrl, entry.pattern, entry.mode) && isBetterMatch(entry, best)) {
      best = entry;
    }
  }

  return best;
}

function findBestTitleMatch(pageUrl, entries) {
  const best = findBestMappingEntry(pageUrl, entries);
  return best ? best.title : null;
}

function mappingsObjectToEntries(mappings) {
  if (Array.isArray(mappings)) {
    return mappings.map(normalizeEntry).filter(Boolean);
  }

  if (!mappings || typeof mappings !== 'object') {
    return [];
  }

  return Object.entries(mappings).map(([url, title]) =>
    normalizeEntry({
      pattern: url,
      mode: 'prefix',
      title: typeof title === 'string' ? title : title?.title
    })
  ).filter(Boolean);
}

function mappingKey(entry) {
  return `${normalizeMode(entry.mode)}::${entry.pattern}`;
}

if (typeof globalThis !== 'undefined') {
  globalThis.TitleMatcher = {
    MATCH_MODES,
    TITLE_MAX_LENGTH,
    isValidHttpUrl,
    normalizeMode,
    validatePattern,
    validateTitle,
    matchesPattern,
    findBestTitleMatch,
    findBestMappingEntry,
    mappingsObjectToEntries,
    mappingKey,
    normalizeEntry
  };
}
