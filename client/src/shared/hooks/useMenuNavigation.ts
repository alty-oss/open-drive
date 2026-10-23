import {
  useCallback,
  useEffect,
  type KeyboardEvent,
  type RefObject,
} from "react";

const MENU_ITEM_SELECTOR = '[role="menuitem"]:not([disabled])';

export function useMenuNavigation<T extends HTMLElement>(
  ref: RefObject<T | null>,
  active = true,
) {
  useEffect(() => {
    if (!active) return;

    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const frame = window.requestAnimationFrame(() => {
      ref.current
        ?.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR)
        .item(0)
        .focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (ref.current?.contains(document.activeElement)) {
        previousFocus?.focus();
      }
    };
  }, [active, ref]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<T>) => {
      if (
        !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
      ) {
        return;
      }

      const items = Array.from(
        ref.current?.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR) ?? [],
      );
      if (items.length === 0) return;

      event.preventDefault();
      const currentIndex = items.findIndex(
        (item) => item === document.activeElement,
      );
      let nextIndex = 0;

      if (event.key === "End") {
        nextIndex = items.length - 1;
      } else if (event.key === "ArrowUp") {
        nextIndex =
          currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
      } else if (event.key === "ArrowDown") {
        nextIndex =
          currentIndex < 0 || currentIndex === items.length - 1
            ? 0
            : currentIndex + 1;
      }

      items[nextIndex]?.focus();
    },
    [ref],
  );

  return { onKeyDown };
}
