"use client";

import { useState, useCallback, useRef, useEffect, useLayoutEffect } from "react";

interface TagModalProps {
  mode: "add" | "edit";
  selectedIds: string[];
  existingTags?: string[];
  onClose: () => void;
  onComplete: (updatedTags?: string[]) => void;
}

interface DragState {
  pill: string;
  cx: number;
  cy: number;
  ox: number;
  oy: number;
}

function normalizeInput(raw: string): string {
  return raw.trim().toLowerCase().replace(/^#/, "").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function TagModal({ mode, selectedIds, existingTags = [], onClose, onComplete }: TagModalProps) {
  const [pills, setPills] = useState<string[]>(() => mode === "edit" ? [...existingTags] : []);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [backspaceArmed, setBackspaceArmed] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const pillElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());

  const registerPill = useCallback((name: string, el: HTMLDivElement | null) => {
    if (el) pillElsRef.current.set(name, el);
    else pillElsRef.current.delete(name);
  }, []);

  // --- FLIP animation helpers ---

  const snapshotPositions = useCallback(() => {
    const rects = new Map<string, DOMRect>();
    pillElsRef.current.forEach((el, name) => {
      rects.set(name, el.getBoundingClientRect());
    });
    prevRectsRef.current = rects;
  }, []);

  useLayoutEffect(() => {
    const prev = prevRectsRef.current;
    if (prev.size === 0) return;

    pillElsRef.current.forEach((el, key) => {
      const oldR = prev.get(key);
      if (!oldR) return;
      const newR = el.getBoundingClientRect();
      const dx = oldR.left - newR.left;
      const dy = oldR.top - newR.top;
      if (!dx && !dy) return;

      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.transition = "transform 200ms ease";
          el.style.transform = "";
        });
      });
    });

    prevRectsRef.current = new Map();
  }, [pills]);

  // --- Pill input ---

  const removePill = useCallback((index: number) => {
    snapshotPositions();
    setPills((prev) => prev.filter((_, i) => i !== index));
    setBackspaceArmed(false);
  }, [snapshotPositions]);

  const commitInput = useCallback(() => {
    const tag = normalizeInput(input);
    if (!tag) return;
    if (pills.includes(tag)) { setInput(""); return; }
    setPills((prev) => [...prev, tag]);
    setInput("");
    setBackspaceArmed(false);
  }, [input, pills]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === " " || (e.key === "Enter" && input.trim())) {
      e.preventDefault();
      commitInput();
    } else if (e.key === "Backspace" && input === "") {
      if (pills.length === 0) return;
      if (backspaceArmed) {
        removePill(pills.length - 1);
      } else {
        setBackspaceArmed(true);
      }
    } else if (e.key === "Escape") {
      onClose();
    } else {
      setBackspaceArmed(false);
    }
  }, [commitInput, input, pills, backspaceArmed, removePill, onClose]);

  // --- Submit ---

  const handleSubmit = useCallback(async () => {
    const finalPills = [...pills];
    const remaining = normalizeInput(input);
    if (remaining && !finalPills.includes(remaining)) {
      finalPills.push(remaining);
    }

    if (finalPills.length === 0 && mode === "add") return;

    setLoading(true);
    setError("");

    try {
      if (mode === "edit") {
        const res = await fetch("/api/assets/tag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetIds: selectedIds, tags: finalPills, mode: "set" }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Failed to update tags");
          setLoading(false);
          return;
        }
        onComplete(finalPills);
      } else {
        const res = await fetch("/api/assets/tag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetIds: selectedIds, tags: finalPills, mode: "add" }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Failed to tag");
          setLoading(false);
          return;
        }
        onComplete();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  }, [pills, input, mode, selectedIds, onComplete]);

  // --- Drag and drop (edit mode) ---

  const computeDropIndex = useCallback((clientX: number, clientY: number, currentPills: string[]): number => {
    const entries: { index: number; rect: DOMRect }[] = [];
    for (let i = 0; i < currentPills.length; i++) {
      const el = pillElsRef.current.get(currentPills[i]);
      if (el) entries.push({ index: i, rect: el.getBoundingClientRect() });
    }
    if (entries.length === 0) return 0;

    const rows: { y: number; items: typeof entries }[] = [];
    for (const e of entries) {
      const cy = e.rect.top + e.rect.height / 2;
      const row = rows.find((r) => Math.abs(r.y - cy) < e.rect.height * 0.6);
      if (row) row.items.push(e);
      else rows.push({ y: cy, items: [e] });
    }
    rows.sort((a, b) => a.y - b.y);

    let closestRow = rows[0];
    let minDist = Math.abs(clientY - closestRow.y);
    for (const row of rows) {
      const d = Math.abs(clientY - row.y);
      if (d < minDist) { minDist = d; closestRow = row; }
    }

    const items = closestRow.items.sort((a, b) => a.rect.left - b.rect.left);
    for (let i = 0; i < items.length; i++) {
      const cx = items[i].rect.left + items[i].rect.width / 2;
      if (clientX < cx) return items[i].index;
    }
    return items[items.length - 1].index + 1;
  }, []);

  const handleDragStart = useCallback((index: number, e: React.PointerEvent) => {
    if (mode !== "edit") return;
    const el = pillElsRef.current.get(pills[index]);
    if (!el) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const rect = el.getBoundingClientRect();
    setDrag({
      pill: pills[index],
      cx: e.clientX,
      cy: e.clientY,
      ox: e.clientX - rect.left,
      oy: e.clientY - rect.top,
    });
  }, [mode, pills]);

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    if (!drag) return;
    e.preventDefault();

    setDrag((prev) => prev ? { ...prev, cx: e.clientX, cy: e.clientY } : null);

    setPills((currentPills) => {
      const currentIdx = currentPills.indexOf(drag.pill);
      if (currentIdx === -1) return currentPills;

      const newDropIdx = computeDropIndex(e.clientX, e.clientY, currentPills);
      if (newDropIdx === currentIdx || newDropIdx === currentIdx + 1) return currentPills;

      snapshotPositions();
      const result = [...currentPills];
      const [dragged] = result.splice(currentIdx, 1);
      const insertAt = newDropIdx > currentIdx ? newDropIdx - 1 : newDropIdx;
      result.splice(insertAt, 0, dragged);
      return result;
    });
  }, [drag, computeDropIndex, snapshotPositions]);

  const handleDragEnd = useCallback((e: React.PointerEvent) => {
    if (!drag) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    setDrag(null);
  }, [drag]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const title = mode === "edit"
    ? `Edit tags${selectedIds.length > 1 ? ` (${selectedIds.length} images)` : ""}`
    : `Tag ${selectedIds.length} image${selectedIds.length > 1 ? "s" : ""}`;

  const buttonLabel = mode === "edit" ? "Save" : "Apply Tags";
  const canSubmit = mode === "edit" || pills.length > 0 || input.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
      <div
        className="bg-zinc-900 rounded-xl p-6 w-full max-w-md flex flex-col gap-4"
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {mode === "edit" && pills.length === 0 && (
          <p className="text-xs text-zinc-500">No tags yet. Type below to add.</p>
        )}

        {/* Pill container + input */}
        <div
          className="flex flex-wrap items-center gap-1.5 min-h-[42px] px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg cursor-text focus-within:ring-2 focus-within:ring-blue-500"
          onClick={() => inputRef.current?.focus()}
        >
          {pills.map((pill, i) => (
            <div
              key={pill}
              ref={(el) => registerPill(pill, el)}
              className={`
                group flex items-center gap-1 px-2 py-0.5 rounded-full text-sm select-none
                ${drag?.pill === pill ? "opacity-30" : ""}
                ${i === 0
                  ? "bg-purple-600/30 text-purple-300 border border-purple-500/50"
                  : backspaceArmed && i === pills.length - 1
                    ? "bg-red-900/50 text-red-300 border border-red-500/50"
                    : "bg-zinc-700 text-zinc-200 border border-zinc-600"
                }
                ${mode === "edit" ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}
              `}
              onPointerDown={(e) => { if (mode === "edit") handleDragStart(i, e); }}
              onClick={(e) => {
                e.stopPropagation();
                if (mode !== "edit" && !drag) removePill(i);
              }}
              title={i === 0 ? "Grouping tag" : mode === "edit" ? "Drag to reorder" : "Click to remove"}
            >
              {i === 0 && (
                <svg className="w-3 h-3 text-purple-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              )}
              <span>{pill}</span>
              <button
                className="ml-0.5 text-current opacity-50 hover:opacity-100 transition-opacity"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); removePill(i); }}
                tabIndex={-1}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setBackspaceArmed(false); }}
            onKeyDown={handleKeyDown}
            placeholder={pills.length === 0 ? "Type a tag, press Space..." : ""}
            className="flex-1 min-w-[80px] bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 outline-none"
          />
        </div>

        <p className="text-xs text-zinc-500">
          {mode === "edit"
            ? "Drag to reorder. First tag = grouping tag. Click \u00d7 to remove."
            : "Press Space to add a tag. Backspace twice to remove last."}
        </p>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={loading || !canSubmit}
            className="flex-1 h-10 px-4 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-500 disabled:opacity-50 transition-colors"
          >
            {loading ? "Saving..." : buttonLabel}
          </button>
          <button
            onClick={onClose}
            className="h-10 px-4 bg-zinc-700 text-zinc-200 text-sm font-medium rounded-lg hover:bg-zinc-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Floating drag clone */}
      {drag && (
        <DragClone
          pill={drag.pill}
          isFirst={pills.indexOf(drag.pill) === 0}
          left={drag.cx - drag.ox}
          top={drag.cy - drag.oy}
        />
      )}
    </div>
  );
}

function DragClone({ pill, isFirst, left, top }: { pill: string; isFirst: boolean; left: number; top: number }) {
  return (
    <div
      className={`fixed z-[210] pointer-events-none px-2 py-0.5 rounded-full text-sm shadow-xl shadow-black/50 flex items-center gap-1
        ${isFirst ? "bg-purple-600/80 text-purple-100 border border-purple-400" : "bg-zinc-600 text-zinc-100 border border-zinc-500"}
      `}
      style={{ left, top, transform: "scale(1.08)" }}
    >
      {isFirst && (
        <svg className="w-3 h-3 text-purple-300 shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      )}
      <span>{pill}</span>
    </div>
  );
}
