"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Asset, AppConfig, CopyMode, OutputFormat, SortOrder } from "@/lib/types";
import { copyToClipboard } from "@/lib/clipboard";
import { ImageTile } from "./ImageTile";
import { TopBar } from "./TopBar";
import { BottomBar } from "./BottomBar";
import { UploadModal } from "./UploadModal";
import { TagModal } from "./TagModal";
import { PreviewModal } from "./PreviewModal";
import { DeleteModal } from "./DeleteModal";

export function Gallery() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [copyMode, setCopyMode] = useState<CopyMode>("public");
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("markdown");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [paintMode, setPaintMode] = useState(false);
  const [hideNsfw, setHideNsfw] = useState(false);
  const [fadingOutIds, setFadingOutIds] = useState<Set<string>>(new Set());
  const lastClickedIndex = useRef<number | null>(null);

  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editTagsIds, setEditTagsIds] = useState<string[] | null>(null);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const paintedInStroke = useRef<Set<string>>(new Set());
  const isPaintingRef = useRef(false);
  const paintModeRef = useRef(false);
  useEffect(() => { paintModeRef.current = paintMode; }, [paintMode]);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data: AppConfig) => {
        setAppConfig(data);
        setCopyMode(data.defaultCopyMode);
      });
  }, []);

  const fetchAssets = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (tagFilter) params.set("tag", tagFilter);
      if (sort) params.set("sort", sort);
      if (hideNsfw) params.set("hideNsfw", "1");
      if (cursor) params.set("cursor", cursor);

      const res = await fetch(`/api/assets?${params}`);
      const data = await res.json();
      setAssets((prev) => (cursor ? [...prev, ...data.assets] : data.assets));
      setNextCursor(data.nextCursor);
      setLoading(false);
      setInitialLoading(false);
    },
    [search, tagFilter, sort, hideNsfw]
  );

  const loadGeneration = useRef(0);

  useEffect(() => {
    const gen = ++loadGeneration.current;

    const load = async () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (tagFilter) params.set("tag", tagFilter);
      if (sort) params.set("sort", sort);
      if (hideNsfw) params.set("hideNsfw", "1");

      const res = await fetch(`/api/assets?${params}`);
      const data = await res.json();
      if (gen === loadGeneration.current) {
        setAssets(data.assets);
        setNextCursor(data.nextCursor);
        setInitialLoading(false);
      }
    };

    load();
  }, [search, tagFilter, sort, hideNsfw]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextCursor && !loading) {
          fetchAssets(nextCursor);
        }
      },
      { rootMargin: "400px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [nextCursor, loading, fetchAssets]);

  const handleSelect = useCallback(
    (asset: Asset, index: number, shiftKey: boolean) => {
      if (shiftKey && lastClickedIndex.current !== null) {
        const start = Math.min(lastClickedIndex.current, index);
        const end = Math.max(lastClickedIndex.current, index);
        setSelected((prev) => {
          const next = new Set(prev);
          for (let i = start; i <= end; i++) {
            next.add(assets[i].id);
          }
          return next;
        });
      } else {
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(asset.id)) next.delete(asset.id);
          else next.add(asset.id);
          if (next.size === 0) setPaintMode(false);
          return next;
        });
      }
      lastClickedIndex.current = index;
    },
    [assets]
  );

  const handleLongPressStart = useCallback((assetId: string) => {
    isPaintingRef.current = true;
    paintedInStroke.current = new Set([assetId]);
    setPaintMode(true);
    const idx = assets.findIndex((a) => a.id === assetId);
    if (idx !== -1) lastClickedIndex.current = idx;
    setSelected((prev) => {
      const next = new Set(prev);
      next.add(assetId);
      return next;
    });
  }, [assets]);

  const handlePaintMove = useCallback(
    (assetId: string) => {
      if (!isPaintingRef.current && !paintMode) return;
      if (paintedInStroke.current.has(assetId)) return;
      paintedInStroke.current.add(assetId);
      setSelected((prev) => {
        const next = new Set(prev);
        next.add(assetId);
        return next;
      });
    },
    [paintMode]
  );

  useEffect(() => {
    let scrollRaf: number | null = null;
    let ptrX = 0;
    let ptrY = 0;
    const EDGE = 80;
    const MAX_SPEED = 12;

    const paintTileAtPointer = () => {
      const el = document.elementFromPoint(ptrX, ptrY);
      if (!el) return;
      const tile = (el as HTMLElement).closest<HTMLElement>("[data-asset-id]");
      const id = tile?.dataset.assetId;
      if (id) handlePaintMove(id);
    };

    const scrollStep = () => {
      if (!isPaintingRef.current) { scrollRaf = null; return; }
      const vh = window.innerHeight;
      let dy = 0;
      if (ptrY < EDGE) {
        dy = -Math.ceil(MAX_SPEED * (1 - ptrY / EDGE));
      } else if (ptrY > vh - EDGE) {
        dy = Math.ceil(MAX_SPEED * (1 - (vh - ptrY) / EDGE));
      }
      if (dy === 0) { scrollRaf = null; return; }
      window.scrollBy(0, dy);
      paintTileAtPointer();
      scrollRaf = requestAnimationFrame(scrollStep);
    };

    const upHandler = () => {
      isPaintingRef.current = false;
      paintedInStroke.current = new Set();
      if (scrollRaf) { cancelAnimationFrame(scrollRaf); scrollRaf = null; }
    };

    const moveHandler = (e: PointerEvent) => {
      if (!isPaintingRef.current) return;
      ptrX = e.clientX;
      ptrY = e.clientY;
      paintTileAtPointer();
      const vh = window.innerHeight;
      if ((ptrY < EDGE || ptrY > vh - EDGE) && !scrollRaf) {
        scrollRaf = requestAnimationFrame(scrollStep);
      }
    };

    const touchMoveHandler = (e: TouchEvent) => {
      if ((isPaintingRef.current || paintModeRef.current) && e.touches.length <= 1) {
        e.preventDefault();
      }
    };

    window.addEventListener("pointerup", upHandler);
    window.addEventListener("pointercancel", upHandler);
    window.addEventListener("pointermove", moveHandler);
    window.addEventListener("touchmove", touchMoveHandler, { passive: false });
    return () => {
      window.removeEventListener("pointerup", upHandler);
      window.removeEventListener("pointercancel", upHandler);
      window.removeEventListener("pointermove", moveHandler);
      window.removeEventListener("touchmove", touchMoveHandler);
      if (scrollRaf) cancelAnimationFrame(scrollRaf);
    };
  }, [handlePaintMove]);

  const selectVisible = useCallback(() => {
    setSelected(new Set(assets.map((a) => a.id)));
  }, [assets]);

  const invertVisible = useCallback(() => {
    setSelected((prev) => {
      const next = new Set<string>();
      for (const a of assets) {
        if (!prev.has(a.id)) next.add(a.id);
      }
      return next;
    });
  }, [assets]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
    setPaintMode(false);
    lastClickedIndex.current = null;
  }, []);

  const getBaseUrl = useCallback(() => {
    if (!appConfig) return "";
    return copyMode === "public"
      ? appConfig.publicImageBaseUrl
      : appConfig.tailscaleImageBaseUrl;
  }, [appConfig, copyMode]);

  const handleCopy = useCallback(
    (format?: OutputFormat) => {
      const fmt = format ?? outputFormat;
      const baseUrl = getBaseUrl();
      const selectedAssets = assets.filter((a) => selected.has(a.id));

      let text: string;
      if (fmt === "markdown") {
        text = selectedAssets
          .map((a) => `![${a.displayName}](${baseUrl}/${a.storedFilename})`)
          .join("\n");
      } else {
        text = selectedAssets
          .map((a) => `${baseUrl}/${a.storedFilename}`)
          .join("\n");
      }

      const success = copyToClipboard(text);
      if (success) {
        setCopyFeedback(`Copied ${selectedAssets.length} ${fmt === "markdown" ? "MD links" : "URLs"}`);
        setTimeout(() => setCopyFeedback(null), 2000);
      } else {
        setFallbackText(text);
      }
    },
    [assets, selected, outputFormat, getBaseUrl]
  );

  const handleUploadComplete = useCallback(
    (newAssets: Asset[]) => {
      setAssets((prev) => {
        const existingIds = new Set(prev.map((a) => a.id));
        const fresh = newAssets.filter((a) => !existingIds.has(a.id));
        return [...fresh, ...prev];
      });
      setShowUpload(false);
    },
    []
  );

  const handleDeleteComplete = useCallback(
    (deletedIds: string[]) => {
      const deletedSet = new Set(deletedIds);
      setAssets((prev) => prev.filter((a) => !deletedSet.has(a.id)));
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of deletedIds) next.delete(id);
        return next;
      });
      setShowDeleteModal(false);
    },
    []
  );

  const previewClosedAt = useRef(0);

  const handleOpenPreview = useCallback((asset: Asset) => {
    if (Date.now() - previewClosedAt.current < 300) return;
    setPreviewAsset(asset);
  }, []);

  const handlePreviewNavigate = useCallback(
    (direction: "prev" | "next") => {
      if (!previewAsset) return;
      const currentIdx = assets.findIndex((a) => a.id === previewAsset.id);
      if (currentIdx === -1) return;

      const newIdx = direction === "next" ? currentIdx + 1 : currentIdx - 1;
      if (newIdx >= 0 && newIdx < assets.length) {
        setPreviewAsset(assets[newIdx]);
      }
    },
    [assets, previewAsset]
  );

  const handleJumpTo = useCallback(
    (id: string) => {
      const target = assets.find((a) => a.id === id);
      if (target) setPreviewAsset(target);
    },
    [assets]
  );

  const handleToggleNsfw = useCallback(
    async (assetId: string, nsfw: boolean) => {
      await fetch("/api/assets/nsfw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetIds: [assetId], nsfw }),
      });
      setAssets((prev) =>
        prev.map((a) => (a.id === assetId ? { ...a, nsfw } : a))
      );
      if (nsfw && hideNsfw) {
        setFadingOutIds((prev) => new Set(prev).add(assetId));
        setTimeout(() => {
          setFadingOutIds((prev) => {
            const next = new Set(prev);
            next.delete(assetId);
            return next;
          });
          setAssets((prev) => prev.filter((a) => a.id !== assetId));
          setPreviewAsset((prev) => (prev?.id === assetId ? null : prev));
        }, 800);
      }
    },
    [hideNsfw]
  );

  const handleBulkNsfw = useCallback(async () => {
    const selectedAssets = assets.filter((a) => selected.has(a.id));
    const allNsfw = selectedAssets.every((a) => a.nsfw);
    const newNsfw = !allNsfw;
    const ids = Array.from(selected);

    await fetch("/api/assets/nsfw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetIds: ids, nsfw: newNsfw }),
    });
    setAssets((prev) =>
      prev.map((a) => (selected.has(a.id) ? { ...a, nsfw: newNsfw } : a))
    );
    if (newNsfw && hideNsfw) {
      const idSet = new Set(ids);
      setFadingOutIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.add(id);
        return next;
      });
      setTimeout(() => {
        setFadingOutIds((prev) => {
          const next = new Set(prev);
          for (const id of ids) next.delete(id);
          return next;
        });
        setAssets((prev) => prev.filter((a) => !idSet.has(a.id)));
        setSelected(new Set());
      }, 800);
    }
  }, [assets, selected, hideNsfw]);

  const handleFilterByTag = useCallback((tag: string) => {
    setSearch(tag);
  }, []);

  const handleEditTags = useCallback((assetIds: string[]) => {
    setEditTagsIds(assetIds);
  }, []);

  const handleEditTagsComplete = useCallback((updatedTags?: string[]) => {
    if (updatedTags && editTagsIds) {
      const tagSet = new Set(editTagsIds);
      setAssets((prev) =>
        prev.map((a) => tagSet.has(a.id) ? { ...a, tags: updatedTags } : a)
      );
    }
    setEditTagsIds(null);
  }, [editTagsIds]);

  return (
    <div className="flex flex-col h-full min-h-screen bg-[#0a0a0a]">
      <TopBar
        search={search}
        onSearchChange={setSearch}
        tagFilter={tagFilter}
        onTagFilterChange={setTagFilter}
        sort={sort}
        onSortChange={setSort}
        copyMode={copyMode}
        onCopyModeChange={setCopyMode}
        outputFormat={outputFormat}
        onOutputFormatChange={setOutputFormat}
        paintMode={paintMode}
        onPaintModeChange={setPaintMode}
        hideNsfw={hideNsfw}
        onHideNsfwChange={setHideNsfw}
        selectedCount={selected.size}
        onSelectVisible={selectVisible}
        onInvertVisible={invertVisible}
        onClearSelection={clearSelection}
      />

      <div
        className="flex-1 pt-[120px] pb-20"
        style={{ touchAction: "auto" }}
      >
        <div className="max-w-screen-2xl mx-auto">
          {initialLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-zinc-500 text-lg">Loading...</div>
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="text-zinc-500 text-lg">No images yet</div>
              <button
                onClick={() => setShowUpload(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
              >
                Upload images
              </button>
            </div>
          ) : (
            <div
              className="grid gap-[2px]"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              }}
            >
              {assets.map((asset, idx) => (
                <ImageTile
                  key={asset.id}
                  asset={asset}
                  index={idx}
                  isSelected={selected.has(asset.id)}
                  selectionActive={selected.size > 0}
                  paintMode={paintMode}
                  hideNsfw={hideNsfw}
                  fadingOut={fadingOutIds.has(asset.id)}
                  onSelect={handleSelect}
                  onOpen={handleOpenPreview}
                  onLongPressStart={handleLongPressStart}
                  onPaintMove={handlePaintMove}
                />
              ))}
            </div>
          )}

          <div ref={sentinelRef} className="h-4" />
          {loading && !initialLoading && (
            <div className="flex justify-center py-4">
              <div className="text-zinc-500">Loading more...</div>
            </div>
          )}
        </div>
      </div>

      {/* FAB upload button */}
      {selected.size === 0 && (
        <button
          onClick={() => setShowUpload(true)}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
          title="Upload images"
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}

      {selected.size > 0 && (() => {
        const selAssets = assets.filter((a) => selected.has(a.id));
        const allSameTags = selAssets.length > 0 && selAssets.every((a) =>
          a.tags.length === selAssets[0].tags.length && a.tags.every((t, i) => t === selAssets[0].tags[i])
        );
        return (
          <BottomBar
            selectedCount={selected.size}
            onCopyMarkdown={() => handleCopy("markdown")}
            onCopyUrls={() => handleCopy("url")}
            onTag={() => setShowTagModal(true)}
            onEditTags={allSameTags && selAssets[0].tags.length > 0 ? () => handleEditTags(Array.from(selected)) : null}
            onToggleNsfw={handleBulkNsfw}
            allSelectedNsfw={selAssets.length > 0 && selAssets.every((a) => a.nsfw)}
            onDelete={() => setShowDeleteModal(true)}
            onClear={clearSelection}
          />
        );
      })()}

      {copyFeedback && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[80] bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg pointer-events-none">
          {copyFeedback}
        </div>
      )}

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onComplete={handleUploadComplete}
        />
      )}

      {showTagModal && (
        <TagModal
          mode="add"
          selectedIds={Array.from(selected)}
          onClose={() => setShowTagModal(false)}
          onComplete={() => {
            setShowTagModal(false);
            fetchAssets();
          }}
        />
      )}

      {editTagsIds && (() => {
        const editAssets = assets.filter((a) => editTagsIds.includes(a.id));
        const commonTags = editAssets.length > 0
          ? editAssets[0].tags.filter((t) => editAssets.every((a) => a.tags.includes(t)))
          : [];
        return (
          <TagModal
            mode="edit"
            selectedIds={editTagsIds}
            existingTags={commonTags}
            onClose={() => setEditTagsIds(null)}
            onComplete={handleEditTagsComplete}
          />
        );
      })()}

      {showDeleteModal && (
        <DeleteModal
          selectedIds={Array.from(selected)}
          onClose={() => setShowDeleteModal(false)}
          onComplete={handleDeleteComplete}
        />
      )}

      {previewAsset && (
        <PreviewModal
          assets={assets}
          currentIndex={assets.findIndex((a) => a.id === previewAsset.id)}
          baseUrl={getBaseUrl()}
          onClose={() => { previewClosedAt.current = Date.now(); setPreviewAsset(null); }}
          onNavigate={handlePreviewNavigate}
          onJumpTo={handleJumpTo}
          onFilterByTag={handleFilterByTag}
          onToggleNsfw={handleToggleNsfw}
          onEditTags={(assetId) => handleEditTags([assetId])}
        />
      )}

      {fallbackText !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
          <div className="bg-zinc-900 rounded-xl p-6 w-full max-w-lg flex flex-col gap-4">
            <h3 className="text-lg font-semibold">Copy failed — select manually:</h3>
            <textarea
              className="w-full h-64 bg-zinc-800 text-zinc-100 rounded-lg p-3 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={fallbackText}
              readOnly
              autoFocus
              onFocus={(e) => e.target.select()}
            />
            <button
              onClick={() => setFallbackText(null)}
              className="px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
