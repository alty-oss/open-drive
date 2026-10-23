import { useCallback, useEffect, useRef, useState } from "react";

export function useImageViewport(filePath: string, enabled: boolean) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef({ pointerId: 0, x: 0, y: 0 });
  const scaleRef = useRef(scale);

  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setDragging(false);
  }, [filePath]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  const zoom = useCallback(
    (nextScale: number, origin?: { x: number; y: number }) => {
      setScale((current) => {
        const clamped = Math.min(8, Math.max(0.2, nextScale));
        if (!origin || clamped === current) return clamped;
        const ratio = clamped / current;
        setOffset((currentOffset) => ({
          x: origin.x - (origin.x - currentOffset.x) * ratio,
          y: origin.y - (origin.y - currentOffset.y) * ratio,
        }));
        return clamped;
      });
    },
    [],
  );

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const element = viewportRef.current;
    if (!element) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const origin = {
        x: event.clientX - rect.left - rect.width / 2,
        y: event.clientY - rect.top - rect.height / 2,
      };
      zoom(scaleRef.current * (event.deltaY < 0 ? 1.12 : 0.88), origin);
    };

    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, [enabled, zoom]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    setDragging(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || dragRef.current.pointerId !== event.pointerId) return;
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    setOffset((current) => ({ x: current.x + dx, y: current.y + dy }));
  };

  const onPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId === event.pointerId) setDragging(false);
  };

  return {
    scale,
    offset,
    dragging,
    viewportRef,
    zoom,
    reset,
    onPointerDown,
    onPointerMove,
    onPointerEnd,
  };
}
