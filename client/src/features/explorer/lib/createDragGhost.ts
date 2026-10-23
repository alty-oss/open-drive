export function createDragGhost(
  name: string,
  rowEl: HTMLElement,
): HTMLDivElement {
  const ghost = document.createElement("div");
  ghost.style.cssText =
    "position:fixed;left:-9999px;top:0;display:flex;align-items:center;gap:8px;padding:8px 14px;background:var(--surface-high);border:0;border-radius:999px;font:500 13px var(--font-sans);color:var(--text);white-space:nowrap;max-width:240px;overflow:hidden;box-shadow:var(--elevation-2);";

  const iconContainer = rowEl.querySelector("[data-drag-icon]");
  const iconEl = iconContainer
    ? iconContainer.matches("svg, img")
      ? iconContainer
      : iconContainer.querySelector("svg, img")
    : rowEl.querySelector("svg, img");
  if (iconEl) {
    const clone = iconEl.cloneNode(true) as HTMLElement;
    clone.style.width = "18px";
    clone.style.height = "18px";
    clone.style.flexShrink = "0";
    if (clone.tagName === "IMG") {
      clone.style.borderRadius = "4px";
      clone.style.objectFit = "cover";
    }
    ghost.appendChild(clone);
  }

  const label = document.createElement("span");
  label.style.cssText = "overflow:hidden;text-overflow:ellipsis";
  label.textContent = name;
  ghost.appendChild(label);

  return ghost;
}
