"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "@/components/lab/rich-text-editor";
import { CodeBlock } from "@/components/lab/code-block";
import {
  GripVertical,
  Trash2,
  ImagePlus,
  X,
  Terminal,
  Loader2,
  Plus,
  Eye,
  Pencil,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import type { CodeSnippet, Step, StepBlock } from "@/lib/types";
import { nanoid } from "@/lib/nanoid";
import { cn } from "@/lib/utils";

type Props = {
  step: Step;
  onChange: (patch: Partial<Step>) => void;
  onDelete: () => void;
  dragging?: boolean;
};

const LANGUAGES = [
  "text", "cpp", "c", "javascript", "typescript", "python", "java",
  "bash", "sql", "json", "html", "css", "go", "rust",
];

// ─── Migration: legacy single fields → unified blocks ───
function legacyToBlocks(step: Step): StepBlock[] {
  const snippetBlocks: StepBlock[] = [];
  if (step.snippets && step.snippets.length > 0) {
    snippetBlocks.push(
      ...step.snippets.map((s) => ({
        type: "snippet" as const,
        id: s.id || nanoid(),
        lang: s.lang,
        code: s.code,
        title: s.title,
      }))
    );
  } else if (step.code) {
    snippetBlocks.push({
      type: "snippet",
      id: "legacy",
      lang: step.codeLang ?? "text",
      code: step.code,
      title: undefined,
    });
  }

  const blocks: StepBlock[] = [];
  if (step.description) {
    blocks.push({ type: "description", id: nanoid(), html: step.description });
  }
  blocks.push(...snippetBlocks);
  if (step.image) {
    blocks.push({
      type: "image",
      id: nanoid(),
      url: step.image,
      fileId: step.imageFileId,
      caption: step.imageCaption,
    });
  }
  return blocks;
}

// Default blocks for a brand-new empty step: 1 description + 1 snippet + 1 image.
function defaultBlocks(): StepBlock[] {
  return [
    { type: "description", id: nanoid(), html: "" },
    { type: "snippet", id: nanoid(), lang: "text", code: "" },
    { type: "image", id: nanoid(), url: "", fileId: null, caption: null },
  ];
}

// Keep legacy fields in sync with blocks so export / PDF / slide-viewer
// fallbacks continue to work during the transition.
function syncLegacyFromBlocks(blocks: StepBlock[]) {
  const firstDesc = blocks.find(
    (b): b is Extract<StepBlock, { type: "description" }> => b.type === "description"
  );
  const snippetBlocks = blocks.filter(
    (b): b is Extract<StepBlock, { type: "snippet" }> => b.type === "snippet"
  );
  const firstImage = blocks.find(
    (b): b is Extract<StepBlock, { type: "image" }> => b.type === "image"
  );
  return {
    description: firstDesc?.html || null,
    snippets:
      snippetBlocks.length > 0
        ? snippetBlocks.map((s) => ({
            id: s.id,
            lang: s.lang,
            code: s.code,
            title: s.title,
          }))
        : null,
    code: snippetBlocks[0]?.code || null,
    codeLang: snippetBlocks[0]?.lang ?? null,
    image: firstImage?.url || null,
    imageFileId: firstImage?.fileId ?? null,
    imageCaption: firstImage?.caption ?? null,
  };
}

export function StepEditor({ step, onChange, onDelete, dragging }: Props) {
  // Resolve the effective blocks: use step.blocks, or migrate from legacy,
  // or default to 1-of-each for a fresh empty step.
  const blocks = useMemo<StepBlock[]>(() => {
    if (step.blocks && step.blocks.length > 0) return step.blocks;
    const migrated = legacyToBlocks(step);
    return migrated.length > 0 ? migrated : defaultBlocks();
  }, [step]);

  // One-time init: if the step had no blocks yet, persist the initialized
  // blocks (+ synced legacy fields) so the server has them.
  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    if (!step.blocks || step.blocks.length === 0) {
      const synced = syncLegacyFromBlocks(blocks);
      onChange({ blocks, ...synced });
    }
  }, []);

  const updateBlock = (id: string, patch: Partial<StepBlock>) => {
    const next = blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as StepBlock) : b));
    const synced = syncLegacyFromBlocks(next);
    onChange({ blocks: next, ...synced });
  };

  // Insert a new block of the given type AFTER the block at `afterIndex`.
  const insertBlock = (
    afterIndex: number,
    type: "description" | "snippet" | "image"
  ) => {
    let newBlock: StepBlock;
    if (type === "description") {
      newBlock = { type, id: nanoid(), html: "" };
    } else if (type === "snippet") {
      newBlock = { type, id: nanoid(), lang: "text", code: "" };
    } else {
      newBlock = { type: "image", id: nanoid(), url: "", fileId: null, caption: null };
    }
    const next = [
      ...blocks.slice(0, afterIndex + 1),
      newBlock,
      ...blocks.slice(afterIndex + 1),
    ];
    const synced = syncLegacyFromBlocks(next);
    onChange({ blocks: next, ...synced });
  };

  const removeBlock = (id: string) => {
    const next = blocks.filter((b) => b.id !== id);
    const synced = syncLegacyFromBlocks(next);
    onChange({ blocks: next, ...synced });
  };

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 transition",
        dragging && "border-primary ring-2 ring-primary/30"
      )}
    >
      {/* Header: grip + step number + title + delete-step */}
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

      {/* Ordered content blocks with "+ add" buttons between each */}
      <div className="space-y-2">
        {blocks.map((block, i) => (
          <div key={block.id}>
            <BlockEditor
              block={block}
              index={i}
              onChange={(patch) => updateBlock(block.id, patch)}
              onRemove={() => removeBlock(block.id)}
            />
            <AddButtonsRow onAdd={(type) => insertBlock(i, type)} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── The 3 "add" buttons rendered after every block ───
function AddButtonsRow({
  onAdd,
}: {
  onAdd: (type: "description" | "snippet" | "image") => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 py-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1 border-dashed text-xs"
        onClick={() => onAdd("description")}
      >
        <Plus className="h-3 w-3" /> add description
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1 border-dashed text-xs"
        onClick={() => onAdd("snippet")}
      >
        <Plus className="h-3 w-3" /> add snippet
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1 border-dashed text-xs"
        onClick={() => onAdd("image")}
      >
        <Plus className="h-3 w-3" /> add illustration
      </Button>
    </div>
  );
}

// ─── Dispatch to the right block editor by type ───
function BlockEditor({
  block,
  index,
  onChange,
  onRemove,
}: {
  block: StepBlock;
  index: number;
  onChange: (patch: Partial<StepBlock>) => void;
  onRemove: () => void;
}) {
  if (block.type === "description") {
    return (
      <DescriptionBlock block={block} onChange={onChange} onRemove={onRemove} />
    );
  }
  if (block.type === "snippet") {
    return (
      <SnippetBlock
        block={block}
        index={index}
        onChange={onChange}
        onRemove={onRemove}
      />
    );
  }
  return <ImageBlock block={block} onChange={onChange} onRemove={onRemove} />;
}

// ─── Description block ───
function DescriptionBlock({
  block,
  onChange,
  onRemove,
}: {
  block: Extract<StepBlock, { type: "description" }>;
  onChange: (patch: Partial<StepBlock>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <FileText className="h-3.5 w-3.5" /> Description (rich text)
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive"
          onClick={onRemove}
          title="Remove description"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <RichTextEditor
        value={block.html}
        onChange={(html) => onChange({ html } as Partial<StepBlock>)}
        placeholder="Explain what to do in this step..."
        minHeight={100}
      />
    </div>
  );
}

// ─── Snippet (code) block ───
function SnippetBlock({
  block,
  onChange,
  onRemove,
}: {
  block: Extract<StepBlock, { type: "snippet" }>;
  index: number;
  onChange: (patch: Partial<StepBlock>) => void;
  onRemove: () => void;
}) {
  const [preview, setPreview] = useState(false);
  return (
    <div className="space-y-2 rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2">
        <Badge
          variant="secondary"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
        >
          <Terminal className="h-3 w-3" />
        </Badge>
        <Input
          value={block.title ?? ""}
          onChange={(e) =>
            onChange({ title: e.target.value } as Partial<StepBlock>)
          }
          placeholder="Snippet title (optional)"
          className="h-8 flex-1 text-xs"
        />
        <Select
          value={block.lang}
          onValueChange={(v) => onChange({ lang: v } as Partial<StepBlock>)}
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
        {block.code && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => setPreview((p) => !p)}
          >
            {preview ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {preview ? "Edit" : "Preview"}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive"
          onClick={onRemove}
          title="Remove snippet"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {preview && block.code ? (
        <CodeBlock code={block.code} language={block.lang ?? "text"} />
      ) : (
        <Textarea
          value={block.code}
          onChange={(e) =>
            onChange({ code: e.target.value } as Partial<StepBlock>)
          }
          placeholder="// Paste code here..."
          className="min-h-[100px] font-mono text-xs"
        />
      )}
    </div>
  );
}

// ─── Illustration image block ───
function ImageBlock({
  block,
  onChange,
  onRemove,
}: {
  block: Extract<StepBlock, { type: "image" }>;
  onChange: (patch: Partial<StepBlock>) => void;
  onRemove: () => void;
}) {
  const [uploading, setUploading] = useState(false);

  const handleImage = useCallback(
    async (file?: File) => {
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
          console.error("Upload failed:", await res.json());
          return;
        }
        const data = await res.json();
        onChange({
          url: data.url,
          fileId: data.fileId,
        } as Partial<StepBlock>);
      } catch (err) {
        console.error("Upload error:", err);
      } finally {
        setUploading(false);
      }
    },
    [onChange]
  );

  const handleRemoveImage = useCallback(() => {
    if (block.fileId) {
      fetch("/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: block.fileId }),
      }).catch((err) => console.error("Delete error:", err));
    }
    onChange({ url: "", fileId: null } as Partial<StepBlock>);
  }, [block.fileId, onChange]);

  // When removing the whole block, also clean up the image from ImageKit.
  const handleRemoveBlock = useCallback(() => {
    if (block.fileId) {
      fetch("/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: block.fileId }),
      }).catch((err) => console.error("Delete error:", err));
    }
    onRemove();
  }, [block.fileId, onRemove]);

  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <ImageIcon className="h-3.5 w-3.5" /> Illustration image
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive"
          onClick={handleRemoveBlock}
          title="Remove illustration"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {uploading ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Uploading to ImageKit...
          </span>
        </div>
      ) : block.url ? (
        <div className="space-y-2">
          <div className="relative overflow-hidden rounded-lg border">
            <img
              src={block.url}
              alt={block.caption ?? ""}
              className="max-h-64 w-full object-contain bg-muted/30"
            />
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
          <Input
            value={block.caption ?? ""}
            onChange={(e) =>
              onChange({ caption: e.target.value } as Partial<StepBlock>)
            }
            placeholder="Image caption (optional)"
            className="h-8 text-xs"
          />
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
    </div>
  );
}
