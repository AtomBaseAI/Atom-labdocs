"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { RichTextRenderer } from "@/components/lab/rich-text-renderer";
import { CodeBlock } from "@/components/lab/code-block";
import { FlowDiagram } from "@/components/lab/flow-diagram";
import type { FlowNode, Module, Step } from "@/lib/types";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Presentation,
  ListOrdered,
  Flag,
  ScrollText,
  Workflow,
  Terminal,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Slide =
  | { kind: "title"; title: string; explanation: string | null }
  | { kind: "overview"; overview: string | null; flow: FlowNode[] | null }
  | { kind: "step"; step: Step; index: number; total: number }
  | { kind: "output"; output: string | null }
  | { kind: "conclusion"; conclusion: string | null };

type Props = {
  module: Module & { steps?: Step[] };
  courseTitle?: string;
  labTitle?: string;
  accent?: string;
};

function parseFlow(flow: string | null): FlowNode[] | null {
  if (!flow) return null;
  try {
    const parsed = JSON.parse(flow);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function SlideViewer({ module, courseTitle, labTitle, accent = "#0d9488" }: Props) {
  const slides = useMemo<Slide[]>(() => {
    const flow = parseFlow(module.flow);
    const steps = module.steps ?? [];
    const list: Slide[] = [
      { kind: "title", title: module.title, explanation: module.explanation },
      { kind: "overview", overview: module.overview, flow },
      ...steps.map<Slide>((s, i) => ({ kind: "step", step: s, index: i, total: steps.length })),
      { kind: "output", output: module.output },
      { kind: "conclusion", conclusion: module.conclusion },
    ];
    return list;
  }, [module]);

  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  // Reset to first slide when the module changes (adjusting state during render)
  const [prevModuleId, setPrevModuleId] = useState(module.id);
  if (module.id !== prevModuleId) {
    setPrevModuleId(module.id);
    setIndex(0);
  }

  const go = useCallback(
    (dir: number) => setIndex((i) => Math.min(slides.length - 1, Math.max(0, i + dir))),
    [slides.length]
  );

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "f" || e.key === "F") setFullscreen((f) => !f);
      else if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [go]);

  const slide = slides[index];
  const progress = ((index + 1) / slides.length) * 100;

  return (
    <div
      className={cn(
        "flex flex-col bg-card border rounded-2xl overflow-hidden shadow-sm",
        fullscreen ? "fixed inset-0 z-50 rounded-none border-0" : ""
      )}
      style={{ ["--accent" as string]: accent } as React.CSSProperties}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <Presentation className="h-4 w-4 shrink-0 text-[var(--accent)]" />
          <span className="truncate font-medium">{module.title}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Slide {index + 1} / {slides.length}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setFullscreen((f) => !f)}
            title={fullscreen ? "Exit fullscreen (Esc)" : "Fullscreen (F)"}
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full bg-muted">
        <motion.div
          className="h-full bg-[var(--accent)]"
          animate={{ width: `${progress}%` }}
          transition={{ type: "spring", stiffness: 200, damping: 30 }}
        />
      </div>

      {/* Slide canvas */}
      <div
        className={cn(
          "relative flex-1 overflow-y-auto",
          fullscreen ? "p-6 md:p-12" : "p-5 md:p-8"
        )}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
            className="mx-auto max-w-3xl"
          >
            <SlideContent slide={slide} courseTitle={courseTitle} labTitle={labTitle} accent={accent} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom controls */}
      <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-4 py-2.5">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => go(-1)}
          disabled={index === 0}
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>

        {/* Slide dots */}
        <div className="flex max-w-[60%] flex-wrap items-center justify-center gap-1.5">
          {slides.map((s, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              title={`Slide ${i + 1}: ${slideLabel(s)}`}
              className={cn(
                "h-2 rounded-full transition-all",
                i === index ? "w-6 bg-[var(--accent)]" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
            />
          ))}
        </div>

        <Button
          variant="default"
          size="sm"
          className="gap-1.5"
          onClick={() => go(1)}
          disabled={index === slides.length - 1}
        >
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function slideLabel(s: Slide): string {
  switch (s.kind) {
    case "title": return "Title & Explanation";
    case "overview": return "Overview & Flow";
    case "step": return `Step ${s.index + 1}`;
    case "output": return "Output";
    case "conclusion": return "Conclusion";
  }
}

function SectionTag({ icon: Icon, label, accent = "#0d9488" }: { icon: typeof Flag; label: string; accent?: string }) {
  return (
    <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground" style={{ borderColor: accent + "33" }}>
      <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
      {label}
    </div>
  );
}

function SlideContent({
  slide,
  courseTitle,
  labTitle,
  accent = "#0d9488",
}: {
  slide: Slide;
  courseTitle?: string;
  labTitle?: string;
  accent?: string;
}) {
  switch (slide.kind) {
    case "title":
      return (
        <div className="space-y-4">
          {(courseTitle || labTitle) && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {courseTitle && <span className="rounded bg-muted px-2 py-0.5">{courseTitle}</span>}
              {labTitle && (
                <>
                  <ChevronRight className="h-3 w-3" />
                  <span className="rounded bg-muted px-2 py-0.5">{labTitle}</span>
                </>
              )}
            </div>
          )}
          <SectionTag icon={ScrollText} label="Title & Explanation" accent={accent} />
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl" style={{ color: accent }}>{slide.title}</h1>
          <div className="border-l-2 pl-4" style={{ borderColor: accent + "66" }}>
            <RichTextRenderer html={slide.explanation} />
          </div>
        </div>
      );

    case "overview":
      return (
        <div className="space-y-6">
          <SectionTag icon={Workflow} label="Lab Overview & Flow" accent={accent} />
          <div>
            <RichTextRenderer html={slide.overview} />
          </div>
          {slide.flow && slide.flow.length > 0 && (
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Flow Diagram
              </p>
              <FlowDiagram flow={slide.flow} />
            </div>
          )}
        </div>
      );

    case "step":
      return (
        <div className="space-y-4">
          <SectionTag icon={ListOrdered} label={`Procedure · Step ${slide.index + 1} of ${slide.total}`} accent={accent} />
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-bold text-white" style={{ background: accent }}>
              {slide.index + 1}
            </span>
            <h2 className="text-xl font-semibold md:text-2xl" style={{ color: accent }}>{slide.step.title}</h2>
          </div>
          {slide.step.description && (
            <div className="rounded-lg bg-muted/30 p-4">
              <RichTextRenderer html={slide.step.description} />
            </div>
          )}
          {slide.step.code && (
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Terminal className="h-3.5 w-3.5" /> Code
              </div>
              <CodeBlock code={slide.step.code} language={slide.step.codeLang ?? "text"} />
            </div>
          )}
          {slide.step.image && (
            <figure className="space-y-2">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <ImageIcon className="h-3.5 w-3.5" /> Image
              </div>
              <img
                src={slide.step.image}
                alt={slide.step.imageCaption ?? "Step illustration"}
                className="w-full rounded-xl border"
              />
              {slide.step.imageCaption && (
                <figcaption className="text-center text-xs text-muted-foreground">
                  {slide.step.imageCaption}
                </figcaption>
              )}
            </figure>
          )}
        </div>
      );

    case "output":
      return (
        <div className="space-y-4">
          <SectionTag icon={Terminal} label="Expected Output" accent={accent} />
          <h2 className="text-2xl font-semibold" style={{ color: accent }}>Output</h2>
          <div className="rounded-xl border bg-muted/20 p-5">
            <RichTextRenderer html={slide.output} />
          </div>
        </div>
      );

    case "conclusion":
      return (
        <div className="space-y-4">
          <SectionTag icon={Flag} label="Conclusion" accent={accent} />
          <h2 className="text-2xl font-semibold" style={{ color: accent }}>Conclusion</h2>
          <div className="rounded-xl border-l-4 p-5" style={{ borderColor: accent, background: accent + "0d" }}>
            <RichTextRenderer html={slide.conclusion} />
          </div>
        </div>
      );
  }
}
