"use client";

import { useCallback, useRef } from "react";
import type { Asset } from "@/lib/types";

interface ImageTileProps {
  asset: Asset;
  index: number;
  columns: number;
  isSelected: boolean;
  selectionActive: boolean;
  paintMode: boolean;
  hideNsfw: boolean;
  fadingOut: boolean;
  onSelect: (asset: Asset, index: number, shiftKey: boolean) => void;
  onOpen: (asset: Asset) => void;
  onLongPressStart: (assetId: string) => void;
  onPaintMove: (assetId: string) => void;
}

export function ImageTile({
  asset,
  index,
  columns,
  isSelected,
  selectionActive,
  paintMode,
  hideNsfw,
  fadingOut,
  onSelect,
  onOpen,
  onLongPressStart,
  onPaintMove,
}: ImageTileProps) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const didPaintDrag = useRef(false);
  const tileRef = useRef<HTMLDivElement>(null);
  const activePointerIdRef = useRef<number | null>(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      didLongPress.current = false;
      didPaintDrag.current = false;
      pointerStart.current = { x: e.clientX, y: e.clientY };
      activePointerIdRef.current = e.pointerId;

      if (paintMode) {
        e.preventDefault();
        return;
      }

      longPressTimer.current = setTimeout(() => {
        didLongPress.current = true;
        onLongPressStart(asset.id);
        navigator.vibrate?.(30);
        if (tileRef.current && activePointerIdRef.current !== null) {
          try { tileRef.current.releasePointerCapture(activePointerIdRef.current); } catch { /* no capture held */ }
        }
      }, 400);
    },
    [paintMode, asset.id, onLongPressStart]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!pointerStart.current) return;

      const dx = e.clientX - pointerStart.current.x;
      const dy = e.clientY - pointerStart.current.y;
      const moved = Math.abs(dx) > 8 || Math.abs(dy) > 8;

      if (paintMode && e.pressure > 0) {
        if (moved && !didPaintDrag.current) {
          didPaintDrag.current = true;
          onLongPressStart(asset.id);
        }
        if (didPaintDrag.current) {
          onPaintMove(asset.id);
        }
        return;
      }

      if (!didLongPress.current && moved) {
        clearLongPress();
      }

      if (didLongPress.current && e.pressure > 0) {
        onPaintMove(asset.id);
      }
    },
    [paintMode, asset.id, onPaintMove, onLongPressStart, clearLongPress]
  );

  const handlePointerUp = useCallback(() => {
    clearLongPress();
    pointerStart.current = null;
  }, [clearLongPress]);

  const handlePointerEnter = useCallback(
    (e: React.PointerEvent) => {
      if (e.pressure > 0 && (didPaintDrag.current || didLongPress.current)) {
        onPaintMove(asset.id);
      }
    },
    [asset.id, onPaintMove]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (didLongPress.current) {
        didLongPress.current = false;
        return;
      }
      if (didPaintDrag.current) return;

      // Shift+click always does range select
      if (e.shiftKey) {
        onSelect(asset, index, true);
        return;
      }

      // Ctrl/Cmd+click toggles selection
      if (e.ctrlKey || e.metaKey) {
        onSelect(asset, index, false);
        return;
      }

      // In paint mode or selection active: tap toggles selection
      if (paintMode || selectionActive) {
        onSelect(asset, index, false);
        return;
      }

      onOpen(asset);
    },
    [paintMode, selectionActive, asset, index, onSelect, onOpen]
  );

  const titleText = [
    asset.displayName,
    asset.tags.length > 0 ? `[${asset.tags.join(", ")}]` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const shouldBlur = hideNsfw && asset.nsfw;

  return (
    <div
      ref={tileRef}
      data-asset-id={asset.id}
      className={`relative aspect-square overflow-hidden cursor-pointer select-none ${
        isSelected
          ? "ring-2 ring-blue-400 ring-inset z-10"
          : "hover:ring-1 hover:ring-zinc-600 hover:ring-inset"
      }`}
      title={titleText}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerEnter={handlePointerEnter}
      onClick={handleClick}
      onContextMenu={(e) => e.preventDefault()}
      onGotPointerCapture={(e) => {
        if (paintMode || didLongPress.current) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      }}
      style={{
        touchAction: "manipulation",
        ...(fadingOut ? { animation: "nsfw-fade-out 800ms ease-out forwards", pointerEvents: "none" } : {}),
      }}
    >
      <img
        src={asset.thumbUrl}
        srcSet={`${asset.thumbUrl} 420w, ${asset.rawUrl} 1600w`}
        sizes={`${Math.round(100 / columns)}vw`}
        alt={asset.displayName}
        className={`w-full h-full object-cover pointer-events-none transition-[filter] duration-200 ${
          shouldBlur ? "blur-xl scale-110" : ""
        }`}
        loading="lazy"
        draggable={false}
      />

      {isSelected && (
        <div className="absolute inset-0 bg-blue-500/20 pointer-events-none">
          <div className="absolute top-1 left-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
      )}

      {asset.nsfw && !isSelected && !shouldBlur && (
        <div className="absolute bottom-1 left-1 pointer-events-none">
          <svg className="w-3.5 h-3.5 text-rose-400/70 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <path strokeWidth={2} d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" strokeWidth={2} />
            <line x1="4" y1="2" x2="20" y2="22" strokeWidth={2.5} />
          </svg>
        </div>
      )}

      {asset.tags.length > 0 && !isSelected && (
        <div className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-purple-500 pointer-events-none" />
      )}
    </div>
  );
}
