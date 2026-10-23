
















const controlBase =
  "flex flex-shrink-0 cursor-pointer items-center justify-center rounded-full " +
  "border-0 transition-colors duration-150";


export function controlSkin(fullscreen: boolean) {
  return fullscreen
    ? "bg-white/12 text-white hover:not-disabled:bg-white/25"
    : "bg-surface-high text-text hover:not-disabled:bg-surface-highest";
}


export function playSkin(fullscreen: boolean) {
  return fullscreen
    ? "bg-white text-black hover:bg-white/90"
    : "bg-accent text-on-accent hover:bg-accent-strong";
}

export const mediaPlayer =
  "group/player flex h-full min-h-0 w-full min-w-0 flex-col bg-surface text-text " +
  "data-[fullscreen]:relative data-[fullscreen]:h-screen data-[fullscreen]:w-screen " +
  "data-[fullscreen]:bg-black data-[fullscreen]:text-white " +

  "data-[controls-hidden]:cursor-none";

export const videoStage =
  "relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-canvas " +
  "group-data-[fullscreen]/player:size-full group-data-[fullscreen]/player:bg-black";

export const controlPanel =
  "relative z-1 flex flex-shrink-0 flex-col gap-3 bg-surface-alt px-4 pt-3.5 pb-4 shadow-e1 " +

  "group-data-[fullscreen]/player:absolute group-data-[fullscreen]/player:inset-x-0 " +
  "group-data-[fullscreen]/player:bottom-0 group-data-[fullscreen]/player:z-8 " +
  "group-data-[fullscreen]/player:gap-2 group-data-[fullscreen]/player:border-0 " +





  "group-data-[fullscreen]/player:bg-transparent " +
  "group-data-[fullscreen]/player:bg-[linear-gradient(to_bottom,transparent_0,rgba(0,0,0,0.45)_38%,rgba(0,0,0,0.92)_100%)] " +
  "group-data-[fullscreen]/player:px-6 group-data-[fullscreen]/player:pt-20 " +
  "group-data-[fullscreen]/player:pb-6 group-data-[fullscreen]/player:text-white " +
  "group-data-[fullscreen]/player:transition-[opacity,transform] " +
  "group-data-[fullscreen]/player:duration-180 group-data-[fullscreen]/player:shadow-none " +
  "group-data-[controls-hidden]/player:pointer-events-none " +
  "group-data-[controls-hidden]/player:translate-y-3.5 " +
  "group-data-[controls-hidden]/player:opacity-0 " +

  "max-md:px-3 max-md:pt-2.75 max-md:pb-3.25";


export const hiddenInFullscreen = "group-data-[fullscreen]/player:hidden";

export const fileRow = "flex min-w-0 items-center gap-2.25";

export const fileName =
  "min-w-0 flex-1 overflow-hidden text-xs font-medium text-ellipsis " +
  "whitespace-nowrap text-muted-strong";

export const formatBadge =
  "flex-shrink-0 rounded-xs bg-accent-soft px-1.5 py-0.75 text-11 " +
  "font-medium tracking-[0.05em] text-on-accent-container";

export const mediaTime =
  "flex-shrink-0 px-1 text-11 text-muted [font-variant-numeric:tabular-nums] " +
  "group-data-[fullscreen]/player:text-white " +
  "group-data-[kind=video]/player:max-md:text-11";

export const progressTrack =
  "relative h-1.5 w-full cursor-pointer overflow-hidden rounded-full bg-surface-highest/70 " +
  "group-data-[fullscreen]/player:h-1.5 group-data-[fullscreen]/player:overflow-visible " +
  "group-data-[fullscreen]/player:bg-white/30";





export const progressFill =
  "absolute inset-y-0 left-0 rounded-[inherit] bg-accent " +
  "group-data-[fullscreen]/player:after:absolute group-data-[fullscreen]/player:after:top-1/2 " +
  "group-data-[fullscreen]/player:after:-right-0.5 group-data-[fullscreen]/player:after:size-2.5 " +
  "group-data-[fullscreen]/player:after:-translate-y-1/2 group-data-[fullscreen]/player:after:rounded-full " +
  "group-data-[fullscreen]/player:after:bg-accent group-data-[fullscreen]/player:after:opacity-0 " +
  "group-data-[fullscreen]/player:after:transition-opacity group-data-[fullscreen]/player:after:duration-120 " +
  "group-hover/track:group-data-[fullscreen]/player:after:opacity-100 " +
  "group-focus-visible/track:group-data-[fullscreen]/player:after:opacity-100";








export const volumeTrack =
  "group/volume relative h-1.25 flex-shrink-0 cursor-pointer touch-none rounded-full bg-surface-highest " +
  "before:absolute before:inset-x-0 before:-inset-y-2 before:content-[''] " +
  "group-data-[fullscreen]/player:bg-white/30 max-md:hidden";


export const volumeFill =
  "absolute inset-y-0 left-0 rounded-[inherit] bg-accent " +
  "after:absolute after:top-1/2 after:-right-1.25 after:size-2.5 " +
  "after:-translate-y-1/2 after:rounded-full after:bg-accent after:shadow-e1 " +
  "after:transition-transform after:duration-120 " +
  "group-hover/volume:after:scale-125 group-data-[dragging]/volume:after:scale-125";

export const transportRow = "flex min-w-0 items-center gap-1 max-md:gap-0.5";

export const iconButton = `${controlBase} size-10 [&>svg]:size-5 disabled:cursor-default disabled:opacity-32`;

export const navigationButton = `${controlBase} size-10 [&>svg]:size-5 disabled:cursor-default disabled:opacity-28`;

export const playButton =
  `${controlBase} size-12 [&>svg]:size-5.5 [&>svg:last-child]:fill-current`;

export const volumeButton =
  `${controlBase} ml-1 size-10 [&>svg]:size-5 ` +
  "group-data-[kind=video]/player:max-md:hidden";


export const secondaryAction = "group-data-[kind=video]/player:max-md:hidden";


export const buttonActive =
  "bg-accent-soft text-on-accent-container " +
  "group-data-[fullscreen]/player:bg-white/18 group-data-[fullscreen]/player:text-white";

export const overlayPlay =
  "absolute flex size-15.5 cursor-pointer items-center justify-center rounded-full " +
  "bg-black/70 text-white shadow-e4 backdrop-blur-[10px]";

export const subtitleStatus =
  "inline-flex max-w-57.5 min-w-0 items-center gap-1.25 overflow-hidden text-11 " +
  "font-semibold text-ellipsis whitespace-nowrap text-accent-strong";

export const subtitleError = "text-11 text-danger";

export const subtitleLayer =
  "pointer-events-none absolute inset-x-[5%] bottom-[6%] z-4 flex justify-center " +
  "group-data-[fullscreen]/player:bottom-28 group-data-[fullscreen]/player:transition-[bottom] " +
  "group-data-[fullscreen]/player:duration-180 " +
  "group-data-[controls-hidden]/player:bottom-8.5";

export const subtitleText =
  "flex max-w-[min(900px,92%)] flex-col items-center gap-0.5 text-center font-semibold " +
  "text-white [font-size:clamp(16px,2.2vw,28px)] leading-[1.35] " +
  "[text-shadow:0_2px_3px_rgba(0,0,0,0.95),0_0_10px_rgba(0,0,0,0.8)]";

export const audioStage =
  "flex min-h-55 min-w-0 flex-1 items-center gap-0 bg-canvas p-0";

export const audioVisualizer =
  "size-full min-h-55 min-w-0 flex-1 overflow-hidden rounded-none border-0 bg-canvas p-5.5";
