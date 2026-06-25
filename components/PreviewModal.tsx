"use client";

import { useCallback, useState, useEffect, useRef, useMemo } from "react";
import type { Asset } from "@/lib/types";
import { copyToClipboard } from "@/lib/clipboard";
import { ThumbnailStrip } from "./ThumbnailStrip";

interface PreviewModalProps {
  assets: Asset[];
  currentIndex: number;
  baseUrl: string;
  onClose: () => void;
  onNavigate: (direction: "prev" | "next") => void;
  onJumpTo: (id: string) => void;
  onFilterByTag: (tag: string) => void;
  onToggleNsfw: (assetId: string, nsfw: boolean) => void;
  onEditTags: (assetId: string) => void;
}

const DISMISS_THRESHOLD = 120;
const SWIPE_COMMIT_FRACTION = 0.18;
const ANIMATION_MS = 220;

export function PreviewModal({ assets, currentIndex, baseUrl, onClose, onNavigate, onJumpTo, onFilterByTag, onToggleNsfw, onEditTags }: PreviewModalProps) {
  const asset = assets[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < assets.length - 1;
  const prevAsset = hasPrev ? assets[currentIndex - 1] : null;
  const nextAsset = hasNext ? assets[currentIndex + 1] : null;

  const [copied, setCopied] = useState<string | null>(null);
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set());
  const [mobileInfoForId, setMobileInfoForId] = useState<string | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<"prev" | "next" | null>(null);
  const showMobileInfo = mobileInfoForId === asset.id;
  const imageLoaded = loadedIds.has(asset.id);
  const fullUrl = `${baseUrl}/${asset.storedFilename}`;
  const markdown = `![${asset.displayName}](${fullUrl})`;

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const gestureDecided = useRef<"none" | "swipe" | "drag-dismiss">("none");
  const dragYOffset = useRef(0);
  const dragXOffset = useRef(0);
  const animating = useRef(false);
  const mountedAt = useRef(0);

  const cardRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const currentImgRef = useRef<HTMLDivElement>(null);
  const incomingImgRef = useRef<HTMLDivElement>(null);

  // Clear all residual inline styles when asset changes or on mount
  useEffect(() => {
    const card = cardRef.current;
    const current = currentImgRef.current;
    const incoming = incomingImgRef.current;
    const backdrop = backdropRef.current;

    if (card) {
      card.style.transform = "translate3d(0,0,0)";
      card.style.opacity = "";
      card.style.transition = "";
    }
    if (current) {
      current.style.transform = "translate3d(0,0,0)";
      current.style.transition = "";
    }
    if (incoming) {
      incoming.style.transform = "scale(0.7)";
      incoming.style.opacity = "0";
      incoming.style.display = "none";
      incoming.style.transition = "";
    }
    if (backdrop) {
      backdrop.style.background = "";
      backdrop.style.transition = "";
    }

    animating.current = false;
    gestureDecided.current = "none";
    dragYOffset.current = 0;
    dragXOffset.current = 0;
    mountedAt.current = Date.now();
  }, [currentIndex]);

  const stripAssets = useMemo(() => {
    if (!asset || asset.tags.length === 0) return [];
    const firstTag = asset.tags[0];
    return assets.filter((a) => a.tags.includes(firstTag));
  }, [assets, asset]);

  const preloadUrls = useMemo(() => {
    if (stripAssets.length === 0) return [];
    const idx = stripAssets.findIndex((a) => a.id === asset?.id);
    if (idx === -1) return [];
    const urls: string[] = [];
    for (let i = Math.max(0, idx - 3); i <= Math.min(stripAssets.length - 1, idx + 3); i++) {
      if (i !== idx) urls.push(stripAssets[i].rawUrl);
    }
    return urls;
  }, [stripAssets, asset]);

  const copyText = useCallback((text: string, label: string) => {
    const success = copyToClipboard(text);
    if (success) {
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (animating.current) return;
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowLeft":
          if (hasPrev) onNavigate("prev");
          break;
        case "ArrowRight":
          if (hasNext) onNavigate("next");
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, onNavigate, hasPrev, hasNext]);

  const wheelCooldown = useRef(false);

  useEffect(() => {
    const handler = (e: WheelEvent) => {
      if (wheelCooldown.current || animating.current) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 20) {
        e.preventDefault();
        wheelCooldown.current = true;
        setTimeout(() => { wheelCooldown.current = false; }, 400);
        if (e.deltaX > 0 && hasNext) onNavigate("next");
        else if (e.deltaX < 0 && hasPrev) onNavigate("prev");
      }
    };
    window.addEventListener("wheel", handler, { passive: false });
    return () => window.removeEventListener("wheel", handler);
  }, [onNavigate, hasPrev, hasNext]);

  // --- Vertical dismiss visuals ---
  const applyDismissVisuals = useCallback((dy: number) => {
    const progress = Math.min(Math.abs(dy) / DISMISS_THRESHOLD, 1);
    const opacity = 1 - progress * 0.6;
    if (cardRef.current) {
      cardRef.current.style.transform = `translate3d(0,${dy}px,0) scale(${1 - progress * 0.05})`;
      cardRef.current.style.opacity = String(opacity);
    }
    if (backdropRef.current) {
      backdropRef.current.style.background = `rgba(0,0,0,${0.95 - progress * 0.5})`;
    }
  }, []);

  const resetDismissVisuals = useCallback(() => {
    if (cardRef.current) {
      cardRef.current.style.transition = "transform 0.2s ease, opacity 0.2s ease";
      cardRef.current.style.transform = "translate3d(0,0,0)";
      cardRef.current.style.opacity = "";
      setTimeout(() => { if (cardRef.current) cardRef.current.style.transition = ""; }, 200);
    }
    if (backdropRef.current) {
      backdropRef.current.style.transition = "background 0.2s ease";
      backdropRef.current.style.background = "";
      setTimeout(() => { if (backdropRef.current) backdropRef.current.style.transition = ""; }, 200);
    }
  }, []);

  // --- Horizontal swipe visuals ---
  const applySwipeVisuals = useCallback((dx: number) => {
    const vw = window.innerWidth;
    const threshold = vw * SWIPE_COMMIT_FRACTION;
    const progress = Math.min(Math.abs(dx) / threshold, 1);

    if (currentImgRef.current) {
      currentImgRef.current.style.transform = `translate3d(${dx}px,0,0)`;
    }
    if (incomingImgRef.current) {
      const scale = 0.7 + progress * 0.3;
      const opacity = 0.15 + progress * 0.85;
      incomingImgRef.current.style.transform = `scale(${scale})`;
      incomingImgRef.current.style.opacity = String(opacity);
      incomingImgRef.current.style.display = "flex";
    }
  }, []);

  const resetSwipeVisuals = useCallback(() => {
    if (currentImgRef.current) {
      currentImgRef.current.style.transition = `transform ${ANIMATION_MS}ms ease-out`;
      currentImgRef.current.style.transform = "translate3d(0,0,0)";
      setTimeout(() => {
        if (currentImgRef.current) {
          currentImgRef.current.style.transition = "";
        }
      }, ANIMATION_MS);
    }
    if (incomingImgRef.current) {
      incomingImgRef.current.style.transition = `transform ${ANIMATION_MS}ms ease-out, opacity ${ANIMATION_MS}ms ease-out`;
      incomingImgRef.current.style.transform = "scale(0.7)";
      incomingImgRef.current.style.opacity = "0";
      setTimeout(() => {
        if (incomingImgRef.current) {
          incomingImgRef.current.style.transition = "";
          incomingImgRef.current.style.display = "none";
        }
        setSwipeDirection(null);
      }, ANIMATION_MS);
    } else {
      setSwipeDirection(null);
    }
  }, []);

  const commitSwipe = useCallback((direction: "prev" | "next") => {
    animating.current = true;
    const vw = window.innerWidth;
    const targetX = direction === "next" ? -vw : vw;

    if (currentImgRef.current) {
      currentImgRef.current.style.transition = `transform ${ANIMATION_MS}ms ease-out`;
      currentImgRef.current.style.transform = `translate3d(${targetX}px,0,0)`;
    }
    if (incomingImgRef.current) {
      incomingImgRef.current.style.transition = `transform ${ANIMATION_MS}ms ease-out, opacity ${ANIMATION_MS}ms ease-out`;
      incomingImgRef.current.style.transform = "scale(1)";
      incomingImgRef.current.style.opacity = "1";
    }

    setTimeout(() => {
      if (currentImgRef.current) {
        currentImgRef.current.style.transition = "";
        currentImgRef.current.style.transform = "translate3d(0,0,0)";
      }
      if (incomingImgRef.current) {
        incomingImgRef.current.style.transition = "";
        incomingImgRef.current.style.transform = "";
        incomingImgRef.current.style.opacity = "";
        incomingImgRef.current.style.display = "none";
      }
      animating.current = false;
      setSwipeDirection(null);
      onNavigate(direction);
    }, ANIMATION_MS);
  }, [onNavigate]);

  // --- Touch gesture handling ---
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (animating.current) return;
    if (e.touches.length === 1) {
      touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      gestureDecided.current = "none";
      dragYOffset.current = 0;
      dragXOffset.current = 0;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current || e.touches.length !== 1 || animating.current) return;
    const dx = e.touches[0].clientX - touchStart.current.x;
    const dy = e.touches[0].clientY - touchStart.current.y;

    if (gestureDecided.current === "none") {
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (absDx < 10 && absDy < 10) return;
      gestureDecided.current = absDx > absDy ? "swipe" : "drag-dismiss";
    }

    if (gestureDecided.current === "drag-dismiss") {
      e.preventDefault();
      dragYOffset.current = dy;
      applyDismissVisuals(dy);
    } else if (gestureDecided.current === "swipe") {
      e.preventDefault();
      const canSwipe = (dx < 0 && hasNext) || (dx > 0 && hasPrev);
      dragXOffset.current = canSwipe ? dx : dx * 0.2;
      const dir = dx < 0 ? "next" : dx > 0 ? "prev" : null;
      setSwipeDirection(dir);
      applySwipeVisuals(canSwipe ? dx : dx * 0.2);
    }
  }, [applyDismissVisuals, applySwipeVisuals, hasNext, hasPrev]);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current || e.changedTouches.length === 0 || animating.current) return;
      const gesture = gestureDecided.current;
      touchStart.current = null;

      if (gesture === "swipe") {
        const dx = dragXOffset.current;
        const vw = window.innerWidth;
        const threshold = vw * SWIPE_COMMIT_FRACTION;

        if (dx < -threshold && hasNext) {
          commitSwipe("next");
        } else if (dx > threshold && hasPrev) {
          commitSwipe("prev");
        } else {
          resetSwipeVisuals();
        }
      } else if (gesture === "drag-dismiss") {
        if (Math.abs(dragYOffset.current) > DISMISS_THRESHOLD) {
          onClose();
        } else {
          resetDismissVisuals();
        }
      } else {
        setMobileInfoForId((prev) => prev === asset.id ? null : asset.id);
      }

      gestureDecided.current = "none";
      dragYOffset.current = 0;
      dragXOffset.current = 0;
    },
    [hasNext, hasPrev, onClose, resetDismissVisuals, resetSwipeVisuals, commitSwipe, asset.id]
  );

  const handleTagClick = useCallback(
    (tag: string) => {
      onFilterByTag(tag);
      onClose();
    },
    [onFilterByTag, onClose]
  );

  const handleImageLoad = useCallback((id: string) => {
    setLoadedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const handleBackdropClick = useCallback(() => {
    if (Date.now() - mountedAt.current < 100) return;
    onClose();
  }, [onClose]);

  const incomingAsset = swipeDirection === "next" ? nextAsset : swipeDirection === "prev" ? prevAsset : null;

  if (!asset) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/95 md:bg-black/90 select-none"
      onClick={handleBackdropClick}
    >
      {/* Desktop navigation arrows */}
      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate("prev"); }}
          className="hidden md:flex shrink-0 w-10 h-10 mx-2 bg-black/60 hover:bg-black/80 rounded-full items-center justify-center text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      {!hasPrev && <div className="hidden md:block w-14 shrink-0" />}

      {/* Main content area */}
      <div
        ref={cardRef}
        className="relative flex flex-col items-center max-w-full md:max-w-[calc(100vw-8rem)] xl:max-w-[1000px] max-h-[100dvh] md:max-h-[92vh]"
        style={{ touchAction: "none", transform: "translate3d(0,0,0)" }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Thumbnail strip — above image */}
        {stripAssets.length > 1 && (
          <ThumbnailStrip
            assets={stripAssets}
            currentId={asset.id}
            onJumpTo={onJumpTo}
          />
        )}

        {/* Image layer — holds current and incoming during swipe */}
        <div className="relative min-h-0 flex-1" style={{ overflow: "clip" }}>
          {/* Incoming image (behind — rendered first in DOM) */}
          <div
            ref={incomingImgRef}
            className="absolute inset-0 flex items-center justify-center"
            style={{ display: "none", opacity: 0, transform: "scale(0.7)" }}
          >
            {incomingAsset && (
              <img
                src={incomingAsset.rawUrl}
                alt={incomingAsset.displayName}
                className="max-w-[100vw] max-h-full md:max-w-[calc(100vw-8rem)] xl:max-w-[1000px] md:max-h-[80vh] md:rounded-t-xl object-contain"
                draggable={false}
                onLoad={() => handleImageLoad(incomingAsset.id)}
              />
            )}
          </div>

          {/* Current image (on top — DOM order handles stacking) */}
          <div ref={currentImgRef} className="flex items-center justify-center" style={{ transform: "translate3d(0,0,0)" }}>
            {!imageLoaded && (
              <div className="w-48 h-48 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
              </div>
            )}
            <img
              src={asset.rawUrl}
              alt={asset.displayName}
              className={`max-w-[100vw] max-h-full md:max-w-[calc(100vw-8rem)] xl:max-w-[1000px] md:max-h-[80vh] md:rounded-t-xl object-contain transition-opacity duration-150 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
              draggable={false}
              onLoad={() => handleImageLoad(asset.id)}
            />
          </div>
        </div>

        {/* Mobile info overlay — shown on tap */}
        {imageLoaded && showMobileInfo && (
          <div className="absolute inset-x-0 bottom-0 md:hidden bg-gradient-to-t from-black/90 via-black/70 to-transparent pt-12 pb-4 px-4 flex flex-col gap-2 z-10">
            <span className="text-sm font-medium text-zinc-100 truncate">{asset.displayName}</span>
            <div className="flex flex-wrap gap-1 items-center">
              {asset.tags.map((tag, i) => (
                <button
                  key={tag}
                  onClick={() => handleTagClick(tag)}
                  className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                    i === 0
                      ? "bg-purple-600/30 text-purple-300 border border-purple-500/50 hover:bg-purple-600 hover:text-white"
                      : "bg-zinc-800/80 text-zinc-300 hover:bg-purple-600 hover:text-white"
                  }`}
                >
                  {tag}
                </button>
              ))}
              <button
                onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); onEditTags(asset.id); }}
                onClick={(e) => { e.stopPropagation(); onEditTags(asset.id); }}
                className="px-2 py-0.5 bg-zinc-800/50 text-zinc-500 text-xs rounded-full hover:bg-zinc-700 hover:text-zinc-300 transition-colors border border-zinc-700/50"
              >
                <svg className="w-3 h-3 inline-block mr-0.5 -mt-px" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                edit
              </button>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={() => copyText(markdown, "md")}
                className="h-8 px-3 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-500 transition-colors"
              >
                {copied === "md" ? "Copied!" : "Copy MD"}
              </button>
              <button
                onClick={() => copyText(fullUrl, "url")}
                className="h-8 px-3 bg-sky-600 text-white text-xs font-medium rounded-lg hover:bg-sky-500 transition-colors"
              >
                {copied === "url" ? "Copied!" : "Copy URL"}
              </button>
              <button
                onClick={() => onToggleNsfw(asset.id, !asset.nsfw)}
                className={`h-8 px-3 ml-auto text-xs font-medium rounded-lg transition-colors ${
                  asset.nsfw
                    ? "bg-rose-900 text-white hover:bg-rose-600"
                    : "bg-zinc-800/80 text-zinc-500 hover:text-zinc-300 border border-zinc-700"
                }`}
              >
                {asset.nsfw ? "NSFW" : "SFW"}
              </button>
            </div>
          </div>
        )}

        {/* Mobile close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 md:hidden w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white z-10"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Desktop info section — always visible */}
        {imageLoaded && (
          <div className="hidden md:flex w-full bg-zinc-900 rounded-b-xl px-4 py-3 border-t border-zinc-800 flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-200 truncate">{asset.displayName}</span>
              <button
                onClick={onClose}
                className="text-zinc-400 hover:text-zinc-100 transition-colors shrink-0 ml-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="text-xs text-zinc-500 font-mono truncate">{asset.storedFilename}</div>
            <div className="flex flex-wrap gap-1 items-center">
              {asset.tags.map((tag, i) => (
                <button
                  key={tag}
                  onClick={() => handleTagClick(tag)}
                  className={`px-2 py-0.5 text-xs rounded-full transition-colors cursor-pointer ${
                    i === 0
                      ? "bg-purple-600/30 text-purple-300 border border-purple-500/50 hover:bg-purple-600 hover:text-white"
                      : "bg-zinc-800 text-zinc-300 hover:bg-purple-600 hover:text-white"
                  }`}
                >
                  {tag}
                </button>
              ))}
              <button
                onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); onEditTags(asset.id); }}
                onClick={(e) => { e.stopPropagation(); onEditTags(asset.id); }}
                className="px-2 py-0.5 bg-zinc-800/50 text-zinc-500 text-xs rounded-full hover:bg-zinc-700 hover:text-zinc-300 transition-colors border border-zinc-700/50"
                title="Edit tags"
              >
                <svg className="w-3 h-3 inline-block mr-0.5 -mt-px" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                edit
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => copyText(markdown, "md")}
                className="h-8 px-3 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-500 transition-colors"
              >
                {copied === "md" ? "Copied!" : "Copy MD"}
              </button>
              <button
                onClick={() => copyText(fullUrl, "url")}
                className="h-8 px-3 bg-sky-600 text-white text-xs font-medium rounded-lg hover:bg-sky-500 transition-colors"
              >
                {copied === "url" ? "Copied!" : "Copy URL"}
              </button>
              <button
                onClick={() => onToggleNsfw(asset.id, !asset.nsfw)}
                className={`h-8 px-3 ml-auto text-xs font-medium rounded-lg transition-colors ${
                  asset.nsfw
                    ? "bg-rose-900 text-white hover:bg-rose-600"
                    : "bg-zinc-800 text-zinc-500 hover:text-zinc-300 border border-zinc-700"
                }`}
                title={asset.nsfw ? "Marked NSFW" : "Mark as NSFW"}
              >
                {asset.nsfw ? "NSFW" : "SFW"}
              </button>
            </div>
          </div>
        )}
      </div>

      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate("next"); }}
          className="hidden md:flex shrink-0 w-10 h-10 mx-2 bg-black/60 hover:bg-black/80 rounded-full items-center justify-center text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
      {!hasNext && <div className="hidden md:block w-14 shrink-0" />}

      {/* Preload neighboring images for smooth strip scrubbing */}
      <div className="hidden">
        {preloadUrls.map((url) => (
          <img key={url} src={url} alt="" />
        ))}
      </div>
    </div>
  );
}
