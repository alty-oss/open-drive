import { useRef, useState } from "react";














export function useDragRatio(onChange: (ratio: number) => void) {
  const [dragging, setDragging] = useState(false);


  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const ratioAt = (track: HTMLElement, clientX: number) => {
    const rect = track.getBoundingClientRect();
    if (!rect.width) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    onChangeRef.current(ratioAt(event.currentTarget, event.clientX));
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {

    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    onChangeRef.current(ratioAt(event.currentTarget, event.clientX));
  };

  const endDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  };

  return {
    dragging,
    dragHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
  };
}
