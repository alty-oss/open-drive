

















const btnBase =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full " +
  "font-medium transition-[background-color,border-color,color,box-shadow] " +
  "duration-150 ease-[cubic-bezier(0.2,0,0,1)]";

export const btn = {




  primary: `${btnBase} border-0 bg-accent text-on-accent shadow-e1 hover:not-disabled:bg-accent-strong hover:not-disabled:shadow-e2`,






  outlined: `${btnBase} border border-border bg-surface-high text-text hover:bg-surface-highest`,


  tonal: `${btnBase} border-0 bg-surface-high text-text hover:bg-surface-highest`,


  icon: `${btnBase} size-10 border-0 bg-surface-high text-muted-strong hover:bg-surface-highest hover:text-text`,




  danger: `${btnBase} border border-border-danger bg-danger-soft text-danger hover:border-danger`,
} as const;

export const surface = {

  card: "rounded-xl bg-surface-alt shadow-e3",

  popover: "overflow-hidden rounded-xs bg-surface-alt p-2 shadow-e2",
} as const;


export const scrollGutter = "[scrollbar-gutter:stable]";


export const spinner =
  "size-3.5 flex-none animate-spin rounded-full border-2 border-border border-t-accent";














export const z = {
  tooltip: "z-[720]",
  subtitleDialog: "z-[650]",
  overlayTop: "z-[600]",
  overlay: "z-[500]",
  drawer: "z-[400]",
  popover: "z-[250]",
  contextMenu: "z-[200]",
  selectionBar: "z-[100]",
} as const;
