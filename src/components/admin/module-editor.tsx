"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RichTextEditor } from "@/components/lab/rich-text-editor";
import { FlowEditor } from "@/components/lab/flow-editor";
import { StepEditor } from "@/components/admin/step-editor";
import { CodeBlock } from "@/components/lab/code-block";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CodeSnippet, FlowNode, Module, Step, StepBlock } from "@/lib/types";
import { nanoid } from "@/lib/nanoid";
import {
  ScrollText,
  Workflow,
  ListOrdered,
  Terminal,
  Plus,
  Save,
  Check,
  Loader2,
  GripVertical,
  Eye,
  Pencil,
  ImagePlus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = { moduleId: string };

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load");
  return res.json();
}

const OUTPUT_LANGUAGES = ["text", "cpp", "c", "javascript", "typescript", "python", "java", "bash", "sql", "json", "html", "css", "go", "rust"];

export function ModuleEditor({ moduleId }: Props) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["admin-module", moduleId],
    queryFn: () =>
      fetchJson<Module & { steps: Step[] }>("/api/modules/" + moduleId),
  });

  const [title, setTitle] = useState("");
  const [explanation, setExplanation] = useState("");
  const [overview, setOverview] = useState("");
  const [flow, setFlow] = useState<FlowNode[]>([]);
  const [output, setOutput] = useState("");
  const [outputCode, setOutputCode] = useState("");
  const [outputCodeLang, setOutputCodeLang] = useState("text");
  const [outputImage, setOutputImage] = useState<string | null>(null);
  const [outputImageFileId, setOutputImageFileId] = useState<string | null>(null);
  const [outputImageCaption, setOutputImageCaption] = useState("");
  const [showOutputPreview, setShowOutputPreview] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [tab, setTab] = useState("explanation");
  const [initialized, setInitialized] = useState(false);
  const [hydratedId, setHydratedId] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate local editable state when server data arrives (adjusting state during render)
  if (query.data && query.data.id !== hydratedId) {
    setHydratedId(query.data.id);
    setTitle(query.data.title);
    setExplanation(query.data.explanation ?? "");
    setOverview(query.data.overview ?? "");
    try {
      const f = query.data.flow ? JSON.parse(query.data.flow) : [];
      setFlow(Array.isArray(f) ? f : []);
    } catch {
      setFlow([]);
    }
    setOutput(query.data.output ?? "");
    setOutputCode(query.data.outputCode ?? "");
    setOutputCodeLang(query.data.outputCodeLang ?? "text");
    setOutputImage(query.data.outputImage ?? null);
    setOutputImageFileId(query.data.outputImageFileId ?? null);
    setOutputImageCaption(query.data.outputImageCaption ?? "");
    // Parse snippets + blocks JSON strings from server data into arrays on each step
    setSteps(query.data.steps.map((s) => {
      const parsedSnippets: CodeSnippet[] | null = s.snippets
        ? (typeof s.snippets === "string" ? (() => { try { const arr = JSON.parse(s.snippets as unknown as string); return Array.isArray(arr) ? arr : null; } catch { return null; } })() : s.snippets)
        : null;
      const parsedBlocks: StepBlock[] | null = s.blocks
        ? (typeof s.blocks === "string" ? (() => { try { const arr = JSON.parse(s.blocks as unknown as string); return Array.isArray(arr) ? arr : null; } catch { return null; } })() : s.blocks)
        : null;
      return { ...s, snippets: parsedSnippets, blocks: parsedBlocks };
    }));
    setInitialized(true);
  }

  // Debounced auto-save for module text fields (syncs to the server = external system)
  useEffect(() => {
    if (!initialized) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveState("saving");
      await fetch("/api/modules/" + moduleId, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          explanation,
          overview,
          flow: JSON.stringify(flow),
          output,
          outputCode: outputCode || null,
          outputCodeLang: outputCodeLang || null,
          outputImage,
          outputImageFileId,
          outputImageCaption: outputImageCaption || null,
        }),
      });
      setSaveState("saved");
      qc.invalidateQueries({ queryKey: ["admin-module", moduleId] });
      qc.invalidateQueries({ queryKey: ["module", moduleId] });
      qc.invalidateQueries({ queryKey: ["lab"] });
      setTimeout(() => setSaveState("idle"), 1500);
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [title, explanation, overview, flow, output, outputCode, outputCodeLang, outputImage, outputImageFileId, outputImageCaption, moduleId, qc, initialized]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setSteps((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      const reordered = arrayMove(items, oldIndex, newIndex).map((s, i) => ({
        ...s,
        order: i,
      }));
      // persist new orders
      reordered.forEach((s) =>
        fetch("/api/steps/" + s.id, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: s.order }),
        })
      );
      return reordered;
    });
  };

  const updateStep = (id: string, patch: Partial<Step>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  // Debounced per-step save
  const stepTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const persistStep = (step: Step) => {
    if (stepTimers.current[step.id]) clearTimeout(stepTimers.current[step.id]);
    stepTimers.current[step.id] = setTimeout(() => {
      fetch("/api/steps/" + step.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: step.title,
          description: step.description,
          code: step.code,
          codeLang: step.codeLang,
          snippets: step.snippets ? JSON.stringify(step.snippets) : null,
          blocks: step.blocks ? JSON.stringify(step.blocks) : null,
          image: step.image,
          imageFileId: step.imageFileId,
          imageCaption: step.imageCaption,
          order: step.order,
        }),
      });
    }, 700);
  };

  const handleStepChange = (id: string, patch: Partial<Step>) => {
    setSteps((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, ...patch } : s));
      const changed = next.find((s) => s.id === id);
      if (changed) persistStep(changed);
      return next;
    });
  };

  const deleteStep = async (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
    await fetch("/api/steps/" + id, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["admin-module", moduleId] });
  };

  const addStep = async () => {
    const order = steps.length;
    const res = await fetch("/api/steps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New step", moduleId }),
    });
    const created: Step = await res.json();
    setSteps((prev) => [...prev, created]);
    setTab("procedure");
  };

  // Upload output image to ImageKit
  const [outputUploading, setOutputUploading] = useState(false);

  const handleOutputImage = useCallback(async (file?: File) => {
    if (!file) return;
    setOutputUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "/labdocs/modules");

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
      setOutputImage(data.url);
      setOutputImageFileId(data.fileId);
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setOutputUploading(false);
    }
  }, []);

  const handleRemoveOutputImage = useCallback(() => {
    // Delete from ImageKit first
    if (outputImageFileId) {
      fetch("/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: outputImageFileId }),
      }).catch((err) => console.error("Delete error:", err));
    }
    setOutputImage(null);
    setOutputImageFileId(null);
  }, [outputImageFileId]);

  if (query.isLoading) return <Skeleton className="h-[600px] w-full rounded-2xl" />;
  if (!query.data) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Module title
          </Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 h-10 text-lg font-semibold"
          />
        </div>
        <div className="flex items-center gap-1.5 self-end rounded-lg border bg-muted/30 px-3 py-1.5 text-xs">
          {saveState === "saving" && (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
            </>
          )}
          {saveState === "saved" && (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-500" /> Saved
            </>
          )}
          {saveState === "idle" && (
            <>
              <Save className="h-3.5 w-3.5 text-muted-foreground" /> Auto-save
            </>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="explanation" className="gap-1.5">
            <ScrollText className="h-3.5 w-3.5" /> Explanation
          </TabsTrigger>
          <TabsTrigger value="overview" className="gap-1.5">
            <Workflow className="h-3.5 w-3.5" /> Overview & Flow
          </TabsTrigger>
          <TabsTrigger value="procedure" className="gap-1.5">
            <ListOrdered className="h-3.5 w-3.5" /> Procedure ({steps.length})
          </TabsTrigger>
          <TabsTrigger value="output" className="gap-1.5">
            <Terminal className="h-3.5 w-3.5" /> Output
          </TabsTrigger>
        </TabsList>

        <TabsContent value="explanation" className="mt-4">
          <SectionShell
            title="Title & Explanation"
            description="Introduce this module. What will learners do and why does it matter?"
          >
            <RichTextEditor
              value={explanation}
              onChange={setExplanation}
              placeholder="Write the introduction and explanation..."
              minHeight={220}
            />
          </SectionShell>
        </TabsContent>

        <TabsContent value="overview" className="mt-4">
          <SectionShell
            title="Lab Overview & Flow"
            description="Describe the approach and define the flow of the procedure."
          >
            <div className="space-y-4">
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Overview text
                </Label>
                <RichTextEditor
                  value={overview}
                  onChange={setOverview}
                  placeholder="Describe the lab overview..."
                  minHeight={160}
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Flow diagram nodes
                </Label>
                <FlowEditor value={flow} onChange={setFlow} />
              </div>
            </div>
          </SectionShell>
        </TabsContent>

        <TabsContent value="procedure" className="mt-4">
          <SectionShell
            title="Lab Procedure"
            description="Add the step-by-step procedure. Drag to reorder. Each step becomes a slide."
          >
            <div className="space-y-3">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext
                  items={steps.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {steps.map((step) => (
                    <SortableStep
                      key={step.id}
                      step={step}
                      onChange={(patch) => handleStepChange(step.id, patch)}
                      onDelete={() => deleteStep(step.id)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              <Button variant="outline" onClick={addStep} className="w-full gap-1.5 border-dashed">
                <Plus className="h-4 w-4" /> Add procedure step
              </Button>
            </div>
          </SectionShell>
        </TabsContent>

        <TabsContent value="output" className="mt-4">
          <SectionShell
            title="Expected Output"
            description="What should learners observe after completing the procedure? Add rich text, code snippets, and images."
          >
            <div className="space-y-4">
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Output description
                </Label>
                <RichTextEditor
                  value={output}
                  onChange={setOutput}
                  placeholder="Describe the expected output..."
                  minHeight={200}
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Terminal className="h-3.5 w-3.5" /> Output code snippet
                  </Label>
                  <div className="flex items-center gap-2">
                    <Select value={outputCodeLang} onValueChange={setOutputCodeLang}>
                      <SelectTrigger className="h-7 w-[130px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OUTPUT_LANGUAGES.map((l) => (
                          <SelectItem key={l} value={l} className="text-xs">
                            {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {outputCode && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={() => setShowOutputPreview((p) => !p)}
                      >
                        {showOutputPreview ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        {showOutputPreview ? "Edit" : "Preview"}
                      </Button>
                    )}
                  </div>
                </div>
                {showOutputPreview && outputCode ? (
                  <CodeBlock code={outputCode} language={outputCodeLang} />
                ) : (
                  <textarea
                    value={outputCode}
                    onChange={(e) => setOutputCode(e.target.value)}
                    placeholder="// Paste expected output code here..."
                    className="min-h-[120px] w-full rounded-lg border bg-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                )}
              </div>

              <div>
                <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Output illustration image
                </Label>
                {outputUploading ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Uploading to ImageKit...</span>
                  </div>
                ) : outputImage ? (
                  <div className="relative overflow-hidden rounded-lg border">
                    <img src={outputImage} alt={outputImageCaption ?? ""} className="max-h-64 w-full object-contain bg-muted/30" />
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="absolute right-2 top-2 h-7 w-7"
                      onClick={handleRemoveOutputImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed py-6 text-sm text-muted-foreground transition hover:bg-muted/40">
                    <ImagePlus className="h-6 w-6" />
                    Click to upload an output image
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleOutputImage(e.target.files?.[0])}
                    />
                  </label>
                )}
                {outputImage && !outputUploading && (
                  <Input
                    value={outputImageCaption}
                    onChange={(e) => setOutputImageCaption(e.target.value)}
                    placeholder="Image caption (optional)"
                    className="mt-2 h-8 text-xs"
                  />
                )}
              </div>
            </div>
          </SectionShell>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SectionShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

function SortableStep({
  step,
  onChange,
  onDelete,
}: {
  step: Step;
  onChange: (patch: Partial<Step>) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className="relative">
        <button
          {...listeners}
          className="absolute -left-6 top-5 z-10 hidden cursor-grab text-muted-foreground hover:text-foreground sm:block"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <StepEditor step={step} onChange={onChange} onDelete={onDelete} dragging={isDragging} />
      </div>
    </div>
  );
}
