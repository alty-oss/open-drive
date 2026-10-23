export type FileCategory =
  | "image"
  | "video"
  | "audio"
  | "archive"
  | "code"
  | "pdf"
  | "text"
  | "other";

export type PreviewType =
  | "image"
  | "video"
  | "audio"
  | "markdown"
  | "pdf"
  | "text"
  | "docx"
  | "font"
  | "notebook"
  | "unknown";

export type FileIconType =
  | "image"
  | "svg"
  | "video"
  | "audio"
  | "archive"
  | "code"
  | "pdf"
  | "text"
  | "file";

export declare const SUBTITLE_EXTENSIONS: string[];
export declare function getExtension(name: string): string;
export declare function getFileCategory(name: string): FileCategory;
export declare function getFileIconType(name: string): FileIconType;
export declare function getPreviewType(name: string): PreviewType;
export declare function isEditableFile(name: string): boolean;
export declare function isImageFile(name: string): boolean;
export declare function isSubtitleFile(name: string): boolean;
