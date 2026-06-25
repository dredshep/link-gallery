"use client";

import { useState, useCallback, useRef } from "react";
import type { Asset } from "@/lib/types";

interface UploadResult {
  id: string;
  storedFilename: string;
  displayName: string;
  thumbUrl: string;
  rawUrl: string;
  tags: string[];
  duplicate: boolean;
}

interface UploadModalProps {
  onClose: () => void;
  onComplete: (assets: Asset[]) => void;
}

export function UploadModal({ onClose, onComplete }: UploadModalProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [dupeCount, setDupeCount] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      if (files.length === 0) return;

      setUploading(true);
      setProgress(`Uploading ${files.length} file(s)...`);
      setDupeCount(0);

      const formData = new FormData();
      for (const file of Array.from(files)) {
        formData.append("files", file);
      }

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        const uploaded: UploadResult[] = data.uploaded ?? [];
        const newItems = uploaded.filter((u) => !u.duplicate);
        const dupes = uploaded.filter((u) => u.duplicate);

        if (dupes.length > 0) {
          setDupeCount(dupes.length);
        }

        const errorCount = data.errors?.length ?? 0;
        setProgress(
          `${newItems.length} uploaded${dupes.length > 0 ? `, ${dupes.length} duplicate${dupes.length > 1 ? "s" : ""} skipped` : ""}${errorCount > 0 ? `, ${errorCount} error${errorCount > 1 ? "s" : ""}` : ""}`
        );

        if (newItems.length > 0) {
          const assets: Asset[] = newItems.map((u) => ({
            id: u.id,
            storedFilename: u.storedFilename,
            originalFilename: u.storedFilename,
            displayName: u.displayName,
            width: null,
            height: null,
            sizeBytes: 0,
            thumbUrl: u.thumbUrl,
            rawUrl: u.rawUrl,
            tags: u.tags,
            nsfw: false,
            createdAt: new Date().toISOString(),
          }));

          setTimeout(() => onComplete(assets), 1200);
        } else {
          setUploading(false);
        }
      } catch (err) {
        setProgress(`Upload failed: ${err instanceof Error ? err.message : "Unknown error"}`);
        setUploading(false);
      }
    },
    [onComplete]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        uploadFiles(e.dataTransfer.files);
      }
    },
    [uploadFiles]
  );

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4">
      <div className="bg-zinc-900 rounded-xl p-6 w-full max-w-md flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">Upload Images</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            dragOver
              ? "border-blue-500 bg-blue-500/10"
              : "border-zinc-700 hover:border-zinc-500"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center gap-3">
            <svg className="w-10 h-10 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-zinc-400">
              Drop images here or tap to select
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              {uploading ? "Uploading..." : "Choose Files"}
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) uploadFiles(e.target.files);
          }}
        />

        {progress && (
          <p className="text-sm text-zinc-400 text-center">{progress}</p>
        )}

        {dupeCount > 0 && (
          <p className="text-xs text-amber-400 text-center">
            {dupeCount} duplicate{dupeCount > 1 ? "s were" : " was"} detected and skipped (same file hash already exists)
          </p>
        )}
      </div>
    </div>
  );
}
