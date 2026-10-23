


export const dialogHeading = "mb-4.5 flex items-start gap-3";


export const dialogHeadingIcon =
  "flex size-10 shrink-0 items-center justify-center rounded-full " +
  "bg-accent-soft text-on-accent-container [&>svg]:size-[18px]";

export const dialogTitle = "m-0 text-base font-medium text-text";
export const dialogDescription = "mt-1 mb-0 text-13 leading-[1.45] text-muted";

export const dialogInput = "h-11 w-full px-3 text-13";

export const dialogActions = "mt-6 flex justify-end gap-2";


export const ALERT_ICON_VARIANT = {
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  default: "bg-surface-high text-muted-strong",
} as const satisfies Record<"danger" | "warning" | "default", string>;





export const appModalHeader =
  "flex min-h-16 items-center justify-between gap-4 border-b border-border-subtle " +
  "py-2.5 pr-3 pl-5";
