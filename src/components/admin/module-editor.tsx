"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RichTextEditor } from "@/components/lab/rich-text-editor";
import { FlowEditor } from "@/components/lab/flow-editor";
import { StepEditor } from "@/components/admin/step-editor";
import { Skeleton } from "@/components/ui/skeleton";
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
import type { FlowNode, Module, Step } from "@/lib/types";
import { nanoid } from "@/lib/nanoid";
import {
  ScrollText,
  Workflow,
  ListOrdered,
  Terminal,
  Flag,
  Plus,
  Save,
  Check,
  Loader2,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = { moduleId: string };

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load");
  return res.json();
}

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
  const [conclusion, setConclusion] = useState("");
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
    setConclusion(query.data.conclusion ?? "");
    setSteps(query.data.steps);
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
          conclusion,
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
  }, [title, explanation, overview, flow, output, conclusion, moduleId, qc, initialized]);

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
          image: step.image,
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
    setSteps((prev) => [...prev, { ...created, order }]);
    setTab("procedure");
  };

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
          <TabsTrigger value="conclusion" className="gap-1.5">
            <Flag className="h-3.5 w-3.5" /> Conclusion
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
            description="What should learners observe after completing the procedure?"
          >
            <RichTextEditor
              value={output}
              onChange={setOutput}
              placeholder="Describe the expected output..."
              minHeight={200}
            />
          </SectionShell>
        </TabsContent>

        <TabsContent value="conclusion" className="mt-4">
          <SectionShell
            title="Conclusion"
            description="Summarize what was learned and point to next steps."
          >
            <RichTextEditor
              value={conclusion}
              onChange={setConclusion}
              placeholder="Write the conclusion..."
              minHeight={200}
            />
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
