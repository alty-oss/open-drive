


import taxonomy from './file-types.json' with { type: 'json' };

const categoryEntries = Object.entries(taxonomy.categories).map(
  ([category, extensions]) => [category, new Set(extensions)],
);
const markdownExtensions = new Set(taxonomy.markdownExtensions);
const plainTextExtensions = new Set(taxonomy.plainTextExtensions);
const specialFilenames = new Set(taxonomy.specialFilenames);
export const SUBTITLE_EXTENSIONS = taxonomy.subtitleExtensions;
const previewExtensions = Object.entries(taxonomy.previewExtensions).map(
  ([previewType, extensions]) => [previewType, new Set(extensions)],
);

export function getExtension(name) {
  const lower = String(name || '').toLowerCase();
  if (specialFilenames.has(lower)) return lower.replace(/^\./, '');
  const lastDot = lower.lastIndexOf('.');
  return lastDot >= 0 ? lower.slice(lastDot + 1) : lower;
}

export function getFileCategory(name) {
  const extension = getExtension(name);
  for (const [category, extensions] of categoryEntries) {
    if (extensions.has(extension)) return category;
  }
  return 'other';
}

export function getPreviewType(name) {
  const extension = getExtension(name);
  const category = getFileCategory(name);
  if (markdownExtensions.has(extension)) return 'markdown';
  for (const [previewType, extensions] of previewExtensions) {
    if (extensions.has(extension)) return previewType;
  }
  if (
    category === 'image'
    || category === 'video'
    || category === 'audio'
    || category === 'pdf'
  ) {
    return category;
  }
  if (category === 'code' || plainTextExtensions.has(extension)) return 'text';
  return 'unknown';
}

export function getFileIconType(name) {
  const category = getFileCategory(name);
  if (category === 'image' && getExtension(name) === 'svg') return 'svg';
  if (category === 'other') return 'file';
  return category;
}

export function isEditableFile(name) {
  const extension = getExtension(name);
  return getFileCategory(name) === 'code' || plainTextExtensions.has(extension);
}

export function isImageFile(name) {
  return getFileCategory(name) === 'image';
}

export function isSubtitleFile(name) {
  return SUBTITLE_EXTENSIONS.includes(getExtension(name));
}
