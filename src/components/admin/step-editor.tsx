"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/lab/rich-text-editor";
import { CodeBlock } from "@/components/lab/code-block";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GripVertical, Trash2, ImagePlus, X, Terminal, Eye, Pencil } from "lucide-react";
import type { Step } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  step: Step;
  onChange: (patch: Partial<Step>) => void;
  onDelete: () => void;
  dragging?: boolean;
};

const LANGUAGES = ["text", "cpp", "c", "javascript", "typescript", "python", "java", "bash", "sql", "json", "html", "css", "go", "rust"];

export function StepEditor({ step, onChange, onDelete, dragging }: Props) {
  const [showPreview, setShowPreview] = useState(false);

  const handleImage = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onChange({ image: reader.result as string });
    };
    reader.readAsDataURL(file);
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
          <div className="mb-1.5 flex items-center justify-between">
            <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Terminal className="h-3.5 w-3.5" /> Code snippet
            </Label>
            <div className="flex items-center gap-2">
              <Select
                value={step.codeLang ?? "text"}
                onValueChange={(v) => onChange({ codeLang: v })}
              >
                <SelectTrigger className="h-7 w-[130px] text-xs">
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
              {step.code && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => setShowPreview((p) => !p)}
                >
                  {showPreview ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {showPreview ? "Edit" : "Preview"}
                </Button>
              )}
            </div>
          </div>
          {showPreview && step.code ? (
            <CodeBlock code={step.code} language={step.codeLang ?? "text"} />
          ) : (
            <Textarea
              value={step.code ?? ""}
              onChange={(e) => onChange({ code: e.target.value })}
              placeholder="// Paste code here..."
              className="min-h-[120px] font-mono text-xs"
            />
          )}
        </div>

        <div>
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Illustration image
          </Label>
          {step.image ? (
            <div className="relative overflow-hidden rounded-lg border">
              <img src={step.image} alt={step.imageCaption ?? ""} className="max-h-64 w-full object-contain bg-muted/30" />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute right-2 top-2 h-7 w-7"
                onClick={() => onChange({ image: null })}
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
          {step.image && (
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
