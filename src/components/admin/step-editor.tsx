"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/lab/rich-text-editor";
import { SnippetEditor } from "@/components/lab/snippet-editor";
import { GripVertical, Trash2, ImagePlus, X, Terminal, Loader2 } from "lucide-react";
import type { CodeSnippet, Step } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  step: Step;
  onChange: (patch: Partial<Step>) => void;
  onDelete: () => void;
  dragging?: boolean;
};

/** Convert legacy single code/codeLang fields into a CodeSnippet[] (for backward compat) */
function legacyToSnippets(step: Step): CodeSnippet[] | null {
  // If snippets already exist, use them
  if (step.snippets && step.snippets.length > 0) return step.snippets;
  // If there's legacy code, convert to a single snippet
  if (step.code) {
    return [{ id: "legacy", lang: step.codeLang ?? "text", code: step.code, title: undefined }];
  }
  return null;
}

/** Resolve the effective snippets to display, merging legacy into snippets */
function resolveSnippets(step: Step): CodeSnippet[] {
  return legacyToSnippets(step) ?? [];
}

export function StepEditor({ step, onChange, onDelete, dragging }: Props) {
  const [uploading, setUploading] = useState(false);
  const snippets = resolveSnippets(step);

  const handleImage = useCallback(async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "/labdocs/steps");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        console.error("Upload failed:", err);
        return;
      }

      const data = await res.json();
      onChange({
        image: data.url,
        imageFileId: data.fileId,
      });
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
    }
  }, [onChange]);

  const handleRemoveImage = useCallback(() => {
    if (step.imageFileId) {
      fetch("/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: step.imageFileId }),
      }).catch((err) => console.error("Delete error:", err));
    }
    onChange({ image: null, imageFileId: null });
  }, [step.imageFileId, onChange]);

  const handleSnippetsChange = (newSnippets: CodeSnippet[]) => {
    onChange({ snippets: newSnippets });
  };

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 transition",
        dragging && "border-primary ring-2 ring-primary/30"
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {step.order + 1}
        </span>
        <Input
          value={step.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Step title"
          className="h-9 flex-1 font-medium"
        />
        <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Description (rich text)
          </Label>
          <RichTextEditor
            value={step.description ?? ""}
            onChange={(html) => onChange({ description: html })}
            placeholder="Explain what to do in this step..."
            minHeight={100}
          />
        </div>

        <div>
          <Label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Terminal className="h-3.5 w-3.5" /> Code snippets
          </Label>
          <SnippetEditor snippets={snippets} onChange={handleSnippetsChange} />
        </div>

        <div>
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Illustration image
          </Label>
          {uploading ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Uploading to ImageKit...</span>
            </div>
          ) : step.image ? (
            <div className="relative overflow-hidden rounded-lg border">
              <img src={step.image} alt={step.imageCaption ?? ""} className="max-h-64 w-full object-contain bg-muted/30" />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute right-2 top-2 h-7 w-7"
                onClick={handleRemoveImage}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed py-6 text-sm text-muted-foreground transition hover:bg-muted/40">
              <ImagePlus className="h-6 w-6" />
              Click to upload an image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImage(e.target.files?.[0])}
              />
            </label>
          )}
          {step.image && !uploading && (
            <Input
              value={step.imageCaption ?? ""}
              onChange={(e) => onChange({ imageCaption: e.target.value })}
              placeholder="Image caption (optional)"
              className="mt-2 h-8 text-xs"
            />
          )}
        </div>
      </div>
    </div>
  );
}
