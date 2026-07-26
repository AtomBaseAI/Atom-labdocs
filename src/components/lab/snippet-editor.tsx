"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CodeBlock } from "@/components/lab/code-block";
import { Plus, Trash2, ArrowUp, ArrowDown, Eye, Pencil } from "lucide-react";
import type { CodeSnippet } from "@/lib/types";
import { nanoid } from "@/lib/nanoid";
import { cn } from "@/lib/utils";

const LANGUAGES = [
  "text", "cpp", "c", "javascript", "typescript", "python", "java",
  "bash", "sql", "json", "html", "css", "go", "rust",
];

type Props = {
  snippets: CodeSnippet[];
  onChange: (snippets: CodeSnippet[]) => void;
};

export function SnippetEditor({ snippets, onChange }: Props) {
  const [previewIds, setPreviewIds] = useState<Set<string>>(new Set());

  const addSnippet = () => {
    onChange([
      ...snippets,
      { id: nanoid(), lang: "text", code: "" },
    ]);
  };

  const removeSnippet = (id: string) => {
    onChange(snippets.filter((s) => s.id !== id));
    setPreviewIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const moveSnippet = (id: string, direction: "up" | "down") => {
    const idx = snippets.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= snippets.length) return;
    const updated = [...snippets];
    const [moved] = updated.splice(idx, 1);
    updated.splice(newIdx, 0, moved);
    onChange(updated);
  };

  const updateSnippet = (id: string, patch: Partial<CodeSnippet>) => {
    onChange(snippets.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const togglePreview = (id: string) => {
    setPreviewIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (snippets.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">No code snippets yet.</p>
        <Button
          type="button"
          variant="outline"
          onClick={addSnippet}
          className="gap-1.5 border-dashed"
        >
          <Plus className="h-4 w-4" /> Add snippet
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {snippets.map((snippet, i) => (
        <div
          key={snippet.id}
          className="rounded-lg border bg-card p-3 space-y-2"
        >
          {/* Header row */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="h-6 w-6 items-center justify-center rounded-full text-xs font-bold shrink-0">
              {i + 1}
            </Badge>
            <Input
              value={snippet.title ?? ""}
              onChange={(e) => updateSnippet(snippet.id, { title: e.target.value })}
              placeholder="Snippet title (optional)"
              className="h-8 flex-1 text-xs"
            />
            <Select
              value={snippet.lang}
              onValueChange={(v) => updateSnippet(snippet.id, { lang: v })}
            >
              <SelectTrigger className="h-8 w-[110px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l} value={l} className="text-xs">
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={i === 0}
                onClick={() => moveSnippet(snippet.id, "up")}
                title="Move up"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={i === snippets.length - 1}
                onClick={() => moveSnippet(snippet.id, "down")}
                title="Move down"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              {snippet.code && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => togglePreview(snippet.id)}
                >
                  {previewIds.has(snippet.id) ? (
                    <Pencil className="h-3 w-3" />
                  ) : (
                    <Eye className="h-3 w-3" />
                  )}
                  {previewIds.has(snippet.id) ? "Edit" : "Preview"}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => removeSnippet(snippet.id)}
                title="Remove snippet"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Code area */}
          {previewIds.has(snippet.id) && snippet.code ? (
            <CodeBlock code={snippet.code} language={snippet.lang} />
          ) : (
            <Textarea
              value={snippet.code}
              onChange={(e) => updateSnippet(snippet.id, { code: e.target.value })}
              placeholder="// Paste code here..."
              className={cn("min-h-[100px] font-mono text-xs")}
            />
          )}
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={addSnippet}
        className="w-full gap-1.5 border-dashed"
      >
        <Plus className="h-4 w-4" /> Add snippet
      </Button>
    </div>
  );
}
