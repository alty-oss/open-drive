const taxonomy = require('./file-types.json');

const categoryEntries = Object.entries(taxonomy.categories).map(
  ([category, extensions]) => [category, new Set(extensions)],
);
const markdownExtensions = new Set(taxonomy.markdownExtensions);
const plainTextExtensions = new Set(taxonomy.plainTextExtensions);
const specialFilenames = new Set(taxonomy.specialFilenames);
const subtitleExtensions = taxonomy.subtitleExtensions;
const previewExtensions = Object.entries(taxonomy.previewExtensions).map(
  ([previewType, extensions]) => [previewType, new Set(extensions)],
);

function getExtension(name) {
  const lower = String(name || '').toLowerCase();
  if (specialFilenames.has(lower)) return lower.replace(/^\./, '');
  const lastDot = lower.lastIndexOf('.');
  return lastDot >= 0 ? lower.slice(lastDot + 1) : lower;
}

function getFileCategory(name) {
  const extension = getExtension(name);
  for (const [category, extensions] of categoryEntries) {
    if (extensions.has(extension)) return category;
  }
  return 'other';
}

function getPreviewType(name) {
  const extension = getExtension(name);
  const category = getFileCategory(name);
  if (markdownExtensions.has(extension)) return 'markdown';
  for (const [previewType, extensions] of previewExtensions) {
    if (extensions.has(extension)) return previewType;
  }
  if (category === 'image' || category === 'video' || category === 'audio' || category === 'pdf') {
    return category;
  }
  if (category === 'code' || plainTextExtensions.has(extension)) return 'text';
  return 'unknown';
}

function getFileIconType(name) {
  const category = getFileCategory(name);
  if (category === 'image' && getExtension(name) === 'svg') return 'svg';
  if (category === 'other') return 'file';
  return category;
}

function isEditableFile(name) {
  const extension = getExtension(name);
  return getFileCategory(name) === 'code' || plainTextExtensions.has(extension);
}

function isImageFile(name) {
  return getFileCategory(name) === 'image';
}

function isSubtitleFile(name) {
  return subtitleExtensions.includes(getExtension(name));
}

module.exports = {
  SUBTITLE_EXTENSIONS: subtitleExtensions,
  getExtension,
  getFileCategory,
  getFileIconType,
  getPreviewType,
  isEditableFile,
  isImageFile,
  isSubtitleFile,
};
