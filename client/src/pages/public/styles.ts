











const BG = "var(--app-bg)";
const SURFACE_RAISED = "var(--surface-high)";
const SURFACE_HOVER = "var(--surface-highest)";
const TEXT = "var(--text)";
const MUTED = "var(--muted)";
const ACCENT = "var(--accent)";

export const page =
  `h-dvh w-full overflow-hidden bg-[${BG}] text-[${TEXT}] ` +
  "print:h-auto print:overflow-visible print:bg-white";

export const statusPage = `h-dvh w-full overflow-auto bg-[${BG}] text-[${TEXT}]`;

export const viewerHeader =
  "flex h-18 items-center justify-between gap-6 px-3.5 py-2.5 " +
  "md:h-23 md:px-6 md:pt-3.5 md:pb-3 print:hidden";

export const viewerFile = "flex min-w-0 items-center gap-2.5 md:gap-3.5";

export const viewerFileIcon =
  `grid size-9.5 flex-none place-items-center rounded-lg bg-[${SURFACE_RAISED}] md:size-10.5`;

export const viewerFileCopy =
  "min-w-0 " +
  `[&>h1]:m-0 [&>h1]:max-w-[calc(100vw-104px)] [&>h1]:overflow-hidden [&>h1]:text-base ` +
  `[&>h1]:leading-[1.25] [&>h1]:font-medium [&>h1]:tracking-[-0.025em] [&>h1]:text-ellipsis ` +
  `[&>h1]:whitespace-nowrap [&>h1]:text-[${TEXT}] md:[&>h1]:max-w-[min(68vw,760px)] md:[&>h1]:text-xl ` +
  `[&>div]:mt-1.25 [&>div]:flex [&>div]:items-center [&>div]:gap-2 [&>div]:text-11 ` +
  `[&>div]:leading-none [&>div]:text-[${MUTED}] md:[&>div]:mt-1.75 md:[&>div]:text-xs ` +
  "[&_i]:size-[3px] [&_i]:rounded-full [&_i]:bg-[var(--muted)]";

export const viewerBrand =
  "hidden flex-none items-center gap-2.25 text-13 font-semibold text-[var(--muted-strong)] md:flex " +
  "[&>img]:size-7.5 [&>img]:rounded-lg [&>img]:object-cover";

export const viewerToolbar =
  `mx-2 mb-2 flex h-13.5 items-center justify-between gap-3 rounded-full border ` +
  `border-[var(--border-subtle)] bg-[${SURFACE_RAISED}] px-2 py-1.25 ` +
  "md:mx-4 md:mb-3 md:h-15.5 rounded-full md:px-3 md:py-1.75 print:hidden";

export const toolbarGroup = "flex min-w-0 items-center gap-0 sm:gap-1";

export const tool =
  "inline-flex h-10 min-w-9 flex-none cursor-pointer items-center justify-center gap-2 " +
  `rounded-full border-0 bg-transparent px-2 text-xs font-semibold text-[var(--muted-strong)] no-underline ` +
  "transition-[background-color,color] duration-120 ease-[ease] " +
  `hover:not-disabled:bg-[${SURFACE_HOVER}] hover:not-disabled:text-white ` +
  `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[${ACCENT}] ` +
  "disabled:cursor-default disabled:text-[var(--muted)] " +
  "[&>svg]:size-4.5 [&>svg]:[stroke-width:2] " +
  "sm:min-w-10 sm:px-2.5 sm:[&>svg]:size-5 md:h-10.5 md:min-w-10.5 md:px-3";


export const toolActive = `bg-[${SURFACE_HOVER}] text-white`;


export const toolLabel = "hidden md:inline";

export const toolbarDivider =
  `mx-px h-5.5 w-px flex-none bg-[var(--border)] sm:mx-0.75 md:mx-2 md:h-6.5`;

export const zoomOutput =
  "min-w-8.5 text-center text-11 text-[var(--muted-strong)] [font-variant-numeric:tabular-nums] " +
  "sm:min-w-10.5 md:min-w-13 md:text-xs";

export const viewerBody =
  "relative h-[calc(100dvh-134px)] min-h-0 overflow-hidden md:h-[calc(100dvh-166px)] " +
  "print:h-auto print:min-h-0 print:overflow-visible";

export const viewerCanvas =
  `grid size-full min-h-0 min-w-0 place-items-center overflow-auto bg-[${BG}] ` +
  "[scrollbar-color:var(--scroll-thumb)_transparent] " +
  "print:h-auto print:min-h-0 print:overflow-visible print:bg-white print:p-0";

export const imageZoom =
  "grid min-h-full min-w-full place-items-center px-3.5 pt-2.5 pb-5.5 " +
  "md:px-7 md:pt-3.5 md:pb-7 print:h-auto print:min-h-0 print:overflow-visible print:bg-white print:p-0";

export const media =
  "block max-h-[calc(100dvh-168px)] max-w-full object-contain shadow-[0_8px_28px_rgb(0_0_0/34%)] " +
  "md:max-h-[calc(100dvh-208px)] " +
  "print:max-h-none print:max-w-full print:shadow-none print:!transform-none";


export const mediaZoomable =
  "w-auto min-w-0 origin-center transition-transform duration-140 ease-[ease]";

export const videoMedia = "w-[calc(100vw-28px)] md:w-[min(1280px,calc(100vw-56px))]";

export const pdfFrame =
  "size-full border-0 bg-white md:h-[calc(100%-24px)] md:w-[calc(100%-44px)]";

export const textPreview =
  "m-3 max-h-[calc(100%-24px)] min-h-[calc(100%-24px)] w-[calc(100%-24px)] overflow-auto " +
  "rounded-[2px] border border-[#d9dce0] bg-[#f8f9fa] px-4.5 py-5.5 font-mono text-13/[1.7] " +
  "whitespace-pre-wrap text-[#202124] shadow-[0_8px_28px_rgb(0_0_0/30%)] " +
  "md:m-6 md:max-h-[calc(100%-48px)] md:min-h-[calc(100%-48px)] md:w-[min(920px,calc(100%-48px))] md:px-9.5 md:py-8";

export const placeholder =
  `flex max-w-115 flex-col items-center justify-center gap-2.5 px-7 py-12 text-center text-[${MUTED}] ` +
  "[&>svg]:mb-2 [&>svg]:size-14.5 [&>svg]:[stroke-width:1.35] [&>svg]:text-[#b5bac1] " +
  `[&>strong]:max-w-full [&>strong]:text-15 [&>strong]:font-semibold [&>strong]:text-[${TEXT}] ` +
  "[&>strong]:[overflow-wrap:anywhere] " +
  "[&>span]:text-xs [&>span]:leading-[1.55]";

export const audioPlaceholder = "[&>audio]:mt-4 [&>audio]:w-[min(440px,78vw)]";







export const detailsModal =
  "flex max-h-[88vh] w-[min(420px,94vw)] flex-col overflow-hidden bg-surface-alt p-0";

export const detailsHeader =
  `flex min-h-15 flex-none items-center justify-between gap-3 px-5 pt-4 pb-1 ` +
  `[&>strong]:text-base [&>strong]:font-medium [&>strong]:text-[${TEXT}] ` +
  "[&>button]:grid [&>button]:size-10 [&>button]:cursor-pointer [&>button]:place-items-center " +
  `[&>button]:rounded-full [&>button]:border-0 [&>button]:bg-transparent [&>button]:text-[${MUTED}] ` +
  `[&>button:hover]:bg-[${SURFACE_HOVER}] [&>button:hover]:text-white ` +
  "[&>button>svg]:size-5";

export const detailsBody = "min-h-0 flex-1 overflow-y-auto px-5 pb-5";


export const detailsFile =
  `flex min-w-0 flex-col items-center pt-6.5 pb-5 text-center ` +
  `[&>strong]:w-full [&>strong]:overflow-hidden [&>strong]:text-sm [&>strong]:font-semibold ` +
  `[&>strong]:text-ellipsis [&>strong]:whitespace-nowrap [&>strong]:text-[${TEXT}] ` +
  `[&>span]:mt-1.25 [&>span]:text-11 [&>span]:text-[${MUTED}]`;


export const detailsFileIcon =
  "mb-3.5 grid size-20 place-items-center rounded-lg bg-surface-high";

export const detailsAction =
  "mt-1 flex h-11 w-full items-center justify-center gap-2.25 rounded-full " +
  "bg-accent text-13 font-medium text-on-accent no-underline shadow-e1 " +
  "transition-colors duration-150 hover:bg-accent-strong " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-accent [&>svg]:size-4.25";

export const detailsExpiration =
  "mt-3.5 flex items-start gap-2.25 rounded-md bg-surface " +
  `px-3 py-2.75 text-11 leading-[1.45] text-[var(--muted-strong)] ` +
  `[&>svg]:mt-px [&>svg]:size-3.5 [&>svg]:flex-none [&>svg]:text-[${ACCENT}]`;

export const detailsList =
  "mt-5.5 mb-0 grid " +
  `[&>div]:grid [&>div]:grid-cols-[90px_minmax(0,1fr)] [&>div]:gap-3.5 [&>div]:border-b ` +
  "[&>div]:border-border-subtle [&>div]:py-3 " +
  `[&_dt]:text-11 [&_dt]:text-[${MUTED}] ` +
  `[&_dd]:m-0 [&_dd]:min-w-0 [&_dd]:overflow-hidden [&_dd]:text-right [&_dd]:text-11 ` +
  `[&_dd]:font-medium [&_dd]:text-ellipsis [&_dd]:whitespace-nowrap [&_dd]:text-[${TEXT}]`;

export const detailsNote =
  `mt-4.5 mb-0 flex items-start gap-2 text-11 leading-[1.45] text-[${MUTED}] ` +
  "[&>svg]:size-3.25 [&>svg]:flex-none [&>svg]:text-[var(--success)]";

export const statusHeader =
  `flex h-17.5 items-center gap-2.5 border-b border-border-subtle px-5.5 text-sm font-semibold text-[${TEXT}] ` +
  "[&>img]:size-7.5 [&>img]:rounded-lg [&>img]:object-cover";

export const statusBody =
  `flex min-h-[calc(100dvh-70px)] flex-col items-center justify-center gap-2.25 px-5 py-8 ` +
  `text-center text-[${MUTED}] ` +
  `[&>svg]:mb-2 [&>svg]:size-8.5 [&>svg]:text-[${ACCENT}] ` +
  `[&>strong]:text-base [&>strong]:font-semibold [&>strong]:text-[${TEXT}] ` +
  "[&>span]:max-w-97.5 [&>span]:text-xs [&>span]:leading-[1.55]";
