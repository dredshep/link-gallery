"use client";

import { useState, useCallback } from "react";

interface DeleteModalProps {
  selectedIds: string[];
  onClose: () => void;
  onComplete: (deletedIds: string[]) => void;
}

export function DeleteModal({ selectedIds, onClose, onComplete }: DeleteModalProps) {
  const [step, setStep] = useState<"confirm1" | "confirm2" | "deleting">("confirm1");
  const [error, setError] = useState("");

  const handleDelete = useCallback(async () => {
    setStep("deleting");
    setError("");

    try {
      const res = await fetch("/api/assets/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetIds: selectedIds }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Delete failed");
        setStep("confirm2");
        return;
      }

      const data = await res.json();
      if (data.errors?.length > 0) {
        setError(`Deleted ${data.deleted}, but ${data.errors.length} failed`);
        setStep("confirm2");
      } else {
        onComplete(selectedIds);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStep("confirm2");
    }
  }, [selectedIds, onComplete]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4">
      <div className="bg-zinc-900 rounded-xl p-6 w-full max-w-sm flex flex-col gap-4">
        {step === "confirm1" && (
          <>
            <h2 className="text-lg font-semibold text-zinc-100">Delete images?</h2>
            <p className="text-sm text-zinc-400">
              You&apos;re about to permanently delete {selectedIds.length} image{selectedIds.length > 1 ? "s" : ""}.
              This cannot be undone.
            </p>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={onClose}
                className="h-9 px-4 bg-zinc-700 text-zinc-200 text-sm rounded-lg hover:bg-zinc-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep("confirm2")}
                className="h-9 px-4 bg-red-700 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
              >
                Yes, delete
              </button>
            </div>
          </>
        )}

        {step === "confirm2" && (
          <>
            <h2 className="text-lg font-semibold text-red-400">Are you sure?</h2>
            <p className="text-sm text-zinc-400">
              This will permanently remove {selectedIds.length} image{selectedIds.length > 1 ? "s" : ""} from
              disk and database. There is no recovery.
            </p>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={onClose}
                className="h-9 px-4 bg-zinc-700 text-zinc-200 text-sm rounded-lg hover:bg-zinc-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="h-9 px-4 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-500 transition-colors"
              >
                Permanently delete
              </button>
            </div>
          </>
        )}

        {step === "deleting" && (
          <div className="flex items-center justify-center py-4">
            <div className="text-zinc-400">Deleting...</div>
          </div>
        )}
      </div>
    </div>
  );
}
