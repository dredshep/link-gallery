"use client";

import type { CopyMode, OutputFormat, SortOrder } from "@/lib/types";
import { useEffect, useState, useRef } from "react";

interface TopBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  tagFilter: string;
  onTagFilterChange: (v: string) => void;
  sort: SortOrder;
  onSortChange: (v: SortOrder) => void;
  copyMode: CopyMode;
  onCopyModeChange: (v: CopyMode) => void;
  outputFormat: OutputFormat;
  onOutputFormatChange: (v: OutputFormat) => void;
  paintMode: boolean;
  onPaintModeChange: (v: boolean) => void;
  hideNsfw: boolean;
  onHideNsfwChange: (v: boolean) => void;
  selectedCount: number;
  onSelectVisible: () => void;
  onInvertVisible: () => void;
  onClearSelection: () => void;
}

export function TopBar({
  search,
  onSearchChange,
  tagFilter,
  onTagFilterChange,
  sort,
  onSortChange,
  copyMode,
  onCopyModeChange,
  outputFormat,
  onOutputFormatChange,
  paintMode,
  onPaintModeChange,
  hideNsfw,
  onHideNsfwChange,
  selectedCount,
  onSelectVisible,
  onInvertVisible,
  onClearSelection,
}: TopBarProps) {
  const [tags, setTags] = useState<{ name: string; count: number }[]>([]);
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    fetch("/api/tags")
      .then((r) => r.json())
      .then((data) => setTags(data.tags));
  }, []);

  useEffect(() => {
    const handler = () => {
      const y = window.scrollY;
      if (y > lastScrollY.current && y > 100) {
        setHidden(true);
      } else {
        setHidden(false);
      }
      lastScrollY.current = y;
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-zinc-800 transition-transform duration-200 ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="max-w-screen-2xl mx-auto">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="flex-1 min-w-[120px] max-w-[280px] h-9 px-3 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <select
            value={tagFilter}
            onChange={(e) => onTagFilterChange(e.target.value)}
            className="h-9 px-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All tags</option>
            {tags.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name} ({t.count})
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortOrder)}
            className="h-9 px-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name">Name</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-3 pb-2">
          {/* Copy mode toggle */}
          <div className="flex items-center gap-0.5 bg-zinc-800 rounded-lg p-0.5 border border-zinc-700">
            <span className="text-[10px] text-zinc-500 px-1 uppercase tracking-wider">Copy:</span>
            <button
              onClick={() => onCopyModeChange("public")}
              className={`h-6 px-2 text-xs rounded-md transition-colors ${
                copyMode === "public" ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Public
            </button>
            <button
              onClick={() => onCopyModeChange("tailscale")}
              className={`h-6 px-2 text-xs rounded-md transition-colors ${
                copyMode === "tailscale" ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              TS
            </button>
          </div>

          {/* Output format toggle */}
          <div className="flex items-center gap-0.5 bg-zinc-800 rounded-lg p-0.5 border border-zinc-700">
            <span className="text-[10px] text-zinc-500 px-1 uppercase tracking-wider">Fmt:</span>
            <button
              onClick={() => onOutputFormatChange("markdown")}
              className={`h-6 px-2 text-xs rounded-md transition-colors ${
                outputFormat === "markdown" ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              MD
            </button>
            <button
              onClick={() => onOutputFormatChange("url")}
              className={`h-6 px-2 text-xs rounded-md transition-colors ${
                outputFormat === "url" ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              URL
            </button>
          </div>

          <button
            onClick={() => onPaintModeChange(!paintMode)}
            className={`h-7 px-3 text-xs rounded-lg font-medium transition-colors ${
              paintMode
                ? "bg-amber-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700"
            }`}
          >
            Paint {paintMode ? "ON" : "Off"}
          </button>

          <button
            onClick={() => onHideNsfwChange(!hideNsfw)}
            className={`h-7 px-3 text-xs rounded-lg font-medium transition-colors ${
              hideNsfw
                ? "bg-rose-900 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700"
            }`}
            title={hideNsfw ? "NSFW content hidden" : "Showing all content"}
          >
            {hideNsfw ? "Show NSFW" : "Hide NSFW"}
          </button>

          <button
            onClick={onSelectVisible}
            className="h-7 px-2 text-xs bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-lg hover:text-zinc-200 transition-colors"
          >
            Select all
          </button>
          <button
            onClick={onInvertVisible}
            className="h-7 px-2 text-xs bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-lg hover:text-zinc-200 transition-colors"
          >
            Invert
          </button>
          {selectedCount > 0 && (
            <button
              onClick={onClearSelection}
              className="h-7 px-2 text-xs bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-lg hover:text-zinc-200 transition-colors"
            >
              Clear ({selectedCount})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
