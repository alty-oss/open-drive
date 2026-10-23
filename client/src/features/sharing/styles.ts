






export const modalShell =
  "flex max-h-[96vh] max-w-[min(560px,96vw)] flex-col overflow-hidden p-0 " +
  "md:max-h-[min(760px,92vh)]";

export const modalHeader =
  "flex min-h-16 flex-none items-start justify-between gap-4 px-5 pt-5 pb-1";

export const modalTitle = "m-0 text-base font-medium text-text";
export const modalSubtitle =
  "mt-0.5 mb-0 overflow-hidden text-13 text-ellipsis whitespace-nowrap text-muted";

export const modalBody = "min-h-0 flex-1 overflow-y-auto px-5 py-4";


export const modalFooter =
  "flex flex-none items-center justify-between gap-3 border-t border-border-subtle px-5 py-4";

export const section = "mb-6 last:mb-0";
export const sectionTitle = "mt-0 mb-3 text-13 font-medium text-text";
export const sectionText = "mt-1 mb-0 text-13 leading-[1.45] text-muted";

export const savingHint =
  "inline-flex items-center gap-1.5 text-11 text-muted [&>svg]:size-3.5";





export const generalAccessRow =
  "flex items-center gap-3.5 rounded-md bg-surface p-3.5";

export const generalAccessIcon =
  "grid size-10 flex-none place-items-center rounded-full [&>svg]:size-5";

export const generalAccessIconPublic = "bg-success-soft text-success";
export const generalAccessIconPrivate = "bg-surface-highest text-muted-strong";


export const visibilitySelect =
  "h-9 cursor-pointer rounded-full border border-border-subtle bg-surface-high px-3 " +
  "text-13 font-medium text-text shadow-none hover:bg-surface-highest focus:shadow-none";

export const inheritNote =
  "mt-2.5 flex flex-wrap items-center justify-between gap-2 text-11 text-muted " +
  "[&>button]:inline-flex [&>button]:cursor-pointer [&>button]:items-center [&>button]:gap-1.5 " +
  "[&>button]:rounded-full [&>button]:border-0 [&>button]:bg-transparent [&>button]:px-2.5 " +
  "[&>button]:py-1 [&>button]:text-11 [&>button]:font-medium [&>button]:text-accent " +
  "[&>button:hover:not(:disabled)]:bg-accent-soft [&>button>svg]:size-3";


export const copyField =
  "flex min-w-0 items-center gap-2 rounded-full bg-surface py-1 pr-1 pl-4 " +
  "[&>span]:min-w-0 [&>span]:flex-1 [&>span]:overflow-hidden [&>span]:font-mono " +
  "[&>span]:text-11 [&>span]:text-ellipsis [&>span]:whitespace-nowrap [&>span]:text-muted-strong";

const accessButtonBase =
  "inline-flex flex-none cursor-pointer items-center justify-center gap-2 rounded-full " +
  "font-medium transition-colors duration-150 [&>svg]:size-4";

export const copyButton =
  `${accessButtonBase} h-9 bg-surface-high px-4 text-13 text-text hover:bg-surface-highest`;

export const createButton =
  `${accessButtonBase} h-10 bg-accent px-5 text-13 whitespace-nowrap text-on-accent ` +
  "hover:not-disabled:bg-accent-strong disabled:cursor-wait disabled:opacity-60";

export const doneButton =
  `${accessButtonBase} h-10 bg-surface-high px-5 text-13 text-text hover:bg-surface-highest`;

export const rowButton =
  `${accessButtonBase} size-9 bg-transparent text-muted hover:bg-state-hover hover:text-text`;

export const revokeButton = "hover:bg-danger-soft hover:text-danger";

export const privateNote =
  "mt-2.5 flex items-start gap-2 text-11 leading-[1.5] text-muted " +
  "[&>svg]:mt-px [&>svg]:size-3.5 [&>svg]:flex-none";


export const linkKindGroup = "flex flex-wrap gap-2";

export const linkKindChip =
  "inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border-0 " +
  "bg-surface-high px-4 text-13 font-medium text-muted-strong " +
  "transition-colors duration-150 hover:bg-surface-highest [&>svg]:size-4";

export const linkKindChipActive = "bg-accent-soft text-on-accent-container";


export const linkBuilder =
  "mt-3 flex flex-wrap items-end gap-2.5 " +
  "[&_label]:grid [&_label]:gap-1.5 [&_label]:text-11 [&_label]:font-medium [&_label]:text-muted " +
  "[&_select]:h-10 [&_select]:min-w-40 [&_select]:px-3 [&_select]:text-13 " +
  "[&_input]:h-10 [&_input]:px-3 [&_input]:text-13";

export const linkList = "grid gap-1";

export const linkRow =
  "grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 " +
  "rounded-md px-2 py-2 transition-colors duration-150 hover:bg-state-hover";


export const linkRowInactive = "opacity-55";

export const linkIcon =
  "grid size-9 flex-none place-items-center rounded-full bg-surface-highest " +
  "text-muted-strong [&>svg]:size-4";

export const linkDetails =
  "min-w-0 [&>strong]:block [&>strong]:truncate [&>strong]:text-13 " +
  "[&>strong]:font-medium [&>strong]:text-text " +
  "[&>span]:mt-0.5 [&>span]:block [&>span]:truncate [&>span]:text-11 [&>span]:text-muted";

export const linkActions = "flex flex-none items-center gap-0.5";

export const linkStatusIcon = "size-4 flex-none text-muted";

export const emptyLinks =
  "flex min-h-20 flex-col items-center justify-center gap-2 rounded-md " +
  "bg-surface text-11 text-muted [&>svg]:size-5";







export const manageShell =
  "flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-app";

export const manageHeader =
  "flex flex-none flex-col gap-3 border-b border-border-subtle px-4 py-3.5 md:px-6";

export const manageTitleRow = "flex items-center gap-2";

export const manageTitle = "m-0 text-base font-medium text-text";

export const manageCount = "text-13 font-normal text-muted";

export const manageToolbar = "flex flex-wrap items-center gap-2";

export const manageSearch =
  "flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full bg-surface-high px-3.5 " +
  "md:max-w-80 [&>svg]:size-4 [&>svg]:flex-none [&>svg]:text-muted " +
  "[&>input]:min-w-0 [&>input]:flex-1 [&>input]:border-0 [&>input]:bg-transparent " +
  "[&>input]:p-0 [&>input]:text-13 [&>input]:text-text [&>input]:shadow-none " +
  "[&>input:focus]:shadow-none";

export const statusChipGroup = "flex flex-wrap items-center gap-1.5";

export const statusChip =
  "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border-0 " +
  "bg-surface-high px-3 text-11 font-medium text-muted-strong " +
  "transition-colors duration-150 hover:bg-surface-highest";

export const statusChipActive = "bg-accent-soft text-on-accent-container";

export const purgeButton =
  "ml-auto inline-flex h-9 flex-none cursor-pointer items-center gap-2 rounded-full " +
  "border-0 bg-surface-high px-4 text-13 font-medium text-text " +
  "transition-colors duration-150 hover:not-disabled:bg-danger-soft " +
  "hover:not-disabled:text-danger disabled:cursor-not-allowed disabled:opacity-50 " +
  "[&>svg]:size-4";

export const manageBody = "min-h-0 flex-1 overflow-y-auto px-4 py-3 md:px-6";

export const manageList = "grid gap-1";






export const manageRow =
  "grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 " +
  "rounded-md bg-surface px-3 py-2.5 transition-colors duration-150 " +
  "hover:bg-state-hover md:grid-cols-[auto_minmax(0,1fr)_auto_auto]";

export const manageRowInactive = "opacity-60";

export const manageIdentity =
  "col-start-2 min-w-0 " +
  "[&>strong]:block [&>strong]:truncate [&>strong]:text-13 " +
  "[&>strong]:font-medium [&>strong]:text-text " +
  "[&>span]:mt-0.5 [&>span]:block [&>span]:truncate [&>span]:font-mono " +
  "[&>span]:text-11 [&>span]:text-muted";

export const manageBadges = "mt-1.5 flex flex-wrap items-center gap-1.5";

export const manageBadge =
  "inline-flex items-center gap-1 rounded-full bg-surface-high px-2 py-0.5 " +
  "text-11 font-medium text-muted-strong [&>svg]:size-3";

export const manageBadgeActive = "bg-success-soft text-success";
export const manageBadgeInactive = "bg-surface-highest text-muted-strong";
export const manageBadgeMissing = "bg-danger-soft text-danger";


export const manageMeta =
  "col-span-2 col-start-2 grid gap-0.5 text-11 text-muted md:col-span-1 " +
  "md:col-start-3 md:justify-items-end md:text-right";

export const manageActions = "col-start-3 flex flex-none items-center gap-0.5 md:col-start-4";

export const manageState =
  "flex min-h-50 flex-col items-center justify-center gap-2.5 px-4 py-10 " +
  "text-center text-13 text-muted [&>svg]:size-7 [&>svg]:text-muted-strong";

export const manageError =
  "mb-3 flex items-start gap-2 rounded-md bg-danger-soft px-3.5 py-2.5 text-13 " +
  "text-danger [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:flex-none";

export const loadMoreButton =
  "mx-auto mt-3 inline-flex h-9 cursor-pointer items-center gap-2 rounded-full " +
  "border-0 bg-surface-high px-5 text-13 font-medium text-text " +
  "transition-colors duration-150 hover:not-disabled:bg-surface-highest " +
  "disabled:cursor-wait disabled:opacity-60 [&>svg]:size-4";
