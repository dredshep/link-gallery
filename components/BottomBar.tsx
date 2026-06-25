"use client";

interface BottomBarProps {
  selectedCount: number;
  onCopyMarkdown: () => void;
  onCopyUrls: () => void;
  onTag: () => void;
  onEditTags: (() => void) | null;
  onToggleNsfw: () => void;
  allSelectedNsfw: boolean;
  onDelete: () => void;
  onClear: () => void;
}

export function BottomBar({
  selectedCount,
  onCopyMarkdown,
  onCopyUrls,
  onTag,
  onEditTags,
  onToggleNsfw,
  allSelectedNsfw,
  onDelete,
  onClear,
}: BottomBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900/95 backdrop-blur-sm border-t border-zinc-700 px-3 py-3">
      <div className="flex items-center justify-between gap-2 max-w-screen-2xl mx-auto">
        <span className="text-sm text-zinc-300 font-medium shrink-0">
          {selectedCount} selected
        </span>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            onClick={onCopyMarkdown}
            className="h-9 px-3 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-500 transition-colors"
          >
            Copy MD
          </button>
          <button
            onClick={onCopyUrls}
            className="h-9 px-3 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-500 transition-colors"
          >
            Copy URLs
          </button>
          <button
            onClick={onTag}
            className="h-9 px-3 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-500 transition-colors"
          >
            Tag
          </button>
          {onEditTags && (
            <button
              onClick={onEditTags}
              className="h-9 px-3 bg-purple-900 text-purple-200 text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
            >
              Edit Tags
            </button>
          )}
          <button
            onClick={onToggleNsfw}
            className={`h-9 px-3 text-sm font-medium rounded-lg transition-colors ${
              allSelectedNsfw
                ? "bg-zinc-700 text-zinc-200 hover:bg-zinc-600"
                : "bg-rose-900 text-white hover:bg-rose-600"
            }`}
          >
            {allSelectedNsfw ? "Unset NSFW" : "Set NSFW"}
          </button>
          <button
            onClick={onDelete}
            className="h-9 px-3 bg-red-700 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
          >
            Delete
          </button>
          <button
            onClick={onClear}
            className="h-9 px-3 bg-zinc-700 text-zinc-200 text-sm font-medium rounded-lg hover:bg-zinc-600 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
