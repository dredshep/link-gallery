"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Asset } from "@/lib/types";

interface ThumbnailStripProps {
  assets: Asset[];
  currentId: string;
  onJumpTo: (id: string) => void;
}

export function ThumbnailStrip({ assets, currentId, onJumpTo }: ThumbnailStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const scrollStartLeft = useRef(0);
  const hasDragged = useRef(false);
  const scrubTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-scroll to center the active thumbnail
  useEffect(() => {
    if (isDragging.current) return;
    const container = scrollRef.current;
    if (!container) return;

    const activeEl = container.querySelector<HTMLElement>(`[data-asset-id="${currentId}"]`);
    if (!activeEl) return;

    const containerRect = container.getBoundingClientRect();
    const elRect = activeEl.getBoundingClientRect();
    const offset = elRect.left - containerRect.left - containerRect.width / 2 + elRect.width / 2;

    container.scrollBy({ left: offset, behavior: "smooth" });
  }, [currentId]);

  const getAssetAtCenter = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return null;

    const containerRect = container.getBoundingClientRect();
    const centerX = containerRect.left + containerRect.width / 2;

    const children = container.querySelectorAll<HTMLElement>("[data-asset-id]");
    let closest: HTMLElement | undefined;
    let closestDist = Infinity;

    children.forEach((child) => {
      const rect = child.getBoundingClientRect();
      const childCenter = rect.left + rect.width / 2;
      const dist = Math.abs(childCenter - centerX);
      if (dist < closestDist) {
        closestDist = dist;
        closest = child;
      }
    });

    return (closest as HTMLElement | undefined)?.dataset.assetId ?? null;
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDragging.current = true;
    hasDragged.current = false;
    dragStartX.current = e.clientX;
    scrollStartLeft.current = scrollRef.current?.scrollLeft ?? 0;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStartX.current;
    if (Math.abs(dx) > 5) hasDragged.current = true;

    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollStartLeft.current - dx;
    }

    // Scrub: switch image when a new thumbnail reaches center
    if (scrubTimer.current) clearTimeout(scrubTimer.current);
    scrubTimer.current = setTimeout(() => {
      const centeredId = getAssetAtCenter();
      if (centeredId && centeredId !== currentId) {
        onJumpTo(centeredId);
      }
    }, 50);
  }, [getAssetAtCenter, currentId, onJumpTo]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    isDragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    if (scrubTimer.current) {
      clearTimeout(scrubTimer.current);
      scrubTimer.current = null;
    }

    // Snap to the centered thumbnail
    const centeredId = getAssetAtCenter();
    if (centeredId && centeredId !== currentId) {
      onJumpTo(centeredId);
    }
  }, [getAssetAtCenter, currentId, onJumpTo]);

  const handleTap = useCallback((e: React.MouseEvent, id: string) => {
    if (hasDragged.current) {
      e.preventDefault();
      return;
    }
    onJumpTo(id);
  }, [onJumpTo]);

  const stopTouchPropagation = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div
      ref={scrollRef}
      className="w-full overflow-x-auto scrollbar-none py-2 flex items-center gap-1.5 px-4 md:px-2"
      style={{ touchAction: "pan-x", scrollbarWidth: "none" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onTouchStart={stopTouchPropagation}
      onTouchMove={stopTouchPropagation}
      onTouchEnd={stopTouchPropagation}
    >
      {/* Spacer to allow first item to center */}
      <div className="shrink-0 w-[calc(50%-24px)]" />

      {assets.map((a) => {
        const isActive = a.id === currentId;
        return (
          <button
            key={a.id}
            data-asset-id={a.id}
            onClick={(e) => handleTap(e, a.id)}
            className={`shrink-0 rounded overflow-hidden transition-all duration-200 ${
              isActive
                ? "w-12 h-12 opacity-100 ring-1 ring-white/60"
                : "w-9 h-9 opacity-50 hover:opacity-75"
            }`}
          >
            <img
              src={a.thumbUrl}
              alt={a.displayName}
              className="w-full h-full object-cover"
              draggable={false}
            />
          </button>
        );
      })}

      {/* Spacer to allow last item to center */}
      <div className="shrink-0 w-[calc(50%-24px)]" />
    </div>
  );
}
